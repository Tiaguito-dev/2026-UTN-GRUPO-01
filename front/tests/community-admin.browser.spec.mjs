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
const output = join(process.cwd(), ".tmp", "community-admin-captures");
const userIds = [];
const writeHeaders = { Origin: "http://localhost:3300", "X-CSRF-Protection": "1" };
let prisma; let original;
test.beforeAll(async () => {
  if (!process.env.TEST_DATABASE_URL) throw new Error("TEST_DATABASE_URL es obligatorio para las pruebas administrativas.");
  prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.TEST_DATABASE_URL }) }); await prisma.$connect();
  original = await prisma.normasConvivencia.findUniqueOrThrow({ where: { id: "vigentes" } });
  await mkdir(output, { recursive: true });
});
test.afterEach(async () => { if (prisma && original) await prisma.normasConvivencia.update({ where: { id: "vigentes" }, data: original }); });
test.afterAll(async () => {
  if (!prisma) return;
  await prisma.emailVerificationCredential.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.refreshCredential.deleteMany({ where: { session: { userId: { in: userIds } } } });
  await prisma.session.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } }); await prisma.$disconnect();
});
async function login(page, role) {
  await page.goto("/login");
  const email = `community-admin-${randomUUID()}@alu.frlp.utn.edu.ar`;
  const response = await page.evaluate(async ({ url, body }) => {
    const response = await fetch(url, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json", "X-CSRF-Protection": "1" }, body: JSON.stringify(body) });
    return { status: response.status, body: await response.json() };
  }, { url: `${API}/auth/register`, body: { aceptaTerminos: true, versionTerminos: "terminos-2026-11-17", email, displayName: "Administración de prueba", password } });
  expect(response.status).toBe(201); userIds.push(response.body.id);
  await prisma.user.update({ where: { id: response.body.id }, data: { role, emailVerifiedAt: new Date() } });
  await page.getByLabel(/^Email$/i).fill(email); await page.getByLabel(/^Contraseña$/i).fill(password);
  await page.getByRole("button", { name: /iniciar sesión/i }).click();
  await expect(page).toHaveURL(role === "ADMIN" ? /\/home\/admin(?:\?|$)/ : /\/home(?:\?|$)/);
  return response.body.id;
}
async function editor(page) {
  await page.goto("/home/admin/comunidad");
  await page.getByRole("link", { name: "Administrar normas de convivencia", exact: true }).click();
  await expect(page).toHaveURL(/\/home\/admin\/comunidad\/editar$/);
  await expect(page.getByRole("textbox", { name: "Título", exact: true })).toHaveValue(original.titulo);
}
async function accessible(page) {
  const { violations } = await new AxeBuilder({ page }).analyze();
  expect(violations.filter(item => ["serious", "critical"].includes(item.impact)).map(item => item.id)).toEqual([]);
}

for (const width of [375, 1280]) {
  test(`HU-C04 ADMIN edita y USER consulta el contenido nuevo a ${width}px`, async ({ page, browser }) => {
    test.setTimeout(90_000); await page.setViewportSize({ width, height: 900 });
    const actor = await login(page, "ADMIN"); await editor(page);
    await expect(page.locator("[data-role-theme]")).toHaveAttribute("data-role-theme", "admin");
    await accessible(page);
    const title = "Construyamos una comunidad todavía mejor";
    await page.getByRole("textbox", { name: "Título", exact: true }).fill(title);
    await page.getByRole("textbox", { name: "Mensaje introductorio" }).fill("Un mensaje actualizado para todos los estudiantes.");
    await page.getByRole("textbox", { name: "Mensaje de cierre" }).fill("Gracias por compartir desde el respeto.");
    await page.getByRole("button", { name: "Agregar norma", exact: true }).click();
    const number = original.normas.length + 1;
    await page.getByRole("textbox", { name: `Norma ${number}`, exact: true }).fill("Nueva norma destacada.");
    for (let position = number; position > 1; position--) await page.getByRole("button", { name: `Subir norma ${position}`, exact: true }).click();
    await page.getByRole("button", { name: "Eliminar norma 2", exact: true }).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width + 1);
    // La cabecera sticky debe quedar arriba en la captura completa, no a la altura del último control usado.
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: join(output, `admin-${width}-formulario.png`), fullPage: true });
    await page.getByRole("button", { name: "Guardar cambios", exact: true }).click();
    await expect(page).toHaveURL(/\/home\/admin\/comunidad\?actualizada=1$/);
    await expect(page.getByRole("heading", { name: title, exact: true })).toBeVisible();
    const stored = await prisma.normasConvivencia.findUniqueOrThrow({ where: { id: "vigentes" } });
    expect(stored.normas).toEqual(["Nueva norma destacada.", ...original.normas.slice(1)]);
    expect(stored.actualizadoPorId).toBe(actor); expect(stored.createdAt).toEqual(original.createdAt);
    const context = await browser.newContext({ viewport: { width, height: 900 } });
    try {
      const student = await context.newPage(); await login(student, "USER"); await student.goto("/home/comunidad");
      await expect(student.getByRole("heading", { name: title, exact: true })).toBeVisible();
      await expect(student.locator(".system-content").getByRole("listitem")).toHaveText(stored.normas);
      await expect(student.getByRole("link", { name: "Administrar normas de convivencia", exact: true })).toHaveCount(0);
      await expect(student.locator("[data-role-theme]")).toHaveAttribute("data-role-theme", "student");
      expect(await student.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width + 1);
      await accessible(student);
      await student.screenshot({ path: join(output, `user-${width}-normas-actualizadas.png`), fullPage: true });
      await student.goto("/home/admin/comunidad/editar");
      await expect(student.getByRole("heading", { name: "Acceso no permitido", exact: true })).toBeVisible();
      await expect(student.getByRole("textbox", { name: "Título", exact: true })).toHaveCount(0);
    } finally { await context.close(); }
  });
}

test("HU-C04 conserva el borrador ante error de guardado y reintenta explícitamente", async ({ page }) => {
  await login(page, "ADMIN"); await editor(page);
  await page.getByRole("textbox", { name: "Título", exact: true }).fill("Borrador que debe conservarse");
  let writes = 0;
  await page.route(`${API}/comunidad/normas`, async route => {
    if (route.request().method() !== "PUT") return route.continue();
    writes++;
    if (writes === 1) return route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ message: "private storage error" }), headers: { "access-control-allow-origin": "http://localhost:3300", "access-control-allow-credentials": "true" } });
    return route.continue();
  });
  await page.getByRole("button", { name: "Guardar cambios", exact: true }).click();
  await expect(page.getByText("No pudimos guardar las normas de convivencia. Intentá nuevamente.", { exact: true })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Título", exact: true })).toHaveValue("Borrador que debe conservarse");
  expect(writes).toBe(1);
  await page.getByRole("button", { name: "Guardar cambios", exact: true }).click();
  await expect(page).toHaveURL(/\/home\/admin\/comunidad\?actualizada=1$/); expect(writes).toBe(2);
});

test("HU-C04 protege Cancelar y enlaces compartidos sin perder el borrador", async ({ page }) => {
  await login(page, "ADMIN"); await editor(page);
  const title = page.getByRole("textbox", { name: "Título", exact: true }); await title.fill("Borrador para confirmar abandono");
  await page.getByRole("navigation", { name: "Navegación principal" }).getByRole("link", { name: "Materias", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Descartar cambios" }); await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Seguir editando", exact: true }).click(); await expect(title).toHaveValue("Borrador para confirmar abandono");
  await page.getByRole("button", { name: "Cancelar", exact: true }).click(); await expect(dialog).toBeVisible();
  await page.keyboard.press("Escape"); await expect(dialog).not.toBeVisible(); await expect(title).toHaveValue("Borrador para confirmar abandono");
  await page.getByRole("button", { name: "Cancelar", exact: true }).click();
  await dialog.getByRole("button", { name: "Descartar y salir", exact: true }).click();
  await expect(page).toHaveURL(/\/home\/admin\/comunidad$/);
  expect(await prisma.normasConvivencia.findUniqueOrThrow({ where: { id: "vigentes" } })).toEqual(original);
});

test("HU-C04 Atrás y recarga requieren decidir si se descartan los cambios", async ({ page }) => {
  await login(page, "ADMIN"); await editor(page);
  const title = page.getByRole("textbox", { name: "Título", exact: true }); await title.fill("Borrador protegido de recarga");
  await page.goBack();
  const dialog = page.getByRole("dialog", { name: "Descartar cambios" }); await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Seguir editando", exact: true }).click(); await expect(title).toHaveValue("Borrador protegido de recarga");
  // page.reload() espera una navegación que no ocurre al cancelar beforeunload.
  // Disparar la recarga nativa y comprobar identidad del documento y borrador conservados.
  const reloadProbe = randomUUID(); const beforeReloadURL = page.url();
  await page.evaluate(probe => { window.__hu04ReloadProbe = probe; }, reloadProbe);
  const beforeUnload = new Promise(resolve => page.once("dialog", async native => {
    expect(native.type()).toBe("beforeunload"); await native.dismiss(); resolve();
  }));
  await page.evaluate(() => window.location.reload());
  await beforeUnload;
  expect(await page.evaluate(() => window.__hu04ReloadProbe)).toBe(reloadProbe);
  await expect(page).toHaveURL(beforeReloadURL);
  await expect(title).toHaveValue("Borrador protegido de recarga");
  await page.goBack(); await expect(dialog).toBeVisible(); await dialog.getByRole("button", { name: "Descartar y salir", exact: true }).click();
  await expect(page).toHaveURL(/\/home\/admin\/comunidad$/);
});

for (const action of ["Cancelar", "Atrás"]) {
  test(`HU-C04 revertir el borrador permite ${action} sin confirmar ni escribir`, async ({ page }) => {
    await login(page, "ADMIN"); await editor(page);
    let writes = 0; let nativeDialogs = 0;
    page.on("request", request => { if (request.method() === "PUT" && new URL(request.url()).pathname === "/comunidad/normas") writes++; });
    page.on("dialog", async dialog => { nativeDialogs++; await dialog.dismiss(); });
    const title = page.getByRole("textbox", { name: "Título", exact: true });
    await title.fill("Borrador temporal que se revierte");
    await title.fill(original.titulo);
    await expect(title).toHaveValue(original.titulo);
    if (action === "Cancelar") await page.getByRole("button", { name: "Cancelar", exact: true }).click();
    else await page.goBack();
    await expect(page).toHaveURL(/\/home\/admin\/comunidad$/);
    await expect(page.getByRole("heading", { name: original.titulo, exact: true })).toBeVisible();
    await expect(page.getByRole("dialog", { name: "Descartar cambios" })).toHaveCount(0);
    expect(nativeDialogs).toBe(0); expect(writes).toBe(0);
    expect(await prisma.normasConvivencia.findUniqueOrThrow({ where: { id: "vigentes" } })).toEqual(original);
  });
}

test("HU-C04 confirma el cierre manual de sesión antes de abandonar un borrador", async ({ page }) => {
  await login(page, "ADMIN"); await editor(page);
  const title = page.getByRole("textbox", { name: "Título", exact: true });
  await title.fill("Borrador que no debe guardarse al cerrar sesión");
  let logouts = 0;
  page.on("request", request => { if (request.method() === "POST" && new URL(request.url()).pathname === "/auth/logout") logouts++; });
  const account = page.getByRole("button", { name: "Opciones de cuenta", exact: true });
  let confirmations = 0;
  page.once("dialog", async dialog => { expect(dialog.type()).toBe("confirm"); confirmations++; await dialog.dismiss(); });
  await account.click(); await page.getByRole("button", { name: "Cerrar sesión", exact: true }).click();
  expect(confirmations).toBe(1);
  expect(logouts).toBe(0);
  await expect(title).toHaveValue("Borrador que no debe guardarse al cerrar sesión");
  if (await account.getAttribute("aria-expanded") !== "true") await account.click();
  page.once("dialog", async dialog => { expect(dialog.type()).toBe("confirm"); confirmations++; await dialog.accept(); });
  await page.getByRole("button", { name: "Cerrar sesión", exact: true }).click();
  await expect(page).toHaveURL(/\/login(?:\?|$)/);
  expect(confirmations).toBe(2);
  expect(logouts).toBe(1);
  expect(await prisma.normasConvivencia.findUniqueOrThrow({ where: { id: "vigentes" } })).toEqual(original);
});

test("HU-C04 proxy conserva permisos y CSRF y persiste PUT administrativo", async ({ browser, request }) => {
  test.skip(!proxy, "Requiere el proxy temporal de validación.");
  const input = { titulo: "Normas guardadas mediante proxy", introduccion: original.introduccion, normas: [...original.normas].reverse(), cierre: original.cierre };
  expect((await request.put(`${proxy}/comunidad/normas`, { headers: writeHeaders, data: input })).status()).toBe(401);
  for (const role of ["USER", "ADMIN"]) {
    const context = await browser.newContext();
    try {
      const actor = await login(await context.newPage(), role);
      if (role === "ADMIN") expect((await context.request.put(`${proxy}/comunidad/normas`, { headers: { Origin: writeHeaders.Origin }, data: input })).status()).toBe(403);
      const response = await context.request.put(`${proxy}/comunidad/normas`, { headers: writeHeaders, data: input });
      expect(response.status()).toBe(role === "ADMIN" ? 200 : 403);
      if (role === "ADMIN") {
        expect(await response.json()).toMatchObject(input);
        const stored = await prisma.normasConvivencia.findUniqueOrThrow({ where: { id: "vigentes" } }); expect(stored.actualizadoPorId).toBe(actor);
      }
    } finally { await context.close(); }
  }
});
