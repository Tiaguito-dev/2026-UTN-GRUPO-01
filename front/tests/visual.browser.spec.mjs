import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { randomUUID } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../back/dist/generated/prisma/client.js";

// Visual baseline and axe scan of the main screens (TASK-023). Baselines are versioned and only
// regenerated from Linux + system Chrome (`--update-snapshots`): fonts differ between systems.
const API = "http://localhost:3301";
const password = " Contraseña de prueba segura 2026 ";
const SCREENS = {
  public: [["landing", "/"], ["login", "/login"]],
  private: [["inicio", "/home"], ["materias", "/home/materias"], ["alta-materia", "/home/admin/materias/nueva"], ["perfil", "/account"], ["cambio-contrasena", "/account/change-password"]],
};
let prisma;
const userIds = [];

// System Google Chrome instead of Playwright's bundled Chromium (decided by the developer on
// 2026-10-21): baselines therefore depend on the installed Chrome version too.
test.use({ channel: "chrome" });

test.beforeAll(async () => {
  if (!process.env.TEST_DATABASE_URL) throw new Error("TEST_DATABASE_URL es obligatorio para las pruebas de navegador.");
  prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.TEST_DATABASE_URL }) });
  await prisma.$connect();
});
test.afterAll(async () => {
  if (!prisma) return;
  await prisma.emailVerificationCredential.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.refreshCredential.deleteMany({ where: { session: { userId: { in: userIds } } } });
  await prisma.session.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await prisma.$disconnect();
});

async function loginAs(page, role) {
  await page.goto("/login");
  const email = `visual-${randomUUID()}@alu.frlp.utn.edu.ar`;
  const registered = await page.evaluate(async ({ url, body }) => {
    const response = await fetch(url, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json", "X-CSRF-Protection": "1" }, body: JSON.stringify(body) });
    return { status: response.status, body: await response.json() };
  }, { url: `${API}/auth/register`, body: { email, displayName: "Cuenta de prueba", password } });
  expect(registered.status).toBe(201); userIds.push(registered.body.id);
  await prisma.user.update({ where: { id: registered.body.id }, data: { role, emailVerifiedAt: new Date() } });
  await page.getByLabel(/^Email$/i).fill(email);
  await page.getByLabel(/^Contraseña$/i).fill(password);
  await page.getByRole("button", { name: /iniciar sesión/i }).click();
  await expect(page).toHaveURL(/\/home(?:\?|$)/);
}

async function check(page, name, path, width) {
  await page.goto(path);
  await expect(page.locator("h1")).toBeVisible();
  // Heading rule (TASK-032): a breadcrumb only when the screen has a parent level.
  await expect(page.getByRole("navigation", { name: "Ubicación actual" }).getByRole("listitem")).not.toHaveCount(1);
  // No screenshot while a "Comprobando sesión…"/"Cargando …" status is still on screen.
  await expect(page.getByRole("status").filter({ hasText: /^(Comprobando|Cargando)/ })).toHaveCount(0);
  await expect(page).toHaveScreenshot(`${name}-${width}.png`, {
    fullPage: true,
    // Data that changes between runs: the catalog in the test database and the random email.
    mask: [page.locator(".card-panel ul, .card-panel .pagination"), page.getByText(/@alu\.frlp\.utn\.edu\.ar/)],
  });
  const { violations } = await new AxeBuilder({ page }).analyze();
  const blocking = violations
    .filter((violation) => ["serious", "critical"].includes(violation.impact))
    .map((violation) => `${violation.id} (${violation.impact}): ${violation.nodes.map((node) => node.target.join(" ")).join(", ")}`);
  expect(blocking, `axe en ${path} a ${width}px`).toEqual([]);
}

for (const width of [390, 1280]) {
  test.describe(`${width}px`, () => {
    test.use({ viewport: { width, height: 900 } });

    test("pantallas públicas", async ({ page }) => {
      for (const [name, path] of SCREENS.public) await test.step(name, () => check(page, name, path, width));
    });

    test("pantallas internas", async ({ page }) => {
      await loginAs(page, "ADMIN");
      for (const [name, path] of SCREENS.private) await test.step(name, () => check(page, name, path, width));
    });

    test("pantallas de los guards", async ({ page }) => {
      // Session check failing with a 5xx (not a 401): the guard shows its temporary error screen.
      await page.route(`${API}/auth/me`, (route) => route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ statusCode: 500, message: "Error temporal de prueba." }) }));
      await test.step("error-sesion", () => check(page, "error-sesion", "/home", width));
      await page.unroute(`${API}/auth/me`);
      await loginAs(page, "USER");
      await test.step("acceso-denegado", () => check(page, "acceso-denegado", "/home/admin", width));
    });
  });
}
