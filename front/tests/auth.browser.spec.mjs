import { test, expect } from "@playwright/test";
import { randomUUID, createHash } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../back/dist/generated/prisma/client.js";

const API = "http://localhost:3301", FRONT = "http://localhost:3300";
const MAIL = process.env.TEST_MAILPIT_API_URL ?? "http://127.0.0.1:8025";
const password = " Contraseña de prueba segura 2026 ";
const replacement = " Nueva contraseña de prueba 2026 ";
let prisma;
const userIds = [];
test.beforeAll(async () => {
  if (!process.env.TEST_DATABASE_URL) throw new Error("TEST_DATABASE_URL es obligatorio para las pruebas de navegador.");
  prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.TEST_DATABASE_URL }) });
  await prisma.$connect();
});
test.afterAll(async () => {
  if (prisma) {
    await prisma.passwordResetCredential.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.refreshCredential.deleteMany({ where: { session: { userId: { in: userIds } } } });
    await prisma.session.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.$disconnect();
  }
});
async function api(page, path, method = "GET", body, csrf = true) {
  return page.evaluate(async ({ url, method, body, csrf }) => {
    const response = await fetch(url, { method, credentials: "include", headers: { ...(body ? { "Content-Type": "application/json" } : {}), ...(method !== "GET" && csrf ? { "X-CSRF-Protection": "1" } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
    return { status: response.status, cache: response.headers.get("cache-control"), body: response.status === 204 ? null : await response.json() };
  }, { url: `${API}${path}`, method, body, csrf });
}
async function fixture(page, role = "USER") {
  await page.goto("/login");
  const email = `browser-${randomUUID()}@example.test`;
  const registered = await api(page, "/auth/register", "POST", { email, displayName: "Cuenta de prueba", password });
  expect(registered.status).toBe(201); userIds.push(registered.body.id);
  if (role === "ADMIN") await prisma.user.update({ where: { id: registered.body.id }, data: { role } });
  return { email, id: registered.body.id };
}
async function login(page, email, pass = password) {
  await page.goto("/login");
  await page.getByLabel(/^Email$/i).fill(email);
  await page.getByLabel(/^Contraseña$/i).fill(pass);
  await page.getByRole("button", { name: /iniciar sesión/i }).click();
  await expect(page).toHaveURL(/\/home(?:\?|$)/);
  // Flows below inspect profile data and actions explicitly, separate from the internal home.
  await page.goto("/account");
  await expect(page).toHaveURL(/\/account(?:\?|$)/);
  await expect(page.getByText(email, { exact: true })).toBeVisible();
}
async function expire(page) { expect((await api(page, "/test/expire-access", "POST", {})).status).toBe(201); }
async function mailbox(email) {
  let message;
  await expect.poll(async () => {
    const response = await fetch(`${MAIL}/api/v1/messages`); const inbox = await response.json();
    const summary = inbox.messages.find((m) => m.To?.some((recipient) => recipient.Address === email));
    if (summary) message = await (await fetch(`${MAIL}/api/v1/message/${summary.ID}`)).json();
    return !!message;
  }, { timeout: 10_000 }).toBe(true);
  const match = message.Text.match(/http:\/\/localhost:3300\/reset-password\?token=([A-Za-z0-9_-]+)/);
  if (!match) throw new Error("El buzón no contiene un enlace de recuperación válido.");
  return { token: match[1], url: match[0] };
}

test("entrada pública separada del home interno, perfil protegido y logo según sesión", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Tu carrera, con/ })).toBeVisible();
  await expect(page.getByRole("button", { name: "Opciones de cuenta" })).toHaveCount(0);
  await expect(page.locator("header .brand")).toHaveAttribute("href", "/");
  for (const target of ["/home", "/account", "/account/change-password"]) {
    await page.goto(target);
    await expect(page).toHaveURL(new RegExp(`/login\\?returnTo=${encodeURIComponent(target)}$`));
    await expect(page.getByRole("button", { name: "Opciones de cuenta" })).toHaveCount(0);
  }
  const f = await fixture(page); await login(page, f.email);
  await expect(page.locator("header .brand")).toHaveAttribute("href", "/home");
  await page.locator("header .brand").click(); await expect(page).toHaveURL(/\/home$/);
  for (const target of ["/", "/login", "/register"]) {
    await page.goto(target); await expect(page).toHaveURL(/\/home$/);
    await expect(page.getByRole("heading", { name: /Tu carrera, con/ })).toHaveCount(0);
  }
  await page.getByRole("button", { name: "Opciones de cuenta" }).click();
  await page.getByRole("link", { name: "Mi perfil", exact: true }).click();
  await expect(page).toHaveURL(/\/account$/); await expect(page.getByText(f.email, { exact: true })).toBeVisible();
  await page.getByRole("button", { name: /cerrar sesión/i }).click();
  await expect(page).toHaveURL(/\/login/);
  await page.goto("/"); await expect(page.getByRole("heading", { name: /Tu carrera, con/ })).toBeVisible();
  await expect(page.getByRole("button", { name: "Opciones de cuenta" })).toHaveCount(0);
});

test("registro por formulario, login, recarga, cookies HttpOnly y ningún secreto en storage/JSON", async ({ page, context }) => {
  const email = `browser-${randomUUID()}@example.test`;
  await page.goto("/register");
  await page.getByLabel(/nombre/i).fill("Cuenta registrada");
  await page.getByLabel(/^Email$/i).fill(email);
  await page.getByLabel(/^Contraseña$/i).fill(password);
  const confirmation = page.getByLabel(/confirmar contraseña/i); if (await confirmation.count()) await confirmation.fill(password);
  await page.getByRole("button", { name: /crear cuenta|registrar/i }).click();
  await expect(page).toHaveURL(/\/login/);
  const user = await prisma.user.findUniqueOrThrow({ where: { email } }); userIds.push(user.id);
  await login(page, email); await page.reload(); await expect(page.getByText(email, { exact: true })).toBeVisible();
  const current = await api(page, "/auth/me"); expect(current.status).toBe(200); expect(Object.keys(current.body).sort()).toEqual(["displayName", "email", "id", "role"]);
  const cookies = (await context.cookies()).filter((c) => /butchery_(access|refresh)$/.test(c.name)); expect(cookies).toHaveLength(2);
  expect(cookies.every((c) => c.httpOnly && c.sameSite === "Lax" && !c.secure)).toBe(true);
  expect(cookies.find((c) => c.name.endsWith("refresh")).path).toBe("/auth");
  const browserState = await page.evaluate(() => JSON.stringify({ local: { ...localStorage }, session: { ...sessionStorage }, cookies: document.cookie }));
  expect(cookies.every((c) => !browserState.includes(c.value)) && !browserState.includes(password)).toBe(true);
  const hashes = await prisma.refreshCredential.findMany({ where: { session: { userId: user.id } } });
  expect(hashes.every((c) => /^[a-f0-9]{64}$/.test(c.tokenHash) && !cookies.some((v) => JSON.stringify(c).includes(v.value)))).toBe(true);
});

test("access vencido se renueva una vez; pestañas y peticiones concurrentes no reutilizan refresh", async ({ page, context }) => {
  const f = await fixture(page); await login(page, f.email);
  const other = await context.newPage(); await other.goto("/account"); await expect(other.getByText(f.email, { exact: true })).toBeVisible();
  await expire(page); const before = await prisma.refreshCredential.count({ where: { session: { userId: f.id } } });
  let refreshCalls = 0; context.on("request", (request) => { if (request.url() === `${API}/auth/refresh`) refreshCalls++; });
  await Promise.all([page.reload(), other.reload()]);
  await expect(page.getByText(f.email, { exact: true })).toBeVisible(); await expect(other.getByText(f.email, { exact: true })).toBeVisible();
  expect(refreshCalls).toBe(1);
  expect(await prisma.refreshCredential.count({ where: { session: { userId: f.id } } })).toBe(before + 1);
  expect(await prisma.session.count({ where: { userId: f.id, revokedAt: null } })).toBe(1);
});

test("logout sincroniza pestañas y rechaza credenciales anteriores inmediatamente", async ({ page, context }) => {
  const f = await fixture(page); await login(page, f.email); const other = await context.newPage(); await other.goto("/account");
  const prior = (await context.cookies()).filter((c) => c.name.includes("butchery"));
  await page.getByRole("button", { name: /cerrar sesión/i }).click(); await expect(page).toHaveURL(/\/login/);
  await expect(other).toHaveURL(/\/login/);
  expect((await context.cookies()).filter((c) => c.name.includes("butchery"))).toHaveLength(0);
  await context.addCookies(prior); expect((await api(page, "/auth/me")).status).toBe(401);
  expect(await prisma.session.count({ where: { userId: f.id, revokedAt: null } })).toBe(0);
});

test("buzón SMTP, enlace sin token en URL, reset y login con contraseña nueva", async ({ page, context }) => {
  const f = await fixture(page); await login(page, f.email);
  await page.goto("/forgot-password"); await page.getByLabel(/^Email$/i).fill(f.email);
  await page.getByRole("button", { name: /enviar|recuperar/i }).click();
  await expect(page.getByText(/Si existe una cuenta asociada al email/)).toBeVisible();
  const link = await mailbox(f.email);
  const persisted = await prisma.passwordResetCredential.findUniqueOrThrow({ where: { tokenHash: createHash("sha256").update(link.token).digest("hex") } });
  expect(!JSON.stringify(persisted).includes(link.token)).toBe(true);
  const thirdParty = []; page.on("request", (r) => { if (!r.url().startsWith(FRONT) && !r.url().startsWith(API)) thirdParty.push(r.url()); });
  let response; try { response = await page.goto(link.url); } catch { throw new Error("No se pudo abrir la pantalla de recuperación."); }
  await expect.poll(() => page.url() === `${FRONT}/reset-password`).toBe(true); expect(response.headers()["referrer-policy"]).toBe("no-referrer");
  await page.getByLabel(/^Nueva contraseña$/i).fill(replacement);
  const confirmation = page.getByLabel(/confirmar contraseña/i); if (await confirmation.count()) await confirmation.fill(replacement);
  await page.getByRole("button", { name: /restablecer/i }).click(); await expect(page).toHaveURL(/\/login/);
  expect(thirdParty).toHaveLength(0); expect((await context.cookies()).filter((c) => c.name.includes("butchery"))).toHaveLength(0);
  expect((await api(page, "/auth/login", "POST", { email: f.email, password })).status).toBe(401);
  await login(page, f.email, replacement);
  expect((await api(page, "/auth/reset-password", "POST", { token: link.token, newPassword: password })).status).toBe(400);
});

test("cambio revoca sesiones de otro navegador y exige login con la nueva contraseña", async ({ page, browser }) => {
  const f = await fixture(page); await login(page, f.email);
  const remote = await browser.newContext(); const other = await remote.newPage(); await login(other, f.email);
  await page.getByRole("link", { name: /cambiar contraseña/i }).click();
  await expect(page).toHaveURL(/\/account\/change-password$/);
  await page.getByLabel(/contraseña actual/i).fill(password); await page.getByLabel(/^Nueva contraseña$/i).fill(replacement);
  const confirmation = page.getByLabel(/confirmar contraseña/i); if (await confirmation.count()) await confirmation.fill(replacement);
  await page.getByRole("button", { name: /cambiar contraseña/i }).click(); await expect(page).toHaveURL(/\/login/);
  expect((await api(other, "/auth/me")).status).toBe(401); expect((await api(other, "/auth/refresh", "POST", {})).status).toBe(401);
  await other.reload(); await expect(other).toHaveURL(/\/login/);
  expect((await api(page, "/auth/login", "POST", { email: f.email, password })).status).toBe(401);
  await login(page, f.email, replacement); await remote.close();
});

test("roles backend reales en controlador exclusivo de pruebas, CSRF y CORS explícito", async ({ page }) => {
  const f = await fixture(page); expect((await api(page, "/test/admin")).status).toBe(401);
  await login(page, f.email); expect((await api(page, "/test/admin")).status).toBe(403);
  await prisma.user.update({ where: { id: f.id }, data: { role: "ADMIN" } }); expect((await api(page, "/test/admin")).status).toBe(200);
  expect((await api(page, "/auth/logout", "POST", {}, false)).status).toBe(403); expect((await api(page, "/auth/me")).status).toBe(200);
  const response = await fetch(`${API}/auth/me`, { headers: { Origin: "https://untrusted.example.test" } });
  expect(response.headers.get("access-control-allow-origin")).not.toBe("https://untrusted.example.test");
});

test("fallos temporales no declaran logout y la incertidumbre se sincroniza entre pestañas", async ({ page, context }) => {
  const f = await fixture(page); await login(page, f.email);
  await page.route(`${API}/auth/logout`, (route) => route.abort("failed"));
  await page.getByRole("button", { name: /cerrar sesión/i }).click();
  await expect(page.getByRole("alert")).toBeVisible(); expect((await api(page, "/auth/me")).status).toBe(200);
  await page.unroute(`${API}/auth/logout`);
  const other = await context.newPage(); await other.goto("/account"); await expect(other.getByText(f.email, { exact: true })).toBeVisible();
  await expire(page); await page.route(`${API}/auth/refresh`, (route) => route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ statusCode: 500, message: "Error temporal de prueba." }) }));
  await page.reload(); await expect(page.getByRole("alert")).toBeVisible();
  await expect(other.getByRole("alert")).toBeVisible(); await expect(other).toHaveURL(/\/account$/);
  expect(await prisma.session.count({ where: { userId: f.id, revokedAt: null } })).toBe(1);
  await page.unroute(`${API}/auth/refresh`); await page.reload(); await expect(page.getByRole("alert")).toBeVisible();
  // A response may have been lost after consuming the refresh: recovery uses a new login.
  await login(page, f.email);
});

test("login 401, mutación 403 y límite 429 se muestran sin renovación o repetición", async ({ page, context }) => {
  const f = await fixture(page); let refreshCalls = 0;
  context.on("request", (request) => { if (request.url() === `${API}/auth/refresh`) refreshCalls++; });
  await page.getByLabel(/^Email$/i).fill(f.email); await page.getByLabel(/^Contraseña$/i).fill(" contraseña equivocada ");
  await page.getByRole("button", { name: /iniciar sesión/i }).click(); await expect(page.getByRole("alert")).toBeVisible();
  expect(refreshCalls).toBe(0); await login(page, f.email);
  await page.route(`${API}/auth/change-password`, (route) => route.fulfill({ status: 403, contentType: "application/json", body: JSON.stringify({ message: "La solicitud no pudo validarse." }) }));
  await page.getByRole("link", { name: /cambiar contraseña/i }).click();
  await expect(page).toHaveURL(/\/account\/change-password$/);
  await page.getByLabel(/contraseña actual/i).fill(password); await page.getByLabel(/^Nueva contraseña$/i).fill(replacement); await page.getByLabel(/confirmar contraseña/i).fill(replacement);
  await page.getByRole("button", { name: /cambiar contraseña/i }).click(); await expect(page.getByRole("alert")).toBeVisible(); expect(refreshCalls).toBe(0);
  let attempts = 0;
  await page.route(`${API}/auth/forgot-password`, (route) => { attempts++; return route.fulfill({ status: 429, contentType: "application/json", body: JSON.stringify({ message: "Se alcanzó el límite de intentos. Espere e intente nuevamente." }) }); });
  await page.goto("/forgot-password"); await page.getByLabel(/^Email$/i).fill(f.email); await page.getByRole("button", { name: /enviar instrucciones/i }).click();
  await expect(page.getByRole("alert")).toContainText(/límite de intentos/); expect(attempts).toBe(1); expect(refreshCalls).toBe(0);
});

test("sesión absoluta vencida solicita login y navegador sin Locks muestra límite explícito", async ({ page, context }) => {
  const f = await fixture(page); await login(page, f.email);
  await prisma.session.updateMany({ where: { userId: f.id }, data: { expiresAt: new Date(0) } });
  await page.reload(); await expect(page).toHaveURL(/\/login/);
  await context.addInitScript(() => Object.defineProperty(navigator, "locks", { value: undefined }));
  await login(page, f.email); await expect(page.getByText(/no permite coordinar la renovación entre pestañas/)).toBeVisible();
  await expire(page); let refreshCalls = 0; context.on("request", (request) => { if (request.url() === `${API}/auth/refresh`) refreshCalls++; });
  await page.reload(); await expect(page.getByRole("alert")).toBeVisible(); await expect(page).toHaveURL(/\/account$/); expect(refreshCalls).toBe(0);
});

test("formularios móviles y desktop utilizables por teclado sin overflow", async ({ page }) => {
  for (const viewport of [{ width: 1280, height: 800 }, { width: 375, height: 812 }]) {
    await page.setViewportSize(viewport); await page.goto("/login");
    await expect(page.getByRole("heading", { name: /iniciar sesión/i })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.getByLabel(/^Email$/i).focus(); await page.keyboard.press("Tab"); await expect(page.getByLabel(/^Contraseña$/i)).toBeFocused();
    await page.getByRole("button", { name: /iniciar sesión/i }).click();
    await expect(page.getByLabel(/^Email$/i)).toBeFocused();
    await expect(page.getByLabel(/^Email$/i)).toHaveAttribute("aria-invalid", "true");
    await expect(page.getByLabel(/^Email$/i)).toHaveAttribute("aria-describedby", /email-error/);
    const contrast = await page.evaluate(() => {
      const rgb = (value) => value.match(/[\d.]+/g).slice(0, 3).map(Number);
      const luminance = (color) => rgb(color).map((v) => { v /= 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }).reduce((sum, value, i) => sum + value * [.2126, .7152, .0722][i], 0);
      const ratio = (a, b) => { const x = luminance(a), y = luminance(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
      const button = getComputedStyle(document.querySelector("button.submit"));
      const card = getComputedStyle(document.querySelector(".auth-card"));
      return [ratio(button.color, button.backgroundColor), ...Array.from(document.querySelectorAll(".auth-card a,.field-error")).map((node) => ratio(getComputedStyle(node).color, card.backgroundColor))];
    });
    expect(contrast.every((ratio) => ratio >= 4.5)).toBe(true);
  }
});
