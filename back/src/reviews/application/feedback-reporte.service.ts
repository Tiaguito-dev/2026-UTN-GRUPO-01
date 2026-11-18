import { DomainError } from "../../shared/domain/domain-error.js";
import { validateFeedbackId } from "./feedback-input.js";
import { validateCreateFeedbackReporte, validateReporteQuery, validateReporteDetailQuery, validateResolveFeedbackReporte } from "./feedback-reporte-input.js";
import type { FeedbackReporteRepository } from "./ports/feedback-reporte.repository.js";

export class FeedbackReporteError extends DomainError {
  constructor(readonly httpStatus: number, message: string) { super(message); }
}
export class FeedbackReporteService {
  constructor(private readonly repository: FeedbackReporteRepository) {}
  create(id: unknown, viewer: string, body: unknown) {
    return this.repository.create(validateFeedbackId(id), validateFeedbackId(viewer), validateCreateFeedbackReporte(body));
  }
  list(query: unknown) { return this.repository.list(validateReporteQuery(query)); }
  get(id: unknown, query: unknown) { return this.repository.get(validateFeedbackId(id), validateReporteDetailQuery(query)); }
  resolve(id: unknown, actor: { id: string; role: "ADMIN" | "USER" }, body: unknown) {
    if (actor.role !== "ADMIN") throw new FeedbackReporteError(403, "Se requiere acceso administrativo.");
    return this.repository.resolve(validateFeedbackId(id), { ...actor, id: validateFeedbackId(actor.id) }, validateResolveFeedbackReporte(body));
  }
}
