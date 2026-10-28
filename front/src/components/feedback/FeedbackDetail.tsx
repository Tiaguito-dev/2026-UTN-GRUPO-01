"use client";
import Link from "next/link";
import { useId, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronDown, Pencil, Trash2 } from "lucide-react";
import { eliminarFeedback, obtenerFeedback } from "@/services/feedback";
import { obtenerComision } from "@/services/academic";
import { PageHeader } from "@/components/ui/PageHeader";
import { Notice } from "@/components/ui/Notice";
import { Dialog } from "@/components/ui/Dialog";
import { feedbackEdicionHref, feedbackNavigation, feedbackSuccessHref } from "@/validations/feedback";
import { useFeedbackResource } from "./useFeedbackResource";
import { FeedbackCard } from "./FeedbackCard";
import { FeedbackHistorial } from "./ComisionFeedback";
import styles from "./feedback.module.css";

export function FeedbackDetail({ feedbackId }: { feedbackId: string }) {
  const headingId = useId();
  const router = useRouter();
  const params = useSearchParams();
  const resource = useFeedbackResource(`feedback:${feedbackId}`, () => obtenerFeedback(feedbackId));
  const feedback = resource.data?.propio ? resource.data : undefined;
  const state = useFeedbackResource(`feedback-estado:${feedback?.contexto.comisionId ?? ""}`, async () => feedback ? obtenerComision(feedback.contexto.comisionId) : null);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const pending = useRef(false);
  const navigation = feedbackNavigation(feedback?.contexto, params);
  const backHref = navigation.back.href;
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
  return <section className={styles.privatePage} aria-labelledby={headingId}>
    <div className={styles.privateHeader}><PageHeader id={headingId} title="Tu comentario" focusKey={feedbackId} back={navigation.back}
      breadcrumb={[...navigation.items, { label: "Tu comentario" }]} /></div>
    {params.get("successMessage") ? <Notice tone="success">{params.get("successMessage")}</Notice> : null}
    {resource.error ? <Notice tone="error">{resource.error} {!resource.notFound ? <button className="button" type="button" onClick={resource.retry}>Reintentar</button> : null}</Notice> : null}
    {resource.loading ? <p role="status">Cargando comentario…</p> : null}
    {resource.data && !resource.data.propio ? <Notice tone="error">Solo podés consultar el detalle de tus propios comentarios.</Notice> : null}
    {error ? <Notice tone="error" focusOnShow>{error}</Notice> : null}
    {feedback ? <>
      <FeedbackCard feedback={feedback} materiaHref={navigation.materiaHref ?? `/home/materias/${encodeURIComponent(feedback.contexto.materiaId)}`} actions={<>
        {state.data?.activa ? <Link className={`button button-secondary ${styles.privateEdit}`} href={feedbackEdicionHref(feedback.id, params)} aria-label="Editar comentario"><Pencil size={17} strokeWidth={1.75} aria-hidden="true" focusable="false" />Editar</Link> : null}
        <button className={`button button-secondary ${styles.privateDelete}`} type="button" onClick={() => setConfirm(true)} disabled={busy} aria-label="Eliminar comentario"><Trash2 size={17} strokeWidth={1.75} aria-hidden="true" focusable="false" />Eliminar</button>
      </>} />
        {state.data && !state.data.activa ? <Notice tone="warning">La comisión está inactiva. Podés retirar tu comentario, pero no editarlo.</Notice> : null}
        {state.error ? <Notice tone="warning">No pudimos comprobar si la comisión admite ediciones. <button className="button" type="button" onClick={state.retry}>Reintentar</button></Notice> : null}
        <FeedbackHistoryDisclosure key={feedback.id} feedbackId={feedback.id} />
        <Dialog open={confirm} onClose={() => setConfirm(false)} title="Eliminar comentario" description="El comentario dejará de ser visible. Después podrás publicar otro si la comisión sigue activa." busy={busy}>
          <div className="dialog-actions"><button className="button button-secondary" type="button" disabled={busy} onClick={() => setConfirm(false)}>Cancelar</button><button className="button" type="button" disabled={busy} onClick={remove}>{busy ? "Eliminando…" : "Confirmar eliminación"}</button></div>
        </Dialog>
    </> : null}
  </section>;
}

function FeedbackHistoryDisclosure({ feedbackId }: { feedbackId: string }) {
  const [open, setOpen] = useState(false);
  const helpId = useId();
  return <details className={styles.privateHistory} onToggle={(event) => setOpen(event.currentTarget.open)}>
    <summary aria-describedby={helpId}>Historial de cambios<ChevronDown size={18} strokeWidth={1.75} aria-hidden="true" focusable="false" /></summary>
    <p id={helpId}>Solo vos podés consultar las versiones de tu comentario.</p>
    {open ? <div className={styles.privateHistoryBody}><FeedbackHistorial feedbackId={feedbackId} /></div> : null}
  </details>;
}
