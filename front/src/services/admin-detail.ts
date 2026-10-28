import { z } from "zod";
import { getAuthService } from "./auth";
import { paginatedSchema } from "./schemas";

export type AdminRecordKind = "materias" | "profesores" | "cursadas" | "comisiones" | "users" | "feedback";
const changeSchema = z.object({ campo: z.string(), anterior: z.string().nullable(), nuevo: z.string().nullable() });
const eventSchema = z.object({ id: z.string(), actorId: z.string().nullable(), accion: z.string(), createdAt: z.string(), cambios: z.array(changeSchema) });
const auditSchema = z.object({ id: z.string(), createdAt: z.string(), createdBy: z.string().nullable(), updatedAt: z.string().nullable(), updatedBy: z.string().nullable(), deletedAt: z.string().nullable(), deletedBy: z.string().nullable() });
const detailSchema = z.object({ registro: z.record(z.string(), z.unknown()), auditoria: auditSchema, historial: paginatedSchema(eventSchema) });
export type AdminRecord = z.infer<typeof detailSchema>;
export function obtenerDetalleAdministrativo(kind: AdminRecordKind, id: string, page = 1): Promise<AdminRecord> {
  return getAuthService().protectedGet(`/admin/${kind}/${encodeURIComponent(id)}/detalle?${new URLSearchParams({ page: String(page), pageSize: "3" })}`, detailSchema);
}
