import express from "express";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createMcpExpressApp } from "@modelcontextprotocol/sdk/server/express.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createWeatherMcp } from "./mcp.js";
import { chatCompletion, ChatError } from "./provider.js";
import { loadModelConfig } from "./config.js";

export const root = fileURLToPath(new URL("../", import.meta.url));
const hostOrigins = [
  "http://127.0.0.1:5173",
  "http://localhost:5173",
  "http://127.0.0.1:3001",
  "http://localhost:3001",
];

export async function createBackend({
  weatherService,
  providerOptions,
  resourceHtml,
  modelConfig,
  allowedOrigins = hostOrigins,
} = {}) {
  modelConfig ??= await loadModelConfig();
  resourceHtml ??= await readFile(
    new URL("../dist-weather/view.html", import.meta.url),
    "utf8",
  );
  const app = createMcpExpressApp({ host: "127.0.0.1" });
  app.disable("x-powered-by");
  app.use((req, res, next) => {
    res.set("Cache-Control", "no-store");
    if (req.headers.origin && !allowedOrigins.includes(req.headers.origin))
      return res.status(403).json({ error: "Origen no permitido." });
    next();
  });
  app.get("/api/health", (req, res) => res.json({ ok: true }));
  app.get("/api/config", (req, res) => res.json(modelConfig));
  app.post("/api/chat", async (req, res) => {
    const controller = new AbortController();
    res.on("close", () => {
      if (!res.writableEnded) controller.abort();
    });
    try {
      const message = await chatCompletion(req.body, {
        ...providerOptions,
        signal: controller.signal,
      });
      res.json({ message });
    } catch (error) {
      if (!res.destroyed)
        res
          .status(error instanceof ChatError ? error.status : 500)
          .json({
            error:
              error instanceof ChatError
                ? error.message
                : "No se pudo completar la consulta.",
          });
    }
  });
  app.post("/mcp", async (req, res) => {
    const server = createWeatherMcp({ weatherService, resourceHtml });
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
    res.on("close", () => {
      void transport.close();
      void server.close();
    });
    try {
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch {
      if (!res.headersSent)
        res
          .status(500)
          .json({
            jsonrpc: "2.0",
            id: null,
            error: {
              code: -32603,
              message: "No se pudo procesar la solicitud MCP.",
            },
          });
    }
  });
  app.all("/mcp", (req, res) =>
    res
      .status(405)
      .json({
        jsonrpc: "2.0",
        id: null,
        error: {
          code: -32000,
          message: "Este servidor MCP es stateless y utiliza POST.",
        },
      }),
  );
  app.use(express.static(`${root}dist`));
  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    res
      .status(error.status === 413 ? 413 : 400)
      .json({
        error:
          error.status === 413
            ? "La conversación es demasiado larga. Reiniciá el chat."
            : "La solicitud no contiene JSON válido.",
      });
  });
  return app;
}

export async function createSandbox({ allowedOrigins = hostOrigins } = {}) {
  const html = await readFile(
    new URL("../sandbox/proxy.html", import.meta.url),
    "utf8",
  );
  const app = createMcpExpressApp({ host: "127.0.0.1" });
  app.disable("x-powered-by");
  app.get("/sandbox_proxy.html", (req, res) => {
    if (!allowedOrigins.includes(req.query.hostOrigin))
      return res.status(403).send("Origen del host no permitido.");
    res
      .set({
        "Content-Security-Policy": `default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; frame-src 'self'; connect-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors ${allowedOrigins.join(" ")}`,
        "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      })
      .type("html")
      .send(html);
  });
  return app;
}

export function listen(app, port) {
  return new Promise((resolve, reject) => {
    const server = app.listen(port, "127.0.0.1", (error) =>
      error ? reject(error) : resolve(server),
    );
    server.on("error", reject);
  });
}
