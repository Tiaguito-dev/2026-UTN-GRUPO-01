import { validateFeedbackFeedQuery } from "./feedback-feed-input.js";
import type { FeedbackFeedRepository } from "./ports/feedback-feed.repository.js";

export class FeedbackFeedService {
  constructor(private readonly repository: FeedbackFeedRepository) {}

  list(viewer: string, query: unknown) {
    return this.repository.list(viewer, validateFeedbackFeedQuery(query));
  }
}
