import { z } from "zod";
import { carrerasInputError, carrerasSchema, materiaNombreSchema, resolveCarreras } from "./materia-input.js";
import type { MateriaCarrera } from "../domain/materia.js";

export interface CrearMateriaInput {
  nombre: string;
  carreras: MateriaCarrera[];
}

const schema = z.strictObject({
  nombre: materiaNombreSchema,
  carreras: carrerasSchema,
});

export function validateCrearMateriaInput(value: unknown): CrearMateriaInput {
  const result = schema.safeParse(value);
  if (result.success) {
    return {
      nombre: result.data.nombre,
      carreras: resolveCarreras(result.data.carreras),
    };
  }
  throw carrerasInputError(result.error);
}
