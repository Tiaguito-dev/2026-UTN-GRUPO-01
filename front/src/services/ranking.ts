import { z } from "zod";
import type { CargoDocente, Cuatrimestre } from "./academic";
import type { Carrera, ResumenValoracionMateria } from "@/types/materias";
import { getAuthService } from "./auth";
import { paginatedSchema } from "./schemas";
import type { PaginationInput } from "./pagination";

// Contract of GET /rankings/* (back/OVERVIEW.md, "Ranking de comisiones y profesores").

interface ContextoComision {
  comision: { id: string; nombre: string; carrera: Carrera; activa: boolean };
  materia: { id: string; nombre: string };
  cursada: { id: string; anio: number; cuatrimestre: Cuatrimestre | null };
}
export interface RankingComision extends ContextoComision { posicion: number; valoracion: ResumenValoracionMateria }
/** One commission (subject + career + number) across every year it was rated. */
export interface RankingComisionHistorica {
  posicion: number;
  comision: { nombre: string; carrera: Carrera };
  materia: { id: string; nombre: string };
  /** Most recent first; the row links to the first one. */
  cursadas: { id: string; anio: number; cuatrimestre: Cuatrimestre | null; comisionId: string; activa: boolean }[];
  anios: { desde: number; hasta: number };
  valoracion: ResumenValoracionMateria;
}
export interface ComisionDeProfesor extends ContextoComision { cargo: CargoDocente | null; valoracion: ResumenValoracionMateria }
export interface RankingProfesor {
  /** null when the professor has too few votes to rank (search results and profile only). */
  posicion: number | null;
  profesor: { id: string; nombreCompleto: string };
  valoracion: ResumenValoracionMateria;
  comisiones: ComisionDeProfesor[];
}

const valoracion: z.ZodType<ResumenValoracionMateria> = z.object({
  promedio: z.number().min(1).max(5).nullable(),
  cantidad: z.number().int().nonnegative(),
}).refine(({ promedio, cantidad }) => cantidad === 0 ? promedio === null : promedio !== null);
const contexto = {
  comision: z.object({ id: z.string(), nombre: z.string(), carrera: z.enum(["S", "C", "Q", "I", "M"]), activa: z.boolean() }),
  materia: z.object({ id: z.string(), nombre: z.string() }),
  cursada: z.object({ id: z.string(), anio: z.number(), cuatrimestre: z.enum(["PRIMERO", "SEGUNDO", "ANUAL"]).nullable() }),
};
const rankingComisionSchema: z.ZodType<RankingComision> = z.object({ ...contexto, posicion: z.number().int().positive(), valoracion });
const rankingComisionHistoricaSchema: z.ZodType<RankingComisionHistorica> = z.object({
  posicion: z.number().int().positive(),
  comision: z.object({ nombre: z.string(), carrera: contexto.comision.shape.carrera }),
  materia: contexto.materia,
  cursadas: z.array(z.object({ id: z.string(), anio: z.number(), cuatrimestre: z.enum(["PRIMERO", "SEGUNDO", "ANUAL"]).nullable(), comisionId: z.string(), activa: z.boolean() })).min(1),
  anios: z.object({ desde: z.number(), hasta: z.number() }),
  valoracion,
});
const rankingProfesorSchema: z.ZodType<RankingProfesor> = z.object({
  posicion: z.number().int().positive().nullable(),
  profesor: z.object({ id: z.string(), nombreCompleto: z.string() }),
  valoracion,
  comisiones: z.array(z.object({ ...contexto, cargo: z.enum(["TITULAR", "ADJUNTO", "JTP"]).nullable(), valoracion })),
});

function query(input: object): string {
  const params = new URLSearchParams();
  for (const [name, value] of Object.entries(input) as [string, string | number | undefined][]) if (value !== undefined && value !== "") params.set(name, String(value));
  return params.size ? `?${params}` : "";
}

export function listarRankingComisiones(input: PaginationInput & { minValoraciones?: number; materiaId?: string } = {}) {
  return getAuthService().protectedGet(`/rankings/comisiones${query(input)}`, paginatedSchema(rankingComisionHistoricaSchema));
}

/** Commissions of one cursada, best first (source of the "Mejor valorada" badge). */
export function listarRankingComisionesDeCursada(cursadaId: string) {
  return getAuthService().protectedGet(`/rankings/cursadas/${encodeURIComponent(cursadaId)}/comisiones`, z.array(rankingComisionSchema));
}

export function listarRankingProfesores(input: PaginationInput & { q?: string } = {}) {
  return getAuthService().protectedGet(`/rankings/profesores${query(input)}`, paginatedSchema(rankingProfesorSchema));
}

export function obtenerRankingProfesor(id: string) {
  return getAuthService().protectedGet(`/rankings/profesores/${encodeURIComponent(id)}`, rankingProfesorSchema);
}
