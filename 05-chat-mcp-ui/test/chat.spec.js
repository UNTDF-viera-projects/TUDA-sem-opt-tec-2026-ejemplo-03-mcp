import { test, expect } from "@playwright/test";
import { modelConfigFixture } from "./fixtures.js";

test("pre-rellena la configuración, permite editar y borrar, y restaura el entorno al recargar", async ({ page }) => {
  await page.goto("/");
  await page.getByText("Configuración del modelo").click();
  await expect(page.getByLabel("API token", { exact: true })).toHaveValue(modelConfigFixture.token);
  await expect(page.getByLabel("URL base", { exact: true })).toHaveValue(modelConfigFixture.baseUrl);
  await expect(page.getByLabel("Modelo", { exact: true })).toHaveValue(modelConfigFixture.model);
  await expect(page.getByText("MCP conectado", { exact: true })).toBeVisible();
  await send(page);
  await expect(card(page).getByText("7.2°", { exact: true })).toBeVisible();
  await page.getByLabel("Modelo", { exact: true }).fill("otro-modelo");
  await page.getByRole("button", { name: "Borrar token", exact: true }).click();
  await expect(page.getByLabel("API token", { exact: true })).toHaveValue("");
  await page.reload();
  await page.getByText("Configuración del modelo").click();
  await expect(page.getByLabel("API token", { exact: true })).toHaveValue(modelConfigFixture.token);
  await expect(page.getByLabel("Modelo", { exact: true })).toHaveValue(modelConfigFixture.model);
});

test("una carga demorada no sobrescribe campos editados ni un token borrado", async ({ page }) => {
  let release;
  const ready = new Promise((resolve) => { release = resolve; });
  await page.route("**/api/config", async (route) => {
    await ready;
    await route.fulfill({ json: modelConfigFixture });
  });
  await page.goto("/");
  await page.getByText("Configuración del modelo").click();
  await page.getByLabel("Modelo", { exact: true }).fill("manual");
  await page.getByRole("button", { name: "Borrar token", exact: true }).click();
  release();
  await expect(page.getByLabel("URL base", { exact: true })).toHaveValue(modelConfigFixture.baseUrl);
  await expect(page.getByLabel("API token", { exact: true })).toHaveValue("");
  await expect(page.getByLabel("Modelo", { exact: true })).toHaveValue("manual");
});

async function configure(
  page,
  { model = "fixture", token = "test-memory-only" } = {},
) {
  await page.goto("/");
  await expect(page.getByText("MCP conectado", { exact: true })).toBeVisible();
  await page.getByText("Configuración del modelo").click();
  await page.getByLabel("API token", { exact: true }).fill(token);
  await page
    .getByLabel("URL base", { exact: true })
    .fill("https://provider.example/v1");
  await page.getByLabel("Modelo", { exact: true }).fill(model);
}
async function send(page, text = "¿Cómo está el clima en Ushuaia?") {
  await page.getByRole("textbox", { name: "Mensaje", exact: true }).fill(text);
  await page
    .getByRole("button", { name: "Enviar mensaje", exact: true })
    .click();
}
const card = (page) =>
  page.frameLocator(".weather-card iframe").frameLocator("iframe");

test("tarjeta recibe el resultado MCP real y está aislada en dos iframes; token sólo en memoria", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await configure(page);
  await expect(page.getByLabel("API token", { exact: true })).toHaveAttribute(
    "type",
    "password",
  );
  await send(page);
  await expect(
    card(page).getByRole("heading", { name: "Ushuaia", exact: true }),
  ).toBeVisible();
  await expect(card(page).getByText("7.2°", { exact: true })).toBeVisible();
  await expect(
    card(page).getByText("22.5 km/h", { exact: true }),
  ).toBeVisible();
  await expect(card(page).locator(".day")).toHaveCount(3);
  await expect(page.getByText("Cargando tarjeta MCP UI…")).toHaveCount(0);
  const outer = page.locator(".weather-card iframe");
  await expect(outer).toHaveAttribute("src", /127\.0\.0\.1:3002/);
  await expect(card(page).locator("body")).toBeVisible();
  const innerSandbox = await page
    .frameLocator(".weather-card iframe")
    .locator("iframe")
    .getAttribute("sandbox");
  expect(innerSandbox).toBe("allow-scripts");
  const storage = await page.evaluate(() => ({
    local: { ...localStorage },
    session: { ...sessionStorage },
    cookies: document.cookie,
  }));
  expect(JSON.stringify(storage)).not.toContain("test-memory-only");
  expect(await card(page).locator("html").innerHTML()).not.toContain(
    "test-memory-only",
  );
  expect(errors).toEqual([]);
  await page.screenshot({
    path: "test-results/chat-desktop.png",
    fullPage: true,
  });
  await page.reload();
  await page.getByText("Configuración del modelo").click();
  await expect(page.getByLabel("API token", { exact: true })).toHaveValue(modelConfigFixture.token);
});

test("toggle apagado ejecuta clima pero no lee resource ni carga sandbox; turnos conservan su modo", async ({
  page,
}) => {
  const methods = [];
  const sandboxRequests = [];
  page.on("request", (req) => {
    if (req.url().endsWith("/mcp") && req.method() === "POST")
      methods.push(req.postDataJSON()?.method);
    if (req.url().includes(":3002")) sandboxRequests.push(req.url());
  });
  await configure(page);
  await page.getByRole("switch", { name: /MCP UI/ }).uncheck();
  await send(page);
  await expect(page.locator(".answer")).toContainText("7.2 °C");
  expect(methods).toContain("tools/call");
  expect(methods).not.toContain("resources/read");
  expect(sandboxRequests).toEqual([]);
  await expect(page.locator(".weather-card")).toHaveCount(0);
  await page.getByRole("switch", { name: /MCP UI/ }).check();
  await expect(page.locator(".turn").first()).toHaveAttribute(
    "data-mode",
    "text",
  );
  await send(page);
  await expect(card(page).getByText("7.2°", { exact: true })).toBeVisible();
  expect(methods).toContain("resources/read");
  await page.getByRole("switch", { name: /MCP UI/ }).uncheck();
  await expect(page.locator(".turn").last()).toHaveAttribute("data-mode", "ui");
  await expect(page.locator(".weather-card")).toHaveCount(1);
});

test("toggle durante consulta conserva modo capturado; reinicio cancela y borra el historial", async ({
  page,
}) => {
  await configure(page, { model: "lento" });
  await send(page);
  await page.getByRole("switch", { name: /MCP UI/ }).uncheck();
  await expect(card(page).getByText("7.2°", { exact: true })).toBeVisible();
  await expect(page.locator(".turn").first()).toHaveAttribute(
    "data-mode",
    "ui",
  );
  await send(page, "Consulta sólo textual");
  await page.getByRole("switch", { name: /MCP UI/ }).check();
  await expect(page.locator(".answer")).toHaveCount(2);
  await expect(page.locator(".turn").last()).toHaveAttribute("data-mode", "text");
  await expect(page.locator(".weather-card")).toHaveCount(1);
  await send(page, "Otra consulta");
  await page.getByRole("button", { name: /Reiniciar chat/ }).click();
  await expect(page.locator(".turn")).toHaveCount(0);
  await expect(page.getByText("Empezá por una ciudad.")).toBeVisible();
  await page.waitForTimeout(1500);
  await expect(page.locator(".turn")).toHaveCount(0);
  const providerMessages = [];
  page.on("request", (request) => {
    if (request.url().endsWith("/api/chat"))
      providerMessages.push(request.postDataJSON().messages);
  });
  await send(page);
  await expect(page.locator(".answer")).toBeVisible();
  expect(providerMessages[0].map((m) => m.role)).toEqual(["system", "user"]);
});

test("fallo del sandbox conserva respuesta y resultado textual", async ({
  page,
}) => {
  await page.route("http://127.0.0.1:3002/**", (route) => route.abort());
  await configure(page);
  await send(page);
  await expect(
    page.getByText(
      "No se pudo mostrar la tarjeta. El resultado textual sigue disponible debajo.",
    ),
  ).toBeVisible({ timeout: 20000 });
  await expect(page.locator(".answer")).toContainText("7.2 °C");
  await page.getByText("Resultado MCP · get_weather", { exact: true }).click();
  await expect(page.locator(".tool-text pre")).toContainText("7.2 °C");
});

test("token inválido, proveedor incompatible y ciudad inexistente muestran errores", async ({
  page,
}) => {
  await configure(page, { token: "invalid" });
  await send(page);
  await expect(page.getByRole("alert")).toContainText("rechazó el token");
  await page.getByLabel("API token", { exact: true }).fill("test-token");
  await page.getByLabel("Modelo", { exact: true }).fill("incompatible");
  await send(page);
  await expect(page.getByText(/Proveedor o modelo incompatible/)).toBeVisible();
  await page.getByLabel("Modelo", { exact: true }).fill("fixture");
  await send(page, "Clima en Inexistente");
  await expect(page.getByRole("alert").last()).toContainText(
    "No encontramos la ciudad",
  );
});

test("diseño móvil: tarjeta, composer y controles sin desborde horizontal", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await configure(page);
  await send(page);
  await expect(card(page).getByText("7.2°", { exact: true })).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(
    await card(page)
      .locator("html")
      .evaluate((el) => el.scrollWidth <= window.innerWidth),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/chat-mobile.png",
    fullPage: true,
  });
});
