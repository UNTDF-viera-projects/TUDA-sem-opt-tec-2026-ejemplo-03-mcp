# 01 — Consumir un MCP externo

## Propósito

Usar MCP antes de implementarlo. El objetivo es observar qué ocurre cuando un host incorpora capacidades externas y distinguir las responsabilidades del usuario, modelo, host y servidor.

## Requisitos

- OpenCode instalado y con acceso a Internet.
- Una terminal en el proyecto donde se realizará la consulta.

## Actividad

1. Prepará el entorno y ejecutá el cliente de descubrimiento incluido:

   ```sh
   uv sync
   uv run python client.py
   ```

   El programa lista las tools que el servidor remoto declara, pero deja la
   invocación concreta como tarea para completar.
2. Incorporá Context7 en OpenCode. Podés copiar el contenido de
   `opencode.example.json` a tu configuración o ejecutar:

   ```sh
   opencode mcp add context7 --url https://mcp.context7.com/mcp
   opencode mcp list
   ```

3. Confirmá que `context7` aparece habilitado como remoto.
4. En OpenCode, hacé una consulta cuya respuesta necesite documentación actualizada de una biblioteca que uses en la materia. Por ejemplo: “¿Cómo se configura [biblioteca] para [tarea] según su documentación actual?”
5. Observá el intercambio: el pedido inicial, la selección de la capacidad, la llamada a la tool y el resultado que vuelve al contexto.

## Punto de control

Podés señalar, con evidencia de la sesión, estas cuatro partes:

1. El prompt de la persona.
2. La decisión del modelo de usar una capacidad MCP.
3. La ejecución de la tool por el host.
4. La respuesta final construida a partir del resultado.

## Entrega mínima

Un registro breve con el prompt usado, qué capacidad se invocó y una aclaración: el resultado de la tool aporta contexto, pero no reemplaza la verificación humana.

## Para pensar

- ¿Por qué el modelo no se conecta directamente con el sitio de documentación?
- ¿Qué diferencia hay entre que una tool esté disponible y que sea apropiado usarla?
