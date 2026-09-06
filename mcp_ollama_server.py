"""Model Context Protocol (MCP) server bridging Antigravity with local Ollama inference."""

import json
import os
import sys
from typing import Any, Dict, List, Optional, Union
import httpx
from mcp.server.fastmcp import FastMCP
from pydantic import BaseModel, Field

OLLAMA_HOST = os.getenv("OLLAMA_HOST", "http://127.0.0.1:11434").rstrip("/")
DEFAULT_MODEL = os.getenv("OLLAMA_MODEL", "qwen3:8b")
REQUEST_TIMEOUT = float(os.getenv("OLLAMA_TIMEOUT", "120.0"))

mcp = FastMCP("ollama-bridge", dependencies=["httpx", "pydantic", "mcp"])


class ModelInfo(BaseModel):
    name: str = Field(description="Name of the model tag, e.g. qwen3:8b")
    size_mb: float = Field(description="Model size in megabytes")
    parameter_size: Optional[str] = Field(default=None, description="Parameter size, e.g. 7.6B or 8.0B")
    family: Optional[str] = Field(default=None, description="Architecture family")
    capabilities: List[str] = Field(default_factory=list, description="Model capabilities (completion, tools, etc.)")


class ToolCallItem(BaseModel):
    name: str = Field(description="Name of the called tool function")
    arguments: Dict[str, Any] = Field(default_factory=dict, description="Parsed arguments passed to the tool function")


class ChatWithToolsResponse(BaseModel):
    model: str = Field(description="Model used for the inference")
    tool_calls: List[ToolCallItem] = Field(default_factory=list, description="List of structured tool calls emitted by model")
    content: Optional[str] = Field(default=None, description="Direct textual response from model if no tool was invoked")
    raw_response: Optional[Dict[str, Any]] = Field(default=None, description="Full raw response from Ollama")


async def _check_ollama_health(client: httpx.AsyncClient) -> Optional[str]:
    """Check if Ollama server is reachable."""
    try:
        res = await client.get(f"{OLLAMA_HOST}/api/version")
        if res.status_code == 200:
            return None
        return f"Ollama returned HTTP status {res.status_code}"
    except httpx.ConnectError:
        return f"Cannot connect to Ollama at {OLLAMA_HOST}. Ensure Ollama daemon is running ('ollama serve')."
    except Exception as exc:
        return f"Ollama connection error: {exc}"


async def _get_installed_model_names(client: httpx.AsyncClient) -> List[str]:
    """Retrieve list of model names currently installed in local Ollama."""
    try:
        res = await client.get(f"{OLLAMA_HOST}/api/tags")
        if res.status_code == 200:
            data = res.json()
            return [m.get("name", "") for m in data.get("models", [])]
    except Exception:
        pass
    return []


@mcp.tool()
async def list_local_models() -> Dict[str, Any]:
    """List all models currently installed and available in the local Ollama instance.

    Returns:
        Dictionary containing available model details and current default model.
    """
    async with httpx.AsyncClient(timeout=10.0) as client:
        health_err = await _check_ollama_health(client)
        if health_err:
            return {"status": "error", "error": health_err, "models": []}

        try:
            res = await client.get(f"{OLLAMA_HOST}/api/tags")
            if res.status_code != 200:
                return {
                    "status": "error",
                    "error": f"Failed to fetch tags: HTTP {res.status_code} - {res.text}",
                    "models": [],
                }

            data = res.json()
            raw_models = data.get("models", [])
            parsed_models: List[Dict[str, Any]] = []

            for item in raw_models:
                details = item.get("details", {})
                size_bytes = item.get("size", 0)
                parsed_models.append(
                    {
                        "name": item.get("name"),
                        "size_mb": round(size_bytes / (1024 * 1024), 2),
                        "parameter_size": details.get("parameter_size"),
                        "family": details.get("family"),
                        "quantization_level": details.get("quantization_level"),
                        "capabilities": item.get("capabilities", []),
                    }
                )

            return {
                "status": "success",
                "default_model": DEFAULT_MODEL,
                "ollama_host": OLLAMA_HOST,
                "total_models": len(parsed_models),
                "models": parsed_models,
            }
        except Exception as exc:
            return {"status": "error", "error": f"Unexpected error reading models: {exc}", "models": []}


@mcp.tool()
async def ollama_quick_query(
    prompt: str,
    system_prompt: Optional[str] = None,
    model: Optional[str] = None,
    json_format: bool = False,
    temperature: float = 0.7,
) -> Dict[str, Any]:
    """Execute a fast prompt or zero-shot extraction using a local Ollama model.

    Args:
        prompt: The main user prompt or content to analyze.
        system_prompt: Optional system instruction (e.g. extraction rules, persona).
        model: Model tag to use. Defaults to configured OLLAMA_MODEL (e.g. qwen3:8b or qwen2.5:7b).
        json_format: If true, forces the Ollama backend to constrain output to valid JSON format.
        temperature: Sampling temperature between 0.0 (deterministic) and 1.0 (creative). Default is 0.7.

    Returns:
        Structured result with model response content, timing, and status.
    """
    target_model = model or DEFAULT_MODEL
    messages: List[Dict[str, str]] = []
    if system_prompt:
        messages.append({"role": "system", "content": system_prompt})
    messages.append({"role": "user", "content": prompt})

    payload: Dict[str, Any] = {
        "model": target_model,
        "messages": messages,
        "stream": False,
        "options": {"temperature": temperature},
    }
    if json_format:
        payload["format"] = "json"

    async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT) as client:
        health_err = await _check_ollama_health(client)
        if health_err:
            return {"status": "error", "error": health_err}

        try:
            res = await client.post(f"{OLLAMA_HOST}/api/chat", json=payload)
            if res.status_code == 404:
                installed = await _get_installed_model_names(client)
                return {
                    "status": "error",
                    "error": (
                        f"Model '{target_model}' not found in Ollama. "
                        f"Installed models: {installed}. "
                        f"Run 'ollama pull {target_model}' to install."
                    ),
                }

            if res.status_code != 200:
                return {
                    "status": "error",
                    "error": f"Ollama API error HTTP {res.status_code}: {res.text}",
                }

            data = res.json()
            msg = data.get("message", {})
            content = msg.get("content", "")

            parsed_json = None
            if json_format and content:
                try:
                    parsed_json = json.loads(content)
                except Exception:
                    pass

            return {
                "status": "success",
                "model": data.get("model", target_model),
                "content": content,
                "json_data": parsed_json,
                "done_reason": data.get("done_reason"),
                "total_duration_ms": round(data.get("total_duration", 0) / 1_000_000, 2),
            }

        except httpx.TimeoutException:
            return {
                "status": "error",
                "error": f"Request to Ollama timed out after {REQUEST_TIMEOUT}s.",
            }
        except Exception as exc:
            return {"status": "error", "error": f"Error running query: {exc}"}


@mcp.tool()
async def ollama_chat_with_tools(
    prompt: str,
    tools: Union[List[Dict[str, Any]], str],
    system_prompt: Optional[str] = None,
    model: Optional[str] = None,
    temperature: float = 0.0,
) -> Dict[str, Any]:
    """Execute a chat query against local Ollama with native function/tool definitions.

    Args:
        prompt: User message requesting action or data.
        tools: List of tool schema objects (or JSON string). Each item should follow OpenAI/Ollama function calling schema:
               {'type': 'function', 'function': {'name': 'foo', 'description': '...', 'parameters': {...}}}.
               If passing a plain function dictionary, it will be automatically wrapped.
        system_prompt: Optional system prompt instructing tool usage.
        model: Model tag to use. Defaults to configured OLLAMA_MODEL (e.g. qwen3:8b or qwen2.5:7b).
        temperature: Sampling temperature (0.0 recommended for precise tool calling).

    Returns:
        Dictionary containing extracted tool calls with parsed arguments or text response.
    """
    target_model = model or DEFAULT_MODEL

    # Normalize tools input if given as serialized JSON string
    parsed_tools: List[Dict[str, Any]] = []
    if isinstance(tools, str):
        try:
            parsed = json.loads(tools)
            parsed_tools = parsed if isinstance(parsed, list) else [parsed]
        except Exception as exc:
            return {"status": "error", "error": f"Invalid JSON passed in tools argument: {exc}"}
    elif isinstance(tools, list):
        parsed_tools = tools
    else:
        return {"status": "error", "error": "Tools argument must be a list of schemas or a JSON string"}

    # Wrap bare function schemas in {'type': 'function', 'function': ...} if needed
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
        "stream": False,
        "options": {"temperature": temperature},
    }

    async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT) as client:
        health_err = await _check_ollama_health(client)
        if health_err:
            return {"status": "error", "error": health_err}

        try:
            res = await client.post(f"{OLLAMA_HOST}/api/chat", json=payload)
            if res.status_code == 404:
                installed = await _get_installed_model_names(client)
                return {
                    "status": "error",
                    "error": (
                        f"Model '{target_model}' not found in Ollama. "
                        f"Installed models: {installed}. "
                        f"Run 'ollama pull {target_model}' to install."
                    ),
                }

            if res.status_code != 200:
                return {
                    "status": "error",
                    "error": f"Ollama API error HTTP {res.status_code}: {res.text}",
                }

            data = res.json()
            message = data.get("message", {})
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

            return {
                "status": "success",
                "model": data.get("model", target_model),
                "has_tool_calls": len(extracted_calls) > 0,
                "tool_calls": extracted_calls,
                "content": message.get("content"),
                "done_reason": data.get("done_reason"),
                "total_duration_ms": round(data.get("total_duration", 0) / 1_000_000, 2),
            }

        except httpx.TimeoutException:
            return {
                "status": "error",
                "error": f"Request to Ollama timed out after {REQUEST_TIMEOUT}s.",
            }
        except Exception as exc:
            return {"status": "error", "error": f"Error running tool chat: {exc}"}


if __name__ == "__main__":
    mcp.run()
