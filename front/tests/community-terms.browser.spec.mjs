import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../back/dist/generated/prisma/client.js";

const API = "http://localhost:3301";
const password = " Contraseña de prueba segura 2026 ";
const ids = []; let prisma; let termsDocument;
test.beforeAll(async () => {
  if (!process.env.TEST_DATABASE_URL) throw new Error("TEST_DATABASE_URL es obligatorio para las pruebas de términos.");
  prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.TEST_DATABASE_URL }) }); await prisma.$connect();
  const response = await fetch(`${API}/auth/terms`); expect(response.status).toBe(200); termsDocument = await response.json();
});
test.afterAll(async () => {
  if (!prisma) return;
  await prisma.emailVerificationCredential.deleteMany({ where: { userId: { in: ids } } });
  await prisma.refreshCredential.deleteMany({ where: { session: { userId: { in: ids } } } });
  await prisma.session.deleteMany({ where: { userId: { in: ids } } });
  await prisma.user.deleteMany({ where: { id: { in: ids } } }); await prisma.$disconnect();
});
async function login(page, role) {
  await page.goto("/login"); await expect(page.getByRole("heading", { name: "Iniciar sesión", level: 1, exact: true })).toBeFocused();
  const email = `terms-community-${randomUUID()}@alu.frlp.utn.edu.ar`;
  const created = await page.evaluate(async ({ url, body }) => {
    const response = await fetch(url, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json", "X-CSRF-Protection": "1" }, body: JSON.stringify(body) });
    return { status: response.status, body: await response.json() };
  }, { url: `${API}/auth/register`, body: { email, displayName: "Consulta de términos", password, aceptaTerminos: true, versionTerminos: termsDocument.version } });
  expect(created.status).toBe(201); ids.push(created.body.id);
  await prisma.user.update({ where: { id: created.body.id }, data: { role, emailVerifiedAt: new Date() } });
  await page.getByLabel(/^Email$/i).fill(email); await page.getByLabel(/^Contraseña$/i).fill(password);
  await page.getByRole("button", { name: "Iniciar sesión", exact: true }).click(); await expect(page).toHaveURL(role === "ADMIN" ? /\/home\/admin(?:\?|$)/ : /\/home(?:\?|$)/);
  return created.body.id;
}
async function community(page, role) {
  await page.goto(role === "ADMIN" ? "/home/admin/comunidad" : "/home/comunidad");
  await expect(page.getByRole("heading", { name: "Comunidad", level: 1, exact: true })).toBeFocused();
}

for (const width of [375, 1280]) for (const role of ["USER", "ADMIN"]) {
  test(`HU-C05 ${role} consulta el documento real sin aceptar nuevamente a ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 }); const id = await login(page, role);
    const accepted = await prisma.aceptacionNormas.findMany({ where: { usuarioId: id } });
    let termsReads = 0; page.on("request", request => { if (request.url() === `${API}/auth/terms` && request.method() === "GET") termsReads++; });
    await community(page, role); const opener = page.getByRole("button", { name: "Ver términos y condiciones", exact: true });
    await expect(opener).toBeVisible(); expect(termsReads).toBe(0);
    const termsRegion = page.getByRole("region", { name: "Términos y condiciones", exact: true });
    const blocks = [page.getByRole("region", { name: "Normas de convivencia", exact: true }), page.getByRole("region", { name: role === "USER" ? "Dale una sugerencia a los creadores." : "Sugerencias recibidas", exact: true })];
    for (const block of blocks) {
      await expect(block).toBeVisible(); const box = await block.boundingBox(); const termsBox = await termsRegion.boundingBox();
      expect(box).not.toBeNull(); expect(termsBox).not.toBeNull(); expect(termsBox.y).toBeGreaterThanOrEqual(box.y + box.height);
    }
    const draft = "Borrador privado conservado durante la lectura de términos.";
    if (role === "USER") { await page.getByRole("textbox", { name: "Sugerencia", exact: true }).fill(draft); await expect(page.getByText(`${draft.length} / 5000 caracteres`, { exact: true })).toBeVisible(); }
    for (const method of ["Cerrar", "X", "Escape"]) {
      await opener.click(); const dialog = page.getByRole("dialog", { name: "Términos y condiciones", exact: true });
      await expect(dialog.getByText(`Versión ${termsDocument.version}`, { exact: true })).toBeVisible();
      await expect(dialog.locator("h3")).toHaveText(termsDocument.secciones.map(section => section.titulo));
      for (const section of termsDocument.secciones) for (const paragraph of section.parrafos) expect(await dialog.getByText(paragraph, { exact: true }).count()).toBeGreaterThan(0);
      await expect(dialog.getByRole("checkbox")).toHaveCount(0);
      // Chrome permite Tab hacia su propia UI; verificar los controles del modal y el fondo inert.
      const documentRegion = dialog.getByRole("region", { name: "Texto de los términos y condiciones", exact: true });
      const footerClose = dialog.getByRole("button", { name: "Cerrar", exact: true }).first();
      const cross = dialog.locator(".dialog-close");
      expect(await dialog.evaluate(node => node.matches(":modal"))).toBe(true);
      await documentRegion.focus(); await documentRegion.press("Tab"); await expect(footerClose).toBeFocused();
      await footerClose.press("Tab"); await expect(cross).toBeFocused();
      await cross.press("Shift+Tab"); await expect(footerClose).toBeFocused();
      await footerClose.press("Shift+Tab"); await expect(documentRegion).toBeFocused();
      await opener.focus(); await expect(opener).not.toBeFocused(); await expect(documentRegion).toBeFocused();
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width + 1);
      if (method === "Escape") await page.keyboard.press("Escape");
      else if (method === "X") await dialog.locator(".dialog-close").click();
      else await dialog.getByRole("button", { name: "Cerrar", exact: true }).first().click();
      await expect(dialog).toHaveCount(0); await expect(opener).toBeFocused();
    }
    expect(termsReads).toBe(3);
    expect(await prisma.aceptacionNormas.findMany({ where: { usuarioId: id } })).toEqual(accepted);
    if (role === "USER") await expect(page.getByRole("textbox", { name: "Sugerencia", exact: true })).toHaveValue(draft);
    await expect(page.locator("[data-role-theme]")).toHaveAttribute("data-role-theme", role === "ADMIN" ? "admin" : "student");
  });
}

test("HU-C05 un error de consulta permite reintentar y cerrar sin consentimiento", async ({ page }) => {
  const id = await login(page, "USER"); await community(page, "USER"); const before = await prisma.aceptacionNormas.findMany({ where: { usuarioId: id } }); let reads = 0;
  await page.route(`${API}/auth/terms`, async route => {
    reads++; if (reads === 1) return route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ message: "temporary" }), headers: { "access-control-allow-origin": "http://localhost:3300", "access-control-allow-credentials": "true" } });
    return route.continue();
  });
  const opener = page.getByRole("button", { name: "Ver términos y condiciones", exact: true }); await opener.click();
  const dialog = page.getByRole("dialog", { name: "Términos y condiciones", exact: true }); await expect(dialog.getByRole("alert")).toBeVisible();
  await dialog.getByRole("button", { name: "Reintentar términos y condiciones", exact: true }).click();
  await expect(dialog.getByText(`Versión ${termsDocument.version}`, { exact: true })).toBeVisible(); expect(reads).toBe(2);
  await expect.poll(() => dialog.evaluate(node => node.contains(document.activeElement))).toBe(true);
  await page.keyboard.press("Escape"); await expect(dialog).toHaveCount(0); await expect(opener).toBeFocused();
  expect(await prisma.aceptacionNormas.findMany({ where: { usuarioId: id } })).toEqual(before);
});

test("HU-C05 el registro conserva datos y aceptación obligatoria al reutilizar el visor", async ({ page }) => {
  const email = `terms-registration-${randomUUID()}@alu.frlp.utn.edu.ar`;
  await page.goto("/register"); await expect(page.getByRole("heading", { name: "Crear cuenta", level: 1, exact: true })).toBeFocused();
  await page.getByRole("textbox", { name: "Email", exact: true }).fill(email); await page.getByRole("textbox", { name: "Nombre visible", exact: true }).fill("Registro preservado");
  await page.getByLabel(/^Contraseña$/i).fill(password);
  const checkbox = page.getByRole("checkbox", { name: "He leído y acepto los Términos y condiciones", exact: true }); await expect(checkbox).not.toBeChecked();
  await expect(checkbox).toBeEnabled();
  const link = page.getByRole("link", { name: "Términos y condiciones", exact: true }); await link.click();
  const dialog = page.getByRole("dialog", { name: "Términos y condiciones", exact: true }); await expect(dialog.getByText(`Versión ${termsDocument.version}`, { exact: true })).toBeVisible();
  await expect(dialog.locator("h3")).toHaveText(termsDocument.secciones.map(section => section.titulo));
  for (const section of termsDocument.secciones) for (const paragraph of section.parrafos) expect(await dialog.getByText(paragraph, { exact: true }).count()).toBeGreaterThan(0);
  await page.keyboard.press("Escape"); await expect(dialog).toHaveCount(0); await expect(link).toBeFocused();
  await expect(checkbox).not.toBeChecked(); await expect(page.getByRole("textbox", { name: "Email", exact: true })).toHaveValue(email); await expect(page.getByLabel(/^Contraseña$/i)).toHaveValue(password);
  await page.getByRole("button", { name: "Crear cuenta", exact: true }).click();
  await expect(page.getByText("Debés aceptar los términos y condiciones para crear tu cuenta", { exact: true })).toBeVisible();
  expect(await prisma.user.count({ where: { email } })).toBe(0);
  await checkbox.check(); const created = page.waitForResponse(response => response.url() === `${API}/auth/register` && response.request().method() === "POST");
  await page.getByRole("button", { name: "Crear cuenta", exact: true }).click(); const response = await created; expect(response.status()).toBe(201); const user = await response.json(); ids.push(user.id);
  const accepted = await prisma.aceptacionNormas.findMany({ where: { usuarioId: user.id } }); expect(accepted).toHaveLength(1); expect(accepted[0].version).toBe(termsDocument.version);
});
