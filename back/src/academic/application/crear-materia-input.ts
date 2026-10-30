import { z } from "zod";
import { carrerasInputError, carrerasSchema, materiaNombreSchema, modalidadMateriaSchema, resolveCarreras } from "./materia-input.js";
import type { MateriaCarrera, ModalidadMateria } from "../domain/materia.js";

export interface CrearMateriaInput {
  nombre: string;
  modalidad: ModalidadMateria;
  carreras: MateriaCarrera[];
}

const schema = z.strictObject({
  nombre: materiaNombreSchema,
  modalidad: modalidadMateriaSchema,
  carreras: carrerasSchema,
});

export function validateCrearMateriaInput(value: unknown): CrearMateriaInput {
  const result = schema.safeParse(value);
  if (result.success) {
    return {
      nombre: result.data.nombre,
      modalidad: result.data.modalidad,
      carreras: resolveCarreras(result.data.carreras),
    };
  }
  throw carrerasInputError(result.error);
}
