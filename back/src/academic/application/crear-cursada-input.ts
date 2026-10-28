import { z } from "zod";
import { CAMPOS_NO_PERMITIDOS, InvalidAcademicInputError } from "./errors.js";

export interface CrearCursadaInput {
  materiaId: string;
  anio: number;
}

export const ANIO_MINIMO = 2000;

/** Decisión 4 de TASK-019: hasta el año siguiente, para no bloquear la planificación del período que viene. */
export function anioMaximo(now: Date = new Date()): number {
  return now.getFullYear() + 1;
}

// El esquema se construye por llamada: el año máximo depende de la fecha actual y el proceso
// puede seguir vivo al cruzar el 1 de enero.
function schema(): z.ZodType<CrearCursadaInput> {
  return z.strictObject({
    materiaId: z.string().uuid(),
    anio: z.number().int().min(ANIO_MINIMO).max(anioMaximo()),
  });
}

const MENSAJES: Record<string, string> = {
  materiaId: "El identificador de la materia no es válido.",
};

export function validateCrearCursadaInput(value: unknown): CrearCursadaInput {
  const result = schema().safeParse(value);
  if (result.success) return result.data;
  if (result.error.issues.some((issue) => issue.code === "unrecognized_keys")) throw new InvalidAcademicInputError(CAMPOS_NO_PERMITIDOS);
  const campo = String(result.error.issues[0]?.path[0] ?? "");
  if (campo === "anio") {
    throw new InvalidAcademicInputError(`El año debe ser un número entero entre ${ANIO_MINIMO} y ${anioMaximo()}.`);
  }
  throw new InvalidAcademicInputError(MENSAJES[campo] ?? "Los datos de la cursada no son válidos.");
}
