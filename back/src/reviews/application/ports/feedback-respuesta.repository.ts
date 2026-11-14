import type { CreateFeedbackRespuestaInput } from "../feedback-respuesta-input.js";
import type { FeedbackRespuestaCreada } from "../../domain/feedback-respuesta.js";

export const FEEDBACK_RESPUESTA_REPOSITORY = Symbol("FEEDBACK_RESPUESTA_REPOSITORY");

export interface FeedbackRespuestaRepository {
  create(id: string, viewer: string, input: CreateFeedbackRespuestaInput): Promise<FeedbackRespuestaCreada>;
}
