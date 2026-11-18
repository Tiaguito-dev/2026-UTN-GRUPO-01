import { getAuthService } from "./auth";
import { normasConvivenciaSchema } from "./schemas";
import type { NormasConvivencia } from "@/types/comunidad";

/** Lectura autenticada del documento persistido, compartida por estudiantes y administración. */
export function obtenerNormas(): Promise<NormasConvivencia> {
  return getAuthService().protectedGet("/comunidad/normas", normasConvivenciaSchema);
}
