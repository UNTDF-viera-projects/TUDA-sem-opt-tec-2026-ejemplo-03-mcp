import { Component, memo, useEffect, useState } from "react";
import { AppRenderer } from "@mcp-ui/client";

const sandboxUrl = new URL("http://127.0.0.1:3002/sandbox_proxy.html");
sandboxUrl.searchParams.set("hostOrigin", location.origin);
const sandbox = {
  url: sandboxUrl,
  csp: { connectDomains: [], resourceDomains: [] },
};

class RenderBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onError();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

export const WeatherCard = memo(function WeatherCard({ client, execution }) {
  const [state, setState] = useState("loading");
  useEffect(() => {
    if (state !== "loading") return;
    const timer = setTimeout(() => setState("error"), 15000);
    return () => clearTimeout(timer);
  }, [state]);
  const fail = () => setState("error");
  if (state === "error")
    return (
      <p className="notice" role="alert">
        No se pudo mostrar la tarjeta. El resultado textual sigue disponible
        debajo.
      </p>
    );
  return (
    <div className="weather-card" aria-label="Tarjeta de clima MCP UI">
      {state === "loading" && (
        <p className="card-loading" role="status">
          Cargando tarjeta MCP UI…
        </p>
      )}
      <RenderBoundary onError={fail}>
        <AppRenderer
          client={client}
          toolName={execution.name}
          toolResourceUri={execution.resourceUri}
          sandbox={sandbox}
          toolInput={execution.input}
          toolResult={execution.result}
          onError={fail}
          onLoggingMessage={({ data }) => {
            if (data === "weather-rendered") setState("ready");
            if (data === "weather-render-failed") setState("error");
          }}
          onOpenLink={async ({ url }) => {
            if (url === "https://open-meteo.com/") {
              window.open(url, "_blank", "noopener,noreferrer");
              return {};
            }
            return { isError: true };
          }}
        />
      </RenderBoundary>
    </div>
  );
});
