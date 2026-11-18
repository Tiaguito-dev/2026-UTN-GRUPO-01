// HU-C06: navegador real contra el frontend compilado, API simulada, sin backend ni base de datos.
// ROLE_THEME_FRONT_URL=http://127.0.0.1:3300 ROLE_THEME_API_URL=http://localhost:3301 node front/tests/role-theme-browser-check.mjs
// Capturas como artefactos de revisión; no modifica las baselines oficiales de Chrome/Linux.
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { chromium, expect } from "@playwright/test";

const front = process.env.ROLE_THEME_FRONT_URL ?? "http://127.0.0.1:3300";
const api = process.env.ROLE_THEME_API_URL ?? "http://localhost:3301";
const output = process.env.ROLE_THEME_OUTPUT_DIR ?? ".tmp/hu-c06-captures";
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true,
  ...(process.env.ROLE_THEME_BROWSER_PATH ? { executablePath: process.env.ROLE_THEME_BROWSER_PATH } : {}),
});
const colors = new Map();

function contrast(first, second) {
  const luminance = rgb => {
    const values = rgb.match(/[\d.]+/g)?.slice(0, 3).map(value => Number(value) / 255)
      .map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
    if (!values || values.length !== 3) throw new Error(`Color CSS inesperado: ${rgb}`);
    return .2126 * values[0] + .7152 * values[1] + .0722 * values[2];
  };
  const values = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (values[0] + .05) / (values[1] + .05);
}
async function assertTextContrast(locator) {
  const values = await locator.evaluate(node => ({ text: getComputedStyle(node).color, background: getComputedStyle(node).backgroundColor }));
  expect(contrast(values.text, values.background)).toBeGreaterThanOrEqual(4.5);
}

async function assertFits(page, width) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width + 1);
}
async function screenshot(page, role, width, name) {
  await page.screenshot({ path: join(output, `${role.toLowerCase()}-${width}-${name}.png`), fullPage: true });
}

try {
  for (const width of [375, 1280]) for (const role of ["USER", "ADMIN"]) {
    const context = await browser.newContext({ viewport: { width, height: 900 } });
    let closed = false;
    let warning = false;
    let holdInitial = true;
    let releaseInitial;
    const initial = new Promise(resolve => { releaseInitial = resolve; });
    const account = { id: "8d8357c7-3d66-47da-8369-516a58554815", email: "visual@example.test", displayName: role === "ADMIN" ? "Administración de prueba" : "Estudiante de prueba", role };
    const status = () => {
      const now = Date.now();
      return { serverNow: new Date(now).toISOString(), warningAt: new Date(now + (warning ? -60_000 : 1680_000)).toISOString(),
        idleExpiresAt: new Date(now + (warning ? 120_000 : 1800_000)).toISOString(), absoluteExpiresAt: new Date(now + 604800_000).toISOString() };
    };
    await context.route(`${api}/**`, async route => {
      const request = route.request();
      const url = new URL(request.url());
      const headers = { "access-control-allow-origin": new URL(front).origin, "access-control-allow-credentials": "true",
        "access-control-allow-headers": "Content-Type, X-CSRF-Protection", "access-control-allow-methods": "GET,POST,PATCH,PUT,DELETE,OPTIONS" };
      const reply = (body, code = 200) => route.fulfill({ status: code, headers, contentType: "application/json", body: JSON.stringify(body) });
      if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers });
      if (url.pathname === "/auth/logout") { closed = true; return route.fulfill({ status: 204, headers }); }
      if (closed) return reply({ message: "La sesión terminó." }, 401);
      if (url.pathname === "/auth/me") { if (holdInitial) await initial; return reply(account); }
      if (url.pathname === "/auth/refresh") return reply(account);
      if (url.pathname.startsWith("/auth/session")) return reply(status());
      if (url.pathname === "/comunidad/normas") return reply({ id: "vigentes", titulo: "Construyamos una comunidad que sume", introduccion: "Mensaje de prueba del equipo.", normas: ["Compartí experiencias reales.", "Respetá la privacidad."], cierre: "De estudiantes, para estudiantes.", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" });
      if (url.pathname === "/feedback/feed") return reply({ items: [], hasMore: false, nextCursor: null });
      if (["/users", "/materias", "/profesores", "/cursadas", "/comisiones", "/feedback"].includes(url.pathname) || url.pathname.startsWith("/rankings/")) {
        return reply({ items: [], total: 0, page: Number(url.searchParams.get("page") ?? 1), pageSize: Number(url.searchParams.get("pageSize") ?? 9) });
      }
      return reply({ message: "Fixture no disponible" }, 404);
    });
    const page = await context.newPage();
    const expected = role === "ADMIN" ? "admin" : "student";
    await page.goto(`${front}${role === "ADMIN" ? "/home/admin" : "/home"}`);
    await expect(page.locator("[data-role-theme]")).toHaveAttribute("data-role-theme", "pending");
    await expect(page.locator(".site-header").getByText("Administración", { exact: true })).toHaveCount(0);
    holdInitial = false; releaseInitial();
    await expect(page.locator("[data-role-theme]")).toHaveAttribute("data-role-theme", expected);
    await expect(page.getByRole("dialog")).toHaveCount(0);
    const header = page.locator(".site-header");
    const sidebar = page.locator(".system-sidebar");
    await expect(header.getByRole("link", { name: "Professors' butchery" })).toBeVisible();
    if (role === "ADMIN") {
      await expect(header.getByText("Administración", { exact: true })).toBeVisible();
      await expect(sidebar.getByRole("link", { name: "Usuarios", exact: true })).toBeVisible();
      // HU-C01 habilita consulta de las mismas normas también para ADMIN.
      await expect(sidebar.getByRole("link", { name: "Comunidad", exact: true })).toBeVisible();
    } else {
      await expect(header.getByText("Administración", { exact: true })).toHaveCount(0);
      await expect(sidebar.getByRole("link", { name: "Usuarios", exact: true })).toHaveCount(0);
      await expect(sidebar.getByRole("link", { name: "Comunidad", exact: true })).toBeVisible();
    }
    await expect(sidebar.locator('[aria-current="page"]')).toHaveCount(1);
    await assertTextContrast(header);
    await assertTextContrast(sidebar);
    await assertTextContrast(sidebar.locator('[aria-current="page"]'));
    colors.set(`${role}-${width}`, await header.evaluate(node => getComputedStyle(node).backgroundColor));
    await assertFits(page, width);
    await screenshot(page, role, width, "inicio");

    const routes = role === "ADMIN"
      ? ["/home/admin/materias", "/home/admin/profesores", "/home/admin/cursadas", "/home/admin/comisiones", "/home/admin/usuarios", "/home/admin/experiencias", "/home/admin/ranking", "/home/admin/comunidad", "/home/admin/materias/nueva", "/home/admin/profesores/nuevo", "/account", "/account/change-password"]
      : ["/home/materias", "/home/profesores", "/home/experiencias", "/home/comunidad", "/account", "/account/change-password"];
    for (const path of routes) {
      await page.goto(`${front}${path}`);
      await expect(page.locator("[data-role-theme]")).toHaveAttribute("data-role-theme", expected);
      await expect(page.locator(".system-content")).toBeVisible();
      await expect(page.getByRole("dialog")).toHaveCount(0);
      expect(await header.evaluate(node => getComputedStyle(node).backgroundColor)).toBe(colors.get(`${role}-${width}`));
    }
    await page.goto(`${front}/account`);
    await expect(page.getByRole("heading", { name: "Mi perfil", exact: true })).toBeVisible();
    await page.reload();
    await expect(page.locator("[data-role-theme]")).toHaveAttribute("data-role-theme", expected);
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await assertFits(page, width);
    await screenshot(page, role, width, "perfil");

    if (role === "USER") {
      await page.goto(`${front}/home/admin/usuarios`);
      await expect(page.getByRole("heading", { name: "Acceso no permitido", exact: true })).toBeVisible();
      await expect(page.getByRole("heading", { name: "Usuarios registrados", exact: true })).toHaveCount(0);
      await expect(page.locator("[data-role-theme]")).toHaveAttribute("data-role-theme", "student");
      await page.goto(`${front}/account`);
    }
    await expect(page.getByRole("dialog")).toHaveCount(0);
    warning = true;
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Renovar sesión", exact: true })).toBeVisible();
    await assertTextContrast(dialog.getByRole("button", { name: "Renovar sesión", exact: true }));
    expect(await dialog.getByRole("button", { name: "Renovar sesión", exact: true }).evaluate(node => getComputedStyle(node).backgroundColor)).toBe(colors.get(`${role}-${width}`));
    await assertFits(page, width);
    await screenshot(page, role, width, "dialogo");
    await dialog.getByRole("button", { name: "Cerrar sesión", exact: true }).click();
    await expect(page).toHaveURL(/\/login/);
    await expect(page.locator("[data-role-theme]")).toHaveAttribute("data-role-theme", "public");
    await expect(page.locator(".site-header").getByText("Administración", { exact: true })).toHaveCount(0);
    await context.close();
  }
  for (const width of [375, 1280]) expect(colors.get(`ADMIN-${width}`)).not.toBe(colors.get(`USER-${width}`));
  console.log("HU-C06 Chromium: USER/ADMIN en 375 y 1280 px, encabezado/sidebar/selección, páginas compartidas/formularios, recarga, guard USER y diálogo/logout: OK.");
  console.log(`Capturas de revisión: ${output}`);
} finally { await browser.close(); }
