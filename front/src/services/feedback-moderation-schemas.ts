import { z } from "zod";
import type { EstadoModeracionFeedback } from "@/types/feedback-moderation";

export const estadoModeracionSchema = z.enum(["PENDIENTE", "APROBADO", "RECHAZADO"]);
export const moderationFields = {
  estadoModeracion: estadoModeracionSchema,
  versionModeracion: z.number().int().min(1),
  requiereRevisionHumana: z.boolean(), motivoRechazo: z.string().nullable(),
  ocultoAutor: z.boolean(), ocultoAdministracion: z.boolean(), ocultoReportes: z.boolean(),
};
export const feedbackModerationSchema: z.ZodType<EstadoModeracionFeedback> = z.object(moderationFields);
