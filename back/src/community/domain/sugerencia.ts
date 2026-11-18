export const CATEGORIAS_SUGERENCIA = [
  "MEJORA_PLATAFORMA", "NUEVA_FUNCIONALIDAD", "REPORTAR_ERROR", "CORRECCION_ACADEMICA", "OTROS",
] as const;

export type CategoriaSugerencia = typeof CATEGORIAS_SUGERENCIA[number];

/** Registro privado interno. La respuesta de envío no expone contenido ni autor. */
export interface Sugerencia {
  id: string;
  usuarioId: string;
  categoria: CategoriaSugerencia;
  contenido: string;
  solicitudId: string;
  createdAt: Date;
}

export type SugerenciaRegistrada = Pick<Sugerencia, "id" | "createdAt">;
