"use client";
import Link from "next/link";
import { useId, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { eliminarFeedback, obtenerFeedback } from "@/services/feedback";
import { obtenerComision } from "@/services/academic";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { Notice } from "@/components/ui/Notice";
import { Dialog } from "@/components/ui/Dialog";
import { feedbackComisionHref, feedbackDetalleHref, feedbackSuccessHref } from "@/validations/feedback";
import { useFeedbackResource } from "./useFeedbackResource";
import { FeedbackCard } from "./FeedbackCard";
import { FeedbackHistorial } from "./ComisionFeedback";
import styles from "./feedback.module.css";

export function FeedbackDetail({ feedbackId }: { feedbackId: string }) {
  const headingId = useId();
  const router = useRouter();
  const params = useSearchParams();
  const resource = useFeedbackResource(`feedback:${feedbackId}`, () => obtenerFeedback(feedbackId));
  const feedback = resource.data;
  const state = useFeedbackResource(`feedback-estado:${feedback?.contexto.comisionId ?? ""}`, async () => feedback ? obtenerComision(feedback.contexto.comisionId) : null);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const pending = useRef(false);
  const backHref = feedback ? feedbackComisionHref(feedback.contexto) : "/home/materias";
  async function remove() {
    if (!feedback || pending.current) return;
    pending.current = true; setBusy(true); setError("");
    try {
      await eliminarFeedback(feedback.id);
      router.push(feedbackSuccessHref(backHref, "El comentario se eliminó correctamente."));
    } catch (failure: unknown) {
      setError(failure instanceof Error ? failure.message : "Lo sentimos. No pudimos eliminar tu comentario, intentá nuevamente.");
      setConfirm(false);
    } finally { pending.current = false; setBusy(false); }
  }
  return <section className={styles.stack} aria-labelledby={headingId}>
    <PageHeader id={headingId} title="Comentario" focusKey={feedbackId} back={{ href: backHref, label: "Comisión" }}
      breadcrumb={[{ label: "Materias", href: "/home/materias" }, { label: "Comentario" }]} />
    {params.get("successMessage") ? <Notice tone="success">{params.get("successMessage")}</Notice> : null}
    {resource.error ? <Notice tone="error">{resource.error} {!resource.notFound ? <button className="button" type="button" onClick={resource.retry}>Reintentar</button> : null}</Notice> : null}
    {resource.loading ? <p role="status">Cargando comentario…</p> : null}
    {error ? <Notice tone="error" focusOnShow>{error}</Notice> : null}
    {feedback ? <>
      <Card variant="panel"><FeedbackCard feedback={feedback} detail /></Card>
      <Card variant="panel"><h2>Auditoría</h2><dl className={styles.data}>
        <div><dt>Publicación</dt><dd>{new Date(feedback.createdAt).toLocaleString("es-AR")}</dd></div>
        <div><dt>Última actualización</dt><dd>{new Date(feedback.updatedAt).toLocaleString("es-AR")}</dd></div>
        <div><dt>Identidad visible</dt><dd>{feedback.anonimo ? "Anónimo" : feedback.autor?.displayName ?? "Usuario"}</dd></div>
      </dl></Card>
      {feedback.propio ? <>
        <div className={styles.actions}>
          {state.data?.activa ? <Link className="button" href={`${feedbackDetalleHref(feedback.id)}/editar`}>Editar comentario</Link> : null}
          <button className="button button-secondary" type="button" onClick={() => setConfirm(true)} disabled={busy}>Eliminar comentario</button>
        </div>
        {state.data && !state.data.activa ? <Notice tone="warning">La comisión está inactiva. Podés retirar tu comentario, pero no editarlo.</Notice> : null}
        {state.error ? <Notice tone="warning">No pudimos comprobar si la comisión admite ediciones. <button className="button" type="button" onClick={state.retry}>Reintentar</button></Notice> : null}
        <Card variant="panel"><h2>Historial de cambios</h2><p>Solo vos podés consultar las versiones de tu comentario.</p><FeedbackHistorial feedbackId={feedback.id} /></Card>
        <Dialog open={confirm} onClose={() => setConfirm(false)} title="Eliminar comentario" description="El comentario dejará de ser visible. Después podrás publicar otro si la comisión sigue activa." busy={busy}>
          <div className="dialog-actions"><button className="button button-secondary" type="button" disabled={busy} onClick={() => setConfirm(false)}>Cancelar</button><button className="button" type="button" disabled={busy} onClick={remove}>{busy ? "Eliminando…" : "Confirmar eliminación"}</button></div>
        </Dialog>
      </> : null}
    </> : null}
  </section>;
}
