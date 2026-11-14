import { z } from "zod";
import type { FeedbackFeed, FeedbackLike, FeedbackRespuesta } from "@/types/feedback-feed";
import { feedbackSchema } from "./feedback-schemas";
const count = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
const item = z.intersection(feedbackSchema, z.object({ cantidadLikes: count, cantidadRespuestas: count, meGusta: z.boolean() }))
  .refine(value => Number.isFinite(Date.parse(value.createdAt)) && Number.isFinite(Date.parse(value.updatedAt)));
export const feedbackFeedSchema: z.ZodType<FeedbackFeed> = z.object({
  items: z.array(item).max(9), nextCursor: z.string().min(1).max(1024).nullable(), hasMore: z.boolean(),
}).refine(value => value.hasMore === (value.nextCursor !== null));

export const feedbackLikeSchema: z.ZodType<FeedbackLike> = z.object({ meGusta: z.boolean(), cantidadLikes: count });
export const feedbackRespuestaSchema: z.ZodType<FeedbackRespuesta> = z.object({
  id: z.string(), feedbackId: z.string(), texto: z.string(), anonimo: z.boolean(), propio: z.boolean(),
  autor: z.object({ displayName: z.string() }).nullable(), createdAt: z.string(), updatedAt: z.string(),
}).refine(value => (!value.anonimo || value.autor === null) && Number.isFinite(Date.parse(value.createdAt)) && Number.isFinite(Date.parse(value.updatedAt)));
export const feedbackRespuestasSchema = z.object({
  items: z.array(feedbackRespuestaSchema).max(100), total: count, page: z.number().int().min(1), pageSize: z.number().int().min(1).max(100),
}).refine(value => value.items.length <= value.pageSize);
