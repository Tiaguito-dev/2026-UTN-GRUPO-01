import { z } from "zod";
import type { Feedback, FeedbackOwn, FeedbackHistorial, NormasConvivencia } from "@/types/feedback";
import { estadoModeracionSchema, moderationFields } from "./feedback-moderation-schemas";

export const normasConvivenciaSchema: z.ZodType<NormasConvivencia> = z.object({
  version: z.string().min(1), aceptada: z.boolean(), reglas: z.array(z.string().min(1)).min(1),
});

const puntuacion = z.number().int().min(1).max(5).nullable();

const feedbackBaseSchema = z.object({
  id: z.string(), texto: z.string(), anonimo: z.boolean(), propio: z.boolean(),
  puntuacion,
  autor: z.object({ displayName: z.string() }).nullable(),
  profesor: z.object({ id: z.string(), nombreCompleto: z.string(), cargo: z.enum(["TITULAR", "ADJUNTO", "JTP"]) }).nullable(),
  contexto: z.object({
    carrera: z.enum(["S", "C", "Q", "I", "M"]).optional(),
    comisionId: z.string(), nombre: z.string(), materiaId: z.string(), materiaNombre: z.string(),
    cursadaId: z.string(), anio: z.number(), cuatrimestre: z.enum(["PRIMERO", "SEGUNDO", "ANUAL"]).nullable(),
    modalidad: z.enum(["ANUAL", "PRIMERO", "SEGUNDO"]).nullable().optional(),
  }),
  createdAt: z.string(), updatedAt: z.string(),
});
export const feedbackSchema: z.ZodType<Feedback> = feedbackBaseSchema.refine((value) => !value.anonimo || value.autor === null);
export const feedbackOwnSchema: z.ZodType<FeedbackOwn> = feedbackBaseSchema.extend(moderationFields).refine((value) => !value.anonimo || value.autor === null);
export const feedbackHistorialSchema: z.ZodType<FeedbackHistorial> = z.object({
  id: z.string(), accion: z.enum(["CREACION", "EDICION", "ELIMINACION", "APROBACION", "RECHAZO", "OCULTAMIENTO_AUTOR", "RESTITUCION_AUTOR", "OCULTAMIENTO_ADMIN", "RESTITUCION_ADMIN", "SOLICITUD_REVISION", "OCULTAMIENTO_REPORTES", "RESTITUCION_REPORTES"]), texto: z.string(), puntuacion, anonimo: z.boolean(), createdAt: z.string(),
  estadoModeracion: estadoModeracionSchema.nullable().optional(), versionModeracion: z.number().int().nullable().optional(), motivoRechazo: z.string().nullable().optional(),
});
