import { readFile } from "node:fs/promises";
import { parseEnv } from "node:util";

export async function loadModelConfig({
  env = process.env,
  envFile = new URL("../.env.local", import.meta.url),
} = {}) {
  let localEnv = {};
  try {
    localEnv = parseEnv(await readFile(envFile, "utf8"));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  function value(name, alias) {
    return env[name] ?? env[alias] ?? localEnv[name] ?? localEnv[alias];
  }
  return {
    token: value("OPENAI_API_KEY", "OPEN_AI_KEY") || "",
    baseUrl:
      value("OPENAI_BASE_URL", "OPEN_AI_BASE_URL") ||
      "https://api.openai.com/v1",
    model: value("OPENAI_MODEL", "OPEN_AI_MODEL") || "",
  };
}
