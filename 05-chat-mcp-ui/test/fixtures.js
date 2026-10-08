export const modelConfigFixture = {
  token: "test-env-token",
  baseUrl: "https://provider.example/v1",
  model: "fixture",
};

export const geoFixture = {
  results: [
    {
      name: "Ushuaia",
      admin1: "Tierra del Fuego",
      country: "Argentina",
      latitude: -54.8,
      longitude: -68.3,
    },
  ],
};
export const weatherFixture = {
  timezone: "America/Argentina/Ushuaia",
  current: {
    time: "2026-10-02T15:00",
    temperature_2m: 7.2,
    apparent_temperature: 3.4,
    relative_humidity_2m: 76,
    wind_speed_10m: 22.5,
    weather_code: 3,
    is_day: 1,
  },
  daily: {
    time: ["2026-10-02", "2026-10-03", "2026-10-04"],
    weather_code: [3, 61, 0],
    temperature_2m_min: [2, 1, 3],
    temperature_2m_max: [8, 7, 10],
    precipitation_probability_max: [10, 80, 0],
  },
};
export function fakeWeatherFetch(url) {
  if (url.hostname === "geocoding-api.open-meteo.com")
    return Promise.resolve(
      Response.json(
        url.searchParams.get("name") === "Inexistente" ? {} : geoFixture,
      ),
    );
  return Promise.resolve(Response.json(weatherFixture));
}
export function toolMessage(id = "call-weather", city = "Ushuaia") {
  return {
    role: "assistant",
    content: null,
    tool_calls: [
      {
        id,
        type: "function",
        function: { name: "get_weather", arguments: JSON.stringify({ city }) },
      },
    ],
  };
}
export async function fakeProviderFetch(url, options) {
  const { messages, model } = JSON.parse(options.body);
  if (options.headers.Authorization === "Bearer invalid")
    return Response.json(
      { error: "sensitive upstream error" },
      { status: 401 },
    );
  if (model === "incompatible") return Response.json({}, { status: 400 });
  if (model === "lento")
    await new Promise((resolve) => setTimeout(resolve, 650));
  const last = messages.at(-1);
  const assistant =
    last.role === "tool"
      ? {
          role: "assistant",
          content: JSON.parse(last.content).isError
            ? JSON.parse(last.content).content[0].text
            : "En Ushuaia, Tierra del Fuego, Argentina hay 7.2 °C y está nublado. Sensación térmica: 3.4 °C, humedad: 76 %, viento: 22.5 km/h. Fuente: Open-Meteo.",
        }
      : toolMessage(
          `call-${messages.length}`,
          last.content.includes("Inexistente") ? "Inexistente" : "Ushuaia",
        );
  return Response.json({ choices: [{ message: assistant }] });
}
