import { useEffect, useRef, useState } from "react";
import { connectMcp } from "./mcp-client.js";
import {
  requestCompletion,
  resultText,
  runChatTurn,
  SYSTEM_MESSAGE,
} from "./chat.js";
import { WeatherCard } from "./WeatherCard.jsx";

const suggestion = "¿Cómo está el clima en Ushuaia?";

export default function App() {
  const [config, setConfig] = useState({
    token: "",
    baseUrl: "https://api.openai.com/v1",
    model: "",
  });
  const [client, setClient] = useState(null);
  const [connectionError, setConnectionError] = useState("");
  const [connectionAttempt, setConnectionAttempt] = useState(0);
  const [ui, setUi] = useState(true);
  const [prompt, setPrompt] = useState("");
  const [turns, setTurns] = useState([]);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [formError, setFormError] = useState("");
  const history = useRef([SYSTEM_MESSAGE]);
  const active = useRef(null);
  const generation = useRef(0);
  const end = useRef(null);
  const configPanel = useRef(null);
  const editedConfig = useRef(new Set());

  function updateConfig(field, value) {
    editedConfig.current.add(field);
    setConfig((current) => ({ ...current, [field]: value }));
  }

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/config", { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error("No se pudo cargar la configuración.");
        return response.json();
      })
      .then((defaults) => {
        if (controller.signal.aborted) return;
        // Conserva cualquier campo que el usuario ya haya editado.
        setConfig((current) => ({
          token: editedConfig.current.has("token") ? current.token : defaults.token,
          baseUrl: editedConfig.current.has("baseUrl")
            ? current.baseUrl
            : defaults.baseUrl,
          model: editedConfig.current.has("model") ? current.model : defaults.model,
        }));
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setFormError(
            "No se pudo cargar la configuración inicial. Completá los campos manualmente.",
          );
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    let mounted = true;
    let connection;
    setConnectionError("");
    connectMcp()
      .then((c) => {
        connection = c;
        if (mounted) setClient(c);
        else void c.close();
      })
      .catch((e) => {
        if (mounted) setConnectionError(e.message);
      });
    return () => {
      mounted = false;
      active.current?.abort();
      void connection?.close();
    };
  }, [connectionAttempt]);
  useEffect(() => {
    end.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [turns.length, busy]);

  function reset() {
    generation.current++;
    active.current?.abort();
    active.current = null;
    history.current = [SYSTEM_MESSAGE];
    setTurns([]);
    setBusy(false);
    setStatus("");
    setFormError("");
    setPrompt("");
  }
  async function send(event) {
    event.preventDefault();
    if (busy || !client || !prompt.trim()) return;
    if (
      !config.token.trim() ||
      !config.model.trim() ||
      !config.baseUrl.trim()
    ) {
      setFormError(
        "Complétá el token, la URL base y el modelo en Configuración.",
      );
      configPanel.current.open = true;
      return;
    }
    const id = crypto.randomUUID();
    const capturedUi = ui;
    const capturedConfig = { ...config };
    const capturedGeneration = generation.current;
    const controller = new AbortController();
    active.current = controller;
    const text = prompt.trim();
    setFormError("");
    setBusy(true);
    setPrompt("");
    setTurns((old) => [
      ...old,
      { id, prompt: text, ui: capturedUi, pending: true, executions: [] },
    ]);
    const update = (fields) => {
      if (generation.current === capturedGeneration)
        setTurns((old) =>
          old.map((t) => (t.id === id ? { ...t, ...fields } : t)),
        );
    };
    try {
      const result = await runChatTurn({
        client,
        history: history.current,
        prompt: text,
        signal: controller.signal,
        complete: (payload, signal) =>
          requestCompletion(capturedConfig, payload, signal),
        onStatus: (text) => {
          if (generation.current === capturedGeneration) setStatus(text);
        },
      });
      if (generation.current === capturedGeneration) {
        history.current = result.messages;
        update({
          pending: false,
          answer: result.answer,
          executions: result.executions,
          warning: result.warning,
        });
      }
    } catch (error) {
      if (!controller.signal.aborted)
        update({
          pending: false,
          error: error.message,
          executions: error.executions ?? [],
        });
    } finally {
      if (generation.current === capturedGeneration) {
        setBusy(false);
        setStatus("");
        active.current = null;
      }
    }
  }

  const connected = Boolean(client);
  return (
    <main className="shell">
      <header className="masthead">
        <a href="#" className="brand" aria-label="Laboratorio MCP">
          <span className="brand-mark">m</span> laboratorio <strong>MCP</strong>
        </a>
        <span className="lab-label">SEMINARIO TECNOLÓGICO · 2026</span>
      </header>
      <section className="intro">
        <span className="eyebrow">
          DEMO 05 <span>/</span> MCP APPS
        </span>
        <h1>
          El clima, en conversación<span>.</span>
        </h1>
        <p>
          Una misma consulta. Dos formas de ver la respuesta.
          <br className="desktop-break" /> Explorá cómo MCP conecta un modelo
          con datos y una interfaz.
        </p>
      </section>
      <details className="configuration" ref={configPanel}>
        <summary>
          <span>
            ⚙ <strong>Configuración del modelo</strong>
          </span>
          <span className="config-hint">
            {config.token && config.model
              ? "Configurada"
              : "Agregá tu API token"}{" "}
            <span className="chevron">⌄</span>
          </span>
        </summary>
        <div className="config-fields">
          <label className="token-field">
            API token
            <input
              type="password"
              autoComplete="off"
              value={config.token}
              placeholder="Tu token del proveedor"
              onChange={(e) => updateConfig("token", e.target.value)}
            />
          </label>
          <label>
            URL base
            <input
              type="url"
              autoComplete="off"
              value={config.baseUrl}
              placeholder="https://proveedor.example/v1"
              onChange={(e) =>
                updateConfig("baseUrl", e.target.value)
              }
            />
          </label>
          <label>
            Modelo
            <input
              autoComplete="off"
              value={config.model}
              placeholder="Nombre de un modelo con tools"
              onChange={(e) => updateConfig("model", e.target.value)}
            />
          </label>
        </div>
        <div className="config-note">
          <p>
            El token permanece en memoria y se envía al backend local para
            consultar tu proveedor. Usá un modelo compatible con Chat
            Completions y tool calling.
          </p>
          <button
            type="button"
            className="subtle"
            onClick={() => updateConfig("token", "")}
          >
            Borrar token
          </button>
        </div>
      </details>
      <section className="chat" aria-label="Conversación">
        <div className="chat-toolbar">
          <span className="connection">
            <span className={`dot ${connected ? "online" : ""}`} />
            {connected
              ? "MCP conectado"
              : connectionError
                ? "MCP desconectado"
                : "Conectando MCP…"}
          </span>
          <button className="subtle" type="button" onClick={reset}>
            ↺ Reiniciar chat
          </button>
        </div>
        {connectionError && (
          <div className="notice" role="alert">
            {connectionError}{" "}
            <button onClick={() => setConnectionAttempt((n) => n + 1)}>
              Reintentar
            </button>
          </div>
        )}
        <div className="conversation">
          {!turns.length && (
            <div className="empty">
              <div className="weather-symbol" aria-hidden="true">
                ☀<span>☁</span>
              </div>
              <h2>Empezá por una ciudad.</h2>
              <p>
                El modelo consulta el clima a través de MCP.
                <br />
                Vos elegís si querés verlo también en una tarjeta.
              </p>
              <button
                className="suggestion"
                onClick={() => setPrompt(suggestion)}
              >
                {suggestion}
                <span aria-hidden="true">↗</span>
              </button>
            </div>
          )}
          {turns.map((turn) => (
            <article
              className="turn"
              key={turn.id}
              data-mode={turn.ui ? "ui" : "text"}
            >
              <div className="user-message">
                <span className="message-label">VOS</span>
                <p>{turn.prompt}</p>
              </div>
              <div className="assistant-message">
                <div className="response-heading">
                  <span className="message-label">ASISTENTE</span>
                  <span className={`mode-badge ${turn.ui ? "with-ui" : ""}`}>
                    {turn.ui ? "Con UI" : "Solo texto"}
                  </span>
                </div>
                {turn.pending ? (
                  <p className="loading" role="status">
                    <span className="pulse" />
                    {status || "Iniciando consulta…"}
                  </p>
                ) : (
                  <>
                    {turn.answer && <p className="answer">{turn.answer}</p>}
                    {turn.error && (
                      <p className="notice" role="alert">
                        {turn.error}
                      </p>
                    )}
                    {turn.warning && turn.warning !== turn.answer && <p className="notice">{turn.warning}</p>}
                    {turn.executions.map((execution, index) => (
                      <div
                        className="execution"
                        key={`${execution.id}-${index}`}
                      >
                        {turn.ui &&
                          execution.resourceUri &&
                          !execution.result.isError && (
                            <WeatherCard
                              client={client}
                              execution={execution}
                            />
                          )}
                        {execution.result.isError && (
                          <p className="notice" role="alert">
                            {resultText(execution.result)}
                          </p>
                        )}
                        <details className="tool-text">
                          <summary>Resultado MCP · {execution.name}</summary>
                          <pre>{resultText(execution.result)}</pre>
                        </details>
                      </div>
                    ))}
                  </>
                )}
              </div>
            </article>
          ))}
          <div ref={end} />
        </div>
        <form className="composer" onSubmit={send}>
          <div className="mode-control">
            <label className="toggle-label">
              <input
                type="checkbox"
                role="switch"
                checked={ui}
                onChange={(e) => setUi(e.target.checked)}
              />
              <span className="toggle-track" aria-hidden="true" />
              <strong>MCP UI</strong>
              <span className="mode-description">
                {ui ? "Respuesta + tarjeta de clima" : "Respuesta textual"}
              </span>
            </label>
          </div>
          <div className="prompt-row">
            <textarea
              aria-label="Mensaje"
              rows="2"
              value={prompt}
              maxLength={4000}
              placeholder="Preguntá por el clima de una ciudad…"
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  e.currentTarget.form.requestSubmit();
                }
              }}
            />
            <button
              className="send"
              disabled={busy || !connected || !prompt.trim()}
              type="submit"
              aria-label="Enviar mensaje"
            >
              {busy ? "…" : "↑"}
            </button>
          </div>
          {formError && (
            <p className="notice" role="alert">
              {formError}
            </p>
          )}
          <p className="composer-note">
            El modo se fija al enviar cada mensaje. Las respuestas anteriores
            conservan su formato.
          </p>
        </form>
      </section>
      <footer>
        <span>
          Modelo → tool MCP → respuesta <span className="footer-arrow">/</span>{" "}
          UI opcional
        </span>
        <span>
          Datos:{" "}
          <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">
            Open-Meteo ↗
          </a>
        </span>
      </footer>
    </main>
  );
}
