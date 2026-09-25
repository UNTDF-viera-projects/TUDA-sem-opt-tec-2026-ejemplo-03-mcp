"""Prompts: flujos guiados reutilizables que el host puede invocar.

TRABAJO DEL ALUMNO: implementar el prompt de este módulo.
A diferencia de un resource (contexto legible) o una tool (acción que el
modelo decide ejecutar), un prompt empaqueta un flujo completo en mensajes
listos para el modelo: qué resources/tools usar y en qué orden.
No copia reglas de negocio: sólo orquesta las capacidades ya expuestas.
"""

from mcp.server import MCPServer


def register_prompts(mcp: MCPServer) -> None:
    @mcp.prompt(
        description="Guía al estudiante paso a paso: explorar, elegir e inscribirse en una actividad."
    )
    def guia_inscripcion(query: str = "", student_email: str = "") -> list[dict[str, object]]:
        """Flujo guiado de inscripción a actividades.

        Args:
            query: tema o palabra clave de interés (ej. "robótica").
                Vacío = mostrar todo el catálogo.
            student_email: correo del estudiante, si ya se conoce.
                Vacío = el modelo debe pedirlo antes de inscribir.
        """
        query = (query or "").strip()
        student_email = (student_email or "").strip()

        contexto = "Che, quiero inscribirme a una actividad de la UNTDF."
        if query:
            contexto += f' Mi tema de interés es "{query}".'
        else:
            contexto += " Quiero ver todo el catálogo."
        if student_email:
            contexto += f" Mi email es {student_email}."

        instrucciones = "\n".join(
            [
                "Dale, te guío paso a paso para explorar, elegir e inscribirte. Seguí este orden:",
                "",
                "1. Leé el resource `activities://available` para mostrar el catálogo inicial de actividades con cupo.",
                f"2. Usá la tool `search_activities` con `query=\"{query}\"` y `only_available=True` para afinar la búsqueda"
                + (" según el interés del estudiante." if query else " (si no hay tema, mostrá todo el catálogo)."),
                "3. Cuando el estudiante elija una candidata, leé el resource template `activities://{activity_id}` con su ID para mostrarle título, descripción y cupos.",
                "4. Antes de inscribir, pedí confirmación explícita ('¿Confirmás la inscripción a X?')"
                + (
                    f" El email ya conocido es {student_email}, confirmalo igual."
                    if student_email
                    else " y pedí el `student_email` si todavía no lo tenés (es obligatorio para inscribir)."
                ),
                "5. Recién con confirmación + email, llamá a la tool `register_for_activity` con `activity_id` y `student_email`.",
                "6. Comunicá el resultado de forma clara: si es `registered`, celebralo con el ID; si es `activity_full`, `already_registered`, `invalid_email` o `activity_not_found`, explicá qué pasó y ofrecé alternativas del catálogo.",
                "",
                "Importante: vos no inscribís por tu cuenta, sólo orquestás estos resources y tools. No inventes actividades ni IDs.",
            ]
        )
        return [
            {"role": "user", "content": contexto},
            {"role": "assistant", "content": instrucciones},
        ]
