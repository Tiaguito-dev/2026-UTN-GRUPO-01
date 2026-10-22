import { z } from "zod";
import { materiaFields, resolveNivelElectiva } from "./materia-input.js";
import type { AnioCarrera, NivelElectiva } from "../domain/materia.js";
import { CAMPOS_NO_PERMITIDOS, InvalidAcademicInputError } from "./errors.js";

export interface CrearMateriaInput {
  nombre: string;
  anioCarrera: AnioCarrera;
  nivelElectiva: NivelElectiva | null;
}

const schema = z.strictObject(materiaFields);

export function validateCrearMateriaInput(value: unknown): CrearMateriaInput {
  const result = schema.safeParse(value);
  if (result.success) return { ...result.data, nivelElectiva: resolveNivelElectiva(result.data.anioCarrera, result.data.nivelElectiva) };
  if (result.error.issues[0]?.code === "unrecognized_keys") throw new InvalidAcademicInputError(CAMPOS_NO_PERMITIDOS);
  throw new InvalidAcademicInputError("Indique un nombre de entre 1 y 150 caracteres, sin controles, un año entre 1 y 5 o Electiva y un nivel de electiva válido (3, 4 o 5).");
}
