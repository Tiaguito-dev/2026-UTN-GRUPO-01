import type { Feedback, FeedbackRevision } from "../../domain/feedback.js";
import type { PaginatedResult, Pagination } from "../../../shared/domain/pagination.js";
import type { CreateFeedbackInput, UpdateFeedbackInput, FeedbackFilters } from "../feedback-input.js";

export const FEEDBACK_REPOSITORY = Symbol("FEEDBACK_REPOSITORY");
export interface FeedbackRepository {
  listGeneral(viewer: string, pagination: Pagination, filters?: FeedbackFilters): Promise<PaginatedResult<Feedback>>;
  listComision(id: string, viewer: string, pagination: Pagination): Promise<PaginatedResult<Feedback>>;
  propio(id: string, viewer: string): Promise<Feedback | null>;
  create(id: string, viewer: string, input: CreateFeedbackInput): Promise<Feedback>;
  get(id: string, viewer: string): Promise<Feedback>;
  update(id: string, viewer: string, input: UpdateFeedbackInput): Promise<Feedback>;
  remove(id: string, viewer: string): Promise<void>;
  history(id: string, viewer: string, pagination: Pagination): Promise<PaginatedResult<FeedbackRevision>>;
}
