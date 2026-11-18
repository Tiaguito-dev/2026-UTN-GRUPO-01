import type { NormasConvivencia } from "../../domain/normas-convivencia.js";

export const NORMAS_REPOSITORY = Symbol("NORMAS_REPOSITORY");

/** Solo lectura en HU-C01: consultar nunca crea ni reemplaza el documento. */
export interface NormasRepository {
  obtenerVigentes(): Promise<NormasConvivencia | null>;
}
