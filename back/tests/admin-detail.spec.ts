import "reflect-metadata";
import { randomUUID } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { GUARDS_METADATA } from "@nestjs/common/constants";
import { PrismaProfesorRepository } from "../src/academic/infrastructure/prisma-profesor.repository.js";
import { AcademicController } from "../src/academic/academic.controller.js";
import { AcademicAdministrationController } from "../src/academic/academic-administration.controller.js";
import { AdminDetailService } from "../src/administration/admin-detail.service.js";
import { AdminDetailController } from "../src/administration/admin-detail.controller.js";
import { AuthenticationGuard } from "../src/auth/presentation/authentication.guard.js";
import type { AuthenticatedRequest } from "../src/auth/presentation/authentication.guard.js";
import { ALLOWED_ROLES } from "../src/auth/presentation/roles.decorator.js";
import { RolesGuard } from "../src/auth/presentation/roles.guard.js";
import { PrismaService } from "../src/infrastructure/prisma/prisma.service.js";
const id = randomUUID();
function fixture() {
  const tx = {
    $queryRaw: vi.fn<(query: unknown) => Promise<unknown>>().mockResolvedValue([]),
    materia: { findUnique: vi.fn().mockResolvedValue({id, nombre:"Materia", createdAt:new Date("2026-01-01"), deletedAt:null}) },
    materiaHistorial: { count:vi.fn().mockResolvedValue(0), findFirst:vi.fn().mockResolvedValue(null) },
    feedback: {findUnique:vi.fn().mockResolvedValue({id,createdAt:new Date("2026-01-01"),updatedAt:new Date("2026-02-01"),deletedAt:null})},
    feedbackHistorial:{findMany:vi.fn().mockResolvedValue([]),count:vi.fn().mockResolvedValue(0)},
    user: { findMany: vi.fn().mockResolvedValue([]), findUnique: vi.fn<(query: unknown) => Promise<unknown>>().mockResolvedValue({ id, displayName: "Persona", createdAt: new Date("2026-01-01"), disabledAt: null }) },
    profesor: { findUnique: vi.fn<(query: unknown) => Promise<unknown>>().mockResolvedValue({ id, nombreCompleto: "Docente", createdAt: new Date("2026-01-01"), deletedAt: null }) },
    cursada: { findUnique: vi.fn().mockResolvedValue({ id, createdAt: new Date("2026-01-01"), deletedAt: null }) },
    comision: { findUnique: vi.fn().mockResolvedValue({ id, createdAt: new Date("2026-01-01"), deletedAt: null, carrera: "S", numero: 1, profesores: [] }) },
    administracionHistorial: { findMany: vi.fn().mockResolvedValue([]), findFirst: vi.fn().mockResolvedValue(null), count: vi.fn().mockResolvedValue(0) },
  };
  const transaction = vi.fn(async (run: (value: typeof tx) => Promise<unknown>) => run(tx));
  return { tx, transaction, service: new AdminDetailService({ $transaction: transaction } as unknown as PrismaService) };
}
describe("detalle administrativo: privacidad y evidencia histórica", () => {
  it("resuelve nombres de actores de usuarios en lote sin agregar datos privados", async () => {
    const { service, tx } = fixture();
    const actorId = randomUUID();
    tx.administracionHistorial.findFirst.mockResolvedValue({ actorId, createdAt: new Date() } as never);
    tx.administracionHistorial.findMany.mockResolvedValue([{ id: randomUUID(), actorId, accion: "ACTIVACION", createdAt: new Date(), cambios: [] }] as never);
    tx.user.findMany.mockResolvedValue([{ id: actorId, displayName: "Administradora" }] as never);
    const result = await service.execute("users", id, {});
    expect(result.auditoria).toMatchObject({ createdByName: "Administradora", updatedByName: "Administradora" });
    expect(result.historial.items[0]).toMatchObject({ actorName: "Administradora" });
    expect(tx.user.findMany).toHaveBeenCalledExactlyOnceWith({ where: { id: { in: [actorId] } }, select: { id: true, displayName: true } });
    tx.user.findMany.mockResolvedValue([]);
    const unresolved = await service.execute("users", id, {});
    expect(unresolved.auditoria).toMatchObject({ createdBy: actorId, createdByName: null });
    expect(unresolved.historial.items[0]).toMatchObject({ actorId, actorName: null });
  });
  it.each(["users", "profesores", "materias", "cursadas", "comisiones", "feedback"])("%s resuelve creación, edición, baja e historial en una consulta agrupada y conserva paginación", async (kind) => {
    const { service, tx } = fixture();
    const creator = randomUUID(); const editor = randomUUID(); const remover = randomUUID();
    const createdAt = new Date("2026-01-01"); const updatedAt = new Date("2026-02-01"); const deletedAt = new Date("2026-03-01");
    const record = { id, nombreCompleto: "Docente", createdAt, deletedAt };
    tx.profesor.findUnique.mockResolvedValue(record);
    tx.user.findUnique.mockResolvedValue({ ...record, disabledAt: deletedAt });
    tx.materia.findUnique.mockResolvedValue({ ...record, nombre: "Materia" });
    tx.cursada.findUnique.mockResolvedValue(record);
    tx.comision.findUnique.mockResolvedValue({ ...record, carrera: "S", numero: 1, profesores: [] });
    tx.feedback.findUnique.mockResolvedValue({ ...record, updatedAt });
    tx.administracionHistorial.findFirst
      .mockResolvedValueOnce({ actorId: creator, createdAt } as never)
      .mockResolvedValueOnce({ actorId: editor, createdAt: updatedAt } as never)
      .mockResolvedValueOnce({ actorId: remover, createdAt: deletedAt } as never);
    const eventId = randomUUID();
    const event = { id: eventId, actorId: editor, accion: "EDICION", createdAt: updatedAt, cambios: [{ campo: "nombreCompleto", anterior: "Antes", nuevo: "Docente" }] };
    tx.administracionHistorial.findMany.mockResolvedValue([event] as never);
    tx.$queryRaw.mockResolvedValue([event]);
    tx.feedbackHistorial.findMany.mockResolvedValue([{ ...event, texto: "Contenido", anonimo: false }] as never);
    tx.feedbackHistorial.count.mockResolvedValue(7);
    tx.administracionHistorial.count.mockResolvedValue(7);
    tx.user.findMany.mockResolvedValue([{ id: creator, displayName: "Creadora" }, { id: editor, displayName: "Editora" }, { id: remover, displayName: "Administradora de baja" }] as never);
    const result = await service.execute(kind, id, { page: 2 });
    expect(result.auditoria).toMatchObject({ createdBy: creator, createdByName: "Creadora", updatedBy: editor, updatedByName: "Editora", deletedBy: remover, deletedByName: "Administradora de baja" });
    expect(result.historial).toMatchObject({ page: 2, pageSize: 3, total: 7, items: [{ id: eventId, actorId: editor, actorName: "Editora", accion: "EDICION", cambios: [{ campo: "nombreCompleto", anterior: "Antes", nuevo: "Docente" }] }] });
    expect(tx.user.findMany).toHaveBeenCalledExactlyOnceWith({ where: { id: { in: [creator, editor, remover] } }, select: { id: true, displayName: true } });
    const entity = { users: "usuario", profesores: "profesor", materias: "materia", cursadas: "cursada", comisiones: "comision", feedback: "feedback" }[kind]!;
    expect(tx.administracionHistorial.findMany).toHaveBeenCalledWith({ where: { entidad: entity, entidadId: id }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip: 3, take: 3 });
  });
  it("materia resuelve el último actor de MateriaHistorial fuera de página y sin evento administrativo", async () => {
    const { service, tx } = fixture();
    const actorId = randomUUID(); const createdAt = new Date("2026-10-30");
    tx.materiaHistorial.findFirst.mockResolvedValue({ actorId, createdAt } as never);
    tx.materiaHistorial.count.mockResolvedValue(5);
    tx.user.findMany.mockResolvedValue([{ id: actorId, displayName: "Editora histórica" }] as never);
    const result = await service.execute("materias", id, { page: 2 });
    expect(result.auditoria).toMatchObject({ updatedAt: createdAt, updatedBy: actorId, updatedByName: "Editora histórica", createdBy: null, createdByName: null });
    expect(result.historial).toMatchObject({ items: [], total: 5, page: 2, pageSize: 3 });
    expect(tx.user.findMany).toHaveBeenCalledExactlyOnceWith({ where: { id: { in: [actorId] } }, select: { id: true, displayName: true } });
  });
  it.each(["users", "profesores", "materias", "cursadas", "comisiones", "feedback"])("%s conserva referencias no resolubles y actores ausentes sin atribuciones ficticias", async (kind) => {
    const { service, tx } = fixture();
    const missingActor = randomUUID();
    tx.administracionHistorial.findFirst.mockResolvedValueOnce({ actorId: missingActor, createdAt: new Date() } as never);
    const entries = [
      { id: randomUUID(), actorId: missingActor, accion: "EDICION", createdAt: new Date(), cambios: [] },
      { id: randomUUID(), actorId: null, accion: "CREACION", createdAt: new Date(), cambios: [] },
    ];
    tx.administracionHistorial.findMany.mockResolvedValue(entries as never);
    tx.$queryRaw.mockResolvedValue(entries);
    tx.feedbackHistorial.findMany.mockResolvedValue(entries.map(entry => ({ ...entry, texto: "Contenido", anonimo: false })) as never);
    const result = await service.execute(kind, id, {});
    expect(result.auditoria).toMatchObject({ createdBy: missingActor, createdByName: null, updatedBy: null, updatedByName: null, deletedBy: null, deletedByName: null });
    expect(result.historial.items).toMatchObject([{ actorId: missingActor, actorName: null }, { actorId: null, actorName: null }]);
    expect(tx.user.findMany).toHaveBeenCalledExactlyOnceWith({ where: { id: { in: [missingActor] } }, select: { id: true, displayName: true } });
  });
  it("aplica sesión y roles en todo el controller", () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, AdminDetailController)).toEqual([AuthenticationGuard, RolesGuard]);
    expect(Reflect.getMetadata(ALLOWED_ROLES, AdminDetailController)).toEqual(["ADMIN"]);
  });
  it("alta, edición y baja de profesores toman actor de sesión y mantienen autorización ADMIN", async () => {
    const actorId = randomUUID();
    const body = { nombreCompleto: "Nombre nuevo" };
    const request = { authUser: { id: actorId, email: "admin@example.test", displayName: "Admin", role: "ADMIN" } } as AuthenticatedRequest;
    const create = vi.fn().mockResolvedValue({ id }); const update = vi.fn().mockResolvedValue({ id }); const remove = vi.fn().mockResolvedValue(undefined);
    const academic = { crearProfesor: { execute: create }, actualizarProfesor: { execute: update } } as unknown as AcademicController;
    const administration = { eliminar: { execute: remove } } as unknown as AcademicAdministrationController;
    await AcademicController.prototype.nuevoProfesor.call(academic, body, request);
    await AcademicController.prototype.editarProfesor.call(academic, id, body, request);
    await AcademicAdministrationController.prototype.eliminarProfesor.call(administration, id, request);
    expect(create).toHaveBeenCalledExactlyOnceWith(body, actorId);
    expect(update).toHaveBeenCalledExactlyOnceWith(id, body, actorId);
    expect(remove).toHaveBeenCalledExactlyOnceWith("profesor", id, actorId);
    expect(Reflect.getMetadata(ALLOWED_ROLES, AcademicController.prototype.nuevoProfesor)).toEqual(["ADMIN"]);
    expect(Reflect.getMetadata(ALLOWED_ROLES, AcademicController.prototype.editarProfesor)).toEqual(["ADMIN"]);
    expect(Reflect.getMetadata(ALLOWED_ROLES, AcademicAdministrationController)).toEqual(["ADMIN"]);
    expect(Reflect.getMetadata(GUARDS_METADATA, AcademicController)).toEqual([AuthenticationGuard, RolesGuard]);
    expect(Reflect.getMetadata(GUARDS_METADATA, AcademicAdministrationController)).toEqual([AuthenticationGuard, RolesGuard]);
  });
  it.each(["users", "profesores", "materias", "cursadas", "comisiones", "feedback"])("%s legado no genera eventos ni actores supuestos", async (kind) => {
    const { service, tx } = fixture();
    const result = await service.execute(kind, id, {});
    expect(result.auditoria).toMatchObject({ id, createdBy: null, updatedBy: null, deletedAt: null, deletedBy: null });
    if (kind !== "feedback") expect(result.auditoria.updatedAt).toBeNull();
    expect(result.historial).toMatchObject({ items: [], total: 0, pageSize: 3 });
    expect(result.auditoria).toMatchObject({ createdByName: null, updatedByName: null, deletedByName: null });
    expect(tx.user.findMany).not.toHaveBeenCalled();
  });
  it("usuarios se consultan con selección explícita que excluye secretos y relaciones privadas", async () => {
    const { service, tx } = fixture();
    await service.execute("users", id, {});
    const selection = tx.user.findUnique.mock.calls[0]?.[0];
    expect(selection).toEqual({ where: { id }, select: { id: true, email: true, displayName: true, role: true, createdAt: true, emailVerifiedAt: true, disabledAt: true } });
  });
  it("descarta campos secretos incluso si existieran en el ledger legado", async () => {
    const { service, tx } = fixture();
    tx.administracionHistorial.findMany.mockResolvedValue([{ id: randomUUID(), actorId: randomUUID(), accion: "EDICION", createdAt: new Date(), cambios: [{ campo: "passwordHash", anterior: "secret-before", nuevo: "secret-after" }, { campo: "nombreCompleto", anterior: "Antes", nuevo: "Después" }] }] as never);
    const result = await service.execute("profesores", id, {});
    expect(result.historial.items[0]?.cambios).toEqual([{ campo: "nombreCompleto", anterior: "Antes", nuevo: "Después" }]);
    expect(JSON.stringify(result)).not.toContain("secret");
  });
  it("materias pagina cambios, altas y bloqueos sin duplicar las bajas exitosas", async () => {
    const { service, tx } = fixture();
    await service.execute("materias", id, {page:2});
    const sql = tx.$queryRaw.mock.calls[0]?.[0] as {strings:string[]; values:unknown[]};
    expect(sql.strings.join(" ")).toContain("UNION ALL");
    expect(sql.strings.join(" ")).toContain("'CREACION'");
    expect(sql.strings.join(" ")).toContain("'BAJA_BLOQUEADA'");
    expect(sql.values.slice(-2)).toEqual([3, 3]);
    expect(tx.materiaHistorial.count).toHaveBeenCalledWith({where:{materiaId:id}});
  });
  it("si falla auditoría de creación, propaga el fallo y ambas escrituras usan la transacción", async () => {
    const actorId = randomUUID();
    const error = new Error("audit failed");
    const tx = { profesor: {create:vi.fn().mockResolvedValue({id})}, administracionHistorial:{create:vi.fn().mockRejectedValue(error)} };
    const transaction = vi.fn(async (run:(value:typeof tx)=>Promise<unknown>) => run(tx));
    const repository = new PrismaProfesorRepository({$transaction:transaction} as unknown as PrismaService);
    await expect(repository.create({nombreCompleto:"Docente"}, actorId)).rejects.toBe(error);
    expect(tx.profesor.create).toHaveBeenCalledExactlyOnceWith({data:{nombreCompleto:"Docente"}});
    expect(tx.administracionHistorial.create).toHaveBeenCalledExactlyOnceWith({data:{entidad:"profesor",entidadId:id,actorId,accion:"CREACION",cambios:[]}});
    expect(transaction).toHaveBeenCalledTimes(1);
  });
  it("alta de profesor registra el actor real en la misma transacción", async () => {
    const actorId = randomUUID();
    const row = { id, nombreCompleto: "Docente", createdAt: new Date(), deletedAt: null };
    const tx = { profesor: { create: vi.fn().mockResolvedValue(row) }, administracionHistorial: { create: vi.fn().mockResolvedValue({}) } };
    const transaction = vi.fn(async (run: (value: typeof tx) => Promise<unknown>) => run(tx));
    const repository = new PrismaProfesorRepository({ $transaction: transaction } as unknown as PrismaService);
    await expect(repository.create({ nombreCompleto: "Docente" }, actorId)).resolves.toEqual(row);
    expect(tx.administracionHistorial.create).toHaveBeenCalledExactlyOnceWith({ data: { entidad: "profesor", entidadId: id, actorId, accion: "CREACION", cambios: [] } });
    expect(transaction).toHaveBeenCalledTimes(1);
  });
  it.each([true, false])("edición de profesor registra solo diferencias reales (cambio: %s)", async (changed) => {
    const actorId = randomUUID();
    const current = { id, nombreCompleto: "Anterior", createdAt: new Date(), deletedAt: null };
    const updated = { ...current, nombreCompleto: changed ? "Nuevo" : "Anterior" };
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([{ id }]),
      profesor: { findFirst: vi.fn().mockResolvedValue(current), update: vi.fn().mockResolvedValue(updated) },
      administracionHistorial: { create: vi.fn().mockResolvedValue({}) },
    };
    const transaction = vi.fn(async (run: (value: typeof tx) => Promise<unknown>) => run(tx));
    const repository = new PrismaProfesorRepository({ $transaction: transaction } as unknown as PrismaService);
    await expect(repository.update(id, { nombreCompleto: updated.nombreCompleto }, actorId)).resolves.toEqual(updated);
    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
    expect(tx.profesor.update).toHaveBeenCalledExactlyOnceWith({ where: { id }, data: { nombreCompleto: updated.nombreCompleto } });
    if (changed) expect(tx.administracionHistorial.create).toHaveBeenCalledExactlyOnceWith({ data: { entidad: "profesor", entidadId: id, actorId, accion: "EDICION", cambios: [{ campo: "nombreCompleto", anterior: "Anterior", nuevo: "Nuevo" }] } });
    else expect(tx.administracionHistorial.create).not.toHaveBeenCalled();
    expect(transaction).toHaveBeenCalledTimes(1);
  });
  it("si falla ledger de edición, la mutación propaga el fallo de la transacción", async () => {
    const actorId = randomUUID();
    const error = new Error("audit edit failed");
    const current = { id, nombreCompleto: "Anterior", createdAt: new Date(), deletedAt: null };
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([{ id }]),
      profesor: { findFirst: vi.fn().mockResolvedValue(current), update: vi.fn().mockResolvedValue({ ...current, nombreCompleto: "Nuevo" }) },
      administracionHistorial: { create: vi.fn().mockRejectedValue(error) },
    };
    const transaction = vi.fn(async (run: (value: typeof tx) => Promise<unknown>) => run(tx));
    const repository = new PrismaProfesorRepository({ $transaction: transaction } as unknown as PrismaService);
    await expect(repository.update(id, { nombreCompleto: "Nuevo" }, actorId)).rejects.toBe(error);
    expect(tx.administracionHistorial.create).toHaveBeenCalledExactlyOnceWith({ data: { entidad: "profesor", entidadId: id, actorId, accion: "EDICION", cambios: [{ campo: "nombreCompleto", anterior: "Anterior", nuevo: "Nuevo" }] } });
    expect(transaction).toHaveBeenCalledTimes(1);
  });
  it("feedback usa cambios reales del ledger para baja y no reconstruye actores legados", async () => {
    const {service,tx} = fixture();
    const eventId = randomUUID(); const actorId = randomUUID(); const createdAt = new Date("2026-02-01");
    const cambios = [{campo:"deletedAt",anterior:null,nuevo:createdAt.toISOString()}];
    tx.feedbackHistorial.findMany.mockResolvedValue([{id:eventId,accion:"ELIMINACION",texto:"Texto",anonimo:true,createdAt}] as never);
    tx.administracionHistorial.findMany.mockResolvedValue([{id:eventId,accion:"ELIMINACION",actorId,createdAt,cambios}] as never);
    const result = await service.execute("feedback",id,{});
    expect(result.historial.items[0]).toMatchObject({id:eventId,actorId,cambios});
    tx.administracionHistorial.findMany.mockResolvedValue([]);
    const legacy = await service.execute("feedback",id,{});
    expect(legacy.historial.items[0]?.actorId).toBeNull();
  });
  it("valida identificadores, sección y página antes de consultar", async () => {
    const { service, transaction } = fixture();
    await expect(service.execute("profesores", "invalid", {})).rejects.toBeDefined();
    await expect(service.execute("sessions", id, {})).rejects.toBeDefined();
    await expect(service.execute("users", id, { page: 0 })).rejects.toBeDefined();
    expect(transaction).not.toHaveBeenCalled();
  });
});
