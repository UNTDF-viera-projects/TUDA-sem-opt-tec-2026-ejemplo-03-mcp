import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { createBackend, listen } from "../server/app.js";
import { createWeatherService } from "../server/weather.js";
import { WEATHER_URI, RESOURCE_MIME_TYPE } from "../server/mcp.js";
import { runChatTurn, SYSTEM_MESSAGE, resultText } from "../src/chat.js";
import {
  fakeWeatherFetch,
  fakeProviderFetch,
  toolMessage,
  modelConfigFixture,
} from "./fixtures.js";

let server, base, client;
before(async () => {
  server = await listen(
    await createBackend({
      modelConfig: modelConfigFixture,
      weatherService: createWeatherService({ fetchImpl: fakeWeatherFetch }),
      providerOptions: { fetchImpl: fakeProviderFetch },
    }),
    0,
  );
  base = `http://127.0.0.1:${server.address().port}`;
  client = new Client(
    { name: "test", version: "1" },
    {
      capabilities: {
        extensions: {
          "io.modelcontextprotocol/ui": { mimeTypes: [RESOURCE_MIME_TYPE] },
        },
      },
    },
  );
  await client.connect(
    new StreamableHTTPClientTransport(new URL("/mcp", base)),
  );
});
after(async () => {
  await client?.close();
  server?.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
});

test("configuración inicial expone los tres campos sin caché y rechaza otros orígenes", async () => {
  const response = await fetch(`${base}/api/config`);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.deepEqual(await response.json(), modelConfigFixture);
  const forbidden = await fetch(`${base}/api/config`, {
    headers: { Origin: "https://untrusted.example" },
  });
  assert.equal(forbidden.status, 403);
  assert.doesNotMatch(await forbidden.text(), /test-env-token/);
});

test("Streamable HTTP descubre get_weather, su metadata UI y el resource empaquetado", async () => {
  const { tools } = await client.listTools();
  assert.equal(tools.length, 1);
  assert.equal(tools[0].name, "get_weather");
  assert.equal(tools[0]._meta.ui.resourceUri, WEATHER_URI);
  assert.deepEqual(tools[0].inputSchema.required, ["city"]);
  const { resources } = await client.listResources();
  assert.equal(resources[0].mimeType, "text/html;profile=mcp-app");
  const { contents } = await client.readResource({ uri: WEATHER_URI });
  assert.equal(contents[0].mimeType, RESOURCE_MIME_TYPE);
  assert.match(contents[0].text, /weather-rendered/);
  assert.doesNotMatch(contents[0].text, /APP_SCRIPT|type="module"|Bearer/);
  assert.deepEqual(contents[0]._meta.ui.csp.connectDomains, []);
});

test("get_weather devuelve texto y datos estructurados reales del servicio inyectado", async () => {
  const result = await client.callTool({
    name: "get_weather",
    arguments: { city: "Ushuaia" },
  });
  assert.equal(result.structuredContent.current.temperature, 7.2);
  assert.equal(result.structuredContent.forecast.length, 3);
  assert.equal(
    result.structuredContent.location.label,
    "Ushuaia, Tierra del Fuego, Argentina",
  );
  assert.match(resultText(result), /7.2 °C/);
});

test("ciudad inexistente y argumentos inválidos son errores de tool", async () => {
  const missing = await client.callTool({
    name: "get_weather",
    arguments: { city: "Inexistente" },
  });
  assert.equal(missing.isError, true);
  assert.match(resultText(missing), /No encontramos/);
  const invalid = await client.callTool({
    name: "get_weather",
    arguments: { city: "" },
  });
  assert.equal(invalid.isError, true);
});

test("ciclo completo: catálogo MCP → proveedor → tool MCP → respuesta final, sin leer UI", async () => {
  let reads = 0;
  const countedClient = {
    listTools: client.listTools.bind(client),
    callTool: client.callTool.bind(client),
    readResource: () => {
      reads++;
    },
  };
  const requests = [];
  const complete = async (payload) => {
    requests.push(structuredClone(payload));
    const response = await fetch(`${base}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token: "test-token",
        baseUrl: "https://provider.example/v1",
        model: "fixture",
        ...payload,
      }),
    });
    assert.equal(response.status, 200);
    return (await response.json()).message;
  };
  const result = await runChatTurn({
    client: countedClient,
    complete,
    history: [SYSTEM_MESSAGE],
    prompt: "Clima en Ushuaia",
  });
  assert.equal(requests.length, 2);
  assert.equal(requests[0].tools[0].function.name, "get_weather");
  assert.equal(requests[1].messages.at(-1).role, "tool");
  assert.match(
    requests[1].messages.find((m) => m.role === "tool").content,
    /7.2/,
  );
  assert.match(result.answer, /7.2 °C/);
  assert.equal(result.executions[0].resourceUri, WEATHER_URI);
  assert.equal(reads, 0);
});

test("cinco rondas como máximo, sexta consulta fuerza tool_choice none", async () => {
  let calls = 0;
  const choices = [];
  const result = await runChatTurn({
    client: {
      listTools: client.listTools.bind(client),
      callTool: async () => {
        calls++;
        return { content: [{ type: "text", text: "ok" }] };
      },
    },
    complete: async ({ toolChoice }) => {
      choices.push(toolChoice);
      return toolMessage(`call-${choices.length}`);
    },
    history: [SYSTEM_MESSAGE],
    prompt: "Clima",
  });
  assert.equal(calls, 5);
  assert.equal(choices.length, 6);
  assert.equal(choices.at(-1), "none");
  assert.match(result.warning, /cinco rondas/);
  assert.equal(result.messages.at(-1).tool_calls, undefined);
});

test("errores de tool vuelven al modelo; JSON inválido no invoca MCP", async () => {
  let calls = 0;
  let requests = 0;
  const result = await runChatTurn({
    client: {
      listTools: client.listTools.bind(client),
      callTool: async () => {
        calls++;
      },
    },
    complete: async ({ messages }) => {
      if (requests++ === 0) {
        const message = toolMessage();
        message.tool_calls[0].function.arguments = "{";
        return message;
      }
      assert.match(messages.at(-1).content, /JSON inválidos/);
      return { role: "assistant", content: "No se pudo consultar el clima." };
    },
    history: [SYSTEM_MESSAGE],
    prompt: "Clima",
  });
  assert.equal(calls, 0);
  assert.equal(result.executions[0].result.isError, true);
});

test("conserva datos obtenidos si falla el proveedor al generar la respuesta final", async () => {
  let calls = 0;
  await assert.rejects(
    runChatTurn({
      client,
      complete: async () => {
        if (calls++ === 0) return toolMessage();
        throw new Error("Proveedor no disponible");
      },
      history: [SYSTEM_MESSAGE],
      prompt: "Clima",
    }),
    (error) => {
      assert.equal(
        error.executions[0].result.structuredContent.current.temperature,
        7.2,
      );
      return true;
    },
  );
});

test("proxy devuelve token inválido e incompatibilidad sin reflejar secretos", async () => {
  for (const [token, model, status, pattern] of [
    ["invalid", "fixture", 401, /rechazó el token/],
    ["test-secret", "incompatible", 400, /incompatible/],
  ]) {
    const response = await fetch(`${base}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token,
        model,
        baseUrl: "https://provider.example/v1",
        messages: [SYSTEM_MESSAGE],
        tools: [],
      }),
    });
    assert.equal(response.status, status);
    const text = await response.text();
    assert.match(text, pattern);
    assert.doesNotMatch(text, /sensitive upstream|test-secret/);
  }
});

test("el backend rechaza solicitudes cross-origin", async () => {
  const response = await fetch(`${base}/api/chat`, {
    method: "POST",
    headers: {
      Origin: "https://untrusted.example",
      "Content-Type": "application/json",
    },
    body: "{}",
  });
  assert.equal(response.status, 403);
});
