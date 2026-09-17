"""Servidor base para experimentar tools y esquemas generados por el SDK."""

from mcp.server import MCPServer

mcp = MCPServer("Laboratorio MCP mínimo")


@mcp.tool()
def health() -> dict[str, str]:
    """Indica que el proceso fue descubierto y puede responder."""
    return {"status": "ok", "message": "El servidor base está activo."}


@mcp.tool()
def add(a: int, b: int) -> int:
    """Suma dos números enteros."""
    # TODO(alumno): implementá la operación sin cambiar el contrato.
    # Después probá con valores válidos e inválidos en MCP Inspector.
    raise NotImplementedError("Implementar la suma como parte de la actividad.")


if __name__ == "__main__":
    # stdio es el transporte local por defecto; Inspector inicia este archivo
    # como subproceso y se comunica por sus streams.
    mcp.run()
