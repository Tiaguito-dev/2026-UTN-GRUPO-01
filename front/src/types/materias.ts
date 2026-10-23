export const ANIOS_CARRERA = ["1", "2", "3", "4", "5", "ELECTIVA"] as const;
export type AnioCarrera = typeof ANIOS_CARRERA[number];
export const NIVELES_ELECTIVA = ["3", "4", "5"] as const;
export type NivelElectiva = typeof NIVELES_ELECTIVA[number];
export interface Materia { id: string; nombre: string; anioCarrera: AnioCarrera | null; nivelElectiva: NivelElectiva | null; createdAt: string; deletedAt: string | null }
export interface MateriaInput { nombre: string; anioCarrera: AnioCarrera; nivelElectiva?: NivelElectiva | null }
export interface MateriaHistorial { id: string; materiaId: string; actorId: string; createdAt: string; cambios: { campo: "nombre" | "anioCarrera" | "nivelElectiva"; anterior: string | null; nuevo: string | null }[] }
