"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useId, useState } from "react";
import { MessageSquare } from "lucide-react";
import type { ComisionDetalle } from "@/services/academic";
import { listarFeedbackComision, obtenerFeedbackPropio, listarHistorialFeedback } from "@/services/feedback";
import { PaginatedListView } from "@/components/ui/PaginatedListView";
import { Notice } from "@/components/ui/Notice";
import { useUrlPagination } from "@/hooks/useUrlPagination";
import { usePaginatedFetch } from "@/hooks/usePaginatedFetch";
import { Pagination } from "@/components/ui/Pagination";
import { comisionNavigation } from "@/validations/admin-academic-navigation";
import { feedbackDetalleHref, feedbackOriginParams } from "@/validations/feedback";
import { useFeedbackResource } from "./useFeedbackResource";
import { ExperienceCard } from "./ExperienceCard";
import styles from "./feedback.module.css";

export function ComisionFeedback({ comision, administrative = false }: { comision: ComisionDetalle; administrative?: boolean }) {
  const headingId = useId();
  const router = useRouter();
  const params = useSearchParams();
  const publishQuery = feedbackOriginParams(params);
  publishQuery.set("comisionId", comision.id);
  const { page, setPage } = useUrlPagination();
  const navigation = comisionNavigation(params, comision);
  const detailUrl = new URL(navigation.detailHref, "https://local.invalid");
  if (page > 1) detailUrl.searchParams.set("page", String(page));
  const returnTo = administrative ? `${detailUrl.pathname}?${detailUrl.searchParams}` : undefined;
  const own = useFeedbackResource(`propio:${comision.id}:${administrative}`, () => administrative ? Promise.resolve(null) : obtenerFeedbackPropio(comision.id));
  const comments = usePaginatedFetch(`feedback:${comision.id}`, (next) => listarFeedbackComision(comision.id, { page: next, pageSize: 9 }), page);
  const result = comments.state.status === "ready" ? comments.state.data : undefined;
  return <section className={styles.experiences} aria-labelledby={headingId}>
    <div className={styles.experienceHeader}>
      <div className={styles.experienceHeading}>
        <h2 id={headingId}><MessageSquare size={22} strokeWidth={1.75} aria-hidden="true" focusable="false" />Experiencias{result ? <span className={styles.experienceCount}>({result.total})</span> : null}</h2>
        <p>Cómo se vive la cursada, contado por quienes la comparten.</p>
      </div>
      {!administrative && !own.loading && !own.error && !own.data && comision.activa ? <button className="button" type="button" onClick={() => router.push(`/home/feedback/nuevo?${publishQuery}`)}>Compartir mi experiencia</button> : null}
    </div>
    <div className={styles.experienceBody}>
      {!administrative ? <details className={styles.experienceHelp}>
        <summary>¿Cómo funcionan los comentarios?</summary>
        <p>Podés mantener un comentario por comisión, aunque haya varios docentes. Podés publicarlo de forma anónima, editarlo o eliminarlo. Si lo eliminás, podés publicar otro mientras la comisión esté activa.</p>
      </details> : null}
      {!comision.activa ? <Notice tone="warning">{administrative ? "Esta comisión está inactiva. Las publicaciones y ediciones están cerradas." : "Esta comisión está inactiva. Podés consultar sus experiencias y retirar tu comentario; las publicaciones y ediciones están cerradas."}</Notice> : null}
      {!administrative && (own.loading ? <p role="status">Comprobando tu comentario…</p> : own.error ? <Notice tone="error">{own.error} <button className="button" type="button" onClick={own.retry}>Reintentar comprobar mi comentario</button></Notice> : null)}
      {comments.state.status === "loading" ? <p role="status">Cargando comentarios…</p> : null}
      {comments.state.status === "error" ? <Notice tone="error">{comments.state.error} <button className="button" type="button" onClick={comments.retry}>Reintentar cargar comentarios</button></Notice> : null}
      {result ? <>
        {result.items.length ? <ul className={styles.experienceList}>{result.items.map((feedback) => <li key={feedback.id}><ExperienceCard feedback={feedback} administrative={administrative} returnTo={returnTo} onManage={() => router.push(feedbackDetalleHref(feedback.id, params))} /></li>)}</ul> : <p className={styles.experienceEmpty}>Todavía no hay comentarios en esta comisión.</p>}
        <Pagination page={result.page} pageSize={result.pageSize} total={result.total} onChange={setPage} />
      </> : null}
    </div>
  </section>;
}

export function FeedbackHistorial({ feedbackId }: { feedbackId: string }) {
  const [page, setPage] = useState(1);
  return <PaginatedListView resetKey={`historial:${feedbackId}`} page={page} onPageChange={setPage}
    fetchPage={(next) => listarHistorialFeedback(feedbackId, { page: next, pageSize: 3 })}
    loadingMessage="Cargando historial…" empty={<p>No hay cambios registrados.</p>}>
    {(result) => <ul className={styles.list}>{result.items.map((event) => <li className={styles.item} key={event.id}>
      <strong>{event.accion === "CREACION" ? "Publicación" : event.accion === "EDICION" ? "Edición" : "Eliminación"}</strong>
      <p className={styles.meta}><time dateTime={event.createdAt}>{new Date(event.createdAt).toLocaleString("es-AR")}</time> · {event.anonimo ? "Anónimo" : "Con nombre visible"}</p>
      <p className={styles.text}>{event.texto}</p>
    </li>)}</ul>}
  </PaginatedListView>;
}
