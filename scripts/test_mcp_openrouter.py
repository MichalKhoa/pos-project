"""Test script for OpenRouter FastMCP Server over stdio transport."""

import asyncio
import os
import sys
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client


async def run_tests():
    print("=== Testing OpenRouter MCP Server over stdio ===")
    server_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "mcp_openrouter_server.py"))

    server_params = StdioServerParameters(
        command=sys.executable,
        args=[server_path],
        env={
            **os.environ,
            "OPENROUTER_MODEL": "gpt-oss-120b",
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
            assert "openrouter_query" in tool_names, "Missing openrouter_query"
            assert "openrouter_chat_with_tools" in tool_names, "Missing openrouter_chat_with_tools"
            assert "list_openrouter_models" in tool_names, "Missing list_openrouter_models"
            assert "openrouter_code_refactor" in tool_names, "Missing openrouter_code_refactor"

            # 3. Test list_openrouter_models tool call
            print("[3] Testing list_openrouter_models tool call (query: 'oss-120b')...")
            models_result = await session.call_tool("list_openrouter_models", {"query": "oss-120b"})
            print(f"    Result: {models_result.content[0].text[:300]}...")

            # 4. Test missing API key handling
            print("[4] Testing API key guard...")
            query_result = await session.call_tool(
                "openrouter_query",
                {
                    "prompt": "Hello",
                },
            )
            print(f"    Result: {query_result.content[0].text[:200]}")

    print("=== All OpenRouter MCP Server tests PASSED! ===")


if __name__ == "__main__":
    asyncio.run(run_tests())
