"""Test script for Ollama FastMCP Server over stdio transport."""

import asyncio
import os
import sys
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client


async def run_tests():
    print("=== Testing Ollama MCP Server over stdio ===")
    server_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "mcp_ollama_server.py"))
    
    server_params = StdioServerParameters(
        command=sys.executable,
        args=[server_path],
        env={
            **os.environ,
            "OLLAMA_HOST": "http://127.0.0.1:11434",
            "OLLAMA_MODEL": "qwen2.5:7b",  # Use locally pulled model for live execution test
        },
    )

    async with stdio_client(server_params) as (read_stream, write_stream):
        async with ClientSession(read_stream, write_stream) as session:
            # 1. Initialize
            print("[1] Initializing MCP Session...")
            init_res = await session.initialize()
            print(f"    Server Info: {init_res.serverInfo}")

            # 2. List tools
            print("[2] Listing Available Tools...")
            tools_res = await session.list_tools()
            tool_names = [t.name for t in tools_res.tools]
            print(f"    Discovered {len(tools_res.tools)} tools: {tool_names}")
            assert "list_local_models" in tool_names, "Missing list_local_models"
            assert "ollama_quick_query" in tool_names, "Missing ollama_quick_query"
            assert "ollama_chat_with_tools" in tool_names, "Missing ollama_chat_with_tools"

            # 3. Test list_local_models
            print("[3] Testing list_local_models tool call...")
            models_result = await session.call_tool("list_local_models", {})
            print(f"    Result: {models_result.content[0].text[:300]}...")

            # 4. Test ollama_quick_query
            print("[4] Testing ollama_quick_query tool call...")
            query_result = await session.call_tool(
                "ollama_quick_query",
                {
                    "prompt": "Return JSON: {\"city\": \"Prague\", \"country\": \"Czech Republic\"}",
                    "json_format": True,
                    "temperature": 0.1,
                },
            )
            print(f"    Result: {query_result.content[0].text}")

            # 5. Test ollama_chat_with_tools
            print("[5] Testing ollama_chat_with_tools tool call...")
            tool_call_result = await session.call_tool(
                "ollama_chat_with_tools",
                {
                    "prompt": "Check the temperature in Tokyo.",
                    "tools": [
                        {
                            "name": "get_weather",
                            "description": "Get current weather for location",
                            "parameters": {
                                "type": "object",
                                "properties": {
                                    "location": {"type": "string", "description": "City name"}
                                },
                                "required": ["location"],
                            },
                        }
                    ],
                },
            )
            # 6. Test missing model error handling
            print("[6] Testing missing model error handling...")
            missing_model_res = await session.call_tool(
                "ollama_quick_query",
                {
                    "prompt": "Hello",
                    "model": "non_existent_model:99b",
                },
            )
            print(f"    Result: {missing_model_res.content[0].text}")
            assert "not found in Ollama" in missing_model_res.content[0].text, "Missing model error handling failed"

    print("=== All Ollama MCP Server tests PASSED! ===")


if __name__ == "__main__":
    asyncio.run(run_tests())
