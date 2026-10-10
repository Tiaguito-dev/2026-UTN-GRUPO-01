import { z } from "zod";
import { InvalidIdError } from "./errors.js";

const idSchema = z.string().uuid();

export function validateId(value: unknown): string {
  const result = idSchema.safeParse(value);
  if (!result.success) throw new InvalidIdError();
  return result.data;
}
