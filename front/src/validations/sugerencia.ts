import { CATEGORIAS_SUGERENCIA, type CategoriaSugerencia } from "@/types/comunidad";

export const MAX_CONTENIDO_SUGERENCIA = 5000;

export function esCategoriaSugerencia(value: string): value is CategoriaSugerencia {
  return CATEGORIAS_SUGERENCIA.some(categoria => categoria === value);
}

export function validarSugerencia(input: { categoria: string; contenido: string }): { categoria?: string; contenido?: string } {
  const contenido = input.contenido.trim();
  return {
    ...(!esCategoriaSugerencia(input.categoria) ? { categoria: "Elegí una categoría válida." } : {}),
    ...(!contenido ? { contenido: "Escribí tu sugerencia." }
      : contenido.length > MAX_CONTENIDO_SUGERENCIA ? { contenido: `La sugerencia no puede superar los ${MAX_CONTENIDO_SUGERENCIA} caracteres.` } : {}),
  };
}
