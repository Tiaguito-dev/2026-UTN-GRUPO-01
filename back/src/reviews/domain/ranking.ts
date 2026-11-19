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

/** Imaginary votes at the overall mean that every group starts with (Bayesian average). */
export const VOTOS_PREVIOS = 5;

/**
 * Bayesian average: few votes stay close to the overall mean, many votes weigh their own mean.
 * A new group with three 5s does not beat one with forty votes averaging 4.6.
 */
export function puntajeBayesiano({ suma, cantidad }: { suma: number; cantidad: number }, media: number, previos = VOTOS_PREVIOS): number {
  return (suma + previos * media) / (cantidad + previos);
}

const mediaGeneral = (grupos: Acumulado[]): number => {
  const total = grupos.reduce((acc, grupo) => ({ suma: acc.suma + grupo.suma, cantidad: acc.cantidad + grupo.cantidad }), { suma: 0, cantidad: 0 });
  return total.cantidad ? total.suma / total.cantidad : 0;
};

const contexto = (fila: FilaValoracion): ContextoComision => ({
  comision: { id: fila.comisionId, nombre: fila.comisionNombre, carrera: fila.carrera, activa: fila.activa },
  materia: { id: fila.materiaId, nombre: fila.materiaNombre },
  cursada: { id: fila.cursadaId, anio: fila.anio, cuatrimestre: fila.cuatrimestre },
});

const valoracion = ({ suma, cantidad }: Acumulado): Valoracion => ({ promedio: cantidad ? Math.round((suma / cantidad) * 10) / 10 : null, cantidad });

// Bayesian score first, then votes, name and id, so the order is stable across pages. The mean is
// taken over the groups being ranked, before the vote minimum, so filtering never shifts it.
function rankear<T extends Acumulado>(grupos: Iterable<T>, minimo: number): T[] {
  const todos = [...grupos];
  const media = mediaGeneral(todos);
  const puntaje = new Map(todos.map(grupo => [grupo, puntajeBayesiano(grupo, media)]));
  return todos.filter(grupo => grupo.cantidad >= minimo).sort((a, b) => puntaje.get(b)! - puntaje.get(a)! || b.cantidad - a.cantidad
    || a.nombre.localeCompare(b.nombre, "es") || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/** One row per commission of one cursada: the per-cursada view behind "Mejor valorada". */
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

export interface CursadaDeComision { id: string; anio: number; cuatrimestre: Cuatrimestre | null; comisionId: string; activa: boolean }
export interface RankingComisionHistorica {
  posicion: number;
  comision: { nombre: string; carrera: Carrera };
  materia: { id: string; nombre: string };
  /** Cursadas with votes, most recent first; the first one is where the row links. */
  cursadas: CursadaDeComision[];
  anios: { desde: number; hasta: number };
  valoracion: Valoracion;
}

const ORDEN_PERIODO: Record<Cuatrimestre, number> = { PRIMERO: 1, SEGUNDO: 2, ANUAL: 3 };
const masReciente = (a: CursadaDeComision, b: CursadaDeComision) =>
  b.anio - a.anio || (b.cuatrimestre ? ORDEN_PERIODO[b.cuatrimestre] : 0) - (a.cuatrimestre ? ORDEN_PERIODO[a.cuatrimestre] : 0);

/** The same commission (subject + career + number) across every year, as one row. */
export function rankingComisionesHistorico(filas: FilaValoracion[], minimo: number): RankingComisionHistorica[] {
  const grupos = new Map<string, Acumulado & { fila: FilaValoracion; cursadas: Map<string, CursadaDeComision> }>();
  for (const fila of filas) {
    const clave = `${fila.materiaId}|${fila.comisionNombre}`;
    const grupo = grupos.get(clave) ?? { suma: 0, cantidad: 0, nombre: `${fila.comisionNombre} ${fila.materiaNombre}`, id: clave, fila, cursadas: new Map() };
    grupo.suma += fila.suma;
    grupo.cantidad += fila.cantidad;
    grupo.cursadas.set(fila.cursadaId, { id: fila.cursadaId, anio: fila.anio, cuatrimestre: fila.cuatrimestre, comisionId: fila.comisionId, activa: fila.activa });
    grupos.set(clave, grupo);
  }
  return rankear(grupos.values(), minimo).map((grupo, index) => {
    const cursadas = [...grupo.cursadas.values()].sort(masReciente);
    const anios = cursadas.map(cursada => cursada.anio);
    return {
      posicion: index + 1,
      comision: { nombre: grupo.fila.comisionNombre, carrera: grupo.fila.carrera },
      materia: { id: grupo.fila.materiaId, nombre: grupo.fila.materiaNombre },
      cursadas,
      anios: { desde: Math.min(...anios), hasta: Math.max(...anios) },
      valoracion: valoracion(grupo),
    };
  });
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
