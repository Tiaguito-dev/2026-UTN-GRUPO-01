import { DomainError } from "../../shared/domain/domain-error.js";
import { validateFeedbackId } from "./feedback-input.js";
import { validateCreateFeedbackRespuesta, validateUpdateFeedbackRespuesta } from "./feedback-respuesta-input.js";
import type { FeedbackRespuestaRepository } from "./ports/feedback-respuesta.repository.js";

export class FeedbackRespuestaConflictError extends DomainError {
  readonly httpStatus = 409;
  constructor() { super("La solicitud ya fue utilizada con otro contenido o la respuesta fue eliminada."); }
}

import { validatePagination } from "../../shared/domain/pagination-input.js";

export class FeedbackRespuestaService {
  constructor(private readonly repository: FeedbackRespuestaRepository) {}
  list(id: unknown, viewer: string, query: unknown) {
    return this.repository.list(validateFeedbackId(id).toLowerCase(), viewer, validatePagination(query));
  }
  update(id: unknown, viewer: string, body: unknown) {
    return this.repository.update(validateFeedbackId(id).toLowerCase(), viewer, validateUpdateFeedbackRespuesta(body));
  }
  remove(id: unknown, viewer: string) {
    return this.repository.remove(validateFeedbackId(id).toLowerCase(), viewer);
  }
  create(id: unknown, viewer: string, body: unknown) {
    return this.repository.create(validateFeedbackId(id).toLowerCase(), viewer, validateCreateFeedbackRespuesta(body));
  }
}
