import type { Feedback } from "./feedback.js";

export interface FeedbackFeedPoint {
  createdAt: string;
  id: string;
}

export interface FeedbackFeedCursor {
  v: 1;
  pageSize: number;
  upper: FeedbackFeedPoint;
  after: FeedbackFeedPoint;
}

export interface FeedbackFeedQuery {
  pageSize: number;
  cursor?: FeedbackFeedCursor;
}

export interface FeedbackFeedItem extends Feedback {
  cantidadLikes: number;
  cantidadRespuestas: number;
  meGusta: boolean;
}

export interface FeedbackFeed {
  items: FeedbackFeedItem[];
  nextCursor: string | null;
  hasMore: boolean;
}
