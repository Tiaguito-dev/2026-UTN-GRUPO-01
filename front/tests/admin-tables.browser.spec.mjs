import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const date = "2026-01-01T00:00:00.000Z";
const materia = { id: "m1", nombre: "Arquitectura de sistemas y administración de organizaciones con nombres extensos", modalidad: "ANUAL", carreras: [{ carrera: "S", anioCarrera: "4", nivelElectiva: null }], createdAt: date, deletedAt: null };
const profesor = { id: "p1", nombreCompleto: "María de los Ángeles Fernández de la Cruz", createdAt: date, deletedAt: null };
const cursada = { id: "c1", materiaId: "m1", anio: 2026, cuatrimestre: "ANUAL", comisiones: 1, profesores: 1, carreras: ["S"], materia, createdAt: date, deletedAt: null };
const comision = { id: "co1", cursadaId: "c1", carrera: "S", numero: 41, nombre: "S-41", activa: true, profesores: [{ id: "p1", nombreCompleto: profesor.nombreCompleto, cargo: "TITULAR" }], createdAt: date, deletedAt: null, cursada };
const usuario = { id: "u1", displayName: "Administración de prueba", email: "prueba@alu.frlp.utn.edu.ar", role: "ADMIN", createdAt: date, disabledAt: null };
const pageOf = (items, query) => ({ items, total: items.length, page: Number(query.get("page") ?? 1), pageSize: Number(query.get("pageSize") ?? 9) });

test.beforeEach(async ({ page }) => {
  await page.route((url) => /^(\/auth\/|\/materias(?:\/|$)|\/profesores(?:\/|$)|\/users$|\/cursadas\/|\/comisiones\/)/.test(url.pathname), async (route) => {
    const url = new URL(route.request().url()); let body;
    if (url.pathname === "/auth/me") body = usuario;
    else if (url.pathname.endsWith("/historial") || url.pathname.endsWith("/feedback")) body = pageOf([], url.searchParams);
    else if (url.pathname === "/materias") body = pageOf([materia], url.searchParams);
    else if (url.pathname === "/profesores") body = pageOf([profesor], url.searchParams);
    else if (url.pathname === "/users") body = pageOf([usuario], url.searchParams);
    else if (url.pathname === "/materias/m1/cursadas") body = pageOf([cursada], url.searchParams);
    else if (url.pathname === "/cursadas/c1/comisiones") body = pageOf([comision], url.searchParams);
    else if (url.pathname === "/materias/m1") body = materia;
    else if (url.pathname === "/profesores/p1") body = profesor;
    else if (url.pathname === "/cursadas/c1") body = cursada;
    else if (url.pathname === "/comisiones/co1") body = comision;
    else throw new Error(`Solicitud de prueba sin fixture: ${url.pathname}`);
    await route.fulfill({ json: body, headers: { "Access-Control-Allow-Origin": new URL(page.url()).origin, "Access-Control-Allow-Credentials": "true" } });
  });
});

const lists = [
  ["Materias", "/home/admin/materias", "Nueva materia"],
  ["Profesores", "/home/admin/profesores", "Nuevo profesor"],
  ["Cursadas", "/home/admin/cursadas?materiaId=m1", "Nueva cursada"],
  ["Comisiones", "/home/admin/comisiones?materiaId=m1&cursadaId=c1", "Nueva comisión"],
  ["Usuarios registrados", "/home/admin/usuarios", null],
];

test("acceso de usuarios: confirmación, filtros, detalle e historial tras reactivación", async ({ page }) => {
  const target = { ...usuario, id: "u2", displayName: "Ana de prueba", email: "ana@alu.frlp.utn.edu.ar", role: "USER" };
  let disabledAt = null;
  const events = [];
  let writes = 0;
  await page.route((url) => /^\/(?:users(?:\/|$)|admin\/users\/)/.test(url.pathname), async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const headers = { "Access-Control-Allow-Origin": new URL(page.url()).origin, "Access-Control-Allow-Credentials": "true", "Access-Control-Allow-Methods": "GET, PATCH, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, X-CSRF-Protection" };
    if (request.method() === "OPTIONS") { await route.fulfill({ status: 204, headers }); return; }
    let body;
    if (url.pathname === "/users/u2/estado") {
      writes++;
      const { activo } = request.postDataJSON();
      disabledAt = activo ? null : date;
      events.unshift({ id: `h${writes}`, actorId: usuario.id, accion: activo ? "ACTIVACION" : "DESACTIVACION", createdAt: date, cambios: [{ campo: "estado", anterior: activo ? "INACTIVO" : "ACTIVO", nuevo: activo ? "ACTIVO" : "INACTIVO" }] });
      body = { ...target, disabledAt };
    } else if (url.pathname === "/admin/users/u2/detalle") {
      body = { registro: { ...target, disabledAt }, auditoria: { id: target.id, createdAt: date, createdBy: null, updatedAt: date, updatedBy: usuario.id, deletedAt: disabledAt, deletedBy: disabledAt ? usuario.id : null }, historial: pageOf(events, url.searchParams) };
    } else if (url.pathname === "/users") {
      const state = url.searchParams.get("estado");
      body = pageOf(!state || (state === "ACTIVO") === (disabledAt === null) ? [{ ...target, disabledAt }] : [], url.searchParams);
    } else throw new Error(`Sin fixture: ${url.pathname}`);
    await route.fulfill({ json: body, headers });
  });
  await page.goto("/home/admin/usuarios?estado=ACTIVO");
  await expect(page.getByRole("cell", { name: "Activo", exact: true })).toBeVisible();
  const deactivate = page.getByRole("button", { name: `Desactivar usuario ${target.displayName} (${target.email})`, exact: true });
  await expect(deactivate.locator("svg.lucide-user-x")).toHaveCount(1);
  await deactivate.click();
  let dialog = page.getByRole("dialog", { name: "Desactivar usuario" });
  await expect(dialog).toContainText(`${target.displayName} (${target.email})`);
  await dialog.getByRole("button", { name: "Cancelar", exact: true }).click();
  expect(writes).toBe(0);
  await deactivate.click();
  await page.getByRole("dialog").getByRole("button", { name: "Confirmar desactivación" }).click();
  await expect(page.getByRole("cell", { name: target.email, exact: true })).toHaveCount(0);
  await expect(page.getByText("Usuario desactivado correctamente.", { exact: true })).toBeVisible();
  await page.getByRole("combobox", { name: "Estado", exact: true }).selectOption("INACTIVO");
  await expect(page.getByRole("cell", { name: "Inactivo", exact: true })).toBeVisible();
  await page.getByRole("button", { name: `Ver detalle de ${target.displayName} (${target.email})`, exact: true }).click();
  await expect(page).toHaveURL(/\/home\/admin\/usuarios\/u2\?returnTo=/);
  await expect(page.getByText("Desactivación", { exact: true })).toBeVisible();
  await expect(page.getByText(`Actor: ${usuario.id}`, { exact: true })).toBeVisible();
  const reactivate = page.getByRole("button", { name: `Reactivar usuario ${target.displayName} (${target.email})`, exact: true });
  await expect(reactivate.locator("svg.lucide-user-check")).toHaveCount(1);
  await reactivate.click();
  dialog = page.getByRole("dialog", { name: "Reactivar usuario" });
  await expect(dialog).toContainText("sesiones revocadas no se restaurarán");
  await dialog.getByRole("button", { name: "Confirmar reactivación" }).click();
  await expect(page.getByRole("button", { name: `Desactivar usuario ${target.displayName} (${target.email})`, exact: true })).toBeVisible();
  await expect(page.getByText("Activación", { exact: true })).toBeVisible();
  expect(writes).toBe(2);
  const violations = (await new AxeBuilder({ page }).analyze()).violations.filter((item) => ["serious", "critical"].includes(item.impact));
  expect(violations.map((item) => item.id)).toEqual([]);
  await page.getByRole("link", { name: "Volver a listado", exact: true }).click();
  await expect(page).toHaveURL(/estado=INACTIVO/);
  await expect(page.getByText("No hay registros que coincidan con los filtros.", { exact: true })).toBeVisible();
});

for (const width of [390, 1280]) {
  test.describe(`${width}px`, () => {
    test.use({ viewport: { width, height: 1000 } });
    for (const [title, path, create] of lists) {
      test(`${title}: ancho, controles, acciones y accesibilidad`, async ({ page }) => {
        await page.goto(path);
        const table = page.getByRole("table");
        await expect(table).toBeVisible();
        await expect(table.getByRole("row")).toHaveCount(2);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        const wrap = table.locator("..");
        const dimensions = await wrap.evaluate((node) => ({ width: node.clientWidth, scrollWidth: node.scrollWidth, parentWidth: node.closest("section").clientWidth }));
        expect(Math.abs(dimensions.width - dimensions.parentWidth)).toBeLessThan(4);
        if (width === 390) expect(dimensions.scrollWidth).toBeGreaterThan(dimensions.width);
        if (create) {
          const action = page.getByRole(title === "Comisiones" ? "link" : "button", { name: create, exact: true });
          await expect(action).toBeVisible(); await expect(action.locator("svg.lucide-plus")).toHaveCount(1);
          const view = table.getByRole("link", { name: /^Ver detalle de/ });
          await view.focus();
          const tooltip = page.getByRole("tooltip", { name: await view.getAttribute("aria-label"), exact: true });
          await expect(tooltip).toBeVisible(); await page.keyboard.press("Escape"); await expect(tooltip).toBeHidden();
          expect((await view.boundingBox()).width).toBeGreaterThanOrEqual(40);
          await expect(view.locator("svg.lucide-eye")).toHaveCount(1);
          await expect(table.getByRole("link", { name: /^Editar/ }).locator("svg.lucide-pencil")).toHaveCount(1);
        } else {
          await expect(table.getByRole("link")).toHaveCount(0);
          await expect(page.getByRole("combobox", { name: "Rol" })).toBeVisible();
        }
        const violations = (await new AxeBuilder({ page }).analyze()).violations.filter((item) => ["serious", "critical"].includes(item.impact));
        expect(violations.map((item) => item.id)).toEqual([]);
        if (create) {
          await table.getByRole("link", { name: /^Ver detalle de/ }).click();
          await expect(page).toHaveURL(/\/home\/admin\/[^/]+\/[^/?]+\?returnTo=/);
          await expect(page.getByRole("link", { name: "Volver a contexto administrativo" })).toBeVisible();
          await page.getByRole("link", { name: "Volver a contexto administrativo" }).click();
          await expect(page).toHaveURL(new URL(path, page.url()).href);
          await page.getByRole("table").getByRole("link", { name: /^Editar/ }).click();
          await expect(page.getByRole("button", { name: "Guardar cambios" })).toBeVisible();
        }
      });
    }
  });
}
