"""Resources: contexto que el host puede leer mediante URIs.

TRABAJO DEL ALUMNO: implementar las dos funciones de este módulo
delegando en el service layer (``activities.services``).
No copiar queries del ORM ni reglas de negocio: usar ``get_activity_service()``.
"""

from mcp.server import MCPServer


def register_resources(mcp: MCPServer) -> None:
    @mcp.resource("activities://available")
    def available_activities() -> str:
        """Lista las actividades que todavía tienen cupo."""
        # TODO(alumno): usar get_activity_service().list_available() y
        # devolver el catálogo en Markdown. Manejar el caso vacío con:
        # "# Actividades disponibles\n\n_No hay actividades cargadas todavía._"
        # Formato sugerido por fila:
        # - **{title}** (`{id}`): {seats} cupos
        return "# Actividades disponibles\n\n_No hay actividades cargadas todavía._"

    @mcp.resource("activities://{activity_id}")
    def activity_detail(activity_id: str) -> str:
        """Devuelve el detalle legible de una actividad identificada por su URI."""
        # TODO(alumno): usar get_activity_service().get_activity(activity_id).
        # - Éxito: devolver Markdown con título, ID y cupos
        #   (ver activities/services.py para los campos del DTO).
        # - Si lanza ActivityNotFound: devolver una representación de error
        #   apta para el host, sin filtrar datos internos, por ejemplo:
        #   f"activity_not_found: no existe la actividad `{activity_id}`"
        _ = activity_id
        return f"activity_not_found: no existe la actividad `{activity_id}`"
