import { z } from "zod";
import { getAuthService } from "./auth";
import { paginatedSchema } from "./schemas";
import { toQuery, type PaginatedResult, type PaginationInput } from "./pagination";

export type AdminHistoryKind = "profesores" | "cursadas" | "comisiones" | "users";
export interface AdminHistoryEntry {
  id: string; actorId: string; accion: string; createdAt: string;
  cambios: { campo: string; anterior: string | null; nuevo: string | null }[];
}
const historySchema: z.ZodType<AdminHistoryEntry> = z.object({ id: z.string(), actorId: z.string(), accion: z.string(), createdAt: z.string(), cambios: z.array(z.object({ campo: z.string(), anterior: z.string().nullable(), nuevo: z.string().nullable() })) });
export function listarHistorialAdministrativo(kind: AdminHistoryKind, id: string, input: PaginationInput = {}): Promise<PaginatedResult<AdminHistoryEntry>> {
  return getAuthService().protectedGet(`/${kind}/${encodeURIComponent(id)}/historial${toQuery({ page: input.page, pageSize: input.pageSize ?? 3 })}`, paginatedSchema(historySchema));
}
