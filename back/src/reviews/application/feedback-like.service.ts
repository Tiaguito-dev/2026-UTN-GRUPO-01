import { DomainError } from "../../shared/domain/domain-error.js";
import { validateFeedbackId } from "./feedback-input.js";
import type { FeedbackLikeRepository } from "./ports/feedback-like.repository.js";

export class FeedbackSelfLikeError extends DomainError {
  readonly httpStatus = 403;
  constructor() { super("No puede reaccionar a su propio comentario."); }
}

export class FeedbackLikeService {
  constructor(private readonly repository: FeedbackLikeRepository) {}
  put(id: unknown, viewer: string) { return this.repository.put(validateFeedbackId(id), viewer); }
  remove(id: unknown, viewer: string) { return this.repository.remove(validateFeedbackId(id), viewer); }
}
