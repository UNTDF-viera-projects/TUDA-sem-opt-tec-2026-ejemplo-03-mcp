export const SYSTEM_MESSAGE = {
  role: "system",
  content:
    "Respondé en español. Para consultar el clima usá get_weather; no inventes datos. Indicá la ubicación completa elegida por la tool y citá Open-Meteo. Si la tool falla, explicá su error. Respondé también consultas generales. No mencionés tarjetas ni modos de interfaz: el host decide cómo mostrar el resultado.",
};

export function resultText(result) {
  return (result.content ?? [])
    .filter((c) => c.type === "text")
    .map((c) => c.text)
    .join("\n");
}

// El toggle no forma parte del prompt ni altera las tools ofrecidas al modelo.
export async function runChatTurn({
  client,
  complete,
  history,
  prompt,
  signal,
  onStatus = () => {},
}) {
  const messages = [...history, { role: "user", content: prompt }];
  const executions = [];
  try {
    onStatus("Descubriendo tools por MCP…");
    const { tools: catalog } = await client.listTools({}, { signal });
    const tools = catalog.map((t) => ({
      type: "function",
      function: {
        name: t.name,
        description: t.description,
        parameters: t.inputSchema,
      },
    }));
    for (let round = 0; round <= 5; round++) {
      signal?.throwIfAborted();
      onStatus(
        round
          ? "Preparando respuesta con los resultados…"
          : "Consultando al modelo…",
      );
      const assistant = await complete(
        { messages, tools, toolChoice: round === 5 ? "none" : "auto" },
        signal,
      );
      if (!assistant.tool_calls?.length) {
        messages.push(assistant);
        return {
          messages,
          answer: assistant.content,
          executions,
          warning:
            round === 5 ? "Se alcanzó el límite de cinco rondas de tools." : "",
        };
      }
      if (round === 5) {
        const answer =
          "Se alcanzó el límite de cinco rondas de tools. Probá con una consulta más específica.";
        messages.push({ role: "assistant", content: answer });
        return { messages, answer, executions, warning: answer };
      }
      messages.push(assistant);
      for (const call of assistant.tool_calls) {
        const tool = catalog.find((t) => t.name === call.function.name);
        let input;
        let result;
        try {
          if (!tool)
            throw new Error(
              "El modelo solicitó una tool que no está disponible.",
            );
          input = JSON.parse(call.function.arguments);
          if (!input || typeof input !== "object" || Array.isArray(input))
            throw new Error("Argumentos inválidos enviados por el modelo.");
          onStatus(`Ejecutando ${tool.name} por MCP…`);
          result = await client.callTool(
            { name: tool.name, arguments: input },
            undefined,
            { signal, timeout: 30000 },
          );
        } catch (error) {
          signal?.throwIfAborted();
          result = {
            isError: true,
            content: [
              {
                type: "text",
                text:
                  error instanceof SyntaxError
                    ? "El modelo envió argumentos JSON inválidos."
                    : error.message,
              },
            ],
          };
        }
        executions.push({
          id: call.id,
          name: call.function.name,
          input,
          result,
          resourceUri: tool?._meta?.ui?.resourceUri,
        });
        messages.push({
          role: "tool",
          tool_call_id: call.id,
          content: JSON.stringify({
            content: result.content,
            structuredContent: result.structuredContent,
            isError: result.isError ?? false,
          }),
        });
      }
    }
  } catch (error) {
    // Conserva los resultados meteorológicos aunque falle la respuesta final del modelo.
    error.executions = executions;
    throw error;
  }
}

export async function requestCompletion(config, payload, signal) {
  let response;
  try {
    response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...config, ...payload }),
      signal: AbortSignal.any([signal, AbortSignal.timeout(55000)]),
    });
  } catch (error) {
    signal.throwIfAborted();
    throw new Error(
      error.name === "TimeoutError"
        ? "La consulta agotó el tiempo de espera. Intentá nuevamente."
        : "No se pudo conectar al backend local. Verificá que npm run dev esté activo.",
    );
  }
  const data = await response.json();
  if (!response.ok)
    throw new Error(data.error ?? "No se pudo consultar el modelo.");
  return data.message;
}
