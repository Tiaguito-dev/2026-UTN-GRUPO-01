/** Documento vigente de la comunidad; consultarlo no registra una aceptación. */
export interface NormasConvivencia {
  id: string;
  titulo: string;
  introduccion: string;
  normas: string[];
  cierre: string;
  createdAt: string;
  updatedAt: string;
}

export type NormasInput = Pick<NormasConvivencia, "titulo" | "introduccion" | "normas" | "cierre">;

export const CATEGORIAS_SUGERENCIA = ["MEJORA_PLATAFORMA", "NUEVA_FUNCIONALIDAD", "REPORTAR_ERROR", "CORRECCION_ACADEMICA", "OTROS"] as const;
export type CategoriaSugerencia = typeof CATEGORIAS_SUGERENCIA[number];

export interface SugerenciaInput {
  solicitudId: string;
  categoria: CategoriaSugerencia;
  contenido: string;
}

/** El alta confirma persistencia sin devolver ni publicar el contenido o su autor. */
export interface SugerenciaRegistrada {
  id: string;
  createdAt: string;
}

/** Exclusiva de ADMIN; el alta USER mantiene su recibo mínimo. */
export interface SugerenciaAdministrativa extends SugerenciaRegistrada {
  categoria: CategoriaSugerencia;
  contenido: string;
  meGusta: boolean;
  autor: { displayName: string };
}
