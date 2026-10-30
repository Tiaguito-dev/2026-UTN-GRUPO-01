import { z } from "zod";
import type { Pagination } from "./pagination.js";
import { InvalidPaginationError } from "./errors.js";

const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export function validatePagination(value: unknown): Pagination {
  const result = paginationSchema.safeParse(value ?? {});
  if (!result.success) throw new InvalidPaginationError();
  return result.data;
}
