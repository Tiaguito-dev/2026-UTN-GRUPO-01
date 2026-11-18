import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../back/dist/generated/prisma/client.js";

const API = "http://localhost:3301";
const password = " Contraseña de prueba segura 2026 ";
const output = join(process.cwd(), ".tmp", "community-captures");
const proxy = process.env.COMMUNITY_PROXY_URL;
const userIds = [];
let prisma;
test.beforeAll(async () => {
  if (!process.env.TEST_DATABASE_URL) throw new Error("TEST_DATABASE_URL es obligatorio para las pruebas de Comunidad.");
  prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.TEST_DATABASE_URL }) });
  await prisma.$connect();
  await mkdir(output, { recursive: true });
});
test.afterAll(async () => {
  if (!prisma) return;
  await prisma.emailVerificationCredential.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.refreshCredential.deleteMany({ where: { session: { userId: { in: userIds } } } });
  await prisma.session.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await prisma.$disconnect();
});

async function login(page, role) {
  await page.goto("/login");
  const email = `community-${randomUUID()}@alu.frlp.utn.edu.ar`;
  const registered = await page.evaluate(async ({ url, body }) => {
    const response = await fetch(url, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json", "X-CSRF-Protection": "1" }, body: JSON.stringify(body) });
    return { status: response.status, body: await response.json() };
  }, { url: `${API}/auth/register`, body: { aceptaTerminos: true, versionTerminos: "terminos-2026-11-17", email, displayName: "Cuenta Comunidad", password } });
  expect(registered.status).toBe(201); userIds.push(registered.body.id);
  await prisma.user.update({ where: { id: registered.body.id }, data: { role, emailVerifiedAt: new Date() } });
  await page.getByLabel(/^Email$/i).fill(email);
  await page.getByLabel(/^Contraseña$/i).fill(password);
  await page.getByRole("button", { name: /iniciar sesión/i }).click();
  await expect(page).toHaveURL(role === "ADMIN" ? /\/home\/admin(?:\?|$)/ : /\/home(?:\?|$)/);
}

test("HU-C01 el proxy sirve la consulta protegida para ambos roles", async ({ browser, request }) => {
  test.skip(!proxy, "Requiere el proxy temporal de validación de infraestructura.");
  expect((await request.get(`${proxy}/comunidad/normas`)).status()).toBe(401);
  const stored = await prisma.normasConvivencia.findUniqueOrThrow({ where: { id: "vigentes" } });
  for (const role of ["USER", "ADMIN"]) {
    const context = await browser.newContext();
    try {
      await login(await context.newPage(), role);
      const response = await context.request.get(`${proxy}/comunidad/normas`);
      expect(response.status()).toBe(200);
      expect(response.headers()["cache-control"]).toBe("no-store");
      expect(await response.json()).toEqual({ id: stored.id, titulo: stored.titulo, introduccion: stored.introduccion, normas: stored.normas, cierre: stored.cierre, createdAt: stored.createdAt.toISOString(), updatedAt: stored.updatedAt.toISOString() });
    } finally { await context.close(); }
  }
});

for (const width of [375, 1280]) for (const role of ["USER", "ADMIN"]) {
  test(`HU-C01 ${role} consulta normas vigentes y conserva identidad a ${width}px`, async ({ page }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width, height: 900 });
    await login(page, role);
    const path = role === "ADMIN" ? "/home/admin/comunidad" : "/home/comunidad";
    const link = page.getByRole("navigation", { name: "Navegación principal" }).getByRole("link", { name: "Comunidad", exact: true });
    await expect(link).toHaveAttribute("href", path);
    await link.focus(); await expect(link).toBeFocused(); await page.keyboard.press("Enter");
    await expect(page).toHaveURL(new RegExp(`${path}$`));
    const content = page.locator(".system-content");
    const stored = await prisma.normasConvivencia.findUniqueOrThrow({ where: { id: "vigentes" } });
    await expect(content.getByRole("heading", { name: stored.titulo, exact: true })).toBeVisible();
    await expect(content.getByRole("heading", { name: "Comunidad", level: 1 })).toBeVisible();
    await expect(content.getByRole("listitem")).toHaveText(stored.normas);
    for (const paragraph of stored.introduccion.split(/\r?\n\s*\r?\n/)) await expect(content.getByText(paragraph, { exact: true })).toBeVisible();
    await expect(page.locator("[data-role-theme]")).toHaveAttribute("data-role-theme", role === "ADMIN" ? "admin" : "student");
    await expect(link).toHaveAttribute("aria-current", "page");
    await expect(content.getByRole("textbox")).toHaveCount(0);
    await expect(content.getByRole("button", { name: /editar|guardar|publicar|enviar/i })).toHaveCount(0);
    // HU-C04 añade un enlace administrativo; USER conserva una consulta sin edición.
    await expect(content.getByRole("link", { name: "Administrar normas de convivencia", exact: true })).toHaveCount(role === "ADMIN" ? 1 : 0);
    await page.reload();
    await expect(content.getByRole("heading", { name: stored.titulo, exact: true })).toBeVisible();
    await expect(page.locator("[data-role-theme]")).toHaveAttribute("data-role-theme", role === "ADMIN" ? "admin" : "student");
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width + 1);
    const { violations } = await new AxeBuilder({ page }).analyze();
    expect(violations.filter(item => ["serious", "critical"].includes(item.impact)).map(item => item.id)).toEqual([]);
    await page.screenshot({ path: join(output, `${role.toLowerCase()}-${width}-comunidad.png`), fullPage: true });
    if (role === "USER") {
      await page.goto("/home/admin/comunidad");
      await expect(page.getByRole("heading", { name: "Acceso no permitido", exact: true })).toBeVisible();
      await expect(page.getByRole("heading", { name: stored.titulo, exact: true })).toHaveCount(0);
    } else {
      await page.goto("/home/comunidad");
      await expect(page).toHaveURL(/\/home\/admin\/comunidad$/);
      await expect(page.getByRole("heading", { name: stored.titulo, exact: true })).toBeVisible();
    }
  });
}

for (const role of ["USER", "ADMIN"]) {
  test(`HU-C01 ${role} reintenta una consulta fallida sin inventar normas`, async ({ page }) => {
    await login(page, role);
    let requests = 0;
    await page.route(`${API}/comunidad/normas`, async route => {
      requests++;
      if (requests === 1) return route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ message: "private database failure" }),
        headers: { "access-control-allow-origin": "http://localhost:3300", "access-control-allow-credentials": "true" } });
      return route.continue();
    });
    await page.goto(role === "ADMIN" ? "/home/admin/comunidad" : "/home/comunidad");
    await expect(page.getByText("No pudimos cargar las normas de convivencia.", { exact: true })).toBeVisible();
    await expect(page.getByText("private database failure", { exact: true })).toHaveCount(0);
    await expect(page.locator(".system-content").getByRole("listitem")).toHaveCount(0);
    const retry = page.getByRole("button", { name: "Reintentar", exact: true });
    await retry.focus(); await page.keyboard.press("Enter");
    const stored = await prisma.normasConvivencia.findUniqueOrThrow({ where: { id: "vigentes" } });
    await expect(page.getByRole("heading", { name: stored.titulo, exact: true })).toBeVisible();
    expect(requests).toBe(2);
  });
}
