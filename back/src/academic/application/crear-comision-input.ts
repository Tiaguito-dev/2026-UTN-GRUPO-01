import { z } from "zod";
import { CAMPOS_NO_PERMITIDOS, InvalidAcademicInputError } from "./errors.js";
import { carreraSchema } from "./materia-input.js";
import type { Carrera } from "../domain/materia.js";

export interface CrearComisionInput {
  cursadaId: string;
  carrera: Carrera;
  numero: number;
}

const schema = z.strictObject({
  cursadaId: z.string().uuid(),
  carrera: carreraSchema,
  numero: z.number().int().min(1).max(999),
});

const MENSAJES: Record<string, string> = {
  cursadaId: "El identificador de la cursada no es válido.",
  carrera: "La carrera debe ser S, C, Q, I o M.",
  numero: "El número de comisión debe ser un entero entre 1 y 999.",
};

export function validateCrearComisionInput(value: unknown): CrearComisionInput {
  const result = schema.safeParse(value);
  if (result.success) return result.data;
  if (result.error.issues.some((issue) => issue.code === "unrecognized_keys")) throw new InvalidAcademicInputError(CAMPOS_NO_PERMITIDOS);
  const campo = String(result.error.issues[0]?.path[0] ?? "");
  throw new InvalidAcademicInputError(MENSAJES[campo] ?? "Los datos de la comisión no son válidos.");
}
