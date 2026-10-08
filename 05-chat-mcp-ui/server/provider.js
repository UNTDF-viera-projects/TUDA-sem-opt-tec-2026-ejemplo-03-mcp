export class ChatError extends Error {
  constructor(message, status = 502) {
    super(message);
    this.status = status;
  }
}

export function completionUrl(baseUrl) {
  let url;
  try {
    url = new URL(baseUrl);
  } catch {
    throw new ChatError("La URL base no es válida.", 400);
  }
  if (
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    !(
      url.protocol === "https:" ||
      (url.protocol === "http:" &&
        ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname))
    )
  ) {
    throw new ChatError(
      "Usá una URL HTTPS, o HTTP para un proveedor local, sin credenciales ni parámetros.",
      400,
    );
  }
  url.pathname = `${url.pathname.replace(/\/$/, "")}/chat/completions`;
  return url;
}

export async function chatCompletion(
  body,
  { fetchImpl = fetch, timeoutMs = 45000, signal } = {},
) {
  const {
    token,
    baseUrl,
    model,
    messages,
    tools,
    toolChoice = "auto",
  } = body ?? {};
  if (
    typeof token !== "string" ||
    !token.trim() ||
    token.length > 8192 ||
    /[\r\n]/.test(token)
  )
    throw new ChatError("Ingresá un API token válido en Configuración.", 400);
  if (typeof model !== "string" || !model.trim() || model.length > 200)
    throw new ChatError("Ingresá el nombre del modelo.", 400);
  if (
    !Array.isArray(messages) ||
    !messages.length ||
    messages.length > 200 ||
    !Array.isArray(tools) ||
    !["auto", "none"].includes(toolChoice)
  ) {
    throw new ChatError(
      "La conversación no es válida o es demasiado larga. Reiniciá el chat.",
      400,
    );
  }
  const url = completionUrl(baseUrl);
  let response;
  try {
    response = await fetchImpl(url, {
      method: "POST",
      redirect: "error",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token.trim()}`,
      },
      body: JSON.stringify({
        model: model.trim(),
        // GPT-6 Luna requiere razonamiento desactivado para tools en Chat Completions.
        ...(model.trim() === "gpt-6-luna" ? { reasoning_effort: "none" } : {}),
        messages,
        tools,
        tool_choice: toolChoice,
        stream: false,
      }),
      signal: AbortSignal.any([
        signal ?? new AbortController().signal,
        AbortSignal.timeout(timeoutMs),
      ]),
    });
  } catch (error) {
    if (error.name === "TimeoutError" || error.name === "AbortError")
      throw new ChatError(
        "El proveedor agotó el tiempo de espera. Intentá nuevamente.",
        504,
      );
    throw new ChatError(
      "No se pudo conectar al proveedor. Revisá la URL base y tu conexión.",
    );
  }
  // Nunca reenviar errores crudos del proveedor: pueden incluir el token o el request.
  if ([401, 403].includes(response.status))
    throw new ChatError(
      "El proveedor rechazó el token. Revisá el token y sus permisos.",
      401,
    );
  if (response.status === 429)
    throw new ChatError(
      "El proveedor alcanzó su límite de uso. Esperá unos minutos o revisá tu cuota.",
      429,
    );
  if ([400, 404, 422].includes(response.status))
    throw new ChatError(
      "Proveedor o modelo incompatible. Verificá la URL base, el modelo y el soporte de Chat Completions con tool calling.",
      400,
    );
  if (!response.ok)
    throw new ChatError("El proveedor devolvió un error. Intentá nuevamente.");
  let data;
  try {
    data = await response.json();
  } catch (error) {
    if (error.name === "TimeoutError" || error.name === "AbortError")
      throw new ChatError(
        "El proveedor agotó el tiempo de espera. Intentá nuevamente.",
        504,
      );
    throw new ChatError(
      "El proveedor no devolvió JSON compatible con Chat Completions.",
    );
  }
  const message = data?.choices?.[0]?.message;
  if (
    !message ||
    message.role !== "assistant" ||
    (message.content != null && typeof message.content !== "string") ||
    (message.tool_calls != null &&
      (!Array.isArray(message.tool_calls) ||
        message.tool_calls.length > 8 ||
        !message.tool_calls.every(
          (c) =>
            c?.type === "function" &&
            typeof c.id === "string" &&
            c.id &&
            typeof c.function?.name === "string" &&
            typeof c.function.arguments === "string",
        ))) ||
    (!message.content && !message.tool_calls?.length)
  ) {
    throw new ChatError(
      "El proveedor no devolvió una respuesta compatible con Chat Completions y tool calling.",
    );
  }
  return {
    role: "assistant",
    content: message.content ?? null,
    ...(message.tool_calls?.length ? { tool_calls: message.tool_calls } : {}),
  };
}
