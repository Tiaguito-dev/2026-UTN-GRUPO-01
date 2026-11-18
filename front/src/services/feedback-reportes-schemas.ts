import { z } from "zod";
import type { ReporteAdmin, ReporteDetail, ReporteItem, ReporteReceipt } from "@/types/feedback-reportes";
import { moderationFields } from "./feedback-moderation-schemas";
import { paginatedSchema } from "./schemas";

export const reporteMotivoSchema = z.enum(["INSULTOS_ACOSO", "AMENAZAS_INTIMIDACION", "DISCRIMINACION", "DATOS_PERSONALES", "SPAM", "OTRO"]);
export const reporteEstadoSchema = z.enum(["ABIERTO", "RESUELTO", "DESESTIMADO"]);
const receipt = z.object({
  id: z.string(), feedbackId: z.string(), versionReportada: z.number().int(), motivo: reporteMotivoSchema,
  descripcion: z.string().nullable(), estado: reporteEstadoSchema, createdAt: z.string(), resolvedAt: z.string().nullable(),
});
export const reporteReceiptSchema: z.ZodType<ReporteReceipt> = receipt;
const admin = receipt.extend({ denuncianteId: z.string(), historialId: z.string(), administradorId: z.string().nullable(), justificacion: z.string().nullable() });
export const reporteAdminSchema: z.ZodType<ReporteAdmin> = admin;
const experiencia = z.object({
  ...moderationFields, id: z.string(), deletedAt: z.string().nullable(),
  contexto: z.object({
    carrera: z.enum(["S", "C", "Q", "I", "M"]).optional(), comisionId: z.string(), nombre: z.string(), materiaId: z.string(), materiaNombre: z.string(),
    cursadaId: z.string(), anio: z.number(), cuatrimestre: z.enum(["PRIMERO", "SEGUNDO", "ANUAL"]).nullable(), modalidad: z.enum(["PRIMERO", "SEGUNDO", "ANUAL"]).nullable().optional(),
  }),
});
const counts = { cantidadReportesActivos: z.number().int().min(0), denunciantesAbiertos: z.number().int().min(0), ultimoReporteAt: z.string() };
export const reporteItemSchema: z.ZodType<ReporteItem> = admin.extend({ ...counts, experiencia });
export const reporteDetailSchema: z.ZodType<ReporteDetail> = z.object({
  ...counts, experiencia,
  reporte: admin.extend({ denunciante: z.object({ id: z.string(), displayName: z.string() }) }),
  evidencia: z.object({ id: z.string(), texto: z.string(), puntuacion: z.number().int().min(1).max(5).nullable(), anonimo: z.boolean(), versionModeracion: z.number().int().nullable(), createdAt: z.string() }),
  resolucionesAnteriores: paginatedSchema(reporteAdminSchema),
});
