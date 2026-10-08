import { createBackend, createSandbox, listen } from "./app.js";

const backend = await listen(await createBackend(), 3001);
const sandbox = await listen(await createSandbox(), 3002);
console.log(
  "Backend y MCP: http://127.0.0.1:3001 — Sandbox: http://127.0.0.1:3002",
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => {
    backend.close();
    sandbox.close();
    backend.closeAllConnections();
    sandbox.closeAllConnections();
  });
