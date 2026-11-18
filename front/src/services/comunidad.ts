import { getAuthService } from "./auth";
import { normasConvivenciaSchema, parseResponse, sugerenciaRegistradaSchema } from "./schemas";
import { requestJson } from "./http";
import type { NormasConvivencia, NormasInput, SugerenciaInput, SugerenciaRegistrada } from "@/types/comunidad";

/** Lectura autenticada del documento persistido, compartida por estudiantes y administración. */
export function obtenerNormas(): Promise<NormasConvivencia> {
  return getAuthService().protectedGet("/comunidad/normas", normasConvivenciaSchema);
}

/** Comprueba la sesión antes del PUT; una escritura fallida no se repite automáticamente. */
export async function actualizarNormas(input: NormasInput): Promise<NormasConvivencia> {
  await getAuthService().me();
  return parseResponse(normasConvivenciaSchema, await requestJson("/comunidad/normas", { method: "PUT", body: input }));
}

/** Alta privada idempotente: el componente conserva la misma solicitud al reintentar. */
export function registrarSugerencia(input: SugerenciaInput): Promise<SugerenciaRegistrada> {
  return getAuthService().protectedPost("/comunidad/sugerencias", input, sugerenciaRegistradaSchema);
}
