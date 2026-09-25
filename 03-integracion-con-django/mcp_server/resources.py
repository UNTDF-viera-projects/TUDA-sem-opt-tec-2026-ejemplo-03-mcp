"""Resources: contexto que el host puede leer mediante URIs.

TRABAJO DEL ALUMNO: implementar las dos funciones de este módulo
delegando en el service layer (``activities.services``).
No copiar queries del ORM ni reglas de negocio: usar ``get_activity_service()``.
"""

from mcp.server import MCPServer

from activities.services import ActivityNotFound, get_activity_service


def register_resources(mcp: MCPServer) -> None:
    @mcp.resource("activities://available")
    def available_activities() -> str:
        """Lista las actividades que todavía tienen cupo."""
        service = get_activity_service()
        activities = service.list_available()

        if not activities:
            return "# Actividades disponibles\n\n_No hay actividades cargadas todavía._"

        lines = ["# Actividades disponibles", ""]
        for activity in activities:
            lines.append(f"- **{activity.title}** (`{activity.id}`): {activity.seats} cupos")
        return "\n".join(lines)

    @mcp.resource("activities://{activity_id}")
    def activity_detail(activity_id: str) -> str:
        """Devuelve el detalle legible de una actividad identificada por su URI."""
        service = get_activity_service()
        try:
            activity = service.get_activity(activity_id)
        except ActivityNotFound:
            return f"activity_not_found: no existe la actividad `{activity_id}`"

        estado = "Disponible" if activity.available else "No disponible"
        return "\n".join(
            [
                f"# {activity.title}",
                "",
                f"- ID: `{activity.id}`",
                f"- Descripción: {activity.description}",
                f"- Cupos: {activity.seats} de {activity.capacity}",
                f"- Estado: {estado}",
            ]
        )
