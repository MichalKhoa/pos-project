"""Model Context Protocol (MCP) server bridging Antigravity with OpenRouter models (including gpt-oss-120b)."""

import json
import os
import sys
from typing import Any, Dict, List, Optional, Union
import httpx
from mcp.server.fastmcp import FastMCP
from pydantic import BaseModel, Field

OPENROUTER_BASE_URL = os.getenv("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1").rstrip("/")
DEFAULT_MODEL = os.getenv("OPENROUTER_MODEL", "gpt-oss-120b")
REQUEST_TIMEOUT = float(os.getenv("OPENROUTER_TIMEOUT", "180.0"))

mcp = FastMCP("openrouter-bridge", dependencies=["httpx", "pydantic", "mcp"])


def _get_api_key() -> Optional[str]:
    """Retrieve OpenRouter API key from environment."""
    return os.getenv("OPENROUTER_API_KEY")


def _get_auth_headers() -> Dict[str, str]:
    """Build OpenRouter authorization headers."""
    api_key = _get_api_key() or ""
    return {
        "Authorization": f"Bearer {api_key}",
        "HTTP-Referer": "https://antigravity.google.com",
        "X-Title": "Antigravity VoltFlow POS Agent",
        "Content-Type": "application/json",
    }


@mcp.tool()
async def openrouter_query(
    prompt: str,
    system_prompt: Optional[str] = None,
    model: Optional[str] = None,
    json_format: bool = False,
    temperature: float = 0.7,
    max_tokens: Optional[int] = 8192,
) -> Dict[str, Any]:
    """Execute a query or code synthesis prompt using OpenRouter (e.g. gpt-oss-120b).

    Args:
        prompt: The main user prompt, task instruction, or code context to analyze.
        system_prompt: Optional system prompt instructing role, rules, or output constraints.
        model: OpenRouter model identifier. Defaults to configured OPENROUTER_MODEL (e.g. 'gpt-oss-120b').
        json_format: If true, requests JSON mode from the model backend.
        temperature: Sampling temperature between 0.0 (deterministic) and 1.0 (creative). Default is 0.7.
        max_tokens: Maximum tokens to generate (up to 131072 for gpt-oss-120b). Default is 8192.

    Returns:
        Dictionary with status, model used, generated content, parsed JSON if requested, and token usage metrics.
    """
    api_key = _get_api_key()
    if not api_key:
        return {
            "status": "error",
            "error": "OPENROUTER_API_KEY environment variable is not set. Please configure it in .env or MCP config.",
        }

    target_model = model or DEFAULT_MODEL
    messages: List[Dict[str, str]] = []
    if system_prompt:
        messages.append({"role": "system", "content": system_prompt})
    messages.append({"role": "user", "content": prompt})

    payload: Dict[str, Any] = {
        "model": target_model,
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens,
    }
    if json_format:
        payload["response_format"] = {"type": "json_object"}

    async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT) as client:
        try:
            res = await client.post(
                f"{OPENROUTER_BASE_URL}/chat/completions",
                headers=_get_auth_headers(),
                json=payload,
            )

            if res.status_code != 200:
                return {
                    "status": "error",
                    "error": f"OpenRouter API error HTTP {res.status_code}: {res.text}",
                }

            data = res.json()
            choices = data.get("choices", [])
            if not choices:
                return {"status": "error", "error": "No response choices returned by OpenRouter", "raw": data}

            choice = choices[0]
            msg = choice.get("message", {})
            content = msg.get("content", "")

            parsed_json = None
            if json_format and content:
                try:
                    parsed_json = json.loads(content)
                except Exception:
                    pass

            usage = data.get("usage", {})

            return {
                "status": "success",
                "model": data.get("model", target_model),
                "content": content,
                "json_data": parsed_json,
                "finish_reason": choice.get("finish_reason"),
                "usage": {
                    "prompt_tokens": usage.get("prompt_tokens", 0),
                    "completion_tokens": usage.get("completion_tokens", 0),
                    "total_tokens": usage.get("total_tokens", 0),
                },
            }

        except httpx.TimeoutException:
            return {
                "status": "error",
                "error": f"Request to OpenRouter timed out after {REQUEST_TIMEOUT}s.",
            }
        except Exception as exc:
            return {"status": "error", "error": f"Error running OpenRouter query: {exc}"}


@mcp.tool()
async def openrouter_chat_with_tools(
    prompt: str,
    tools: Union[List[Dict[str, Any]], str],
    system_prompt: Optional[str] = None,
    model: Optional[str] = None,
    temperature: float = 0.0,
    max_tokens: Optional[int] = 8192,
) -> Dict[str, Any]:
    """Execute a chat query against OpenRouter with native function calling / tool definitions.

    Args:
        prompt: User message requesting action, reasoning, or tool use.
        tools: List of tool schema objects (or JSON string). Each item should follow OpenAI function schema:
               {'type': 'function', 'function': {'name': '...', 'description': '...', 'parameters': {...}}}.
        system_prompt: Optional system instructions for tool calling.
        model: OpenRouter model identifier (default: 'gpt-oss-120b').
        temperature: Sampling temperature (0.0 recommended for precise tool calling).
        max_tokens: Maximum tokens to generate.

    Returns:
        Dictionary containing extracted tool calls with parsed arguments or direct content.
    """
    api_key = _get_api_key()
    if not api_key:
        return {
            "status": "error",
            "error": "OPENROUTER_API_KEY environment variable is not set.",
        }

    target_model = model or DEFAULT_MODEL

    # Normalize tools input if passed as serialized JSON string
    parsed_tools: List[Dict[str, Any]] = []
    if isinstance(tools, str):
        try:
            parsed = json.loads(tools)
            parsed_tools = parsed if isinstance(parsed, list) else [parsed]
        except Exception as exc:
            return {"status": "error", "error": f"Invalid JSON in tools argument: {exc}"}
    elif isinstance(tools, list):
        parsed_tools = tools
    else:
        return {"status": "error", "error": "Tools argument must be a list of schemas or a JSON string"}

    normalized_tools: List[Dict[str, Any]] = []
    for tool_item in parsed_tools:
        if isinstance(tool_item, dict):
            if "type" in tool_item and "function" in tool_item:
                normalized_tools.append(tool_item)
            elif "name" in tool_item:
                normalized_tools.append({"type": "function", "function": tool_item})
            elif "function" in tool_item:
                normalized_tools.append({"type": "function", "function": tool_item["function"]})

    messages: List[Dict[str, str]] = []
    if system_prompt:
        messages.append({"role": "system", "content": system_prompt})
    messages.append({"role": "user", "content": prompt})

    payload: Dict[str, Any] = {
        "model": target_model,
        "messages": messages,
        "tools": normalized_tools,
        "temperature": temperature,
        "max_tokens": max_tokens,
    }

    async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT) as client:
        try:
            res = await client.post(
                f"{OPENROUTER_BASE_URL}/chat/completions",
                headers=_get_auth_headers(),
                json=payload,
            )

            if res.status_code != 200:
                return {
                    "status": "error",
                    "error": f"OpenRouter API error HTTP {res.status_code}: {res.text}",
                }

            data = res.json()
            choices = data.get("choices", [])
            if not choices:
                return {"status": "error", "error": "No response choices returned by OpenRouter"}

            choice = choices[0]
            message = choice.get("message", {})
            raw_tool_calls = message.get("tool_calls", [])

            extracted_calls: List[Dict[str, Any]] = []
            for tc in raw_tool_calls:
                fn = tc.get("function", {})
                args = fn.get("arguments", {})
                if isinstance(args, str):
                    try:
                        args = json.loads(args)
                    except Exception:
                        pass
                extracted_calls.append(
                    {
                        "name": fn.get("name", ""),
                        "arguments": args,
                        "raw_tool_call": tc,
                    }
                )

            usage = data.get("usage", {})

            return {
                "status": "success",
                "model": data.get("model", target_model),
                "has_tool_calls": len(extracted_calls) > 0,
                "tool_calls": extracted_calls,
                "content": message.get("content"),
                "finish_reason": choice.get("finish_reason"),
                "usage": {
                    "prompt_tokens": usage.get("prompt_tokens", 0),
                    "completion_tokens": usage.get("completion_tokens", 0),
                    "total_tokens": usage.get("total_tokens", 0),
                },
            }

        except httpx.TimeoutException:
            return {
                "status": "error",
                "error": f"Request to OpenRouter timed out after {REQUEST_TIMEOUT}s.",
            }
        except Exception as exc:
            return {"status": "error", "error": f"Error running OpenRouter tool chat: {exc}"}


@mcp.tool()
async def list_openrouter_models(query: Optional[str] = None) -> Dict[str, Any]:
    """List and search available models on OpenRouter, including context limits and pricing.

    Args:
        query: Optional substring to filter models by name or slug (e.g. 'oss-120b', 'gpt-4o', 'claude').

    Returns:
        List of matching models with context length, pricing, and descriptions.
    """
    async with httpx.AsyncClient(timeout=15.0) as client:
        try:
            res = await client.get(f"{OPENROUTER_BASE_URL}/models")
            if res.status_code != 200:
                return {
                    "status": "error",
                    "error": f"Failed to fetch OpenRouter models: HTTP {res.status_code} - {res.text}",
                }

            data = res.json()
            models = data.get("data", [])

            filtered: List[Dict[str, Any]] = []
            q = query.lower() if query else None

            for m in models:
                mid = m.get("id", "")
                mname = m.get("name", "")
                if q and (q not in mid.lower() and q not in mname.lower()):
                    continue

                pricing = m.get("pricing", {})
                filtered.append(
                    {
                        "id": mid,
                        "name": mname,
                        "context_length": m.get("context_length", 0),
                        "prompt_price_per_m": round(float(pricing.get("prompt", 0)) * 1_000_000, 4),
                        "completion_price_per_m": round(float(pricing.get("completion", 0)) * 1_000_000, 4),
                        "description": m.get("description", "")[:200],
                    }
                )

            return {
                "status": "success",
                "default_model": DEFAULT_MODEL,
                "total_matched": len(filtered),
                "models": filtered[:50],  # Return top 50 matches
            }
        except Exception as exc:
            return {"status": "error", "error": f"Error listing OpenRouter models: {exc}"}


@mcp.tool()
async def openrouter_code_refactor(
    instruction: str,
    code: str,
    language: Optional[str] = "javascript",
    model: Optional[str] = None,
) -> Dict[str, Any]:
    """Execute high-capacity surgical code refactoring or test generation via OpenRouter gpt-oss-120b.

    Args:
        instruction: Refactoring instructions, changes required, or invariants to uphold.
        code: The source code to refactor or analyze.
        language: Programming language (e.g. 'javascript', 'python', 'rust', 'html').
        model: OpenRouter model to use (default: 'gpt-oss-120b').

    Returns:
        Structured result containing the refactored code and explanation.
    """
    system_prompt = (
        f"You are an expert {language} refactoring engineer. Follow instructions strictly. "
        "Return high-precision code matching the style and invariants. "
        "Keep changes surgical. Do not output conversational filler."
    )
    prompt = f"### INSTRUCTION\n{instruction}\n\n### SOURCE CODE ({language})\n```{language}\n{code}\n```"

    return await openrouter_query(
        prompt=prompt,
        system_prompt=system_prompt,
        model=model or DEFAULT_MODEL,
        temperature=0.2,
    )


if __name__ == "__main__":
    mcp.run()
