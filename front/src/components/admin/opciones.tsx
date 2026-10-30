import type { ReactNode } from "react";
import { Notice } from "@/components/ui/Notice";
import type { AsyncState } from "@/hooks/usePaginatedFetch";

export interface RecursoDeOpciones {
  state: AsyncState<unknown[]>;
  retry: () => void;
  /** Qué se está trayendo, en plural y minúscula: "materias", "cursadas". */
  nombre: string;
  /** Qué hacer cuando el listado vino vacío (normalmente, crear primero esa entidad). */
  vacio: ReactNode;
}

/**
 * Traduce el estado de los listados que pueblan los selects al aviso que `AltaForm` muestra en
 * `blocked`. Mientras devuelva algo, el alta no se puede enviar: sin opciones cargadas no hay
 * forma de elegir una válida.
 */
export function bloqueoDeOpciones(recursos: RecursoDeOpciones[]): ReactNode {
  const fallido = recursos.find((recurso) => recurso.state.status === "error");
  if (fallido?.state.status === "error") return <Notice tone="error">{fallido.state.error} <button className="button" type="button" onClick={fallido.retry}>Reintentar</button></Notice>;
  const cargando = recursos.find((recurso) => recurso.state.status === "loading");
  if (cargando) return <Notice tone="warning">Cargando {cargando.nombre}…</Notice>;
  const vacio = recursos.find((recurso) => recurso.state.status === "ready" && recurso.state.data.length === 0);
  if (vacio) return <Notice tone="warning">{vacio.vacio}</Notice>;
  return null;
}

/** The options of a loaded list, or none while it loads or after it fails. */
export function opcionesListas<T>(state: AsyncState<T[]>): T[] {
  return state.status === "ready" ? state.data : [];
}
