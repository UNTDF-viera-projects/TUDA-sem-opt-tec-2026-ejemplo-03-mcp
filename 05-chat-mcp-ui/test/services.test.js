import { test } from "node:test";
import assert from "node:assert/strict";
import { chatCompletion, completionUrl } from "../server/provider.js";
import { createWeatherService } from "../server/weather.js";
import { fakeWeatherFetch, weatherFixture, geoFixture } from "./fixtures.js";

const request = {
  token: "test-secret",
  baseUrl: "https://provider.example/v1/",
  model: "fixture",
  messages: [{ role: "user", content: "Hola" }],
  tools: [],
};
test("URL y request al proveedor: ruta, bearer, sin token en el body y sin redirects", async () => {
  await chatCompletion(request, {
    fetchImpl: async (url, options) => {
      assert.equal(url.href, "https://provider.example/v1/chat/completions");
      assert.equal(options.headers.Authorization, "Bearer test-secret");
      assert.doesNotMatch(options.body, /test-secret/);
      assert.equal(options.redirect, "error");
      assert.equal(Object.hasOwn(JSON.parse(options.body), "reasoning_effort"), false);
      return Response.json({
        choices: [{ message: { role: "assistant", content: "Hola" } }],
      });
    },
  });
  assert.throws(() => completionUrl("http://remote.example/v1"), /HTTPS/);
  assert.equal(
    completionUrl("http://127.0.0.1:11434/v1").pathname,
    "/v1/chat/completions",
  );
});
test("GPT-6 Luna envía reasoning_effort none en consultas con tools y en la respuesta final", async () => {
  const tools = [{
    type: "function",
    function: {
      name: "get_weather",
      parameters: {
        type: "object",
        properties: { city: { type: "string" } },
        required: ["city"],
      },
    },
  }];
  for (const toolChoice of ["auto", "none"]) {
    await chatCompletion({ ...request, model: " gpt-6-luna ", tools, toolChoice }, {
      fetchImpl: async (url, options) => {
        const payload = JSON.parse(options.body);
        assert.equal(payload.model, "gpt-6-luna");
        assert.equal(payload.reasoning_effort, "none");
        assert.equal(payload.tool_choice, toolChoice);
        assert.deepEqual(payload.tools, tools);
        return Response.json({
          choices: [{ message: { role: "assistant", content: "Hola" } }],
        });
      },
    });
  }
});
test("errores HTTP, formato incompatible y desconexión del proveedor son comprensibles", async () => {
  for (const [status, pattern] of [
    [401, /token/],
    [429, /límite de uso/],
    [400, /incompatible/],
    [502, /error/],
  ]) {
    await assert.rejects(
      chatCompletion(request, {
        fetchImpl: async () =>
          Response.json({ error: request.token }, { status }),
      }),
      pattern,
    );
  }
  await assert.rejects(
    chatCompletion(request, {
      fetchImpl: async () =>
        Response.json({ choices: [{ message: { content: "Invalid" } }] }),
    }),
    /compatible/,
  );
  await assert.rejects(
    chatCompletion(request, {
      fetchImpl: async () => {
        throw new Error(request.token);
      },
    }),
    /conectar/,
  );
});
test("timeouts del proveedor y del clima", async () => {
  const blockedFetch = (url, { signal }) =>
    new Promise((resolve, reject) =>
      signal.addEventListener("abort", () => reject(signal.reason), {
        once: true,
      }),
    );
  // Mantiene el event loop activo mientras AbortSignal.timeout dispara.
  const timer = setTimeout(() => {}, 1000);
  try {
    await assert.rejects(
      chatCompletion(request, { fetchImpl: blockedFetch, timeoutMs: 10 }),
      /tiempo de espera/,
    );
    await assert.rejects(
      createWeatherService({ fetchImpl: blockedFetch, timeoutMs: 10 })(
        "Ushuaia",
      ),
      /tiempo de espera/,
    );
  } finally {
    clearTimeout(timer);
  }
});
test("Open-Meteo recibe variables actuales, tres días, timezone auto y primera ubicación", async () => {
  const urls = [];
  const data = await createWeatherService({
    fetchImpl: async (url) => {
      urls.push(url);
      return fakeWeatherFetch(url);
    },
  })(" Ushuaia ");
  assert.equal(urls[0].searchParams.get("name"), "Ushuaia");
  assert.equal(urls[0].searchParams.get("count"), "1");
  assert.equal(urls[1].searchParams.get("forecast_days"), "3");
  assert.equal(urls[1].searchParams.get("timezone"), "auto");
  assert.match(urls[1].searchParams.get("current"), /apparent_temperature/);
  assert.equal(data.current.wind, 22.5);
  assert.equal(data.forecast[1].label, "Lluvia o llovizna");
});
test("fallos de Open-Meteo y datos incompletos", async () => {
  await assert.rejects(
    createWeatherService({
      fetchImpl: async () => Response.json({}, { status: 503 }),
    })("Ushuaia"),
    /Open-Meteo/,
  );
  await assert.rejects(
    createWeatherService({
      fetchImpl: async (url) =>
        Response.json(
          url.hostname.startsWith("geocoding")
            ? geoFixture
            : { ...weatherFixture, current: {} },
        ),
    })("Ushuaia"),
    /incompletos/,
  );
});
