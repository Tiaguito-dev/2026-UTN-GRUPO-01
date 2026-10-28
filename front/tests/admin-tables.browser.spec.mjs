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
