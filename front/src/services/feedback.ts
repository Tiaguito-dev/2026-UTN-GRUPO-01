import type { FeedbackEdicion, FeedbackInput } from "@/types/feedback";
import { getAuthService } from "./auth";
import { requestJson } from "./http";
import { toQuery, type PaginationInput } from "./pagination";
import { paginatedSchema, parseResponse } from "./schemas";
import { feedbackHistorialSchema, feedbackSchema, feedbackOwnSchema, normasConvivenciaSchema } from "./feedback-schemas";
import { feedbackModerationSchema } from "./feedback-moderation-schemas";
import type { ComandoModeracion, EstadoModeracion } from "@/types/feedback-moderation";
import type { Carrera } from "@/types/materias";

const idPath = (id: string) => encodeURIComponent(id);
const listQuery = (input: PaginationInput = {}, size = 9) => toQuery({ page: 1, pageSize: size, ...input });

export function listarFeedback(input: PaginationInput & { carrera?: Carrera; materiaId?: string; profesorId?: string } = {}) {
  const query = new URLSearchParams(listQuery(input).slice(1));
  if (input.carrera) query.set("carrera", input.carrera);
  if (input.materiaId) query.set("materiaId", input.materiaId);
  if (input.profesorId) query.set("profesorId", input.profesorId);
  return getAuthService().protectedGet(`/feedback?${query}`, paginatedSchema(feedbackSchema));
}

export function listarFeedbackComision(id: string, input: PaginationInput = {}) {
  return getAuthService().protectedGet(`/comisiones/${idPath(id)}/feedback${listQuery(input)}`, paginatedSchema(feedbackSchema));
}
export function obtenerFeedbackPropio(id: string) {
  return getAuthService().protectedGet(`/comisiones/${idPath(id)}/feedback/propio`, feedbackOwnSchema.nullable());
}
export function crearFeedback(id: string, input: FeedbackInput) {
  return getAuthService().protectedPost(`/comisiones/${idPath(id)}/feedback`, input, feedbackSchema);
}
export function obtenerNormasConvivencia() {
  return getAuthService().protectedGet("/feedback/normas", normasConvivenciaSchema);
}
export function obtenerFeedback(id: string) {
  return getAuthService().protectedGet(`/feedback/${idPath(id)}`, feedbackOwnSchema);
}
export async function actualizarFeedback(id: string, input: FeedbackEdicion) {
  await getAuthService().me();
  return parseResponse(feedbackOwnSchema, await requestJson(`/feedback/${idPath(id)}`, { method: "PATCH", body: input }));
}
export function listarFeedbackPropios(input: PaginationInput = {}) {
  return getAuthService().protectedGet(`/feedback/propios${listQuery(input)}`, paginatedSchema(feedbackOwnSchema));
}
export function listarFeedbackModeracion(input: PaginationInput & { estado?: EstadoModeracion } = {}) {
  const query = new URLSearchParams(listQuery(input).slice(1));
  query.set("estado", input.estado ?? "PENDIENTE");
  return getAuthService().protectedGet(`/admin/feedback?${query}`, paginatedSchema(feedbackOwnSchema));
}
export function moderarFeedback(id: string, input: ComandoModeracion) {
  return getAuthService().protectedPost(`/admin/feedback/${idPath(id)}/moderacion`, input, feedbackModerationSchema);
}
export function ocultarFeedback(id: string, versionEsperada: number) {
  return getAuthService().protectedPost(`/feedback/${idPath(id)}/ocultar`, { versionEsperada }, feedbackModerationSchema);
}
export function restaurarFeedback(id: string, versionEsperada: number) {
  return getAuthService().protectedPost(`/feedback/${idPath(id)}/restaurar`, { versionEsperada }, feedbackModerationSchema);
}
export function solicitarRevisionFeedback(id: string, versionEsperada: number) {
  return getAuthService().protectedPost(`/feedback/${idPath(id)}/revision`, { versionEsperada }, feedbackModerationSchema);
}
export async function eliminarFeedback(id: string): Promise<void> {
  await getAuthService().me();
  await requestJson(`/feedback/${idPath(id)}`, { method: "DELETE" });
}
export function listarHistorialFeedback(id: string, input: PaginationInput = {}) {
  return getAuthService().protectedGet(`/feedback/${idPath(id)}/historial${listQuery(input, 3)}`, paginatedSchema(feedbackHistorialSchema));
}
