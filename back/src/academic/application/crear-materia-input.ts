import { z } from "zod";
import { nombreSchema } from "./academic-text.js";
import { CAMPOS_NO_PERMITIDOS, InvalidAcademicInputError } from "./errors.js";

export interface CrearMateriaInput {
  nombre: string;
}

const schema = z.strictObject({ nombre: nombreSchema(150) });

export function validateCrearMateriaInput(value: unknown): CrearMateriaInput {
  const result = schema.safeParse(value);
  if (result.success) return result.data;
  if (result.error.issues[0]?.code === "unrecognized_keys") throw new InvalidAcademicInputError(CAMPOS_NO_PERMITIDOS);
  throw new InvalidAcademicInputError("El nombre de la materia debe tener entre 1 y 150 caracteres, sin caracteres de control.");
}
