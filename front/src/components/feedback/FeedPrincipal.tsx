"use client";
import { useEffect, useId, useRef } from "react";
import { Notice } from "@/components/ui/Notice";
import { ExperienceCard } from "./ExperienceCard";
import { useFeedComentarios } from "./useFeedComentarios";
import styles from "./FeedPrincipal.module.css";
export function FeedPrincipal() {
  const heading = useId();
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
    <header className={styles.header}><h2 id={heading}>Comentarios de la comunidad</h2><button className="button button-secondary" type="button" onClick={feed.refresh}>Actualizar feed</button></header>
    <ul className={styles.list} aria-busy={feed.loading}>{feed.items.map(item => <li key={item.id}>
      <ExperienceCard feedback={item} showContext showTime readOnly />
      <p className={styles.counts}><span>{item.cantidadLikes} Me gusta</span><span>{item.cantidadRespuestas} {item.cantidadRespuestas === 1 ? "respuesta" : "respuestas"}</span>{item.meGusta ? <span>Te gusta este comentario</span> : null}</p>
    </li>)}</ul>
    {feed.loading ? <p role="status">{feed.items.length ? "Cargando más comentarios…" : "Cargando comentarios…"}</p> : null}
    {feed.error ? <Notice tone="error">{feed.error} <button className="button button-secondary" type="button" onClick={() => void feed.loadMore()}>Reintentar</button></Notice> : null}
    {!feed.loading && !feed.error && feed.loaded && feed.items.length === 0 ? <p role="status">Todavía no hay comentarios.</p> : null}
    {!feed.loading && !feed.error && feed.items.length > 0 && !feed.hasMore ? <p role="status">Llegaste al final de los comentarios.</p> : null}
    {feed.loaded && feed.hasMore && !feed.error ? <button className="button button-secondary" type="button" disabled={feed.loading} onClick={() => void feed.loadMore()}>{feed.loading ? "Cargando…" : "Cargar más"}</button> : null}
    <div ref={sentinel} className={styles.sentinel} aria-hidden="true" />
  </section>;
}
