# Laboratorio MCP

Este material acompaña la parte práctica de la presentación sobre Model Context Protocol (MCP). Las etapas están ordenadas para aislar las dificultades: primero usamos MCP como consumidores; luego construimos e inspeccionamos un servidor pequeño; después lo conectamos con el dominio Django; revisamos seguridad y calidad de diseño; y exploramos interfaces dentro de un chat con MCP Apps.

| Etapa | Foco | Resultado esperado |
| --- | --- | --- |
| 01 | Consumir un MCP remoto | Reconocer el ciclo prompt → tool call → respuesta. |
| 02 | Servidor mínimo e Inspector | Exponer y probar una tool sin depender de un modelo. |
| 03 | Adaptador para Django | Ofrecer resources y tools sobre servicios ya existentes. |
| 04 | Seguridad y cierre | Delimitar permisos, validar entradas y explicar las decisiones. |
| [05](05-chat-mcp-ui/README.md) | Chat con clima y MCP UI | Comparar texto y tarjetas meteorológicas usando la misma tool MCP. |

Las etapas 01–04 incluyen requisitos, consignas, puntos de control, una entrega mínima y una base de código. Cada base tiene su propio `pyproject.toml`: desde su carpeta se prepara con `uv sync`. Los `TODO(alumno)` señalan decisiones que se deben implementar durante la práctica, no errores accidentales. La etapa 05 es una demo independiente en JavaScript con Vite, React y Node: se prepara con `npm ci` y se ejecuta con `npm run dev` desde su carpeta.

No se debe avanzar si el punto de control de la etapa previa todavía falla.
