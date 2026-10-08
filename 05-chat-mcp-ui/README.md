# 05 — Chat con clima y MCP UI

## Propósito

Comparar una respuesta textual y una tarjeta meteorológica alimentadas por la **misma tool MCP**. El modelo decide cuándo consultar `get_weather(city)`; el host decide si también muestra su interfaz. Todo el proyecto está escrito en JavaScript.

## Instalación y ejecución

Requisitos: Node **22.12 o superior**, npm y un navegador moderno. Necesitás conexión a Internet para el proveedor del modelo y Open-Meteo.

```sh
cd 05-chat-mcp-ui
npm ci
npm run dev
```

Abrí **http://127.0.0.1:5173**. El comando inicia tres servicios, vinculados a loopback:

| Puerto | Servicio |
| --- | --- |
| 5173 | Frontend Vite; proxy de `/api` y `/mcp` al backend. |
| 3001 | Backend Node: `/api/chat` y servidor MCP Streamable HTTP `/mcp`. |
| 3002 | Sandbox de MCP Apps en un origen separado. |

Los puertos son fijos; deben estar disponibles. Para probar el build:

```sh
npm run build
npm start
```

Abrí **http://127.0.0.1:3001**. `npm start` sirve el frontend compilado y también inicia el sandbox.

## Configuración del modelo

Podés pre-rellenar los campos creando `.env.local` en la raíz de esta demo:

```dotenv
OPEN_AI_KEY=tu-token
OPEN_AI_BASE_URL=https://api.openai.com/v1
OPEN_AI_MODEL=nombre-del-modelo
```

También se admiten `OPENAI_API_KEY`, `OPENAI_BASE_URL` y `OPENAI_MODEL`. Las variables del entorno del proceso tienen prioridad sobre las del archivo; si se definen ambas variantes en la misma fuente, se usa la variante `OPENAI_`. Reiniciá el servidor después de cambiar `.env.local`. Funciona con `npm run dev` y `npm start`; el token se carga desde el backend local y no se incluye en el build del frontend. Sin archivo, el token y el modelo quedan vacíos y la URL base usa `https://api.openai.com/v1`.

Abrí **Configuración del modelo** para revisar o modificar:

- **API token**: credencial del proveedor, en un campo oculto.
- **URL base**: raíz de su API compatible con Chat Completions, por ejemplo `https://proveedor.example/v1`. El backend añade `/chat/completions`; no incluyas esa ruta, parámetros ni credenciales en la URL. Se admite HTTP para proveedores locales (`localhost`, `127.0.0.1`, `::1`).
- **Modelo**: identificador de un modelo que soporte `tools`, `tool_calls` y `tool_choice`.

Para GPT-6 Luna usá `OPEN_AI_MODEL=gpt-6-luna`. El backend envía automáticamente `reasoning_effort: "none"`, requerido para usar function calling con este modelo en Chat Completions según la [documentación oficial de OpenAI](https://developers.openai.com/api/docs/models/gpt-6-luna).

La configuración del formulario vive sólo en memoria. El token se envía al backend local en cada consulta; éste lo usa como Bearer al contactar al proveedor. La app no persiste los cambios del formulario en archivos ni en storage del navegador, historial del modelo, logs o resource UI. **Borrar token** lo quita del formulario; recargar la página borra la conversación y vuelve a cargar los valores del entorno. Reiniciar el chat conserva la configuración.

La consulta al proveedor puede consumir su cuota. No hace falta una clave meteorológica: `get_weather` usa las APIs públicas de [Open-Meteo](https://open-meteo.com/en/docs).

## Ejercicio comparativo

1. Con **MCP UI** activado (estado inicial), enviá «¿Cómo está el clima en Ushuaia?». Deberías ver la respuesta del modelo y una tarjeta con ubicación completa, condiciones actuales, temperatura, sensación térmica, humedad, viento y pronóstico de tres días.
2. Desactivá **MCP UI** y repetí la consulta. El modelo recibe el mismo catálogo y ejecuta la misma tool. Ese turno muestra texto y **no lee el resource ni carga el sandbox**.
3. Revisá las etiquetas **Con UI** y **Solo texto**. Cambiar el toggle no modifica respuestas anteriores. Si lo cambiás durante una consulta, esa consulta conserva el modo capturado al enviarla.
4. Expandí **Resultado MCP · get_weather** para comparar el texto de la tool con la respuesta del modelo. Las respuestas del modelo y los datos actuales pueden variar entre consultas.
5. Probá un nombre inexistente y reiniciá el chat. El reinicio cancela la consulta en curso y elimina su historial.

Para ciudades ambiguas se utiliza el primer resultado de geocodificación. Verificá la ubicación completa: no hay selección interactiva de ciudades. Las fechas y horas meteorológicas corresponden a la zona horaria devuelta por Open-Meteo.

## Cómo funciona

```text
React ── MCP /mcp ── tools/list
  │
  ├── /api/chat ── proveedor Chat Completions + catálogo descubierto
  │                  │
  │              tool_calls
  ├── MCP /mcp ── tools/call get_weather ── Open-Meteo
  ├── /api/chat ── resultado de tool ── respuesta final
  │
  └── sólo con UI: resources/read ui://weather/view.html
                      └── AppRenderer → iframe proxy :3002 → iframe de vista
                                          └── SDK App recibe toolResult
```

- `src/chat.js` descubre tools, ejecuta llamadas y devuelve sus resultados al modelo. Conserva el historial en memoria; permite cinco rondas de tools y una última consulta con `tool_choice: "none"`. Si el proveedor insiste en pedir tools, se detiene con un mensaje comprensible. Una ronda admite hasta ocho llamadas, ejecutadas en orden.
- `server/provider.js` hace el proxy sin persistencia ni streaming. Timeout de 45 segundos por consulta; nunca refleja errores crudos del proveedor.
- `server/mcp.js` registra tool y resource mediante el SDK de MCP Apps. El resource tiene MIME **`text/html;profile=mcp-app`** y está vinculado en **`_meta.ui.resourceUri`**. El transporte HTTP es stateless: acepta POST y responde JSON.
- `scripts/build-weather.js` empaqueta el SDK y la vista en un único HTML local, sin CDN. Se ejecuta antes de dev, build y pruebas. Si editás `weather/`, reiniciá `npm run dev` para volver a empaquetarlo.
- `src/WeatherCard.jsx` usa [AppRenderer de `@mcp-ui/client`](https://mcpui.dev/guide/client/app-renderer). El SDK `App` recibe el resultado estructurado por `ontoolresult`; la vista no consulta el clima por su cuenta.
- `sandbox/proxy.html` implementa dos iframes y comprueba los emisores de mensajes. El proxy está en otro origen; la vista interior permite scripts y tiene origen opaco. La CSP del servidor impide conexiones de red y recursos externos de la vista. La tarjeta sólo puede abrir el enlace de atribución a Open-Meteo.

Si falla la UI, se conservan la respuesta del modelo y el texto de la tool. Si falla el proveedor después de obtener el clima, se conservan esos resultados meteorológicos; el turno fallido no se agrega al historial que se enviará al modelo.

## Verificación

```sh
npm test
npm run build
npx playwright install chromium
npm run test:browser
```

Si ya tenés Chrome instalado, podés usar `PLAYWRIGHT_CHANNEL=chrome npm run test:browser`. Las pruebas de navegador usan los puertos 3001 y 3002, generan un build y arrancan fixtures aisladas; detené la demo antes de ejecutarlas.

`npm test` verifica descubrimiento MCP, contrato y MIME del resource, datos estructurados, ciclo de tool calling, límite de rondas, errores, timeouts y tratamiento del token. `test:browser` verifica el doble iframe, valores obtenidos por MCP, ausencia de lecturas UI con el toggle apagado, cambios de modo durante una consulta, reinicio, errores de tarjeta y diseño móvil. Proveedor y clima están simulados; no necesita token ni Internet durante estas pruebas (una vez instalados dependencias y navegador).

Para una prueba con proveedor real, iniciá la demo, completá tu credencial y modelo, y repetí el ejercicio comparativo. Esa comprobación requiere un token válido y no forma parte de las pruebas automatizadas.

## Punto de control

- `get_weather` aparece por descubrimiento MCP y devuelve texto más `structuredContent`.
- La tarjeta usa esos datos, sin credenciales del proveedor.
- El modo textual conserva la tool y evita la lectura del HTML UI.
- Turnos anteriores y consultas en curso conservan su modo original.
- Los errores de token, compatibilidad, ciudad, timeout y renderizado son visibles.

Demo local, sin persistencia, autenticación de usuarios ni streaming. La atribución a Open-Meteo aparece en el texto de la tool, en la tarjeta y en el pie del chat.
