import { z } from "zod";
import { FeedbackInputError } from "./errors.js";
import { validateUpdateFeedback } from "./feedback-input.js";

const bodySchema = z.strictObject({ solicitudId: z.string().uuid(), texto: z.string(), anonimo: z.boolean() });

export function validateCreateFeedbackRespuesta(value: unknown) {
  const result = bodySchema.safeParse(value);
  if (!result.success) throw new FeedbackInputError();
  // Reuse the existing text/control/Unicode rules without requiring or accepting stars.
  const normalized = validateUpdateFeedback({ texto: result.data.texto, anonimo: result.data.anonimo });
  return { solicitudId: result.data.solicitudId.toLowerCase(), texto: normalized.texto!, anonimo: result.data.anonimo };
}

export type CreateFeedbackRespuestaInput = ReturnType<typeof validateCreateFeedbackRespuesta>;

const updateSchema = bodySchema.pick({ texto: true, anonimo: true }).partial();
export function validateUpdateFeedbackRespuesta(value: unknown) {
  const result = updateSchema.safeParse(value);
  if (!result.success) throw new FeedbackInputError();
  return validateUpdateFeedback(result.data);
}
export type UpdateFeedbackRespuestaInput = Pick<ReturnType<typeof validateUpdateFeedbackRespuesta>, "texto" | "anonimo">;
