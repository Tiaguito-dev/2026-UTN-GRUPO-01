import type { NormasInput } from "@/types/comunidad";

export const MAX_TITULO_NORMAS = 160;

export function normalizarNormas(input: NormasInput): NormasInput {
  return { titulo: input.titulo.trim(), introduccion: input.introduccion.trim(), normas: input.normas.map(norma => norma.trim()), cierre: input.cierre.trim() };
}

export function validarNormas(input: NormasInput): { titulo?: string; introduccion?: string; normas: string[]; cierre?: string } {
  const value = normalizarNormas(input);
  return {
    ...(value.titulo ? value.titulo.length > MAX_TITULO_NORMAS ? { titulo: `El título no puede superar los ${MAX_TITULO_NORMAS} caracteres.` } : {} : { titulo: "Ingresá un título." }),
    ...(!value.introduccion ? { introduccion: "Ingresá el mensaje introductorio." } : {}),
    normas: value.normas.length ? value.normas.map(norma => norma ? "" : "Ingresá el texto de la norma.") : ["Agregá al menos una norma."],
    ...(!value.cierre ? { cierre: "Ingresá el mensaje de cierre." } : {}),
  };
}
