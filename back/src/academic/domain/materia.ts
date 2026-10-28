export type AnioCarrera = "1" | "2" | "3" | "4" | "5" | "ELECTIVA";
export type NivelElectiva = "3" | "4" | "5";
export type ModalidadMateria = "ANUAL" | "PRIMERO" | "SEGUNDO";
/** Orden del enum de Prisma: es también el orden de serialización del historial. */
export const CARRERAS = ["S", "C", "Q", "I", "M"] as const;
export type Carrera = (typeof CARRERAS)[number];

export interface MateriaCarrera {
  carrera: Carrera;
  anioCarrera: AnioCarrera;
  nivelElectiva: NivelElectiva | null;
}

export interface Materia {
  id: string;
  nombre: string;
  modalidad: ModalidadMateria | null;
  /** Ordenadas por el enum (S, C, Q, I, M). */
  carreras: MateriaCarrera[];
  createdAt: Date;
  deletedAt: Date | null;
}

export interface MateriaCambio {
  campo: "nombre" | "modalidad" | "anioCarrera" | "nivelElectiva" | "carreras";
  anterior: string | null;
  nuevo: string | null;
}

export interface MateriaHistorial {
  id: string;
  materiaId: string;
  actor: {
    id: string;
    displayName: string;
  };
  createdAt: Date;
  cambios: MateriaCambio[];
}

/** Valor del historial para `campo: "carreras"`, por ejemplo `S:2,Q:ELECTIVA:4`. */
export function serializarCarreras(filas: MateriaCarrera[]): string {
  return [...filas].sort((a, b) => CARRERAS.indexOf(a.carrera) - CARRERAS.indexOf(b.carrera))
    .map((fila) => [fila.carrera, fila.anioCarrera, fila.nivelElectiva].filter(Boolean).join(":")).join(",");
}
