export const FEEDBACK_LIKE_REPOSITORY = Symbol("FEEDBACK_LIKE_REPOSITORY");

export interface FeedbackLikeState {
  meGusta: boolean;
  cantidadLikes: number;
}

export interface FeedbackLikeRepository {
  put(id: string, viewer: string): Promise<FeedbackLikeState>;
  remove(id: string, viewer: string): Promise<FeedbackLikeState>;
}
