import "reflect-metadata";
import { randomUUID } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { GUARDS_METADATA } from "@nestjs/common/constants";
import { PrismaProfesorRepository } from "../src/academic/infrastructure/prisma-profesor.repository.js";
import { AdminDetailService } from "../src/administration/admin-detail.service.js";
import { AdminDetailController } from "../src/administration/admin-detail.controller.js";
import { AuthenticationGuard } from "../src/auth/presentation/authentication.guard.js";
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
    administracionHistorial: { findMany: vi.fn().mockResolvedValue([]), findFirst: vi.fn().mockResolvedValue(null), count: vi.fn().mockResolvedValue(0) },
  };
  const transaction = vi.fn(async (run: (value: typeof tx) => Promise<unknown>) => run(tx));
  return { tx, transaction, service: new AdminDetailService({ $transaction: transaction } as unknown as PrismaService) };
}
describe("detalle administrativo: privacidad y evidencia histórica", () => {
  it("resuelve nombres de actores en lote solo para usuarios sin agregar datos privados", async () => {
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
    tx.user.findMany.mockClear();
    await service.execute("profesores", id, {});
    expect(tx.user.findMany).not.toHaveBeenCalled();
  });
  it("aplica sesión y roles en todo el controller", () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, AdminDetailController)).toEqual([AuthenticationGuard, RolesGuard]);
    expect(Reflect.getMetadata(ALLOWED_ROLES, AdminDetailController)).toEqual(["ADMIN"]);
  });
  it("un registro legado no genera eventos ni actores supuestos", async () => {
    const { service } = fixture();
    const result = await service.execute("profesores", id, {});
    expect(result.auditoria).toMatchObject({ id, createdBy: null, updatedAt: null, updatedBy: null, deletedAt: null, deletedBy: null });
    expect(result.historial).toMatchObject({ items: [], total: 0, pageSize: 3 });
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
  it("si falla auditor?a la mutaci?n no se declara exitosa y ambas escrituras usan la transacci?n", async () => {
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
