import type { FeedbackFeed, FeedbackFeedQuery } from "../../domain/feedback-feed.js";

export const FEEDBACK_FEED_REPOSITORY = Symbol("FEEDBACK_FEED_REPOSITORY");

export interface FeedbackFeedRepository {
  list(viewer: string, query: FeedbackFeedQuery): Promise<FeedbackFeed>;
}
