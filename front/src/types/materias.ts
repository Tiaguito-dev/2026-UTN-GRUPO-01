export const CARRERAS = ["S", "C", "Q", "I", "M"] as const;
export type Carrera = typeof CARRERAS[number];
export const ANIOS_CARRERA = ["1", "2", "3", "4", "5", "ELECTIVA"] as const;
export type AnioCarrera = typeof ANIOS_CARRERA[number];
export const NIVELES_ELECTIVA = ["3", "4", "5"] as const;
export type NivelElectiva = typeof NIVELES_ELECTIVA[number];
export const MODALIDADES_MATERIA = ["ANUAL", "PRIMERO", "SEGUNDO"] as const;
export type ModalidadMateria = typeof MODALIDADES_MATERIA[number];

export interface MateriaCarrera {
  carrera: Carrera;
  anioCarrera: AnioCarrera;
  nivelElectiva: NivelElectiva | null;
}

export interface Materia {
  id: string;
  nombre: string;
  /** Ausente solo en respuestas antiguas; el backend actual siempre devuelve valor o null. */
  modalidad?: ModalidadMateria | null;
  carreras: MateriaCarrera[];
  createdAt: string;
  deletedAt: string | null;
}

export interface MateriaInput {
  nombre: string;
  modalidad: ModalidadMateria;
  carreras: MateriaCarrera[];
}

export interface MateriaHistorial {
  id: string;
  materiaId: string;
  actor: {
    id: string;
    displayName: string;
  };
  createdAt: string;
  cambios: {
    campo: "nombre" | "anioCarrera" | "nivelElectiva" | "carreras" | "modalidad" | "deletedAt";
    anterior: string | null;
    nuevo: string | null;
  }[];
}
