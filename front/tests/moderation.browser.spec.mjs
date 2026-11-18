import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { randomUUID } from "node:crypto";
import { hash } from "argon2";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../back/dist/generated/prisma/client.js";

// All application requests reach Nest and a disposable PostgreSQL database. No route mocks.
test.use({ channel: "chrome" });
test.describe.configure({ mode: "serial" });
const password = "Moderacion T6 contraseña segura";
const tag = `t6-${randomUUID()}`;
let prisma, users, materia, cursada, comisiones, feedbackId;
test.beforeAll(async () => {
  if (!process.env.TEST_DATABASE_URL) throw new Error("TEST_DATABASE_URL exclusiva es obligatoria.");
  prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.TEST_DATABASE_URL }) });
  const passwordHash = await hash(password);
  users = await Promise.all(["ADMIN", "USER", "USER", "USER", "USER"].map((role, i) => prisma.user.create({ data: { email: `${tag}-${i}@alu.frlp.utn.edu.ar`, displayName: `${tag} Persona ${i}`, passwordHash, role, emailVerifiedAt: new Date() } })));
  materia = await prisma.materia.create({ data: { nombre: `Materia ${tag}`, modalidad: "ANUAL", carreras: { create: { carrera: "S", anioCarrera: "4" } } } });
  cursada = await prisma.cursada.create({ data: { materiaId: materia.id, anio: 2026, cuatrimestre: "ANUAL" } });
  comisiones = await Promise.all([91, 92].map(numero => prisma.comision.create({ data: { cursadaId: cursada.id, carrera: "S", numero } })));
});
test.afterAll(async () => { await prisma?.$disconnect(); });

async function login(page, user) {
  await page.goto("/login"); await page.getByLabel(/^Email$/).fill(user.email); await page.getByLabel(/^Contraseña$/).fill(password); await page.getByRole("button", { name: /Iniciar sesión/i }).click(); await expect(page).toHaveURL(user.role === "ADMIN" ? /\/home\/admin$/ : /\/home$/);
}
async function create(page, commission, text) {
  await page.goto(`/home/feedback/nuevo?comisionId=${commission.id}`);
  const input = page.getByRole("textbox", { name: "Tu experiencia" });
  await input.fill(text);
  // Assert both the native control and React's derived counter: a DOM-only fill is not a saved draft.
  await expect(input).toHaveValue(text);
  await expect(page.getByText(`${Array.from(text).length} / 3000`, { exact: true })).toBeVisible();
  await page.getByRole("radio", { name: "4 estrellas" }).click(); await page.getByRole("radio", { name: /^De forma anónima/ }).click();
  await expect(input).toHaveValue(text);
  await expect(page.getByText(`${Array.from(text).length} / 3000`, { exact: true })).toBeVisible();
  await expect(page.getByRole("checkbox", { name: /Acepto las Normas/ })).toHaveCount(0);
  if (commission.id === comisiones[0].id) await responsive(page);
  await page.getByRole("button", { name: "Publicar comentario" }).click(); await expect(page).toHaveURL(/\/home\?/); await expect(page.getByRole("status").filter({ hasText: /se publicó correctamente/ })).toBeVisible();
  return (await prisma.feedback.findFirstOrThrow({ where: { autorId: users[1].id, comisionId: commission.id } })).id;
}
async function decision(page, id, label, reason) {
  await page.goto(`/home/admin/experiencias/${id}`); await page.getByRole("button", { name: label, exact: true }).click(); const dialog = page.getByRole("dialog"); await dialog.getByLabel("Justificación obligatoria").fill(reason); await dialog.getByRole("button", { name: "Confirmar decisión" }).click(); await expect(dialog).not.toBeVisible();
}
async function assertPublic(page, id, visible) {
  const response = await page.request.get(`http://localhost:3301/feedback?materiaId=${materia.id}&pageSize=9`); expect(response.status()).toBe(200); const body = await response.json(); expect(body.items.some(item => item.id === id)).toBe(visible); expect(JSON.stringify(body)).not.toMatch(/denunciante|cantidadReportes|ocultoReportes|versionModeracion/);
}
async function responsive(page) {
  for (const width of [360, 600, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    const result = await new AxeBuilder({ page }).analyze(); expect(result.violations.filter(v => ["serious", "critical"].includes(v.impact))).toEqual([]);
  }
}

test("T6 recorrido real principal: autor, dos denunciantes y restitución ADMIN", async ({ browser }) => {
  // Four sessions and six full axe audits are one end-to-end business journey.
  test.slow();
  const authorContext = await browser.newContext(); const adminContext = await browser.newContext(); const author = await authorContext.newPage(); const admin = await adminContext.newPage();
  await login(author, users[1]); await login(admin, users[0]);
  feedbackId = await create(author, comisiones[0], `${tag} contenido aprobado`);
  await author.goto("/home/experiencias?seccion=propias");
  await author.getByRole("link", { name: "Mis experiencias", exact: true }).click(); await expect(author.getByText(`${tag} contenido aprobado`, { exact: true })).toBeVisible(); await expect(author.getByText("Publicada", { exact: true })).toBeVisible();
  await responsive(author);
  await admin.goto("/home/admin/experiencias?estado=APROBADO"); await expect(admin.getByRole("link", { name: "Ver detalle", exact: true }).first()).toBeVisible(); await responsive(admin);
  await assertPublic(author, feedbackId, true);
  await author.goto(`/home/feedback/${feedbackId}`); await author.getByRole("button", { name: "Ocultar experiencia", exact: true }).click(); await author.getByRole("dialog").getByRole("button", { name: "Confirmar", exact: true }).click(); await expect(author.getByRole("button", { name: "Mostrar experiencia", exact: true })).toBeVisible(); await assertPublic(author, feedbackId, false);
  await author.getByRole("button", { name: "Mostrar experiencia", exact: true }).click(); await author.getByRole("dialog").getByRole("button", { name: "Confirmar", exact: true }).click(); await expect(author.getByRole("button", { name: "Ocultar experiencia", exact: true })).toBeVisible(); await assertPublic(author, feedbackId, true);
  for (const reporter of users.slice(2, 4)) {
    const context = await browser.newContext(); const page = await context.newPage(); await login(page, reporter); await page.goto(`/home/experiencias?materiaId=${materia.id}`);
    const article = page.getByRole("article").filter({ hasText: `${tag} contenido aprobado` }); await article.getByRole("button", { name: "Reportar", exact: true }).click();
    const dialog = page.getByRole("dialog");
    if (reporter.id === users[2].id) await responsive(page);
    await dialog.getByLabel("Motivo obligatorio", { exact: true }).selectOption("SPAM"); await dialog.getByRole("button", { name: "Enviar reporte", exact: true }).click(); await expect(page.getByRole("status").filter({ hasText: /reporte/i })).toBeVisible();
    if (reporter.id === users[3].id) await expect(article).toHaveCount(0);
    await context.close();
  }
  await assertPublic(author, feedbackId, false); await author.goto(`/home/feedback/${feedbackId}`); await expect(author.getByText(/Oculta preventivamente por reportes/)).toBeVisible(); await expect(author.getByText(`${tag} contenido aprobado`, { exact: true })).toBeVisible();
  await author.getByRole("button", { name: "Ocultar experiencia", exact: true }).click(); await author.getByRole("dialog").getByRole("button", { name: "Confirmar", exact: true }).click(); await expect(author.getByRole("button", { name: "Mostrar experiencia", exact: true })).toBeVisible();
  await author.getByRole("button", { name: "Mostrar experiencia", exact: true }).click(); await author.getByRole("dialog").getByRole("button", { name: "Confirmar", exact: true }).click(); await expect(author.getByText(/permanece oculta por las otras restricciones/)).toBeVisible();
  await decision(admin, feedbackId, "Ocultar por administración", "Restricción administrativa independiente para verificar restitución parcial");
  const reports = await prisma.feedbackReporte.findMany({ where: { feedbackId }, orderBy: { createdAt: "asc" } }); expect(reports).toHaveLength(2);
  await admin.goto("/home/admin/experiencias?seccion=reportes"); await expect(admin.getByRole("link", { name: "Ver reporte" }).first()).toBeVisible(); await responsive(admin);
  await admin.goto(`/home/admin/experiencias?seccion=reportes&reporteId=${reports[0].id}`);
  const reporterIdentity = admin.getByRole("definition").filter({ hasText: users[2].displayName });
  await expect(reporterIdentity).toContainText(`ID: ${users[2].id}`); await expect(reporterIdentity).toBeVisible(); await expect(admin.getByText(users[2].email, { exact: true })).toHaveCount(0); await responsive(admin);
  await admin.getByRole("button", { name: "Desestimar reporte", exact: true }).click(); await admin.getByRole("dialog").getByLabel("Justificación obligatoria").fill("Reporte revisado y desestimado"); await admin.getByRole("dialog").getByRole("button", { name: "Confirmar decisión" }).click();
  await expect(admin.getByRole("button", { name: "Restituir ocultamiento preventivo", exact: true })).toBeEnabled(); await assertPublic(author, feedbackId, false);
  await admin.getByRole("button", { name: "Restituir ocultamiento preventivo", exact: true }).click(); await admin.getByRole("dialog").getByLabel("Justificación obligatoria").fill("Menos de dos denunciantes abiertos y contenido revisado"); await admin.getByRole("dialog").getByRole("button", { name: "Confirmar decisión" }).click(); await expect(admin.getByRole("dialog")).not.toBeVisible(); await assertPublic(author, feedbackId, false);
  await decision(admin, feedbackId, "Restituir ocultamiento administrativo", "Finalizó la restricción administrativa independiente"); await assertPublic(author, feedbackId, true);
  expect(await prisma.feedback.findUniqueOrThrow({ where: { id: feedbackId } })).toMatchObject({ estadoModeracion: "APROBADO", ocultoAutor: false, ocultoAdministracion: false, ocultoReportes: false });
  await authorContext.close(); await adminContext.close();
});

test("T6 rechazo real: corrección conserva rechazo, reenvío explícito y nueva aprobación", async ({ browser }) => {
  const ac = await browser.newContext(); const dc = await browser.newContext(); const author = await ac.newPage(); const admin = await dc.newPage(); await login(author, users[1]); await login(admin, users[0]);
  const id = await create(author, comisiones[1], `${tag} texto por corregir`); await decision(admin, id, "Rechazar experiencia", "Explicá el contexto académico sin insultos");
  await author.goto(`/home/feedback/${id}`); await expect(author.getByText("Explicá el contexto académico sin insultos", { exact: false })).toBeVisible();
  await author.getByRole("button", { name: "Solicitar nueva revisión", exact: true }).click(); await author.getByRole("dialog").getByRole("button", { name: "Confirmar", exact: true }).click(); await expect(author.getByRole("region", { name: "Tu comentario", exact: true }).getByRole("alert")).toContainText(/correg|cambi|revis/i);
  await author.getByRole("link", { name: "Editar comentario", exact: true }).click();
  await author.getByRole("textbox", { name: "Tu experiencia" }).fill(`${tag} texto corregido respetuoso`); await author.getByRole("button", { name: "Guardar cambios", exact: true }).click(); await expect(author).toHaveURL(new RegExp(`/home/feedback/${id}\\?`));
  expect((await prisma.feedback.findUniqueOrThrow({ where: { id } })).estadoModeracion).toBe("RECHAZADO"); await assertPublic(author, id, false);
  await author.getByRole("button", { name: "Solicitar nueva revisión", exact: true }).click(); await author.getByRole("dialog").getByRole("button", { name: "Confirmar", exact: true }).click(); await expect(author.getByText(/Tu comentario está pendiente de revisión por el equipo administrativo/)).toBeVisible();
  await decision(admin, id, "Aprobar experiencia", "Corrección revisada conforme"); await assertPublic(author, id, true); await ac.close(); await dc.close();
});

test("T6 contratos reales negativos: permisos, Origin, versiones y duplicados", async ({ page }) => {
  await login(page, users[1]);
  const request = (path, data, origin = "http://localhost:3300") => page.request.post(`http://localhost:3301${path}`, { data, headers: { Origin: origin, "X-CSRF-Protection": "1" } });
  expect((await page.request.get("http://localhost:3301/admin/feedback-reportes")).status()).toBe(403);
  expect((await request(`/admin/feedback/${feedbackId}/moderacion`, { accion: "APROBACION", motivo: "No autorizado", versionEsperada: 1 })).status()).toBe(403);
  expect((await request(`/feedback/${feedbackId}/ocultar`, { versionEsperada: 1 })).status()).toBe(409);
  expect((await request(`/feedback/${feedbackId}/ocultar`, { versionEsperada: 1 }, "https://evil.invalid")).status()).toBe(403);
  expect((await request(`/feedback/${feedbackId}/reportes`, { motivo: "SPAM" })).status()).toBe(403);
  await page.context().clearCookies(); expect((await page.request.get("http://localhost:3301/feedback/propios")).status()).toBe(401);
});

test("T6 reportes HTTP reales: reintento idempotente, duplicado distinto y cuota 429", async ({ browser }) => {
  const ac = await browser.newContext(); const dc = await browser.newContext(); const bc = await browser.newContext();
  const author = await ac.newPage(); const admin = await dc.newPage(); const reporter = await bc.newPage();
  await login(author, users[1]); await login(admin, users[0]); await login(reporter, users[2]);
  const headers = { Origin: "http://localhost:3300", "X-CSRF-Protection": "1" };
  const post = (page, path, data) => page.request.post(`http://localhost:3301${path}`, { data, headers });
  for (let index = 0; index < 5; index++) {
    const commission = await prisma.comision.create({ data: { cursadaId: cursada.id, carrera: "S", numero: 100 + index } });
    const created = await post(author, `/comisiones/${commission.id}/feedback`, { texto: `Cuota ${tag} ${index}`, anonimo: true, puntuacion: 3 }); expect(created.status()).toBe(201); const record = await created.json();
    expect((await prisma.feedback.findUniqueOrThrow({ where: { id: record.id } })).estadoModeracion).toBe("APROBADO");
    const result = await post(reporter, `/feedback/${record.id}/reportes`, { motivo: "SPAM" }); expect(result.status()).toBe(index < 4 ? 201 : 429);
    if (index === 0) {
      // Retry immediately on the same version; restoration in the principal journey advances versions.
      const original = await result.json();
      const retry = await post(reporter, `/feedback/${record.id}/reportes`, { motivo: "SPAM" });
      expect(retry.status()).toBe(200); const receipt = await retry.json(); expect(receipt).toMatchObject({ id: original.id }); expect(JSON.stringify(receipt)).not.toMatch(/denunciante|email|token|session/);
      expect((await post(reporter, `/feedback/${record.id}/reportes`, { motivo: "OTRO" })).status()).toBe(409);
    }
  }
  await ac.close(); await dc.close(); await bc.close();
});
