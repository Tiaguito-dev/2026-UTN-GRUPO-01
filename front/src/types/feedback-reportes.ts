import type { FeedbackContexto } from "./feedback";
import type { EstadoModeracionFeedback } from "./feedback-moderation";
import type { PaginatedResult, PaginationInput } from "@/services/pagination";

export type ReporteMotivo = "INSULTOS_ACOSO" | "AMENAZAS_INTIMIDACION" | "DISCRIMINACION" | "DATOS_PERSONALES" | "SPAM" | "OTRO";
export type ReporteEstado = "ABIERTO" | "RESUELTO" | "DESESTIMADO";
export interface ReporteInput { motivo: ReporteMotivo; descripcion?: string }
export interface ReporteResolucionInput { estado: "RESUELTO" | "DESESTIMADO"; motivo: string }
export interface ReporteReceipt {
  id: string; feedbackId: string; versionReportada: number; motivo: ReporteMotivo;
  descripcion: string | null; estado: ReporteEstado; createdAt: string; resolvedAt: string | null;
}
export interface ReporteAdmin extends ReporteReceipt {
  denuncianteId: string; historialId: string; administradorId: string | null; justificacion: string | null;
}
export interface ReporteExperiencia extends EstadoModeracionFeedback { id: string; deletedAt: string | null; contexto: FeedbackContexto }
export interface ReporteCounts { cantidadReportesActivos: number; denunciantesAbiertos: number }
export interface ReporteItem extends ReporteAdmin, ReporteCounts { experiencia: ReporteExperiencia; ultimoReporteAt: string }
export interface ReporteDetail extends ReporteCounts {
  ultimoReporteAt: string;
  reporte: ReporteAdmin & { denunciante: { id: string; displayName: string } };
  experiencia: ReporteExperiencia;
  evidencia: { id: string; texto: string; puntuacion: number | null; anonimo: boolean; versionModeracion: number | null; createdAt: string };
  resolucionesAnteriores: PaginatedResult<ReporteAdmin>;
}
export type ReporteFilters = PaginationInput & { estado?: ReporteEstado; motivo?: ReporteMotivo; feedbackId?: string; ocultoReportes?: boolean };
