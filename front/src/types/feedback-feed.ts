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

export interface FeedbackLike { meGusta: boolean; cantidadLikes: number }
export interface FeedbackRespuesta {
  id: string; feedbackId: string; texto: string; anonimo: boolean;
  autor: { displayName: string } | null; propio: boolean; createdAt: string; updatedAt: string;
}
export interface FeedbackRespuestaInput { solicitudId: string; texto: string; anonimo: boolean }
export type FeedbackRespuestaEdicion = Partial<Pick<FeedbackRespuestaInput, "texto" | "anonimo">>;
