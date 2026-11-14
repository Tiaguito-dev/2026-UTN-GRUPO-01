import { z } from "zod";
import type { FeedbackFeed } from "@/types/feedback-feed";
import { feedbackSchema } from "./feedback-schemas";
const count = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
const item = z.intersection(feedbackSchema, z.object({ cantidadLikes: count, cantidadRespuestas: count, meGusta: z.boolean() }))
  .refine(value => Number.isFinite(Date.parse(value.createdAt)) && Number.isFinite(Date.parse(value.updatedAt)));
export const feedbackFeedSchema: z.ZodType<FeedbackFeed> = z.object({
  items: z.array(item).max(9), nextCursor: z.string().min(1).max(1024).nullable(), hasMore: z.boolean(),
}).refine(value => value.hasMore === (value.nextCursor !== null));
