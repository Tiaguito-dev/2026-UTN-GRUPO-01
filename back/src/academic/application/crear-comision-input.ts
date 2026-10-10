import { z } from "zod";
import { nombreSchema } from "./academic-text.js";
import { CAMPOS_NO_PERMITIDOS, InvalidAcademicInputError } from "./errors.js";

export interface CrearComisionInput {
  cursadaId: string;
  nombre: string;
}

const schema = z.strictObject({
  cursadaId: z.string().uuid(),
  nombre: nombreSchema(100),
});

export function validateCrearComisionInput(value: unknown): CrearComisionInput {
  const result = schema.safeParse(value);
  if (result.success) return result.data;
  if (result.error.issues[0]?.code === "unrecognized_keys") throw new InvalidAcademicInputError(CAMPOS_NO_PERMITIDOS);
  const campo = String(result.error.issues[0]?.path[0] ?? "");
  if (campo === "cursadaId") throw new InvalidAcademicInputError("El identificador de la cursada no es válido.");
  throw new InvalidAcademicInputError("El nombre de la comisión debe tener entre 1 y 100 caracteres, sin caracteres de control.");
}
