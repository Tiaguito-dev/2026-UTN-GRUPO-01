import { z } from "zod";
import { nombreSchema } from "./academic-text.js";
import { CAMPOS_NO_PERMITIDOS, InvalidAcademicInputError } from "./errors.js";
import { InvalidPaginationError } from "../../shared/domain/errors.js";
import type { Pagination } from "../../shared/domain/pagination.js";
import type { AnioCarrera, NivelElectiva } from "../domain/materia.js";
import type { MateriaFilters } from "./ports/materia.repository.js";

export const anioCarreraSchema = z.enum(["1", "2", "3", "4", "5", "ELECTIVA"]);
export const nivelElectivaSchema = z.enum(["3", "4", "5"]);
export const materiaFields = { nombre: nombreSchema(150), anioCarrera: anioCarreraSchema,
  nivelElectiva: nivelElectivaSchema.nullable().optional() };
const updateSchema = z.strictObject({ nombre: materiaFields.nombre.optional(), anioCarrera: anioCarreraSchema.optional(),
  nivelElectiva: materiaFields.nivelElectiva });

export function validateActualizarMateriaInput(value: unknown): { nombre?: string; anioCarrera?: AnioCarrera; nivelElectiva?: NivelElectiva | null } {
  const result = updateSchema.safeParse(value);
  if (result.success) return result.data;
  throw new InvalidAcademicInputError(result.error.issues[0]?.code === "unrecognized_keys"
    ? CAMPOS_NO_PERMITIDOS : "Indique un nombre válido, un año entre 1 y 5 o Electiva y, para electivas, nivel 3, 4 o 5.");
}

export function validateMateriaPagination(value: unknown, maximum: number, defaultSize = maximum): Pagination {
  const result = z.object({ page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(maximum).default(defaultSize) }).safeParse(value ?? {});
  if (!result.success) throw new InvalidPaginationError();
  return result.data;
}

export function validateMateriaFilter(value: unknown): MateriaFilters {
  const result = z.object({ anioCarrera: anioCarreraSchema.optional(), nivelElectiva: nivelElectivaSchema.optional(),
    // eslint-disable-next-line no-control-regex -- rechaza caracteres de control deliberadamente, no es un error de tipeo
    q: z.string().refine((text) => !/[\u0000-\u001f\u007f-\u009f]/u.test(text))
      .transform((text) => text.trim()).refine((text) => Array.from(text).length <= 150).optional(),
  }).safeParse(value ?? {});
  if (!result.success) throw new InvalidAcademicInputError("Revise la búsqueda (máximo 150 caracteres) y seleccione un año y nivel válidos.");
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
