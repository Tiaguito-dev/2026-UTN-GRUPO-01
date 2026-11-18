import type { FeedbackModerationRecord } from "./feedback-moderation.js";

/** One publication contract; adapters derive query predicates from these exact requirements. */
export const PUBLIC_FEEDBACK_REQUIREMENTS = {
  estadoModeracion: "APROBADO", deletedAt: null,
  ocultoAutor: false, ocultoAdministracion: false, ocultoReportes: false,
} as const;

export type FeedbackVisibility = Pick<FeedbackModerationRecord, keyof typeof PUBLIC_FEEDBACK_REQUIREMENTS>;

export function isFeedbackVisible(row: FeedbackVisibility): boolean {
  return (Object.keys(PUBLIC_FEEDBACK_REQUIREMENTS) as (keyof FeedbackVisibility)[])
    .every(field => row[field] === PUBLIC_FEEDBACK_REQUIREMENTS[field]);
}
