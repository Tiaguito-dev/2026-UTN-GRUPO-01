import type { Feedback } from "./feedback.js";
import type { FeedbackModerationState } from "./feedback-moderation.js";
import type { PaginatedResult } from "../../shared/domain/pagination.js";

export type ReporteMotivo = "INSULTOS_ACOSO" | "AMENAZAS_INTIMIDACION" | "DISCRIMINACION" | "DATOS_PERSONALES" | "SPAM" | "OTRO";
export type ReporteEstado = "ABIERTO" | "RESUELTO" | "DESESTIMADO";
/** Receipt for the reporter. Never return an unrestricted persistence object. */
export interface FeedbackReporteReceipt {
  id: string;
  feedbackId: string;
  versionReportada: number;
  motivo: ReporteMotivo;
  descripcion: string | null;
  estado: ReporteEstado;
  createdAt: Date;
  resolvedAt: Date | null;
}
export interface FeedbackReporteAdmin extends FeedbackReporteReceipt {
  denuncianteId: string;
  historialId: string;
  administradorId: string | null;
  justificacion: string | null;
}
export interface ReporteCounts { cantidadReportesActivos: number; denunciantesAbiertos: number }
export interface ReporteExperience extends FeedbackModerationState {
  id: string;
  deletedAt: Date | null;
  contexto: Feedback["contexto"];
}
export interface FeedbackReporteItem extends FeedbackReporteAdmin, ReporteCounts { experiencia: ReporteExperience }
export interface FeedbackReporteDetail extends ReporteCounts {
  /** Only the ADMIN detail includes the reporter's current account name. */
  reporte: FeedbackReporteAdmin & { denunciante: { id: string; displayName: string } };
  experiencia: ReporteExperience;
  evidencia: { id: string; texto: string; puntuacion: number | null; anonimo: boolean; versionModeracion: number | null; createdAt: Date };
  resolucionesAnteriores: PaginatedResult<FeedbackReporteAdmin>;
}
