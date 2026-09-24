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
        # TODO(alumno): devolver una lista de mensajes {"role": ..., "content": ...}
        # que guíe al modelo por este flujo, usando las capacidades del servidor:
        #   1. Leer el resource `activities://available` para el catálogo inicial.
        #   2. Usar la tool `search_activities` con `query` para afinar
        #      (recordar `only_available=True` por defecto).
        #   3. Leer el resource template `activities://{activity_id}` para el
        #      detalle de la candidata elegida.
        #   4. Pedir confirmación explícita y el `student_email` si falta.
        #   5. Usar la tool `register_for_activity` y comunicar el resultado,
        #      incluyendo los casos de error (cupo lleno, ya inscripto,
        #      email inválido, actividad inexistente).
        # El prompt NO llama al service layer ni inscribe directamente:
        # sólo devuelve mensajes. Incluí `query` y `student_email` en el texto
        # cuando vengan dados. Mantené el tono en español rioplatense.
        _ = (query, student_email)
        return [
            {
                "role": "user",
                "content": "TODO(alumno): reemplazar por el flujo guiado de inscripción.",
            }
        ]
