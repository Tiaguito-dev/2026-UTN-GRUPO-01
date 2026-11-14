import { getAuthService } from "./auth";
import { feedbackFeedSchema } from "./feedback-feed-schemas";
/** Opaque cursor from the current window; independent of Experiencias pagination. */
export function listarFeedComentarios(cursor?: string) {
  const query = new URLSearchParams({ pageSize: "9" });
  if (cursor !== undefined) query.set("cursor", cursor);
  return getAuthService().protectedGet(`/feedback/feed?${query}`, feedbackFeedSchema);
}
