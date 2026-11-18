import type { Feedback, FeedbackOwn, FeedbackRevision } from "../../domain/feedback.js";
import type { UserRole } from "../../../users/domain/user.js";
import type { PaginatedResult, Pagination } from "../../../shared/domain/pagination.js";
import type { CreateFeedbackInput, UpdateFeedbackInput, FeedbackFilters } from "../feedback-input.js";
import type { FeedbackModerationActor, FeedbackModerationCommand, FeedbackModerationState, FeedbackModerationStatus } from "../../domain/feedback-moderation.js";

export const FEEDBACK_REPOSITORY = Symbol("FEEDBACK_REPOSITORY");
export interface FeedbackRepository {
  aceptoNormas(viewer: string, version: string): Promise<boolean>;
  listGeneral(viewer: string, pagination: Pagination, filters?: FeedbackFilters): Promise<PaginatedResult<Feedback>>;
  listOwn(viewer: string, pagination: Pagination): Promise<PaginatedResult<FeedbackOwn>>;
  listModeration(pagination: Pagination, estado: FeedbackModerationStatus): Promise<PaginatedResult<FeedbackOwn>>;
  listComision(id: string, viewer: string, pagination: Pagination): Promise<PaginatedResult<Feedback>>;
  propio(id: string, viewer: string): Promise<FeedbackOwn | null>;
  create(id: string, viewer: string, input: CreateFeedbackInput): Promise<Feedback>;
  get(id: string, viewer: string): Promise<FeedbackOwn>;
  update(id: string, viewer: string, input: UpdateFeedbackInput): Promise<FeedbackOwn>;
  remove(id: string, viewer: string, role?: UserRole): Promise<void>;
  history(id: string, viewer: string, pagination: Pagination): Promise<PaginatedResult<FeedbackRevision>>;
  /** Transactional transition shared by all author and administration actions. */
  transitionModeration(id: string, actor: FeedbackModerationActor, command: FeedbackModerationCommand): Promise<FeedbackModerationState>;
}
