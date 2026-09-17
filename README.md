# Laboratorio MCP

Este material acompaña la parte práctica de la presentación sobre Model Context Protocol (MCP). Las etapas están ordenadas para aislar las dificultades: primero usamos MCP como consumidores; luego construimos e inspeccionamos un servidor pequeño; después lo conectamos con el dominio Django; finalmente revisamos seguridad y calidad de diseño.

| Etapa | Foco | Resultado esperado |
| --- | --- | --- |
| 01 | Consumir un MCP remoto | Reconocer el ciclo prompt → tool call → respuesta. |
| 02 | Servidor mínimo e Inspector | Exponer y probar una tool sin depender de un modelo. |
| 03 | Adaptador para Django | Ofrecer resources y tools sobre servicios ya existentes. |
| 04 | Seguridad y cierre | Delimitar permisos, validar entradas y explicar las decisiones. |

Cada carpeta incluye requisitos, consignas, puntos de control, una entrega mínima y una base de código. Cada base tiene su propio `pyproject.toml`: desde su carpeta se prepara con `uv sync`. Los `TODO(alumno)` señalan decisiones que se deben implementar durante la práctica, no errores accidentales.

No se debe avanzar si el punto de control de la etapa previa todavía falla.
