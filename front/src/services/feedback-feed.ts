import { getAuthService } from "./auth";
import { feedbackFeedSchema, feedbackLikeSchema, feedbackRespuestaSchema, feedbackRespuestasSchema } from "./feedback-feed-schemas";
/** Opaque cursor from the current window; independent of Experiencias pagination. */
export function listarFeedComentarios(cursor?: string) {
  const query = new URLSearchParams({ pageSize: "9" });
  if (cursor !== undefined) query.set("cursor", cursor);
  return getAuthService().protectedGet(`/feedback/feed?${query}`, feedbackFeedSchema);
}

import { requestJson } from "./http";
import { parseResponse } from "./schemas";
import type { FeedbackRespuestaInput, FeedbackRespuestaEdicion } from "@/types/feedback-feed";
import type { PaginationInput } from "./pagination";
const idPath = (id: string) => encodeURIComponent(id);
export async function activarLikeFeedback(id: string) {
  await getAuthService().me();
  return parseResponse(feedbackLikeSchema, await requestJson(`/feedback/${idPath(id)}/like`, { method: "PUT" }));
}
export async function retirarLikeFeedback(id: string) {
  await getAuthService().me();
  return parseResponse(feedbackLikeSchema, await requestJson(`/feedback/${idPath(id)}/like`, { method: "DELETE" }));
}
export function listarRespuestasFeedback(id: string, input: PaginationInput = {}) {
  const query = new URLSearchParams({ page: String(input.page ?? 1), pageSize: String(input.pageSize ?? 20) });
  return getAuthService().protectedGet(`/feedback/${idPath(id)}/respuestas?${query}`, feedbackRespuestasSchema);
}
export function crearRespuestaFeedback(id: string, input: FeedbackRespuestaInput) {
  return getAuthService().protectedPost(`/feedback/${idPath(id)}/respuestas`, input, feedbackRespuestaSchema);
}
export async function editarRespuestaFeedback(id: string, input: FeedbackRespuestaEdicion) {
  await getAuthService().me();
  return parseResponse(feedbackRespuestaSchema, await requestJson(`/feedback/respuestas/${idPath(id)}`, { method: "PATCH", body: input }));
}
export async function eliminarRespuestaFeedback(id: string): Promise<void> {
  await getAuthService().me();
  await requestJson(`/feedback/respuestas/${idPath(id)}`, { method: "DELETE" });
}
