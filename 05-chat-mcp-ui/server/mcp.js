import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  registerAppTool,
  registerAppResource,
  RESOURCE_MIME_TYPE,
} from "@modelcontextprotocol/ext-apps/server";
import { z } from "zod";
import { createWeatherService, weatherText } from "./weather.js";

export const WEATHER_URI = "ui://weather/view.html";
export { RESOURCE_MIME_TYPE };

export function createWeatherMcp({
  weatherService = createWeatherService(),
  resourceHtml,
} = {}) {
  const server = new McpServer({ name: "demo-05-weather", version: "1.0.0" });
  registerAppTool(
    server,
    "get_weather",
    {
      title: "Consultar clima",
      description:
        "Clima actual y pronóstico de tres días para una ciudad. Usa el primer resultado de Open-Meteo y devuelve su ubicación completa.",
      inputSchema: {
        city: z
          .string()
          .trim()
          .min(2)
          .max(120)
          .describe("Nombre de la ciudad, por ejemplo Ushuaia"),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: true,
      },
      _meta: { ui: { resourceUri: WEATHER_URI } },
    },
    async ({ city }, extra) => {
      try {
        const data = await weatherService(city, extra.signal);
        return {
          content: [{ type: "text", text: weatherText(data) }],
          structuredContent: data,
        };
      } catch (error) {
        return {
          isError: true,
          content: [{ type: "text", text: error.message }],
        };
      }
    },
  );
  registerAppResource(
    server,
    "weather-view",
    WEATHER_URI,
    {
      description:
        "Tarjeta del clima alimentada por el resultado de get_weather.",
      _meta: {
        ui: {
          csp: { connectDomains: [], resourceDomains: [] },
          prefersBorder: false,
        },
      },
    },
    async () => ({
      contents: [
        {
          uri: WEATHER_URI,
          mimeType: RESOURCE_MIME_TYPE,
          text: resourceHtml,
          _meta: {
            ui: {
              csp: { connectDomains: [], resourceDomains: [] },
              prefersBorder: false,
            },
          },
        },
      ],
    }),
  );
  return server;
}
