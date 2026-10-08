import { App } from "@modelcontextprotocol/ext-apps";

const app = new App({ name: "Weather View", version: "1.0.0" }, {});
const root = document.getElementById("weather");
function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text != null) node.textContent = text;
  if (className) node.className = className;
  return node;
}
function value(number, unit) {
  return Number.isFinite(number) ? `${number}${unit}` : "Sin datos";
}
app.ontoolresult = async (result) => {
  try {
    const { location, current, forecast } = result.structuredContent ?? {};
    if (!location || !current || !Array.isArray(forecast))
      throw new Error("Datos de clima incompletos.");
    root.replaceChildren(
      element("div", "Clima actual · Open-Meteo", "eyebrow"),
      element("h1", location.name),
      element("p", location.label, "location"),
      element(
        "p",
        `${current.time.replace("T", " · ")} · ${location.timezone}`,
        "time",
      ),
    );
    const now = element("div", null, "now");
    const temperature = element("div");
    temperature.append(
      element("div", value(current.temperature, "°"), "temperature"),
      element("p", current.label, "condition"),
    );
    now.append(element("span", current.icon, "icon"), temperature);
    const metrics = element("dl", null, "metrics");
    for (const [label, reading] of [
      ["Sensación térmica", value(current.feelsLike, " °C")],
      ["Humedad", value(current.humidity, " %")],
      ["Viento", value(current.wind, " km/h")],
    ]) {
      const item = element("div");
      item.append(element("dt", label), element("dd", reading));
      metrics.append(item);
    }
    const days = element("div", null, "forecast");
    for (const day of forecast) {
      const item = element("div", null, "day");
      const date = new Intl.DateTimeFormat("es-AR", {
        weekday: "short",
        day: "numeric",
        month: "short",
        timeZone: "UTC",
      }).format(new Date(`${day.date}T12:00:00Z`));
      item.append(
        element("p", date),
        element("div", day.icon, "symbol"),
        element("p", day.label),
      );
      const range = element("p", value(day.max, "°") + " / ");
      range.append(element("span", value(day.min, "°"), "low"));
      item.append(
        range,
        element(
          "p",
          `${value(day.precipitationProbability, " %")} precip.`,
          "rain",
        ),
      );
      days.append(item);
    }
    const source = element("p", "Datos meteorológicos: ", "source");
    const link = element("a", "Open-Meteo");
    link.href = "https://open-meteo.com/";
    link.addEventListener("click", (event) => {
      event.preventDefault();
      void app.openLink({ url: link.href });
    });
    source.append(link);
    root.append(
      now,
      metrics,
      element("h2", "PRONÓSTICO · 3 DÍAS"),
      days,
      source,
      element(
        "p",
        "Primer resultado de geocodificación. Verificá la ubicación.",
        "selection",
      ),
    );
    await app.sendSizeChanged({
      height: document.documentElement.scrollHeight,
    });
    await app.sendLog({ level: "info", data: "weather-rendered" });
  } catch {
    root.textContent = "No se pudo mostrar la tarjeta meteorológica.";
    await app.sendLog({ level: "error", data: "weather-render-failed" });
  }
};
app.connect().catch(() => {
  root.textContent = "No se pudo conectar la tarjeta con el chat.";
});
