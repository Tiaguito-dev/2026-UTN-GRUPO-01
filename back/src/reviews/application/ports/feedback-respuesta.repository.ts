import type { CreateFeedbackRespuestaInput, UpdateFeedbackRespuestaInput } from "../feedback-respuesta-input.js";
import type { FeedbackRespuestaCreada, FeedbackRespuesta } from "../../domain/feedback-respuesta.js";

import type { Pagination, PaginatedResult } from "../../../shared/domain/pagination.js";

export const FEEDBACK_RESPUESTA_REPOSITORY = Symbol("FEEDBACK_RESPUESTA_REPOSITORY");

export interface FeedbackRespuestaRepository {
  list(id: string, viewer: string, pagination: Pagination): Promise<PaginatedResult<FeedbackRespuesta>>;
  update(id: string, viewer: string, input: UpdateFeedbackRespuestaInput): Promise<FeedbackRespuesta>;
  remove(id: string, viewer: string): Promise<void>;
  create(id: string, viewer: string, input: CreateFeedbackRespuestaInput): Promise<FeedbackRespuestaCreada>;
}
