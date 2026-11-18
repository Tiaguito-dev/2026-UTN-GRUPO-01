import type { CategoriaSugerencia, SugerenciaRegistrada } from "../../domain/sugerencia.js";

export const SUGERENCIAS_REPOSITORY = Symbol("SUGERENCIAS_REPOSITORY");

export interface RegistrarSugerenciaInput {
  solicitudId: string;
  categoria: CategoriaSugerencia;
  contenido: string;
}

/** Registro privado idempotente; HU-C02 no incorpora consultas ni administración. */
export interface SugerenciasRepository {
  registrar(input: RegistrarSugerenciaInput, usuarioId: string): Promise<SugerenciaRegistrada>;
}
