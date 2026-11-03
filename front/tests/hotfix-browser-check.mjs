// Comprobación manual reproducible contra Next dev, sin escribir datos en una base real.
// NEXT_PUBLIC_API_URL=http://localhost:3001 NEXT_PUBLIC_ALLOW_LOCAL_HTTP=true npm run dev --workspace=front -- --port 3310
// node front/tests/hotfix-browser-check.mjs
import { chromium, expect } from "@playwright/test";

const front = process.env.HOTFIX_FRONT_URL ?? "http://127.0.0.1:3310";
const api = process.env.HOTFIX_API_URL ?? "http://localhost:3001";
const account = { id: "u1", email: "usuario@alu.frlp.utn.edu.ar", displayName: "Usuario de prueba", role: "USER" };
const feedback = {
  id: "f1", texto: "Experiencia para verificar la eliminación", anonimo: false,
  propio: true, autor: { displayName: account.displayName }, profesor: null,
  contexto: { comisionId: "co1", nombre: "S-31", materiaId: "m1", materiaNombre: "Álgebra", cursadaId: "cu1", anio: 2026, cuatrimestre: "ANUAL" },
  createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z",
};
const comision = {
  id: "co1", cursadaId: "cu1", carrera: "S", numero: 31, nombre: "S-31", activa: true,
  profesores: [], createdAt: "2026-01-01T00:00:00Z", deletedAt: null,
  cursada: { id: "cu1", anio: 2026, cuatrimestre: "ANUAL", materia: { id: "m1", nombre: "Álgebra" } },
};
const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext();
  const page = await context.newPage();
  // Instalar antes de navegar permite controlar también los intervalos creados al montar React.
  await page.clock.install();
  let expired = false;
  let deleted = false;
  let deleteCalls = 0;
  let sessionCalls = 0;
  await context.route(`${api}/**`, async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const headers = { "access-control-allow-origin": new URL(front).origin, "access-control-allow-credentials": "true", "access-control-allow-headers": "Content-Type, X-CSRF-Protection", "access-control-allow-methods": "GET, POST, DELETE, OPTIONS" };
    const reply = (json, status = 200) => route.fulfill({ status, headers, contentType: "application/json", body: JSON.stringify(json) });
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers });
    if (path === "/auth/me") { sessionCalls++; return reply(expired ? { message: "La sesión terminó." } : account, expired ? 401 : 200); }
    if (path === "/auth/refresh") return reply({ message: "La sesión terminó." }, 401);
    if (path === "/feedback/f1" && request.method() === "DELETE") {
      deleteCalls++; deleted = true; return route.fulfill({ status: 204, headers });
    }
    if (path === "/feedback/f1") return reply(feedback);
    if (path === "/comisiones/co1") return reply(comision);
    if (path === "/feedback") return reply({ items: deleted ? [] : [feedback], total: deleted ? 0 : 1, page: 1, pageSize: 9 });
    if (path === "/materias") return reply({ items: [], total: 0, page: 1, pageSize: 9 });
    return reply({ message: `Fixture no disponible: ${path}` }, 404);
  });

  await page.goto(`${front}/home/experiencias`);
  await page.getByRole("button", { name: "Administrar mi comentario" }).click();
  await page.getByRole("button", { name: "Eliminar comentario" }).click();
  const dialog = page.getByRole("dialog", { name: "Eliminar comentario" });
  await expect(dialog).toBeVisible();
  expect(deleteCalls).toBe(0);
  await dialog.getByRole("button", { name: "Cancelar" }).click();
  await expect(dialog).not.toBeVisible();
  expect(deleteCalls).toBe(0);
  await page.getByRole("button", { name: "Eliminar comentario" }).click();
  await dialog.getByRole("button", { name: "Confirmar eliminación" }).click();
  await expect(page).toHaveURL(/\/home\/experiencias\?successMessage=/);
  await expect(page.getByText("El comentario se eliminó correctamente.")).toBeVisible();
  expect(deleteCalls).toBe(1);

  const before = sessionCalls;
  await page.clock.runFor(60_000);
  await expect.poll(() => sessionCalls).toBeGreaterThan(before);
  await expect(page.getByRole("heading", { name: "Experiencias", exact: true })).toBeVisible();
  expired = true;
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(page).toHaveURL(/\/login\?returnTo=/);
  await expect(page.getByRole("button", { name: /Iniciar sesión/i })).toBeVisible();
  console.log("Navegador: confirmación, cancelación sin DELETE, eliminación única, éxito visible, comprobación por minuto y vencimiento al recuperar foco: OK.");
  await context.close();
} finally {
  await browser.close();
}
