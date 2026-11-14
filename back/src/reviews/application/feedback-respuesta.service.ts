import { DomainError } from "../../shared/domain/domain-error.js";
import { validateFeedbackId } from "./feedback-input.js";
import { validateCreateFeedbackRespuesta } from "./feedback-respuesta-input.js";
import type { FeedbackRespuestaRepository } from "./ports/feedback-respuesta.repository.js";

export class FeedbackRespuestaConflictError extends DomainError {
  readonly httpStatus = 409;
  constructor() { super("La solicitud ya fue utilizada con otro contenido o la respuesta fue eliminada."); }
}

export class FeedbackRespuestaService {
  constructor(private readonly repository: FeedbackRespuestaRepository) {}
  create(id: unknown, viewer: string, body: unknown) {
    return this.repository.create(validateFeedbackId(id).toLowerCase(), viewer, validateCreateFeedbackRespuesta(body));
  }
}
