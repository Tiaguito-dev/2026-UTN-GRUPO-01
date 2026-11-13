import { z } from "zod";
import type { FeedbackFeedQuery } from "../domain/feedback-feed.js";
import { FeedbackInputError } from "./errors.js";

const size = z.number().int().min(1).max(9);
const point = z.strictObject({
  id: z.string().uuid().transform(value => value.toLowerCase()),
  createdAt: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
    .refine(value => Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value),
});
const cursorSchema = z.strictObject({ v: z.literal(1), pageSize: size, upper: point, after: point });
const querySchema = z.strictObject({
  pageSize: z.union([z.string().regex(/^\d+$/).transform(Number), z.number()]).pipe(size).default(9),
  cursor: z.string().min(1).max(1024).regex(/^[A-Za-z0-9_-]+$/).optional(),
});

export function validateFeedbackFeedQuery(value: unknown): FeedbackFeedQuery {
  const parsed = querySchema.safeParse(value ?? {});
  if (!parsed.success) throw new FeedbackInputError();
  const { pageSize, cursor: encoded } = parsed.data;
  if (encoded === undefined) return { pageSize };
  try {
    const decoded = Buffer.from(encoded, "base64url");
    if (decoded.toString("base64url") !== encoded) throw new FeedbackInputError();
    const cursor = cursorSchema.parse(JSON.parse(decoded.toString("utf8")));
    if (cursor.pageSize !== pageSize || cursor.after.createdAt > cursor.upper.createdAt ||
      (cursor.after.createdAt === cursor.upper.createdAt && cursor.after.id > cursor.upper.id)) throw new FeedbackInputError();
    return { pageSize, cursor };
  } catch {
    throw new FeedbackInputError();
  }
}
