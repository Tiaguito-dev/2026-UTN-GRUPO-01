type Carrera = "S" | "C" | "Q" | "I" | "M";
type Cuatrimestre = "PRIMERO" | "SEGUNDO" | "ANUAL";
type Cargo = "TITULAR" | "ADJUNTO" | "JTP";

/** Votes of one commission for one professor (or for none), already summed by the database. */
export interface FilaValoracion {
  comisionId: string;
  comisionNombre: string;
  carrera: Carrera;
  activa: boolean;
  materiaId: string;
  materiaNombre: string;
  cursadaId: string;
  anio: number;
  cuatrimestre: Cuatrimestre | null;
  profesorId: string | null;
  profesorNombre: string | null;
  /** Current assignment; null once the professor left the commission. */
  cargo: Cargo | null;
  suma: number;
  cantidad: number;
}

export interface Valoracion { promedio: number | null; cantidad: number }

interface ContextoComision {
  comision: { id: string; nombre: string; carrera: Carrera; activa: boolean };
  materia: { id: string; nombre: string };
  cursada: { id: string; anio: number; cuatrimestre: Cuatrimestre | null };
}

export interface RankingComision extends ContextoComision { posicion: number; valoracion: Valoracion }
export interface ComisionDeProfesor extends ContextoComision { cargo: Cargo | null; valoracion: Valoracion }
export interface RankingProfesor {
  /** null when the professor is below the vote minimum or has no votes (search and detail only). */
  posicion: number | null;
  profesor: { id: string; nombreCompleto: string };
  valoracion: Valoracion;
  comisiones: ComisionDeProfesor[];
}

interface Acumulado { suma: number; cantidad: number; nombre: string; id: string }

const contexto = (fila: FilaValoracion): ContextoComision => ({
  comision: { id: fila.comisionId, nombre: fila.comisionNombre, carrera: fila.carrera, activa: fila.activa },
  materia: { id: fila.materiaId, nombre: fila.materiaNombre },
  cursada: { id: fila.cursadaId, anio: fila.anio, cuatrimestre: fila.cuatrimestre },
});

// Exact mean first, so 4.17 beats 4.0 even if both would round alike; then votes, name and id
// keep the order stable across pages.
function mejorPrimero(a: Acumulado, b: Acumulado): number {
  return b.suma / b.cantidad - a.suma / a.cantidad || b.cantidad - a.cantidad
    || a.nombre.localeCompare(b.nombre, "es") || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}

const valoracion = ({ suma, cantidad }: Acumulado): Valoracion => ({ promedio: cantidad ? Math.round((suma / cantidad) * 10) / 10 : null, cantidad });

function rankear<T extends Acumulado>(grupos: Iterable<T>, minimo: number): T[] {
  return [...grupos].filter(grupo => grupo.cantidad >= minimo).sort(mejorPrimero);
}

export function rankingComisiones(filas: FilaValoracion[], minimo: number): RankingComision[] {
  const grupos = new Map<string, Acumulado & { fila: FilaValoracion }>();
  for (const fila of filas) {
    const grupo = grupos.get(fila.comisionId) ?? { suma: 0, cantidad: 0, nombre: fila.comisionNombre, id: fila.comisionId, fila };
    grupo.suma += fila.suma;
    grupo.cantidad += fila.cantidad;
    grupos.set(fila.comisionId, grupo);
  }
  return rankear(grupos.values(), minimo).map((grupo, index) => ({ posicion: index + 1, ...contexto(grupo.fila), valoracion: valoracion(grupo) }));
}

export function rankingProfesores(filas: FilaValoracion[], minimo: number): RankingProfesor[] {
  const grupos = new Map<string, Acumulado & { comisiones: (Acumulado & { fila: FilaValoracion })[] }>();
  for (const fila of filas) {
    if (!fila.profesorId || !fila.profesorNombre) continue;
    const grupo = grupos.get(fila.profesorId) ?? { suma: 0, cantidad: 0, nombre: fila.profesorNombre, id: fila.profesorId, comisiones: [] };
    // The query already returns one row per commission and professor: each row is one breakdown entry.
    grupo.comisiones.push({ suma: fila.suma, cantidad: fila.cantidad, nombre: fila.comisionNombre, id: fila.comisionId, fila });
    grupo.suma += fila.suma;
    grupo.cantidad += fila.cantidad;
    grupos.set(fila.profesorId, grupo);
  }
  return rankear(grupos.values(), minimo).map((grupo, index) => ({
    posicion: index + 1,
    profesor: { id: grupo.id, nombreCompleto: grupo.nombre },
    valoracion: valoracion(grupo),
    comisiones: rankear(grupo.comisiones, 1).map(comision => ({ ...contexto(comision.fila), cargo: comision.fila.cargo, valoracion: valoracion(comision) })),
  }));
}

/** Accent- and case-insensitive name match, so "perez" finds "Pérez". */
export function coincideNombre(nombre: string, busqueda: string): boolean {
  const normalizar = (texto: string) => texto.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLocaleLowerCase("es");
  return normalizar(nombre).includes(normalizar(busqueda));
}

/**
 * Every active professor: the ranked ones first (with their position), then those below the vote
 * minimum and those without votes, by rating and name. Used by search and by the profile page.
 */
export function todosLosProfesores(filas: FilaValoracion[], minimo: number, profesores: { id: string; nombreCompleto: string }[]): RankingProfesor[] {
  const ranking = rankingProfesores(filas, minimo);
  const vistos = new Set(ranking.map(item => item.profesor.id));
  const debajoDelMinimo = rankingProfesores(filas, 1).filter(item => !vistos.has(item.profesor.id)).map(item => ({ ...item, posicion: null }));
  for (const item of debajoDelMinimo) vistos.add(item.profesor.id);
  const sinVotos = profesores.filter(profesor => !vistos.has(profesor.id))
    .sort((a, b) => a.nombreCompleto.localeCompare(b.nombreCompleto, "es") || (a.id < b.id ? -1 : 1))
    .map(profesor => ({ posicion: null, profesor, valoracion: { promedio: null, cantidad: 0 }, comisiones: [] }));
  return [...ranking, ...debajoDelMinimo, ...sinVotos];
}
