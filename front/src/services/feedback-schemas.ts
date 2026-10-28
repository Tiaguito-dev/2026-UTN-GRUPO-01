import { z } from "zod";
import type { Feedback, FeedbackHistorial } from "@/types/feedback";

export const feedbackSchema: z.ZodType<Feedback> = z.object({
  id: z.string(), texto: z.string(), anonimo: z.boolean(), propio: z.boolean(),
  autor: z.object({ displayName: z.string() }).nullable(),
  profesor: z.object({ id: z.string(), nombreCompleto: z.string(), cargo: z.enum(["TITULAR", "ADJUNTO", "JTP"]) }).nullable(),
  contexto: z.object({
    comisionId: z.string(), nombre: z.string(), materiaId: z.string(), materiaNombre: z.string(),
    cursadaId: z.string(), anio: z.number(), cuatrimestre: z.enum(["PRIMERO", "SEGUNDO", "ANUAL"]).nullable(),
    modalidad: z.enum(["ANUAL", "PRIMERO", "SEGUNDO"]).nullable().optional(),
  }),
  createdAt: z.string(), updatedAt: z.string(),
}).refine((value) => !value.anonimo || value.autor === null);
export const feedbackHistorialSchema: z.ZodType<FeedbackHistorial> = z.object({
  id: z.string(), accion: z.enum(["CREACION", "EDICION", "ELIMINACION"]), texto: z.string(), anonimo: z.boolean(), createdAt: z.string(),
});
