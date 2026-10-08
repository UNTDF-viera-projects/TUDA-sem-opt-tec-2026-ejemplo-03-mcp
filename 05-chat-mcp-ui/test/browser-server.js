// Fixtures aisladas: nunca se activan desde el servidor de la demo.
import "../scripts/build-weather.js";
import { createBackend, createSandbox, listen } from "../server/app.js";
import { createWeatherService } from "../server/weather.js";
import { fakeWeatherFetch, fakeProviderFetch, modelConfigFixture } from "./fixtures.js";

const backend = await listen(
  await createBackend({
    modelConfig: modelConfigFixture,
    weatherService: createWeatherService({ fetchImpl: fakeWeatherFetch }),
    providerOptions: { fetchImpl: fakeProviderFetch },
  }),
  3001,
);
const sandbox = await listen(await createSandbox(), 3002);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => {
    backend.close();
    sandbox.close();
    backend.closeAllConnections();
    sandbox.closeAllConnections();
  });
