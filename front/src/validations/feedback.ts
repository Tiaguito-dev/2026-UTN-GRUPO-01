import type { FeedbackContexto, FeedbackEdicion } from "@/types/feedback";

export const MAX_TEXTO_FEEDBACK = 3000;

/** Only academic navigation context is carried through the publication form. */
export function feedbackOriginParams(params: { get(name: string): string | null }): URLSearchParams {
  const query = new URLSearchParams();
  for (const key of ["carrera", "anioCarrera", "listadoPage", "q", "nivelElectiva", "cursadaId", "comisionesPage", "page"]) {
    const value = params.get(key);
    if (value) query.set(key, value);
  }
  return query;
}

export function validarTextoFeedback(texto: string): string {
  for (const character of texto) {
    const code = character.codePointAt(0)!;
    if ((code < 32 && code !== 9 && code !== 10 && code !== 13) || (code >= 127 && code <= 159)) {
      return "El comentario contiene caracteres no permitidos. Revisá el texto.";
    }
  }
  const clean = texto.trim();
  if (!clean) return "Escribí tu experiencia antes de publicar.";
  if ([...clean].length > MAX_TEXTO_FEEDBACK) return `El comentario admite hasta ${MAX_TEXTO_FEEDBACK} caracteres.`;
  return "";
}

export function diferenciasFeedback(original: { texto: string; anonimo: boolean }, edited: { texto: string; anonimo: boolean }): FeedbackEdicion {
  const changes: FeedbackEdicion = {};
  if (original.texto !== edited.texto.trim()) changes.texto = edited.texto.trim();
  if (original.anonimo !== edited.anonimo) changes.anonimo = edited.anonimo;
  return changes;
}

export function feedbackComisionHref(contexto: FeedbackContexto): string {
  return `/home/materias/${encodeURIComponent(contexto.materiaId)}/cursadas/${encodeURIComponent(contexto.cursadaId)}/comisiones/${encodeURIComponent(contexto.comisionId)}`;
}

export function feedbackDetalleHref(id: string): string { return `/home/feedback/${encodeURIComponent(id)}`; }

export function feedbackSuccessHref(href: string, message: string): string {
  return `${href}${href.includes("?") ? "&" : "?"}${new URLSearchParams({ successMessage: message })}`;
}
