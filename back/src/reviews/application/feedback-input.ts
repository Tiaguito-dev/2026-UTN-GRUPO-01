import { z } from "zod";
import { FeedbackInputError } from "./errors.js";
import { carreraSchema } from "../../academic/application/materia-input.js";

const forbiddenControl = (text: string) => [...text].some((character) => {
  const point = character.codePointAt(0)!;
  return (point < 32 && point !== 9 && point !== 10 && point !== 13) || (point >= 127 && point <= 159);
});
const texto = z.string().refine((value) => !forbiddenControl(value), "El comentario contiene caracteres no permitidos.")
  .transform((value) => value.trim())
  .refine((value) => [...value].length >= 1 && [...value].length <= 3000, "El comentario debe tener entre 1 y 3000 caracteres.");
const create = z.strictObject({ texto, anonimo: z.boolean(), profesorId: z.string().uuid().nullable().optional() });
const update = z.strictObject({ texto: texto.optional(), anonimo: z.boolean().optional() });
const page = z.union([z.string().regex(/^\d+$/), z.number()]).transform(Number).pipe(z.number().int().min(1).max(1_000_000)).default(1);
const pageSize = (max: number) => z.union([z.string().regex(/^\d+$/), z.number()]).transform(Number).pipe(z.number().int().min(1).max(max)).default(max);
const pagination = (history: boolean) => z.strictObject({ page, pageSize: pageSize(history ? 3 : 9) });
const generalQuery = pagination(false).extend({ carrera: carreraSchema.optional(), materiaId: z.string().uuid().optional() });

function validate<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new FeedbackInputError();
  return result.data;
}
export const validateCreateFeedback = (value: unknown) => validate(create, value);
export const validateUpdateFeedback = (value: unknown) => validate(update, value);
export const validateFeedbackPagination = (value: unknown, history = false) => validate(pagination(history), value ?? {});
export const validateFeedbackId = (value: unknown) => validate(z.string().uuid(), value);
export const validateGeneralFeedbackQuery = (value: unknown) => validate(generalQuery, value ?? {});
export type FeedbackFilters = Pick<z.infer<typeof generalQuery>, "carrera" | "materiaId">;
export type CreateFeedbackInput = z.infer<typeof create>;
export type UpdateFeedbackInput = z.infer<typeof update>;
