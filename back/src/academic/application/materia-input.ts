import { z } from "zod";
import { nombreSchema } from "./academic-text.js";
import { CAMPOS_NO_PERMITIDOS, InvalidAcademicInputError } from "./errors.js";
import { InvalidPaginationError } from "../../shared/domain/errors.js";
import type { Pagination } from "../../shared/domain/pagination.js";
import { CARRERAS, type AnioCarrera, type MateriaCarrera, type NivelElectiva } from "../domain/materia.js";
import type { MateriaFilters } from "./ports/materia.repository.js";

export const anioCarreraSchema = z.enum(["1", "2", "3", "4", "5", "ELECTIVA"]);
export const nivelElectivaSchema = z.enum(["3", "4", "5"]);
export const materiaNombreSchema = nombreSchema(150);

export const carreraSchema = z.enum(CARRERAS);
export const materiaCarreraSchema = z.strictObject({
  carrera: carreraSchema,
  anioCarrera: anioCarreraSchema,
  nivelElectiva: nivelElectivaSchema.nullable().optional(),
});
export const carrerasSchema = z.array(materiaCarreraSchema).min(1)
  .refine((filas) => new Set(filas.map((fila) => fila.carrera)).size === filas.length);

const updateCarrerasSchema = z.strictObject({
  nombre: materiaNombreSchema.optional(),
  carreras: carrerasSchema.optional(),
});

export function carrerasInputError(error: z.ZodError): InvalidAcademicInputError {
  return new InvalidAcademicInputError(error.issues.some((issue) => issue.code === "unrecognized_keys") ? CAMPOS_NO_PERMITIDOS
    : "Indique al menos una carrera (S, C, Q, I o M), sin repetir, cada una con un año entre 1 y 5 o Electiva y, para electivas, nivel 3, 4 o 5.");
}

/** Exige nivel en Electiva y lo descarta en el resto. */
export function resolveCarreras(filas: z.infer<typeof carrerasSchema>): MateriaCarrera[] {
  return filas.map((fila) => ({ ...fila, nivelElectiva: resolveNivelElectiva(fila.anioCarrera, fila.nivelElectiva) }));
}

export function validateActualizarMateriaInput(value: unknown): { nombre?: string; carreras?: MateriaCarrera[] } {
  const result = updateCarrerasSchema.safeParse(value);
  if (!result.success) throw carrerasInputError(result.error);
  const output: { nombre?: string; carreras?: MateriaCarrera[] } = {};
  if (result.data.nombre !== undefined) output.nombre = result.data.nombre;
  if (result.data.carreras !== undefined) output.carreras = resolveCarreras(result.data.carreras);
  return output;
}

export function validateMateriaPagination(value: unknown, maximum: number, defaultSize = maximum): Pagination {
  const result = z.object({ page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(maximum).default(defaultSize) }).safeParse(value ?? {});
  if (!result.success) throw new InvalidPaginationError();
  return result.data;
}

export function validateMateriaFilter(value: unknown): MateriaFilters {
  const result = z.object({ carrera: carreraSchema.optional(),
    anioCarrera: anioCarreraSchema.optional(), nivelElectiva: nivelElectivaSchema.optional(),
    // eslint-disable-next-line no-control-regex -- rechaza caracteres de control deliberadamente, no es un error de tipeo
    q: z.string().refine((text) => !/[\u0000-\u001f\u007f-\u009f]/u.test(text))
      .transform((text) => text.trim()).refine((text) => Array.from(text).length <= 150).optional(),
  }).safeParse(value ?? {});
  if (!result.success) throw new InvalidAcademicInputError("Revise la búsqueda (máximo 150 caracteres) y seleccione una carrera, un año y un nivel válidos.");
  if (!result.data.carrera && (result.data.anioCarrera || result.data.nivelElectiva)) {
    throw new InvalidAcademicInputError("Seleccione una carrera para filtrar por año o nivel.");
  }
  if (result.data.nivelElectiva && result.data.anioCarrera !== "ELECTIVA") {
    throw new InvalidAcademicInputError("El filtro de nivel solo está disponible para Electivas.");
  }
  return { ...result.data, q: result.data.q || undefined };
}

/** Resolve against the effective year both before saving and after acquiring the row lock. */
export function resolveNivelElectiva(anioCarrera: AnioCarrera | null, nivelElectiva: NivelElectiva | null | undefined): NivelElectiva | null {
  if (anioCarrera !== "ELECTIVA") return null;
  if (!nivelElectiva) throw new InvalidAcademicInputError("Indique el nivel de la electiva: 3, 4 o 5.");
  return nivelElectiva;
}
