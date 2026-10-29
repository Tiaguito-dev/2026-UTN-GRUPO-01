import type { FeedbackRepository } from "./ports/feedback.repository.js";
import { validateCreateFeedback, validateFeedbackId, validateFeedbackPagination, validateGeneralFeedbackQuery, validateUpdateFeedback } from "./feedback-input.js";

/** Application boundary: all external inputs are normalized before reaching persistence. */
export class FeedbackService {
  constructor(private readonly repository: FeedbackRepository) {}
  listGeneral(viewer: string, query: unknown) {
    const { page, pageSize, ...filters } = validateGeneralFeedbackQuery(query);
    return this.repository.listGeneral(viewer, { page, pageSize }, filters);
  }
  listComision(id: unknown, viewer: string, query: unknown) { return this.repository.listComision(validateFeedbackId(id), viewer, validateFeedbackPagination(query)); }
  propio(id: unknown, viewer: string) { return this.repository.propio(validateFeedbackId(id), viewer); }
  create(id: unknown, viewer: string, body: unknown) { return this.repository.create(validateFeedbackId(id), viewer, validateCreateFeedback(body)); }
  get(id: unknown, viewer: string) { return this.repository.get(validateFeedbackId(id), viewer); }
  update(id: unknown, viewer: string, body: unknown) { return this.repository.update(validateFeedbackId(id), viewer, validateUpdateFeedback(body)); }
  remove(id: unknown, viewer: string) { return this.repository.remove(validateFeedbackId(id), viewer); }
  history(id: unknown, viewer: string, query: unknown) { return this.repository.history(validateFeedbackId(id), viewer, validateFeedbackPagination(query, true)); }
}
