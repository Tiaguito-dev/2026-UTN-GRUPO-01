import type { Cuatrimestre } from "@/services/academic";

export const CUATRIMESTRE_LABEL: Record<Cuatrimestre, string> = { PRIMERO: "1er cuatrimestre", SEGUNDO: "2do cuatrimestre" };

export function periodoLabel(anio: number, cuatrimestre: Cuatrimestre): string {
  return `${CUATRIMESTRE_LABEL[cuatrimestre]} ${anio}`;
}
