import { z } from "zod";
import { HttpError } from "./http";
import type { Materia, MateriaCarrera, MateriaHistorial } from "@/types/materias";
import type { PublicAccount } from "@/types/auth";
import type {
  CargoDocente,
  Comision,
  ComisionDetalle,
  Cursada,
  CursadaDetalle,
  CursadaResumen,
  Profesor,
  ProfesorAsignado,
} from "./academic";
import type { UsuarioRegistrado } from "./users";
import type { PaginatedResult } from "./pagination";

// One schema per backend response. The `z.ZodType<…>` annotation makes the compiler check that
// each schema matches the TypeScript type the screens already use.

const UNEXPECTED = "El servidor devolvió datos con un formato inesperado. Intentá nuevamente.";

/** Validates a response body. A mismatch becomes a 502 with a Spanish message, never a ZodError. */
export function parseResponse<T>(schema: z.ZodType<T>, body: unknown, message = UNEXPECTED): T {
  const result = schema.safeParse(body);
  if (!result.success) throw new HttpError(502, message);
  return result.data;
}

export function paginatedSchema<T>(item: z.ZodType<T>): z.ZodType<PaginatedResult<T>> {
  return z.object({ items: z.array(item), total: z.number(), page: z.number(), pageSize: z.number() });
}

const cuatrimestre = z.enum(["PRIMERO", "SEGUNDO"]);
const carrera = z.enum(["S", "C", "Q", "I", "M"]);
const cargo: z.ZodType<CargoDocente> = z.enum(["TITULAR", "ADJUNTO", "JTP"]);

export const materiaCarreraSchema: z.ZodType<MateriaCarrera> = z.object({
  carrera,
  anioCarrera: z.enum(["1", "2", "3", "4", "5", "ELECTIVA"]),
  nivelElectiva: z.enum(["3", "4", "5"]).nullable(),
});

export const materiaSchema: z.ZodType<Materia> = z.object({
  id: z.string(),
  nombre: z.string(),
  carreras: z.array(materiaCarreraSchema),
  createdAt: z.string(),
  deletedAt: z.string().nullable(),
});

export const materiaHistorialSchema: z.ZodType<MateriaHistorial> = z.object({
  id: z.string(),
  materiaId: z.string(),
  actor: z.object({
    id: z.string(),
    displayName: z.string(),
  }),
  createdAt: z.string(),
  cambios: z.array(
    z.object({
      campo: z.enum(["nombre", "anioCarrera", "nivelElectiva", "carreras"]),
      anterior: z.string().nullable(),
      nuevo: z.string().nullable(),
    })
  ),
});

export const profesorSchema: z.ZodType<Profesor> = z.object({
  id: z.string(),
  nombreCompleto: z.string(),
  createdAt: z.string(),
  deletedAt: z.string().nullable(),
});

export const cursadaSchema: z.ZodType<Cursada> = z.object({
  id: z.string(),
  materiaId: z.string(),
  anio: z.number(),
  cuatrimestre,
  createdAt: z.string(),
  deletedAt: z.string().nullable(),
});

export const cursadaResumenSchema: z.ZodType<CursadaResumen> = z.object({
  id: z.string(),
  anio: z.number(),
  cuatrimestre,
  comisiones: z.number(),
  profesores: z.number(),
  carreras: z.array(carrera),
});

export const cursadaDetalleSchema: z.ZodType<CursadaDetalle> = z.object({
  id: z.string(),
  anio: z.number(),
  cuatrimestre,
  materia: z.object({ id: z.string(), nombre: z.string() }),
});

export const profesorAsignadoSchema: z.ZodType<ProfesorAsignado> = z.object({
  id: z.string(),
  nombreCompleto: z.string(),
  cargo,
});

const comisionRawSchema = z.object({
  id: z.string(),
  cursadaId: z.string(),
  carrera,
  numero: z.number(),
  nombre: z.string(),
  activa: z.boolean(),
  profesores: z.array(profesorAsignadoSchema),
  createdAt: z.string(),
  deletedAt: z.string().nullable(),
});
export const comisionSchema: z.ZodType<Comision> = comisionRawSchema;

export const comisionDetalleSchema: z.ZodType<ComisionDetalle> = comisionRawSchema.extend({
  cursada: z.object({
    id: z.string(),
    anio: z.number(),
    cuatrimestre,
    materia: z.object({ id: z.string(), nombre: z.string() }),
  }),
});

export const usuarioRegistradoSchema: z.ZodType<UsuarioRegistrado> = z.object({
  id: z.string(),
  email: z.string(),
  displayName: z.string(),
  role: z.enum(["ADMIN", "USER"]),
  createdAt: z.string(),
});

/** `createdAt` is optional on purpose: a non-string value is dropped, not rejected. */
export const publicAccountSchema: z.ZodType<PublicAccount> = z.object({
  id: z.string().min(1),
  email: z.string(),
  displayName: z.string(),
  role: z.enum(["ADMIN", "USER"]),
  createdAt: z.string().optional().catch(undefined),
});

export const messageSchema = z.object({ message: z.string() });
