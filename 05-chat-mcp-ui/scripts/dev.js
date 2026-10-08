import "./build-weather.js";
import { spawn } from "node:child_process";
import { createServer } from "vite";

const backend = spawn(process.execPath, ["--watch", "server/index.js"], {
  stdio: "inherit",
});
const vite = await createServer();
await vite.listen();
vite.printUrls();
let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  backend.kill("SIGTERM");
  await vite.close();
}
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, stop);
backend.on("exit", async (code) => {
  await stop();
  process.exitCode = code ?? 0;
});
