import type { NormasConvivencia } from "../../domain/normas-convivencia.js";

export const NORMAS_REPOSITORY = Symbol("NORMAS_REPOSITORY");

export interface ActualizarNormasInput {
  titulo: string;
  introduccion: string;
  normas: string[];
  cierre: string;
}

/** La consulta no escribe; la actualización conserva el singleton sin crearlo. */
export interface NormasRepository {
  obtenerVigentes(): Promise<NormasConvivencia | null>;
  actualizarVigentes(input: ActualizarNormasInput, actorId: string): Promise<NormasConvivencia>;
}
