import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { hash } from "argon2";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../back/dist/generated/prisma/client.js";

// Prueba funcional real, sin capturas ni análisis visual. Solo usa TEST_DATABASE_URL explícita.
test.use({ channel: "chrome" });
const password = " TASK070 contraseña de pruebas funcionales ";
const tag = `Navegacion070-${randomUUID()}`;
let prisma; let admin; let target; let materia; let cursada;
const userIds = []; const profesorIds = [];

test.beforeAll(async () => {
  if (!process.env.TEST_DATABASE_URL) throw new Error("TEST_DATABASE_URL es obligatorio; no se usa la base de desarrollo.");
  prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.TEST_DATABASE_URL }) });
  await prisma.$connect();
  const passwordHash = await hash(password);
  admin = await prisma.user.create({ data: { email: `admin-${randomUUID()}@alu.frlp.utn.edu.ar`, displayName: `Administrador ${tag}`, passwordHash, role: "ADMIN", emailVerifiedAt: new Date() } }); userIds.push(admin.id);
  target = await prisma.user.create({ data: { email: `user-${randomUUID()}@alu.frlp.utn.edu.ar`, displayName: `Usuario ${tag}`, passwordHash, role: "USER", emailVerifiedAt: new Date() } }); userIds.push(target.id);
  materia = await prisma.materia.create({ data: { nombre: `Materia ${tag}`, modalidad: "ANUAL", carreras: { create: { carrera: "S", anioCarrera: "4" } } } });
  cursada = await prisma.cursada.create({ data: { materiaId: materia.id, anio: 2026, cuatrimestre: "ANUAL" } });
  for (let i = 0; i < 12; i++) {
    const p = await prisma.profesor.create({ data: { nombreCompleto: `${tag} García ${String(i).padStart(2, "0")}` } }); profesorIds.push(p.id);
  }
});

test.afterAll(async () => {
  if (!prisma) return;
  await prisma.administracionHistorial.deleteMany({ where: { actorId: { in: userIds } } });
  if (profesorIds.length) await prisma.profesor.deleteMany({ where: { id: { in: profesorIds } } });
  if (cursada) await prisma.cursada.delete({ where: { id: cursada.id } });
  if (materia) { await prisma.materiaHistorial.deleteMany({ where: { materiaId: materia.id } }); await prisma.materiaCarrera.deleteMany({ where: { materiaId: materia.id } }); await prisma.materia.delete({ where: { id: materia.id } }); }
  await prisma.refreshCredential.deleteMany({ where: { session: { userId: { in: userIds } } } });
  await prisma.session.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.passwordResetCredential.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.emailVerificationCredential.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await prisma.$disconnect();
});

async function login(page) {
  await page.goto("/login");
  await page.getByLabel(/^Email$/).fill(admin.email);
  await page.getByLabel(/^Contraseña$/).fill(password);
  await page.getByRole("button", { name: /Iniciar sesión/i }).click();
  await expect(page).toHaveURL(/\/home\/admin$/);
}

test("Usuarios: filtros remotos, confirmación de estado e historial persistido", async ({ page }) => {
  await login(page);
  await page.goto(`/home/admin/usuarios?${new URLSearchParams({ q: tag, estado: "ACTIVO", rol: "USER" })}`);
  await expect(page.getByRole("cell", { name: target.displayName, exact: true })).toBeVisible();
  await page.getByRole("button", { name: `Desactivar usuario ${target.displayName} (${target.email})`, exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Confirmar desactivación" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Usuario desactivado correctamente." })).toBeVisible();
  await expect(page.getByRole("cell", { name: target.displayName, exact: true })).toHaveCount(0);
  expect((await prisma.user.findUniqueOrThrow({ where: { id: target.id } })).disabledAt).toBeInstanceOf(Date);
  await page.getByRole("combobox", { name: "Estado", exact: true }).selectOption("INACTIVO");
  await expect(page).toHaveURL(/estado=INACTIVO/);
  await page.getByRole("button", { name: `Ver detalle de ${target.displayName} (${target.email})`, exact: true }).click();
  await expect(page.getByText("Desactivación", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: `Reactivar usuario ${target.displayName} (${target.email})`, exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Confirmar reactivación" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Usuario reactivado correctamente." })).toBeVisible();
  expect((await prisma.user.findUniqueOrThrow({ where: { id: target.id } })).disabledAt).toBeNull();
});

test("Académico: paginación remota, edición con retorno, baja real y bloqueo relacional", async ({ page }) => {
  await login(page);
  await page.goto(`/home/admin/profesores?${new URLSearchParams({ q: tag })}`);
  await expect(page.getByRole("table").getByRole("row")).toHaveCount(10);
  await page.getByRole("button", { name: "Página siguiente" }).click();
  await expect(page).toHaveURL(/page=2/);
  await expect(page.getByRole("table").getByRole("row")).toHaveCount(4);
  const listUrl = page.url(); await page.reload();
  const first = page.getByRole("table").getByRole("link", { name: /^Ver detalle de/ }).first();
  const oldName = (await first.getAttribute("aria-label")).replace("Ver detalle de ", "");
  await first.click();
  await expect(page.getByRole("heading", { name: oldName, exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Editar profesor", exact: true }).click();
  const newName = `${oldName} actualizado`;
  await page.getByLabel("Nombre completo", { exact: true }).fill(newName);
  await page.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(page.getByRole("heading", { name: newName, exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Volver a contexto administrativo" }).click();
  await expect(page).toHaveURL(listUrl);
  await page.getByRole("button", { name: `Dar de baja ${newName}`, exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Confirmar baja" }).click();
  await expect(page.getByRole("status").filter({ hasText: "El registro se dio de baja correctamente." })).toBeVisible();
  expect((await prisma.profesor.findFirstOrThrow({ where: { nombreCompleto: newName } })).deletedAt).toBeInstanceOf(Date);
  await page.goto(`/home/admin/materias?${new URLSearchParams({ q: materia.nombre })}`);
  await page.getByRole("button", { name: `Dar de baja ${materia.nombre}`, exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Confirmar baja" }).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText("cursadas vigentes");
  expect((await prisma.materia.findUniqueOrThrow({ where: { id: materia.id } })).deletedAt).toBeNull();
  await page.getByRole("dialog").getByRole("button", { name: "Cancelar", exact: true }).click();
});
