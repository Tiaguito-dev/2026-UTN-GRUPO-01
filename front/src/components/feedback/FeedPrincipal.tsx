"use client";
import { useEffect, useId, useRef, useState } from "react";
import { Plus, RefreshCw } from "lucide-react";
import { Dialog } from "@/components/ui/Dialog";
import { SeleccionComisionComentario } from "./SeleccionComisionComentario";
import { Notice } from "@/components/ui/Notice";
import { FeedbackInteracciones } from "./FeedbackInteracciones";
import { ExperienceCard } from "./ExperienceCard";
import { useFeedComentarios } from "./useFeedComentarios";
import { HideFeedExperienceAction } from "./HideFeedExperienceAction";
import styles from "./FeedPrincipal.module.css";
export function FeedPrincipal() {
  const heading = useId();
  const [selecting, setSelecting] = useState(false);
  const [reportNotice, setReportNotice] = useState(false);
  const [hideNotice, setHideNotice] = useState("");
  const [actionError, setActionError] = useState("");
  const feed = useFeedComentarios();
  const sentinel = useRef<HTMLDivElement>(null);
  const { loadAutomatically } = feed;
  useEffect(() => {
    const target = sentinel.current;
    if (!target || typeof IntersectionObserver === "undefined") return;
    let inside = false;
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (entry.isIntersecting && !inside) loadAutomatically();
        inside = entry.isIntersecting;
      }
    });
    observer.observe(target);
    return () => observer.disconnect();
  }, [loadAutomatically]);
  return <section className={styles.feed} aria-labelledby={heading}>
    <header className={styles.header}>
      <div className={styles.heading}><h2 id={heading}>Comentarios de la comunidad</h2><p>Experiencias de estudiantes sobre materias, comisiones y docentes.</p></div>
      <div className={styles.headerActions}>
        <button className="button button-secondary" type="button" aria-label="Actualizar feed" onClick={feed.refresh}><RefreshCw size={17} aria-hidden="true" />Actualizar</button>
        <button className="button" type="button" onClick={() => setSelecting(true)}><Plus size={17} aria-hidden="true" />Agregar comentario</button>
      </div>
    </header>
    {reportNotice ? <Notice tone="success">El reporte se envió correctamente. La revisión administrativa se activa con reportes abiertos de dos personas distintas.</Notice> : null}
    {hideNotice ? <Notice tone="success">{hideNotice}</Notice> : null}
    {actionError ? <Notice tone="error">{actionError}</Notice> : null}
    <ul className={styles.list} aria-busy={feed.loading}>{feed.items.map(item => <li key={item.id}>
      <FeedbackInteracciones feedback={item} renderCard={actions => <ExperienceCard feedback={item} variant="inicio" footer={actions}
        secondaryActions={item.propio && (!item.estadoModeracion || item.estadoModeracion === "APROBADO") && !item.ocultoAutor && !item.ocultoAdministracion && !item.ocultoReportes ? <HideFeedExperienceAction feedbackId={item.id}
          onHidden={() => { setActionError(""); setHideNotice("La experiencia se ocultó correctamente. Sigue disponible en Mis experiencias."); feed.refresh(); }}
          onRefresh={message => { setHideNotice(""); setActionError(message); feed.refresh(); }} /> : undefined}
        onReported={() => { setReportNotice(true); feed.refresh(); }} showContext showTime readOnly />} />
    </li>)}</ul>
    {feed.loading ? <p role="status">{feed.items.length ? "Cargando más comentarios…" : "Cargando comentarios…"}</p> : null}
    {feed.error ? <Notice tone="error">{feed.error} <button className="button button-secondary" type="button" onClick={() => void feed.loadMore()}>Reintentar</button></Notice> : null}
    {!feed.loading && !feed.error && feed.loaded && feed.items.length === 0 ? <p role="status">Todavía no hay comentarios.</p> : null}
    {!feed.loading && !feed.error && feed.items.length > 0 && !feed.hasMore ? <p role="status">Llegaste al final de los comentarios.</p> : null}
    {feed.loaded && feed.hasMore && !feed.error ? <button className="button button-secondary" type="button" disabled={feed.loading} onClick={() => void feed.loadMore()}>{feed.loading ? "Cargando…" : "Cargar más"}</button> : null}
    {selecting ? <Dialog open title="Agregar comentario" onClose={() => setSelecting(false)}><SeleccionComisionComentario onCancel={() => setSelecting(false)} /></Dialog> : null}
    <div ref={sentinel} className={styles.sentinel} aria-hidden="true" />
  </section>;
}
