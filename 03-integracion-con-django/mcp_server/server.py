"""Punto de entrada del servidor MCP para el proyecto Django."""

from mcp.server import MCPServer

from mcp_server.prompts import register_prompts
from mcp_server.resources import register_resources
from mcp_server.tools import register_tools

mcp = MCPServer("Actividades UNTDF")
register_resources(mcp)
register_tools(mcp)
register_prompts(mcp)


if __name__ == "__main__":
    # TODO(alumno): si el servidor vive fuera de manage.py, inicializá Django
    # antes de importar modelos o servicios que dependan del ORM.
    mcp.run()
