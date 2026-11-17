import { z } from "zod";
import { FeedbackInputError } from "./errors.js";

export const reporteMotivos = ["INSULTOS_ACOSO", "AMENAZAS_INTIMIDACION", "DISCRIMINACION", "DATOS_PERSONALES", "SPAM", "OTRO"] as const;
const text = z.string().refine(value => ![...value].some(character => {
  const point = character.codePointAt(0)!;
  return point < 32 || (point >= 127 && point <= 159);
})).transform(value => value.trim()).refine(value => [...value].length >= 1 && [...value].length <= 1000);
const create = z.strictObject({ motivo: z.enum(reporteMotivos), descripcion: text.optional() });
const resolve = z.strictObject({ estado: z.enum(["RESUELTO", "DESESTIMADO"]), motivo: text });
const page = z.union([z.string().regex(/^\d+$/), z.number()]).transform(Number).pipe(z.number().int().min(1).max(1_000_000)).default(1);
const pageSize = (max: number) => z.union([z.string().regex(/^\d+$/), z.number()]).transform(Number).pipe(z.number().int().min(1).max(max)).default(max);
const query = z.strictObject({ page, pageSize: pageSize(9), estado: z.enum(["ABIERTO", "RESUELTO", "DESESTIMADO"]).optional(), motivo: z.enum(reporteMotivos).optional(), feedbackId: z.string().uuid().optional() });
const detailQuery = z.strictObject({ page, pageSize: pageSize(3) });
function validate<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new FeedbackInputError("Revise los datos del reporte e intente nuevamente.");
  return result.data;
}
export const validateCreateFeedbackReporte = (value: unknown) => validate(create, value);
export const validateResolveFeedbackReporte = (value: unknown) => validate(resolve, value);
export const validateReporteQuery = (value: unknown) => validate(query, value ?? {});
export const validateReporteDetailQuery = (value: unknown) => validate(detailQuery, value ?? {});
export type CreateFeedbackReporteInput = z.infer<typeof create>;
export type ResolveFeedbackReporteInput = z.infer<typeof resolve>;
export type FeedbackReporteQuery = z.infer<typeof query>;
