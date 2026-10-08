import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadModelConfig } from "../server/config.js";

test("lee .env.local, admite nombres compatibles y prioriza el entorno", async () => {
  const directory = await mkdtemp(join(tmpdir(), "chat-model-config-"));
  const envFile = join(directory, ".env.local");
  try {
    await writeFile(envFile, [
      '# Configuración local',
      'OPEN_AI_KEY="local-token"',
      'OPEN_AI_BASE_URL=https://local.example/v1',
      "OPEN_AI_MODEL='local-model'",
    ].join("\n"));
    assert.deepEqual(await loadModelConfig({ env: {}, envFile }), {
      token: "local-token",
      baseUrl: "https://local.example/v1",
      model: "local-model",
    });
    assert.deepEqual(await loadModelConfig({
      env: {
        OPENAI_API_KEY: "process-token",
        OPENAI_BASE_URL: "https://process.example/v1",
        OPENAI_MODEL: "process-model",
      },
      envFile,
    }), {
      token: "process-token",
      baseUrl: "https://process.example/v1",
      model: "process-model",
    });
    const override = await loadModelConfig({ env: { OPEN_AI_KEY: "override" }, envFile });
    assert.equal(override.token, "override");
    assert.equal(override.model, "local-model");
    await writeFile(envFile, "OPENAI_API_KEY=file-token\nOPENAI_MODEL=file-model\n");
    assert.equal((await loadModelConfig({ env: { OPEN_AI_KEY: "process-alias" }, envFile })).token, "process-alias");
    await writeFile(envFile, "OPEN_AI_KEY=only-token\n");
    assert.deepEqual(await loadModelConfig({ env: {}, envFile }), {
      token: "only-token",
      baseUrl: "https://api.openai.com/v1",
      model: "",
    });
    assert.deepEqual(await loadModelConfig({ env: {}, envFile: join(directory, "missing") }), {
      token: "",
      baseUrl: "https://api.openai.com/v1",
      model: "",
    });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
