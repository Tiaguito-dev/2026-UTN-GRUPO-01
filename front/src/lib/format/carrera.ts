import type { Carrera } from "@/types/materias";

export const CARRERA_LABEL: Record<Carrera, string> = {
  S: "Ingeniería en Sistemas de Información",
  C: "Ingeniería Civil",
  Q: "Ingeniería Química",
  I: "Ingeniería Industrial",
  M: "Ingeniería Mecánica",
};

export const CARRERA_SHORT_LABEL: Record<Carrera, string> = {
  S: "Sistemas", C: "Civil", Q: "Química", I: "Industrial", M: "Mecánica",
};

export function carreraLabel(carrera: Carrera | null | undefined): string {
  return carrera ? CARRERA_LABEL[carrera] : "Sin carrera asignada";
}

export function carreraShortLabel(carrera: Carrera): string {
  return CARRERA_SHORT_LABEL[carrera];
}
