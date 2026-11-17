import type { Pagination, PaginatedResult } from "../../../shared/domain/pagination.js";
import type { CreateFeedbackReporteInput, ResolveFeedbackReporteInput, FeedbackReporteQuery } from "../feedback-reporte-input.js";
import type { FeedbackReporteAdmin, FeedbackReporteReceipt, FeedbackReporteItem, FeedbackReporteDetail } from "../../domain/feedback-reporte.js";
export const FEEDBACK_REPORTE_REPOSITORY = Symbol("FEEDBACK_REPORTE_REPOSITORY");
export interface FeedbackReporteRepository {
  create(id: string, viewer: string, input: CreateFeedbackReporteInput): Promise<{ created: boolean; reporte: FeedbackReporteReceipt }>;
  list(query: FeedbackReporteQuery): Promise<PaginatedResult<FeedbackReporteItem>>;
  get(id: string, query: Pagination): Promise<FeedbackReporteDetail>;
  resolve(id: string, actor: { id: string; role: "ADMIN" | "USER" }, input: ResolveFeedbackReporteInput): Promise<FeedbackReporteAdmin>;
}
