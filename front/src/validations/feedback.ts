import type { FeedbackContexto, FeedbackEdicion } from "@/types/feedback";
import { isAnioCarrera, isCarrera, materiaDetailHref, materiaListHref, parseMateriaContext, parseMateriaPage } from "./materias";
import type { Carrera } from "@/types/materias";

type NavigationParams = { get(name: string): string | null };

export const MAX_TEXTO_FEEDBACK = 3000;
export function experienciasFilters(params: NavigationParams) {
  const career = params.get("carrera");
  const subject = params.get("materiaId");
  return { carrera: isCarrera(career) ? career : undefined, materiaId: subject && /^[\w-]{1,100}$/.test(subject) ? subject : undefined };
}
export function experienciasHref(carrera?: Carrera, materiaId?: string, page = 1) {
  const query = new URLSearchParams();
  if (carrera) query.set("carrera", carrera);
  if (materiaId) query.set("materiaId", materiaId);
  if (page > 1) query.set("page", String(page));
  return `/home/experiencias${query.size ? `?${query}` : ""}`;
}
export function experienciasOrigin(params: NavigationParams) {
  const filters = experienciasFilters(params);
  const origin = new URLSearchParams({ origen: "experiencias" });
  if (filters.carrera) origin.set("experienciasCarrera", filters.carrera);
  if (filters.materiaId) origin.set("experienciasMateriaId", filters.materiaId);
  const page = parseMateriaPage(params.get("page"));
  if (page > 1) origin.set("experienciasPage", String(page));
  return origin;
}
export function experienciasBack(params: NavigationParams) {
  if (params.get("origen") !== "experiencias") return undefined;
  const filters = experienciasFilters(new URLSearchParams({ carrera: params.get("experienciasCarrera") ?? "", materiaId: params.get("experienciasMateriaId") ?? "" }));
  return { href: experienciasHref(filters.carrera, filters.materiaId, parseMateriaPage(params.get("experienciasPage"))), label: "Experiencias" };
}

/** Only academic navigation context is carried through the publication form. */
export function feedbackOriginParams(params: { get(name: string): string | null }): URLSearchParams {
  const query = new URLSearchParams();
  for (const key of ["carrera", "anioCarrera", "listadoPage", "q", "nivelElectiva", "cursadaId", "comisionesPage", "page"]) {
    const value = params.get(key);
    if (value) query.set(key, value);
  }
  if (params.get("origen") === "experiencias") {
    query.set("origen", "experiencias");
    const career = params.get("experienciasCarrera");
    const subject = params.get("experienciasMateriaId");
    if (isCarrera(career)) query.set("experienciasCarrera", career);
    if (subject && /^[\w-]{1,100}$/.test(subject)) query.set("experienciasMateriaId", subject);
    const page = parseMateriaPage(params.get("experienciasPage"));
    if (page > 1) query.set("experienciasPage", String(page));
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

function withOrigin(href: string, params?: NavigationParams): string {
  const origin = params ? feedbackOriginParams(params) : new URLSearchParams();
  return `${href}${origin.size ? `?${origin}` : ""}`;
}

export function feedbackDetalleHref(id: string, params?: NavigationParams): string {
  return withOrigin(`/home/feedback/${encodeURIComponent(id)}`, params);
}

export function feedbackEdicionHref(id: string, params: NavigationParams): string {
  return withOrigin(`/home/feedback/${encodeURIComponent(id)}/editar`, params);
}

/** Academic breadcrumbs use real entities, with the same catalog filters as their return links. */
export function feedbackNavigation(contexto: FeedbackContexto | null | undefined, params: NavigationParams) {
  const context = parseMateriaContext(params);
  const rawYear = params.get("anioCarrera");
  const year = isAnioCarrera(rawYear) ? rawYear : undefined;
  const listPage = parseMateriaPage(params.get("listadoPage"));
  const materiasHref = materiaListHref(context.carrera, year, listPage, context);
  const items = [{ label: "Materias", href: materiasHref }];
  let commissionHref = materiasHref;
  let materiaHref: string | undefined;
  if (contexto) {
    const base = materiaDetailHref(contexto.materiaId, context.carrera, year, listPage, context);
    const query = new URLSearchParams(base.split("?")[1]);
    for (const [key, value] of feedbackOriginParams(params)) {
      if (key === "origen" || key.startsWith("experiencias")) query.set(key, value);
    }
    query.set("cursadaId", contexto.cursadaId);
    const commissionsPage = parseMateriaPage(params.get("comisionesPage"));
    if (commissionsPage > 1) query.set("comisionesPage", String(commissionsPage));
    materiaHref = `${base.split("?")[0]}?${query}`;
    items.push({ label: contexto.materiaNombre, href: materiaHref });
    commissionHref = withOrigin(feedbackComisionHref(contexto), params);
    items.push({ label: `Comisión ${contexto.nombre}`, href: commissionHref });
  }
  const back = experienciasBack(params) ?? { href: commissionHref, label: contexto ? "Comisión" : "Materias" };
  return { items, commissionHref, materiaHref, back };
}

export function feedbackSuccessHref(href: string, message: string): string {
  return `${href}${href.includes("?") ? "&" : "?"}${new URLSearchParams({ successMessage: message })}`;
}
