import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { randomUUID } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../back/dist/generated/prisma/client.js";

const API = "http://localhost:3301"; const proxy = process.env.COMMUNITY_PROXY_URL;
const password = " Contraseña de prueba segura 2026 ";
const headers = { Origin: "http://localhost:3300", "X-CSRF-Protection": "1" };
const userIds = []; let prisma;
test.beforeAll(async () => {
  if (!process.env.TEST_DATABASE_URL) throw new Error("TEST_DATABASE_URL obligatorio");
  prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.TEST_DATABASE_URL }) }); await prisma.$connect();
});
test.afterEach(async () => {
  await prisma.sugerencia.deleteMany({ where: { usuarioId: { in: userIds } } });
});
test.afterAll(async () => {
  if (!prisma) return;
  await prisma.emailVerificationCredential.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.refreshCredential.deleteMany({ where: { session: { userId: { in: userIds } } } });
  await prisma.session.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } }); await prisma.$disconnect();
});
async function login(page, role = "ADMIN") {
  await page.goto("/login"); const email = `inbox-${randomUUID()}@alu.frlp.utn.edu.ar`;
  const registration = await page.request.post(`${API}/auth/register`, { headers, data: { aceptaTerminos: true, versionTerminos: "terminos-2026-11-17", email, displayName: "Estudiante de prueba", password } });
  expect(registration.status()).toBe(201); const { id } = await registration.json(); userIds.push(id);
  await prisma.user.update({ where: { id }, data: { role, emailVerifiedAt: new Date() } });
  await page.getByLabel(/^Email$/i).fill(email); await page.getByLabel(/^Contraseña$/i).fill(password);
  await page.getByRole("button", { name: /iniciar sesión/i }).click();
  await expect(page).toHaveURL(role === "ADMIN" ? /\/home\/admin(?:\?|$)/ : /\/home(?:\?|$)/);
  return id;
}
async function seed(count = 1) {
  const author = await prisma.user.create({ data: { email: `author-${randomUUID()}@example.test`, displayName: "María Estudiante", passwordHash: "unused-fixture", role: "USER" } }); userIds.push(author.id);
  const rows = Array.from({ length: count }, (_, index) => ({
    id: randomUUID(), usuarioId: author.id, solicitudId: randomUUID(), categoria: "MEJORA_PLATAFORMA",
    contenido: `Idea privada ${String(index + 1).padStart(2, "0")} para mejorar Comunidad.`,
    createdAt: new Date(Date.UTC(2026, 10, 18, 12, index)),
  }));
  await prisma.sugerencia.createMany({ data: rows }); return rows;
}
const inbox = page => page.getByRole("region", { name: "Sugerencias recibidas", exact: true });
async function open(page, query = "") {
  await page.goto(`/home/admin/comunidad${query}`);
  await expect(page.getByRole("heading", { level: 1, name: "Comunidad", exact: true })).toBeFocused();
  await expect(inbox(page)).toBeVisible();
}

for (const width of [375, 1280]) {
  test(`HU-C03 ADMIN marca, recarga, filtra y elimina con confirmación a ${width}px`, async ({ page }) => {
    test.setTimeout(90_000); await page.setViewportSize({ width, height: 900 });
    await login(page); const [stored] = await seed(); await open(page);
    let item = inbox(page).getByRole("article", { name: "Sugerencia de María Estudiante" });
    await expect(item.getByText("Mejora de la plataforma", { exact: true })).toBeVisible();
    await expect(item.getByText(stored.contenido, { exact: true })).toBeVisible();
    await expect(page.locator("[data-role-theme]")).toHaveAttribute("data-role-theme", "admin");
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width + 1);
    const violations = (await new AxeBuilder({ page }).analyze()).violations;
    expect(violations.filter(v => ["serious", "critical"].includes(v.impact)).map(v => v.id)).toEqual([]);
    await page.evaluate(() => { window.__huC03Document = "same-document"; });
    await item.getByRole("button", { name: "Me gusta", exact: true }).click();
    await expect(item.getByRole("button", { name: "Me gusta", exact: true })).toHaveAttribute("aria-pressed", "true");
    expect(await page.evaluate(() => window.__huC03Document)).toBe("same-document");
    expect(await prisma.sugerencia.findUnique({ where: { id: stored.id } })).toMatchObject({ meGusta: true });
    await page.reload();
    await expect(item.getByRole("button", { name: "Me gusta", exact: true })).toHaveAttribute("aria-pressed", "true");
    await inbox(page).getByRole("group", { name: "Filtrar sugerencias" }).getByRole("button", { name: "Me gusta", exact: true }).click();
    await expect(page).toHaveURL(/soloMeGusta=true/);
    await item.getByRole("button", { name: "Me gusta", exact: true }).click();
    await expect(inbox(page).getByText("No hay sugerencias marcadas con Me gusta.", { exact: true })).toBeVisible();
    await inbox(page).getByRole("button", { name: "Todas", exact: true }).click();
    await expect(item).toBeVisible();
    await item.getByRole("button", { name: "Eliminar sugerencia", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Eliminar sugerencia", exact: true });
    await expect(dialog).toBeVisible(); await expect(dialog.getByRole("button", { name: "Cancelar", exact: true })).toBeFocused();
    await page.keyboard.press("Escape"); await expect(dialog).not.toBeVisible();
    expect((await prisma.sugerencia.findUniqueOrThrow({ where: { id: stored.id } })).deletedAt).toBeNull();
    await expect(item.getByRole("button", { name: "Eliminar sugerencia", exact: true })).toBeFocused();
    await item.getByRole("button", { name: "Eliminar sugerencia", exact: true }).press("Enter");
    await dialog.getByRole("button", { name: "Cancelar", exact: true }).click(); await expect(dialog).not.toBeVisible();
    await item.getByRole("button", { name: "Eliminar sugerencia", exact: true }).click();
    await dialog.getByRole("button", { name: "Confirmar eliminación", exact: true }).click();
    await expect(inbox(page).getByText("La sugerencia se eliminó correctamente.", { exact: true })).toBeVisible();
    await expect(inbox(page).getByText("Todavía no hay sugerencias para mostrar.", { exact: true })).toBeVisible();
    expect((await prisma.sugerencia.findUniqueOrThrow({ where: { id: stored.id } })).deletedAt).not.toBeNull();
    await expect(page.getByRole("heading", { name: "Normas de convivencia", exact: true })).toBeVisible();
  });
}

test("HU-C03 página final vuelve a la anterior al eliminar su única sugerencia", async ({ page }) => {
  await login(page); const rows = await seed(21); await open(page);
  await expect(inbox(page).getByRole("article")).toHaveCount(20);
  await expect(inbox(page).getByRole("article").first()).toContainText(rows[20].contenido);
  await inbox(page).getByRole("button", { name: "Página siguiente", exact: true }).click();
  await expect(page).toHaveURL(/page=2/); await expect(inbox(page).getByRole("article")).toHaveCount(1);
  await inbox(page).getByRole("button", { name: "Eliminar sugerencia", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Confirmar eliminación" }).click();
  await expect(page).not.toHaveURL(/page=2/); await expect(inbox(page).getByRole("article")).toHaveCount(20);
});

test("HU-C03 informa errores de listado y mutaciones y permite reintentar", async ({ page }) => {
  await login(page); const [stored] = await seed(); let allowReads = false; let puts = 0; let deletes = 0;
  const fail = route => route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ message: "Servicio temporalmente no disponible." }), headers: { "access-control-allow-origin": "http://localhost:3300", "access-control-allow-credentials": "true" } });
  await page.route(`${API}/comunidad/sugerencias**`, async route => {
    const method = route.request().method();
    // Next dev puede ejecutar nuevamente el efecto inicial en StrictMode; mantener el fallo
    // hasta la acción explícita evita que el montaje consuma el escenario de reintento.
    if (method === "GET" && !allowReads) return fail(route);
    if (method === "PUT" && ++puts === 1) return fail(route);
    if (method === "DELETE" && ++deletes === 1) return fail(route);
    return route.continue();
  });
  await open(page); await expect(inbox(page).getByRole("alert")).toContainText("No pudimos cargar");
  allowReads = true;
  await inbox(page).getByRole("button", { name: "Reintentar" }).click();
  const item = inbox(page).getByRole("article");
  await item.getByRole("button", { name: "Me gusta", exact: true }).click();
  await expect(inbox(page).getByRole("alert")).toContainText("No pudimos actualizar Me gusta");
  expect((await prisma.sugerencia.findUniqueOrThrow({ where: { id: stored.id } })).meGusta).toBe(false);
  await item.getByRole("button", { name: "Me gusta", exact: true }).click();
  await expect(item.getByRole("button", { name: "Me gusta", exact: true })).toHaveAttribute("aria-pressed", "true");
  await item.getByRole("button", { name: "Eliminar sugerencia", exact: true }).click();
  const dialog = page.getByRole("dialog"); await dialog.getByRole("button", { name: "Confirmar eliminación" }).click();
  await expect(dialog.getByRole("alert")).toContainText("No pudimos eliminar");
  await dialog.getByRole("button", { name: "Confirmar eliminación" }).click(); await expect(dialog).not.toBeVisible();
  await expect(inbox(page).getByText("La sugerencia se eliminó correctamente.", { exact: true })).toBeVisible();
});

test("HU-C03 Nginx aplica ADMIN y CSRF, comparte Me gusta y no resucita una baja", async ({ browser, request }) => {
  test.skip(!proxy, "Requiere proxy temporal existente");
  expect((await request.get(`${proxy}/comunidad/sugerencias`)).status()).toBe(401);
  const contexts = await Promise.all([browser.newContext(), browser.newContext(), browser.newContext()]);
  try {
    const [user, admin, other] = contexts; await login(await user.newPage(), "USER");
    await login(await admin.newPage()); await login(await other.newPage());
    const body = { solicitudId: randomUUID(), categoria: "OTROS", contenido: "No resucitar esta sugerencia privada." };
    const created = await user.request.post(`${proxy}/comunidad/sugerencias`, { headers, data: body }); expect(created.status()).toBe(201);
    const receipt = await created.json(); const path = `${proxy}/comunidad/sugerencias/${receipt.id}`;
    expect((await user.request.get(`${proxy}/comunidad/sugerencias`)).status()).toBe(403);
    expect((await user.request.put(`${path}/me-gusta`, { headers, data: { meGusta: true } })).status()).toBe(403);
    expect((await user.request.delete(path, { headers })).status()).toBe(403);
    expect((await admin.request.put(`${path}/me-gusta`, { headers: { Origin: headers.Origin }, data: { meGusta: true } })).status()).toBe(403);
    expect((await admin.request.put(`${path}/me-gusta`, { headers: { ...headers, Origin: "https://evil.example" }, data: { meGusta: true } })).status()).toBe(403);
    expect((await admin.request.put(`${path}/me-gusta`, { headers, data: { meGusta: true } })).status()).toBe(200);
    const list = await other.request.get(`${proxy}/comunidad/sugerencias?soloMeGusta=true`); expect(list.status()).toBe(200);
    expect(list.headers()["cache-control"]).toBe("no-store");
    const payload = await list.json(); expect(payload.items).toHaveLength(1); expect(payload.items[0]).toMatchObject({ id: receipt.id, meGusta: true });
    expect(JSON.stringify(payload)).not.toContain(body.solicitudId); expect(payload.items[0].autor).toEqual({ displayName: "Estudiante de prueba" });
    expect((await other.request.put(`${path}/me-gusta`, { headers, data: { meGusta: false } })).status()).toBe(200);
    expect((await admin.request.delete(path, { headers: { Origin: headers.Origin } })).status()).toBe(403);
    expect((await admin.request.delete(path, { headers })).status()).toBe(204);
    const retry = await user.request.post(`${proxy}/comunidad/sugerencias`, { headers, data: body }); expect(await retry.json()).toEqual(receipt);
    expect((await (await admin.request.get(`${proxy}/comunidad/sugerencias`)).json()).items).toEqual([]);
    expect((await admin.request.put(`${path}/me-gusta`, { headers, data: { meGusta: true } })).status()).toBe(404);
  } finally { await Promise.all(contexts.map(context => context.close())); }
});
