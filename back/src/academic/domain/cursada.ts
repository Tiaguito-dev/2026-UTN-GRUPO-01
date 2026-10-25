import type { Carrera } from "./materia.js";

export type Cuatrimestre = "PRIMERO" | "SEGUNDO";

export interface Cursada {
  id: string;
  materiaId: string;
  anio: number;
  cuatrimestre: Cuatrimestre;
  createdAt: Date;
  deletedAt: Date | null;
}

export interface CursadaResumen {
  id: string;
  anio: number;
  cuatrimestre: Cuatrimestre;
  comisiones: number;
  profesores: number;
  carreras: Carrera[];
}
