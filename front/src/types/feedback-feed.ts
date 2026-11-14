import type { Feedback } from "./feedback";
export interface FeedbackFeedItem extends Feedback {
  cantidadLikes: number;
  meGusta: boolean;
  cantidadRespuestas: number;
}
export interface FeedbackFeed {
  items: FeedbackFeedItem[];
  nextCursor: string | null;
  hasMore: boolean;
}
