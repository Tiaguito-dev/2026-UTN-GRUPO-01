import { getAuthService } from "./auth";
import { requestJson } from "./http";
import { profesorSchema, cursadaSchema, comisionSchema, parseResponse } from "./schemas";
import type { Cursada, Comision, Profesor } from "./academic";
import type { Carrera } from "@/types/materias";
import type { z } from "zod";
export function obtenerProfesor(id: string): Promise<Profesor> { return getAuthService().protectedGet(`/profesores/${encodeURIComponent(id)}`, profesorSchema); }
async function patch<T>(path: string, input: unknown, schema: z.ZodType<T>): Promise<T> {
  await getAuthService().me();
  return parseResponse(schema, await requestJson(path, { method: "PATCH", body: input }));
}
export function actualizarProfesor(id: string, input: { nombreCompleto: string }): Promise<Profesor> { return patch(`/profesores/${encodeURIComponent(id)}`, input, profesorSchema); }
export function actualizarCursada(id: string, input: Partial<{ materiaId: string; anio: number; cuatrimestre: NonNullable<Cursada["cuatrimestre"]> }>): Promise<Cursada> { return patch(`/cursadas/${encodeURIComponent(id)}`, input, cursadaSchema); }
export function actualizarComision(id: string, input: { carrera?: Carrera; numero?: number }): Promise<Comision> { return patch(`/comisiones/${encodeURIComponent(id)}`, input, comisionSchema); }
