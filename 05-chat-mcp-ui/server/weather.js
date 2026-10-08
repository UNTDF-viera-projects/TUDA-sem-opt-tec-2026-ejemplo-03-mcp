export function condition(code, isDay = true) {
  if (code === 0) return { label: "Despejado", icon: isDay ? "☀️" : "🌙" };
  if (code === 3) return { label: "Nublado", icon: "☁️" };
  if (code === 1 || code === 2)
    return { label: "Parcialmente nublado", icon: "⛅" };
  if ([45, 48].includes(code)) return { label: "Niebla", icon: "🌫️" };
  if ([71, 73, 75, 77, 85, 86].includes(code))
    return { label: "Nieve", icon: "🌨️" };
  if (code >= 95) return { label: "Tormenta", icon: "⛈️" };
  if (code >= 51 && code <= 82)
    return { label: "Lluvia o llovizna", icon: "🌧️" };
  return { label: "Condiciones desconocidas", icon: "🌡️" };
}

async function weatherJson(url, fetchImpl, signal, timeoutMs) {
  try {
    const response = await fetchImpl(url, {
      signal: AbortSignal.any([
        signal ?? new AbortController().signal,
        AbortSignal.timeout(timeoutMs),
      ]),
    });
    if (!response.ok) throw new Error("weather-http");
    return await response.json();
  } catch (error) {
    if (error.name === "TimeoutError" || error.name === "AbortError") {
      throw new Error(
        "La consulta del clima agotó el tiempo de espera. Intentá nuevamente.",
      );
    }
    throw new Error(
      "No pudimos consultar Open-Meteo. Intentá nuevamente en unos minutos.",
    );
  }
}

export function createWeatherService({
  fetchImpl = fetch,
  timeoutMs = 12000,
} = {}) {
  return async (city, signal) => {
    const geoUrl = new URL("https://geocoding-api.open-meteo.com/v1/search");
    geoUrl.search = new URLSearchParams({
      name: city.trim(),
      count: "1",
      language: "es",
      format: "json",
    });
    const geo = await weatherJson(geoUrl, fetchImpl, signal, timeoutMs);
    const place = geo.results?.[0];
    if (!place)
      throw new Error(
        `No encontramos la ciudad «${city}». Probá con otro nombre.`,
      );
    const url = new URL("https://api.open-meteo.com/v1/forecast");
    url.search = new URLSearchParams({
      latitude: String(place.latitude),
      longitude: String(place.longitude),
      timezone: "auto",
      forecast_days: "3",
      current:
        "temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code,is_day",
      daily:
        "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max",
      temperature_unit: "celsius",
      wind_speed_unit: "kmh",
    });
    const weather = await weatherJson(url, fetchImpl, signal, timeoutMs);
    const c = weather.current;
    const d = weather.daily;
    if (
      !c ||
      !d ||
      d.time?.length !== 3 ||
      ![
        c.temperature_2m,
        c.apparent_temperature,
        c.relative_humidity_2m,
        c.wind_speed_10m,
        c.weather_code,
      ].every(Number.isFinite) ||
      ![
        "weather_code",
        "temperature_2m_min",
        "temperature_2m_max",
        "precipitation_probability_max",
      ].every((key) => d[key]?.length === 3)
    ) {
      throw new Error(
        "Open-Meteo devolvió datos incompletos. Intentá nuevamente.",
      );
    }
    const location = {
      name: place.name,
      region: place.admin1 ?? "",
      country: place.country ?? "",
      label: [
        ...new Set([place.name, place.admin1, place.country].filter(Boolean)),
      ].join(", "),
      latitude: place.latitude,
      longitude: place.longitude,
      timezone: weather.timezone,
    };
    const current = {
      time: c.time,
      temperature: c.temperature_2m,
      feelsLike: c.apparent_temperature,
      humidity: c.relative_humidity_2m,
      wind: c.wind_speed_10m,
      weatherCode: c.weather_code,
      ...condition(c.weather_code, c.is_day === 1),
    };
    const forecast = d.time.map((date, i) => ({
      date,
      min: d.temperature_2m_min[i],
      max: d.temperature_2m_max[i],
      precipitationProbability: d.precipitation_probability_max[i],
      weatherCode: d.weather_code[i],
      ...condition(d.weather_code[i]),
    }));
    return {
      location,
      current,
      forecast,
      source: "Open-Meteo",
      sourceUrl: "https://open-meteo.com/",
    };
  };
}

export function weatherText({ location, current: c, forecast }) {
  return (
    `Clima en ${location.label} (${location.timezone}), actualizado ${c.time}: ${c.label}, ${c.temperature} °C. Sensación térmica: ${c.feelsLike} °C. Humedad: ${c.humidity} %. Viento: ${c.wind} km/h.\nPronóstico:\n` +
    forecast
      .map(
        (d) =>
          `${d.date}: ${d.label}, mínima ${d.min} °C, máxima ${d.max} °C, probabilidad de precipitación ${d.precipitationProbability ?? "no disponible"} %.`,
      )
      .join("\n") +
    "\nFuente: Open-Meteo (https://open-meteo.com/). Se usa el primer resultado de geocodificación; verificá la ubicación completa."
  );
}
