export type AnioCarrera = "1" | "2" | "3" | "4" | "5" | "ELECTIVA";
export type NivelElectiva = "3" | "4" | "5";

export interface Materia {
  id: string;
  nombre: string;
  anioCarrera: AnioCarrera | null;
  nivelElectiva: NivelElectiva | null;
  createdAt: Date;
  deletedAt: Date | null;
}

export interface MateriaCambio {
  campo: "nombre" | "anioCarrera" | "nivelElectiva";
  anterior: string | null;
  nuevo: string | null;
}

export interface MateriaHistorial {
  id: string;
  materiaId: string;
  actorId: string;
  createdAt: Date;
  cambios: MateriaCambio[];
}
