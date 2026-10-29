import type { FeedbackEdicion, FeedbackInput } from "@/types/feedback";
import { getAuthService } from "./auth";
import { requestJson } from "./http";
import { toQuery, type PaginationInput } from "./pagination";
import { paginatedSchema, parseResponse } from "./schemas";
import { feedbackHistorialSchema, feedbackSchema } from "./feedback-schemas";
import type { Carrera } from "@/types/materias";

const idPath = (id: string) => encodeURIComponent(id);
const listQuery = (input: PaginationInput = {}, size = 9) => toQuery({ page: 1, pageSize: size, ...input });

export function listarFeedback(input: PaginationInput & { carrera?: Carrera; materiaId?: string } = {}) {
  const query = new URLSearchParams(listQuery(input).slice(1));
  if (input.carrera) query.set("carrera", input.carrera);
  if (input.materiaId) query.set("materiaId", input.materiaId);
  return getAuthService().protectedGet(`/feedback?${query}`, paginatedSchema(feedbackSchema));
}

export function listarFeedbackComision(id: string, input: PaginationInput = {}) {
  return getAuthService().protectedGet(`/comisiones/${idPath(id)}/feedback${listQuery(input)}`, paginatedSchema(feedbackSchema));
}
export function obtenerFeedbackPropio(id: string) {
  return getAuthService().protectedGet(`/comisiones/${idPath(id)}/feedback/propio`, feedbackSchema.nullable());
}
export function crearFeedback(id: string, input: FeedbackInput) {
  return getAuthService().protectedPost(`/comisiones/${idPath(id)}/feedback`, input, feedbackSchema);
}
export function obtenerFeedback(id: string) {
  return getAuthService().protectedGet(`/feedback/${idPath(id)}`, feedbackSchema);
}
export async function actualizarFeedback(id: string, input: FeedbackEdicion) {
  await getAuthService().me();
  return parseResponse(feedbackSchema, await requestJson(`/feedback/${idPath(id)}`, { method: "PATCH", body: input }));
}
export async function eliminarFeedback(id: string): Promise<void> {
  await getAuthService().me();
  await requestJson(`/feedback/${idPath(id)}`, { method: "DELETE" });
}
export function listarHistorialFeedback(id: string, input: PaginationInput = {}) {
  return getAuthService().protectedGet(`/feedback/${idPath(id)}/historial${listQuery(input, 3)}`, paginatedSchema(feedbackHistorialSchema));
}
