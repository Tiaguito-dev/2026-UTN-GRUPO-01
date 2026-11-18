"use client";

import { useEffect, useId, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Heart, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Dialog } from "@/components/ui/Dialog";
import { FilterChips } from "@/components/ui/FilterChips";
import { Notice } from "@/components/ui/Notice";
import { PaginatedListView } from "@/components/ui/PaginatedListView";
import { useUrlPagination } from "@/hooks/useUrlPagination";
import { asignarMeGustaSugerencia, eliminarSugerencia, listarSugerencias } from "@/services/comunidad";
import type { SugerenciaAdministrativa } from "@/types/comunidad";
import { CATEGORIA_SUGERENCIA_LABEL } from "@/lib/format/sugerencia";
import styles from "./SugerenciasAdmin.module.css";

export function SugerenciasAdmin() {
  const headingId = useId(); const heading = useRef<HTMLHeadingElement>(null);
  const params = useSearchParams(); const pathname = usePathname(); const router = useRouter();
  const { page, setPage } = useUrlPagination();
  const soloMeGusta = params.get("soloMeGusta") === "true";
  const [refresh, setRefresh] = useState(0);
  const [selected, setSelected] = useState<SugerenciaAdministrativa | null>(null);
  const [busy, setBusy] = useState(false); const inFlight = useRef(false);
  const [error, setError] = useState(""); const [message, setMessage] = useState("");
  const generation = useRef(0);
  // Una respuesta vieja no debe corregir la URL de un filtro/página más reciente.
  useEffect(() => () => { generation.current += 1; }, [page, soloMeGusta, refresh]);
  useEffect(() => { if (message) heading.current?.focus(); }, [message]);

  function filter(value: string) {
    const query = new URLSearchParams(params.toString()); query.delete("page");
    if (value === "likes") query.set("soloMeGusta", "true"); else query.delete("soloMeGusta");
    const search = query.toString(); router.replace(search ? `${pathname}?${search}` : pathname, { scroll: false });
  }
  async function mutate(item: SugerenciaAdministrativa, deleting: boolean) {
    if (inFlight.current) return;
    inFlight.current = true; setBusy(true); setError(""); setMessage("");
    try {
      if (deleting) await eliminarSugerencia(item.id);
      else await asignarMeGustaSugerencia(item.id, !item.meGusta);
      setSelected(null);
      setMessage(deleting ? "La sugerencia se eliminó correctamente." : "Se actualizó Me gusta.");
      setRefresh(value => value + 1);
    } catch {
      setError(deleting ? "No pudimos eliminar la sugerencia. Intentá nuevamente." : "No pudimos actualizar Me gusta. Intentá nuevamente.");
    } finally { inFlight.current = false; setBusy(false); }
  }

  return <Card as="section" variant="panel" aria-labelledby={headingId}><div className={styles.inbox}>
    <h2 id={headingId} ref={heading} tabIndex={-1}>Sugerencias recibidas</h2>
    <p className={styles.description}>El corazón indica un interés compartido entre los administradores en futuras mejoras.</p>
    <fieldset disabled={busy} className={styles.filters}>
      <legend className="sr-only">Opciones de la bandeja</legend>
      <FilterChips label="Filtrar sugerencias" labelHidden value={soloMeGusta ? "likes" : "all"} options={[{ value: "all", label: "Todas" }, { value: "likes", label: "Me gusta" }]} onChange={filter} />
    </fieldset>
    {message ? <Notice tone="success">{message}</Notice> : null}
    {error && !selected ? <Notice tone="error">{error}</Notice> : null}
    <PaginatedListView<SugerenciaAdministrativa> page={page} onPageChange={setPage}
      resetKey={`sugerencias:${soloMeGusta}`} refreshKey={refresh}
      fetchPage={async next => {
        const request = ++generation.current;
        const result = await listarSugerencias({ page: next, pageSize: 20, soloMeGusta });
        const last = Math.max(1, Math.ceil(result.total / result.pageSize));
        if (generation.current === request && next > last) setPage(last);
        return result;
      }}
      loadingMessage="Cargando sugerencias…" errorMessage="No pudimos cargar las sugerencias."
      empty={<p>{soloMeGusta ? "No hay sugerencias marcadas con Me gusta." : "Todavía no hay sugerencias para mostrar."}</p>}>
      {result => <div className={styles.list}>{result.items.map(item => <Card as="article" variant="panel" key={item.id} aria-label={`Sugerencia de ${item.autor.displayName}`}>
        <div className={styles.metadata}><strong>{item.autor.displayName}</strong><span>{CATEGORIA_SUGERENCIA_LABEL[item.categoria]}</span>
          <time dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleDateString("es-AR", { year: "numeric", month: "long", day: "numeric", timeZone: "America/Argentina/Buenos_Aires" })}</time>
        </div>
        <p className={styles.content}>{item.contenido}</p>
        <div className={styles.actions}>
          <button type="button" className={`button button-secondary ${styles.action}`} aria-label="Me gusta" aria-pressed={item.meGusta} disabled={busy}
            onClick={() => void mutate(item, false)}><Heart size={20} aria-hidden="true" fill={item.meGusta ? "currentColor" : "none"} /><span>Me gusta</span></button>
          <button type="button" className={`button button-secondary ${styles.action}`} aria-label="Eliminar sugerencia" disabled={busy}
            onClick={() => { setError(""); setSelected(item); }}><Trash2 size={20} aria-hidden="true" /><span>Eliminar</span></button>
        </div>
      </Card>)}</div>}
    </PaginatedListView>
    {selected ? <Dialog open title="Eliminar sugerencia" busy={busy} onClose={() => { setSelected(null); setError(""); }}>
      <p>¿Querés eliminar la sugerencia de {selected.autor.displayName}? Dejará de aparecer en la bandeja.</p>
      {error ? <Notice tone="error">{error}</Notice> : null}
      <div className="dialog-actions">
        <button type="button" className="button button-secondary" data-autofocus disabled={busy} onClick={() => { setSelected(null); setError(""); }}>Cancelar</button>
        <button type="button" className="button" disabled={busy} onClick={() => void mutate(selected, true)}>{busy ? "Eliminando…" : "Confirmar eliminación"}</button>
      </div>
    </Dialog> : null}
  </div></Card>;
}
