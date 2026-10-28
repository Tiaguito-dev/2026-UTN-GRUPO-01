"use client";

import Link from "next/link";
import { useId } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { Notice } from "@/components/ui/Notice";
import { Pagination } from "@/components/ui/Pagination";
import { usePaginatedFetch } from "@/hooks/usePaginatedFetch";
import { useUrlPagination } from "@/hooks/useUrlPagination";
import { listarFeedback } from "@/services/feedback";
import { feedbackDetalleHref } from "@/validations/feedback";
import { ExperienceCard } from "./ExperienceCard";
import styles from "./feedback.module.css";

export function ExperienciasList() {
  const headingId = useId();
  const router = useRouter();
  const { page, setPage } = useUrlPagination();
  const { state, retry } = usePaginatedFetch("experiencias-generales", (next) => listarFeedback({ page: next, pageSize: 9 }), page);
  return <section className={styles.stack} aria-labelledby={headingId}>
    <PageHeader id={headingId} title="Experiencias" description="Comentarios de la comunidad sobre materias, comisiones y docentes, del más reciente al más antiguo." />
    <p className={styles.meta}>Para compartir tu experiencia, elegí una comisión desde <Link href="/home/materias">Materias</Link>.</p>
    {state.status === "loading" ? <p role="status">Cargando experiencias…</p> : state.status === "error" ? <Notice tone="error">Lo sentimos. No pudimos recuperar las experiencias. Intentá nuevamente. <button className="button" type="button" onClick={retry}>Reintentar</button></Notice> : <>
      <p className={styles.meta}>{state.data.total === 1 ? "1 comentario" : `${state.data.total} comentarios`}{state.data.items.length ? ` · Mostrando ${(state.data.page - 1) * state.data.pageSize + 1}–${Math.min(state.data.total, (state.data.page - 1) * state.data.pageSize + state.data.items.length)}` : ""}</p>
      {state.data.items.length ? <ul className={styles.experienceList}>{state.data.items.map((feedback) => <li key={feedback.id}><ExperienceCard feedback={feedback} showContext onManage={() => router.push(feedbackDetalleHref(feedback.id))} /></li>)}</ul> : state.data.total ? <p>No hay comentarios en esta página. <button className="button button-secondary" type="button" onClick={() => setPage(1)}>Volver a la primera página</button></p> : <p className={styles.experienceEmpty}>Todavía no hay experiencias publicadas.</p>}
      <Pagination page={page} pageSize={state.data.pageSize} total={state.data.total} onChange={setPage} />
    </>}
  </section>;
}
