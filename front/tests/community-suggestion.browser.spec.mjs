import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../back/dist/generated/prisma/client.js";

const API = "http://localhost:3301";
const proxy = process.env.COMMUNITY_PROXY_URL;
const password = " Contraseña de prueba segura 2026 ";
const success = "¡Gracias por tu sugerencia! Tu opinión nos ayuda a seguir mejorando Professors' Butchery.";
const output = join(process.cwd(), ".tmp", "community-suggestion-captures");
const headers = { Origin: "http://localhost:3300", "X-CSRF-Protection": "1" };
const userIds = []; let prisma;
test.beforeAll(async () => {
  if (!process.env.TEST_DATABASE_URL) throw new Error("TEST_DATABASE_URL es obligatorio para las pruebas de sugerencias.");
  prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.TEST_DATABASE_URL }) }); await prisma.$connect(); await mkdir(output, { recursive: true });
});
test.afterAll(async () => {
  if (!prisma) return;
  await prisma.sugerencia.deleteMany({ where: { usuarioId: { in: userIds } } });
  await prisma.emailVerificationCredential.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.refreshCredential.deleteMany({ where: { session: { userId: { in: userIds } } } });
  await prisma.session.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } }); await prisma.$disconnect();
});
async function login(page, role = "USER") {
  await page.goto("/login"); const email = `suggestion-${randomUUID()}@alu.frlp.utn.edu.ar`;
  const response = await page.evaluate(async ({ url, body }) => {
    const response = await fetch(url, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json", "X-CSRF-Protection": "1" }, body: JSON.stringify(body) });
    return { status: response.status, body: await response.json() };
  }, { url: `${API}/auth/register`, body: { aceptaTerminos: true, versionTerminos: "terminos-2026-11-17", email, displayName: "Sugerencias de prueba", password } });
  expect(response.status).toBe(201); userIds.push(response.body.id);
  await prisma.user.update({ where: { id: response.body.id }, data: { role, emailVerifiedAt: new Date() } });
  await page.getByLabel(/^Email$/i).fill(email); await page.getByLabel(/^Contraseña$/i).fill(password);
  await page.getByRole("button", { name: /iniciar sesión/i }).click(); await expect(page).toHaveURL(role === "ADMIN" ? /\/home\/admin(?:\?|$)/ : /\/home(?:\?|$)/);
  return response.body.id;
}
async function openForm(page) {
  await page.goto("/home/comunidad");
  // Esperar el foco inicial del PageHeader antes de escribir; las normas pueden seguir cargando.
  await expect(page.getByRole("heading", { name: "Comunidad", level: 1, exact: true })).toBeFocused();
  await expect(page.getByRole("heading", { name: "Dale una sugerencia a los creadores.", exact: true })).toBeVisible();
}
async function fill(page, text, category = "OTROS") {
  await page.getByRole("combobox", { name: "Categoría", exact: true }).selectOption(category);
  await page.getByRole("textbox", { name: "Sugerencia", exact: true }).fill(text);
  await expect(page.getByRole("combobox", { name: "Categoría", exact: true })).toHaveValue(category);
  await expect(page.getByRole("textbox", { name: "Sugerencia", exact: true })).toHaveValue(text);
  await expect(page.getByText(`${text.length} / 5000 caracteres`, { exact: true })).toBeVisible();
}
async function send(page) { await page.getByRole("button", { name: "Enviar sugerencia", exact: true }).click(); }

for (const width of [375, 1280]) {
  test(`HU-C02 USER envía una sugerencia privada y recibe confirmación a ${width}px`, async ({ page }) => {
    test.setTimeout(90_000); await page.setViewportSize({ width, height: 900 }); const id = await login(page); await openForm(page);
    await expect(page.getByRole("combobox", { name: "Categoría", exact: true })).toHaveValue("");
    await expect(page.getByText("Solo los administradores podrán leer tu sugerencia.", { exact: true })).toBeVisible();
    const rules = page.getByRole("region", { name: "Normas de convivencia", exact: true });
    const suggestion = page.getByRole("region", { name: "Dale una sugerencia a los creadores.", exact: true });
    await expect(rules).toBeVisible();
    const rulesBox = await rules.boundingBox(); const suggestionBox = await suggestion.boundingBox();
    expect(rulesBox).not.toBeNull(); expect(suggestionBox).not.toBeNull();
    if (width === 1280) { expect(suggestionBox.x).toBeGreaterThanOrEqual(rulesBox.x + rulesBox.width); expect(suggestionBox.y).toBeLessThan(rulesBox.y + rulesBox.height); }
    else expect(suggestionBox.y).toBeGreaterThanOrEqual(rulesBox.y + rulesBox.height);
    const text = `Una mejora privada del estudiante a ${width}px.`; await fill(page, text, "MEJORA_PLATAFORMA");
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width + 1);
    const { violations } = await new AxeBuilder({ page }).analyze(); expect(violations.filter(item => ["serious", "critical"].includes(item.impact)).map(item => item.id)).toEqual([]);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: join(output, `user-${width}-formulario.png`), fullPage: true });
    const receiptResponse = page.waitForResponse(response => response.url() === `${API}/comunidad/sugerencias` && response.request().method() === "POST");
    const button = page.getByRole("button", { name: "Enviar sugerencia", exact: true }); await button.focus(); await page.keyboard.press("Enter");
    const response = await receiptResponse; expect(response.status()).toBe(201); expect(Object.keys(await response.json()).sort()).toEqual(["createdAt", "id"]);
    await expect(page.getByText(success, { exact: true })).toBeVisible();
    await expect(page.getByRole("combobox", { name: "Categoría", exact: true })).toHaveValue("");
    await expect(page.getByRole("textbox", { name: "Sugerencia", exact: true })).toHaveValue("");
    expect(await prisma.sugerencia.findMany({ where: { usuarioId: id }, select: { categoria: true, contenido: true } })).toEqual([{ categoria: "MEJORA_PLATAFORMA", contenido: text }]);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: join(output, `user-${width}-confirmacion.png`), fullPage: true });
    await page.reload(); await expect(page.getByRole("textbox", { name: "Sugerencia", exact: true })).toHaveValue("");
    await expect(page.getByText(text, { exact: true })).toHaveCount(0);
  });
}

test("HU-C02 una respuesta perdida se reintenta con la misma clave sin duplicar", async ({ page }) => {
  const id = await login(page); await openForm(page); const payloads = []; let writes = 0;
  await page.route(`${API}/comunidad/sugerencias`, async route => {
    if (route.request().method() !== "POST") return route.continue();
    writes++; payloads.push(route.request().postDataJSON());
    if (writes === 1) { const response = await route.fetch(); expect(response.status()).toBe(201); await route.abort("failed"); return; }
    return route.continue();
  });
  const text = "Idea privada cuya primera respuesta se pierde."; await fill(page, text); await send(page);
  await expect(page.getByText("No pudimos enviar tu sugerencia. Intentá nuevamente.", { exact: true })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Sugerencia", exact: true })).toHaveValue(text);
  expect(await prisma.sugerencia.count({ where: { usuarioId: id } })).toBe(1);
  await send(page); await expect(page.getByText(success, { exact: true })).toBeVisible();
  expect(writes).toBe(2); expect(payloads[1]).toEqual(payloads[0]); expect(await prisma.sugerencia.count({ where: { usuarioId: id } })).toBe(1);
});

test("HU-C02 cambiar un envío incierto requiere Nueva sugerencia explícita", async ({ page }) => {
  const id = await login(page); await openForm(page); const payloads = []; let writes = 0;
  await page.route(`${API}/comunidad/sugerencias`, async route => {
    if (route.request().method() !== "POST") return route.continue();
    writes++; payloads.push(route.request().postDataJSON());
    if (writes === 1) { await route.fetch(); await route.abort("failed"); return; }
    return route.continue();
  });
  await fill(page, "Primera idea persistida sin respuesta."); await send(page);
  await expect(page.getByText("No pudimos enviar tu sugerencia. Intentá nuevamente.", { exact: true })).toBeVisible();
  await page.getByRole("textbox", { name: "Sugerencia", exact: true }).fill("Segunda idea como operación nueva."); await send(page);
  await expect(page.getByText("Para enviar otro contenido, elegí Nueva sugerencia.", { exact: true })).toBeVisible(); expect(writes).toBe(1);
  await page.getByRole("button", { name: "Nueva sugerencia", exact: true }).click(); await send(page);
  await expect(page.getByText(success, { exact: true })).toBeVisible(); expect(payloads[1].solicitudId).not.toBe(payloads[0].solicitudId);
  expect(await prisma.sugerencia.count({ where: { usuarioId: id } })).toBe(2);
});

test("HU-C02 ADMIN conserva normas y no recibe formulario de sugerencias", async ({ page }) => {
  await login(page, "ADMIN"); await page.goto("/home/admin/comunidad");
  await expect(page.getByRole("link", { name: "Administrar normas de convivencia", exact: true })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Sugerencia", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Enviar sugerencia", exact: true })).toHaveCount(0);
  await expect(page.locator("[data-role-theme]")).toHaveAttribute("data-role-theme", "admin");
});

test("HU-C02 reintentar normas conserva el borrador privado sin enviar nada", async ({ page }) => {
  const id = await login(page); let reads = 0;
  await page.route(`${API}/comunidad/normas`, async route => {
    if (route.request().method() !== "GET") return route.continue();
    reads++;
    if (reads === 1) return route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ message: "temporary" }), headers: { "access-control-allow-origin": "http://localhost:3300", "access-control-allow-credentials": "true" } });
    return route.continue();
  });
  await openForm(page);
  await expect(page.getByText("No pudimos cargar las normas de convivencia.", { exact: true })).toBeVisible();
  const draft = "Borrador privado mientras se recuperan las normas."; await fill(page, draft, "REPORTAR_ERROR");
  await page.getByRole("button", { name: "Reintentar", exact: true }).click();
  const stored = await prisma.normasConvivencia.findUniqueOrThrow({ where: { id: "vigentes" } });
  await expect(page.getByRole("heading", { name: stored.titulo, exact: true })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Sugerencia", exact: true })).toHaveValue(draft);
  await expect(page.getByRole("combobox", { name: "Categoría", exact: true })).toHaveValue("REPORTAR_ERROR");
  expect(reads).toBe(2); expect(await prisma.sugerencia.count({ where: { usuarioId: id } })).toBe(0);
});

test("HU-C02 proxy conserva sesión, rol, CSRF e idempotencia y no publica sugerencias", async ({ browser, request }) => {
  test.skip(!proxy, "Requiere el proxy temporal de validación.");
  const data = { solicitudId: randomUUID(), categoria: "REPORTAR_ERROR", contenido: "Reporte privado a través del proxy." };
  expect((await request.post(`${proxy}/comunidad/sugerencias`, { headers, data })).status()).toBe(401);
  for (const role of ["ADMIN", "USER"]) {
    const context = await browser.newContext();
    try {
      const id = await login(await context.newPage(), role);
      if (role === "USER") expect((await context.request.post(`${proxy}/comunidad/sugerencias`, { headers: { Origin: headers.Origin }, data })).status()).toBe(403);
      const response = await context.request.post(`${proxy}/comunidad/sugerencias`, { headers, data }); expect(response.status()).toBe(role === "USER" ? 201 : 403);
      if (role === "USER") {
        const receipt = await response.json(); const retry = await context.request.post(`${proxy}/comunidad/sugerencias`, { headers, data }); expect(await retry.json()).toEqual(receipt);
        expect(await prisma.sugerencia.count({ where: { usuarioId: id } })).toBe(1);
        for (const path of ["/comunidad/sugerencias", `/comunidad/sugerencias/${receipt.id}`]) expect((await context.request.get(`${proxy}${path}`)).status()).toBe(404);
      }
    } finally { await context.close(); }
  }
});
