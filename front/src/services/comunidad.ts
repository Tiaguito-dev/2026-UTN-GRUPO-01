import { getAuthService } from "./auth";
import { normasConvivenciaSchema, parseResponse, sugerenciaRegistradaSchema, sugerenciaAdministrativaSchema, sugerenciasAdministrativasSchema } from "./schemas";
import { requestJson } from "./http";
import type { NormasConvivencia, NormasInput, SugerenciaInput, SugerenciaRegistrada } from "@/types/comunidad";

export function listarSugerencias(input: { page: number; pageSize?: number; soloMeGusta?: boolean }) {
  const query = new URLSearchParams({ page: String(input.page), pageSize: String(input.pageSize ?? 20), soloMeGusta: String(input.soloMeGusta ?? false) });
  return getAuthService().protectedGet(`/comunidad/sugerencias?${query}`, sugerenciasAdministrativasSchema);
}

/** Asignaciones explícitas; nunca repetir automáticamente una escritura incierta. */
export async function asignarMeGustaSugerencia(id: string, meGusta: boolean) {
  await getAuthService().me();
  return parseResponse(sugerenciaAdministrativaSchema, await requestJson(`/comunidad/sugerencias/${encodeURIComponent(id)}/me-gusta`, { method: "PUT", body: { meGusta } }));
}

export async function eliminarSugerencia(id: string): Promise<void> {
  await getAuthService().me();
  await requestJson(`/comunidad/sugerencias/${encodeURIComponent(id)}`, { method: "DELETE" });
}

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
