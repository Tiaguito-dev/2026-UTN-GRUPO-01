import { getAuthService } from "./auth";
import { paginatedSchema } from "./schemas";
import { toQuery, type PaginationInput } from "./pagination";
import { reporteAdminSchema, reporteDetailSchema, reporteItemSchema, reporteReceiptSchema } from "./feedback-reportes-schemas";
import type { ReporteFilters, ReporteInput, ReporteResolucionInput } from "@/types/feedback-reportes";

export function crearReporteFeedback(id: string, input: ReporteInput) {
  return getAuthService().protectedPost(`/feedback/${encodeURIComponent(id)}/reportes`, input, reporteReceiptSchema);
}
export function listarReportesFeedback(input: ReporteFilters = {}) {
  const query = new URLSearchParams(toQuery({ page: input.page ?? 1, pageSize: input.pageSize ?? 9 }).slice(1));
  if (input.estado) query.set("estado", input.estado);
  if (input.motivo) query.set("motivo", input.motivo);
  if (input.feedbackId) query.set("feedbackId", input.feedbackId);
  if (input.ocultoReportes !== undefined) query.set("ocultoReportes", String(input.ocultoReportes));
  return getAuthService().protectedGet(`/admin/feedback-reportes?${query}`, paginatedSchema(reporteItemSchema));
}
export function obtenerReporteFeedback(id: string, input: PaginationInput = {}) {
  return getAuthService().protectedGet(`/admin/feedback-reportes/${encodeURIComponent(id)}${toQuery({ page: input.page ?? 1, pageSize: input.pageSize ?? 3 })}`, reporteDetailSchema);
}
export function resolverReporteFeedback(id: string, input: ReporteResolucionInput) {
  return getAuthService().protectedPost(`/admin/feedback-reportes/${encodeURIComponent(id)}/resolucion`, input, reporteAdminSchema);
}
