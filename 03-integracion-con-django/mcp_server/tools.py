"""Tools: capacidades que el host puede pedir ejecutar.

TRABAJO DEL ALUMNO: implementar las dos functions de este módulo
delegando en el service layer (``activities.services``).
No exponer SQL, ORM ni views como parte del contrato MCP.
"""

from mcp.server import MCPServer


def _as_dict(activity: object) -> dict[str, object]:
    """Convierte el DTO del service layer en un dict apto para MCP.

    Evita exponer el objeto ORM o el service layer como contrato.
    Campos: id, title, available, seats.
    """
    # TODO(alumno): completar a partir del DTO de activities/services.py
    # (id, title, available, seats). Pista: activity.id, activity.title, ...
    return {
        "id": activity.id,  # type: ignore[attr-defined]
        "title": activity.title,  # type: ignore[attr-defined]
        "available": activity.available,  # type: ignore[attr-defined]
        "seats": activity.seats,  # type: ignore[attr-defined]
    }


def register_tools(mcp: MCPServer) -> None:
    @mcp.tool()
    def search_activities(query: str, only_available: bool = True) -> list[dict[str, object]]:
        """Busca actividades por título y, opcionalmente, sólo entre las disponibles."""
        # TODO(alumno): definir límites de longitud y normalización de query,
        # luego delegar en get_activity_service().search(query, only_available)
        # y devolver [_as_dict(a) for a in results].
        _ = (query, only_available)
        return []

    @mcp.tool()
    def register_for_activity(activity_id: str, student_email: str) -> dict[str, str]:
        """Inscribe a un estudiante en una actividad."""
        # TODO(alumno): delegar en get_activity_service().register(activity_id,
        # student_email) y mapear el resultado / errores a dicts:
        # - Éxito: {"status": "registered", "activity_id": ..., "student_email": ...}
        #   (lo que ya devuelve el servicio).
        # - ActivityNotFound -> {"status": "activity_not_found", "message": ...}
        # - InvalidEmail -> {"status": "invalid_email", "message": ...}
        # - ActivityFull -> {"status": "activity_full", "message": ...}
        # - AlreadyRegistered -> {"status": "already_registered", "message": ...}
        # No dejar el `not_implemented`: es sólo el marcador inicial.
        _ = (activity_id, student_email)
        return {"status": "not_implemented", "message": "Inscripción no implementada todavía."}
