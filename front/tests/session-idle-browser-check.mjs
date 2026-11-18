// Next dev con NEXT_PUBLIC_API_URL=http://localhost:3001 y NEXT_PUBLIC_ALLOW_LOCAL_HTTP=true.
// node front/tests/session-idle-browser-check.mjs (API simulada; no escribe datos reales).
import { chromium, expect } from "@playwright/test";

const front = process.env.HOTFIX_FRONT_URL ?? "http://127.0.0.1:3310";
const api = process.env.HOTFIX_API_URL ?? "http://localhost:3001";
const baseline = Date.now();
let now = baseline; let activityAt = baseline; let closed = false;
let activityCalls = 0; let renewalCalls = 0; let failRenewal = false;
const account = { id: "idle-browser-user", email: "usuario@alu.frlp.utn.edu.ar", displayName: "Sesión de prueba", role: "USER" };
const status = () => ({ serverNow: new Date(now).toISOString(), warningAt: new Date(activityAt + 1680_000).toISOString(),
  idleExpiresAt: new Date(activityAt + 1800_000).toISOString(), absoluteExpiresAt: new Date(baseline + 604800_000).toISOString() });
const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext();
  await context.route(`${api}/**`, async (route) => {
    const req = route.request(); const path = new URL(req.url()).pathname;
    const headers = { "access-control-allow-origin": new URL(front).origin, "access-control-allow-credentials": "true",
      "access-control-allow-headers": "Content-Type, X-CSRF-Protection", "access-control-allow-methods": "GET,POST,OPTIONS" };
    const reply = (body, code = 200) => route.fulfill({ status: code, headers, contentType: "application/json", body: JSON.stringify(body) });
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers });
    if (path === "/auth/logout") { closed = true; return route.fulfill({ status: 204, headers }); }
    if (closed || now >= activityAt + 1800_000) return reply({ message: "La sesión terminó. Iniciá sesión nuevamente." }, 401);
    if (path === "/auth/me" || path === "/auth/refresh") return reply(account);
    if (path === "/auth/session") return reply(status());
    if (path === "/auth/session/activity") {
      activityCalls++;
      if (now < activityAt + 1680_000) activityAt = now;
      return reply(status());
    }
    if (path === "/auth/session/renew") {
      renewalCalls++;
      if (failRenewal) { failRenewal = false; return reply({ message: "Lo sentimos. No pudimos renovar la sesión. Intentá nuevamente." }, 500); }
      activityAt = now; return reply(status());
    }
    return reply({ message: "Fixture de prueba no disponible." }, 404);
  });
  const first = await context.newPage(); const second = await context.newPage();
  const settle = async () => { await Promise.all([first.clock.runFor(100), second.clock.runFor(100)]); };
  for (const page of [first, second]) {
    await page.clock.install({ time: new Date(baseline) });
    await page.clock.pauseAt(new Date(baseline + 1000));
  }
  await first.goto(`${front}/account/change-password`);
  const password = first.getByLabel("Contraseña actual", { exact: true });
  await expect(password).toBeVisible();
  await second.goto(`${front}/account/change-password`);
  await expect(second.getByLabel("Contraseña actual", { exact: true })).toBeVisible();
  for (const page of [first, second]) await expect.poll(async () => { await settle(); return page.getByRole("dialog").count(); }).toBe(0);
  await password.pressSequentially("borrador que debe conservarse");
  await expect(password).toHaveValue("borrador que debe conservarse");
  const advanceTo = async (time) => {
    now = time;
    // Sincronizar ambos relojes antes de procesar eventos compartidos evita que una pestaña
    // reciba metadata futura y luego avance otra vez ese mismo intervalo artificialmente.
    await Promise.all([first.clock.setSystemTime(new Date(time)), second.clock.setSystemTime(new Date(time))]);
    await Promise.all([first.clock.runFor(1000), second.clock.runFor(1000)]);
  };
  await advanceTo(activityAt + 1680_000);
  for (const page of [first, second]) await expect(page.getByRole("dialog")).toBeVisible();
  const callsBeforeWarningInput = activityCalls;
  await second.mouse.move(250, 250); await second.keyboard.press("Escape");
  await first.evaluate(() => document.dispatchEvent(new PointerEvent("pointermove", { bubbles: true })));
  expect(activityCalls).toBe(callsBeforeWarningInput); expect(renewalCalls).toBe(0);
  await expect(second.getByRole("dialog")).toBeVisible();
  await first.screenshot({ path: ".tmp/idle-warning-desktop.png" });
  await second.setViewportSize({ width: 390, height: 844 });
  await second.screenshot({ path: ".tmp/idle-warning-mobile.png" });
  const mobileDialog = await second.getByRole("dialog").boundingBox();
  expect(mobileDialog.width).toBeLessThanOrEqual(390);
  await second.setViewportSize({ width: 1280, height: 720 });
  await first.getByRole("button", { name: "Renovar sesión", exact: true }).click();
  await expect.poll(() => renewalCalls).toBe(1);
  for (const page of [first, second]) await expect.poll(async () => { await settle(); return page.getByRole("dialog").count(); }).toBe(0);
  expect(renewalCalls).toBe(1); await expect(password).toHaveValue("borrador que debe conservarse");
  await expect(first.getByText("La sesión se renovó correctamente.")).toBeInViewport();
  await first.screenshot({ path: ".tmp/idle-renewal-success.png" });

  await advanceTo(now + 30_000);
  const activityBefore = activityCalls;
  await Promise.all([first.mouse.move(350, 300), second.mouse.move(380, 320)]);
  await expect.poll(() => activityCalls).toBe(activityBefore + 1);
  // Recargar y hacer scroll programático no deben generar actividad real.
  const activityAfter = activityCalls;
  await advanceTo(now + 20_000); await second.reload();
  await expect(second.getByLabel("Contraseña actual", { exact: true })).toBeVisible();
  await second.evaluate(() => { window.scrollTo(0, 200); document.dispatchEvent(new Event("scroll", { bubbles: true })); });
  expect(activityCalls).toBe(activityAfter);

  await advanceTo(activityAt + 1680_000);
  await expect(first.getByRole("dialog")).toBeVisible();
  failRenewal = true;
  await first.getByRole("button", { name: "Renovar sesión", exact: true }).click();
  await expect(first.getByRole("dialog").getByRole("alert")).toContainText("No pudimos renovar");
  await first.getByRole("button", { name: "Renovar sesión", exact: true }).click();
  for (const page of [first, second]) await expect.poll(async () => { await settle(); return page.getByRole("dialog").count(); }).toBe(0);
  await expect(password).toHaveValue("borrador que debe conservarse");

  // Un salto de reloj simula suspensión: no depende de que se ejecuten todos los ticks.
  await advanceTo(activityAt + 1800_000);
  for (const page of [first, second]) {
    await expect.poll(async () => { await settle(); return page.url(); }).toMatch(/\/login\?.*notice=idle/);
    await expect(page.getByText("Tu sesión se cerró por inactividad. Iniciá sesión nuevamente.")).toBeVisible();
  }
  console.log("Chromium: dos pestañas, actividad real agrupada, recarga sin actividad, aviso, Escape, renovación explícita, error/reintento, borrador conservado y cierre por inactividad: OK.");
  await context.close();
} finally { await browser.close(); }
