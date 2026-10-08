import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { UI_EXTENSION_CAPABILITIES } from "@mcp-ui/client";

export async function connectMcp() {
  const client = new Client(
    { name: "demo-05-chat", version: "1.0.0" },
    { capabilities: { extensions: UI_EXTENSION_CAPABILITIES } },
  );
  try {
    await client.connect(
      new StreamableHTTPClientTransport(new URL("/mcp", location.origin)),
    );
    return client;
  } catch {
    await client.close();
    throw new Error(
      "No se pudo conectar al servidor MCP. Verificá que npm run dev esté activo.",
    );
  }
}
