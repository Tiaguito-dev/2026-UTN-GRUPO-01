import type { ReactNode } from "react";
import { Notice } from "@/components/ui/Notice";

export interface RecursoDeOpciones {
  items: unknown[] | null;
  error: string;
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
  const fallido = recursos.find((recurso) => recurso.error);
  if (fallido) return <Notice tone="error">{fallido.error} <button className="button" type="button" onClick={fallido.retry}>Reintentar</button></Notice>;
  const cargando = recursos.find((recurso) => recurso.items === null);
  if (cargando) return <Notice tone="warning">Cargando {cargando.nombre}…</Notice>;
  const vacio = recursos.find((recurso) => recurso.items?.length === 0);
  if (vacio) return <Notice tone="warning">{vacio.vacio}</Notice>;
  return null;
}
