"""Cliente mínimo para observar el descubrimiento de un MCP remoto."""

import asyncio

from mcp import Client

CONTEXT7_URL = "https://mcp.context7.com/mcp"


async def main() -> None:
    # Client abre una conexión Streamable HTTP cuando recibe una URL.
    async with Client(CONTEXT7_URL) as client:
        tools = await client.list_tools()

        print("Tools descubiertas:")
        for tool in tools.tools:
            print(f"- {tool.name}: {tool.description or '(sin descripción)'}")

        # TODO(alumno): elegí una tool del catálogo e invocala con argumentos
        # válidos. Antes, inspeccioná tool.inputSchema para saber qué contrato usa.
        # result = await client.call_tool("nombre_de_la_tool", {"argumento": "valor"})
        # print(result.structured_content)


if __name__ == "__main__":
    asyncio.run(main())
