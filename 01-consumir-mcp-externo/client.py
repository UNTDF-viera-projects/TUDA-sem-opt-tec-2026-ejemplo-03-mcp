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
            # Inspección del contrato: qué argumentos válidos acepta cada tool.
            print(f"  inputSchema: {tool.input_schema}")
            print(f" ################ #########################")

        # Resolución del TODO(alumno): flujo en 2 pasos que exige Context7.
        # 1) resolve-library-id: convierte "FastAPI" en un ID compatible.
        print("\n1) Invocando resolve-library-id...")
        resolve_result = await client.call_tool(
            "resolve-library-id",
            {
                "libraryName": "FastAPI",
                "query": "how to define query parameters with validation",
            },
        )
        resolve_text = "\n".join(
            block.text for block in resolve_result.content if hasattr(block, "text")
        )
        print(resolve_text[:2000])

        # El ID elegido es el de mayor reputación/snippets del catálogo.
        library_id = "/websites/fastapi_tiangolo"
        if library_id not in resolve_text:
            # Fallback: extraer el primer ID mencionado en la respuesta.
            import re

            match = re.search(r"/[A-Za-z0-9_.\-/]+", resolve_text)
            if match:
                library_id = match.group(0)
        print(f"\nLibrary ID seleccionado: {library_id}")

        # 2) query-docs: pide documentación actualizada con ese ID.
        print("\n2) Invocando query-docs...")
        docs_result = await client.call_tool(
            "query-docs",
            {
                "libraryId": library_id,
                "query": "How to define query parameters with validation",
            },
        )
        docs_text = "\n".join(
            block.text for block in docs_result.content if hasattr(block, "text")
        )
        # structured_content viene None en este servidor; el contenido real
        # viaja en content[0].text, por eso lo imprimimos recortado.
        print(docs_text[:3000])


if __name__ == "__main__":
    asyncio.run(main())
