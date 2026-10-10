export type Cuatrimestre = "PRIMERO" | "SEGUNDO";

export interface Cursada {
  id: string;
  materiaId: string;
  profesorId: string;
  anio: number;
  cuatrimestre: Cuatrimestre;
  createdAt: Date;
  deletedAt: Date | null;
}
