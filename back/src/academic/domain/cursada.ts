import type { Carrera } from "./materia.js";

export type Cuatrimestre = "PRIMERO" | "SEGUNDO" | "ANUAL";

export interface Cursada {
  id: string;
  materiaId: string;
  anio: number;
  cuatrimestre: Cuatrimestre | null;
  createdAt: Date;
  deletedAt: Date | null;
}

export interface CursadaResumen {
  id: string;
  anio: number;
  cuatrimestre: Cuatrimestre | null;
  comisiones: number;
  profesores: number;
  carreras: Carrera[];
}
