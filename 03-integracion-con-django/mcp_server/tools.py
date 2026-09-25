"""Tools: capacidades que el host puede pedir ejecutar.

TRABAJO DEL ALUMNO: implementar las dos functions de este módulo
delegando en el service layer (``activities.services``).
No exponer SQL, ORM ni views como parte del contrato MCP.
"""

from mcp.server import MCPServer

from activities.services import (
    Activity,
    ActivityFull,
    ActivityNotFound,
    AlreadyRegistered,
    InvalidEmail,
    get_activity_service,
)

MAX_QUERY_LENGTH = 100


def _as_dict(activity: Activity) -> dict[str, object]:
    """Convierte el DTO del service layer en un dict apto para MCP.

    Evita exponer el objeto ORM o el service layer como contrato.
    Campos: id, title, available, seats.
    """
    return {
        "id": activity.id,
        "title": activity.title,
        "available": activity.available,
        "seats": activity.seats,
    }


def _normalize_query(query: str) -> str:
    """Limpia la query: recorta y limita la longitud a MAX_QUERY_LENGTH."""
    return str(query or "").strip()[:MAX_QUERY_LENGTH]


def register_tools(mcp: MCPServer) -> None:
    @mcp.tool()
    def search_activities(query: str, only_available: bool = True) -> list[dict[str, object]]:
        """Busca actividades por título y, opcionalmente, sólo entre las disponibles."""
        service = get_activity_service()
        results = service.search(_normalize_query(query), only_available)
        return [_as_dict(activity) for activity in results]

    @mcp.tool()
    def register_for_activity(activity_id: str, student_email: str) -> dict[str, str]:
        """Inscribe a un estudiante en una actividad."""
        service = get_activity_service()
        try:
            return service.register(activity_id, student_email)
        except ActivityNotFound:
            return {
                "status": "activity_not_found",
                "message": f"no existe la actividad `{activity_id}`",
            }
        except InvalidEmail as error:
            return {"status": "invalid_email", "message": str(error)}
        except ActivityFull as error:
            return {"status": "activity_full", "message": str(error)}
        except AlreadyRegistered as error:
            return {"status": "already_registered", "message": str(error)}
