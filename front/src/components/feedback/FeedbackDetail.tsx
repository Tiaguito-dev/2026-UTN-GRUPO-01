"use client";
import { BrandLoading } from "@/components/ui/BrandLoading";
import Link from "next/link";
import { useId, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronDown, Pencil, Trash2, Eye, EyeOff } from "lucide-react";
import { eliminarFeedback, obtenerFeedback, ocultarFeedback, restaurarFeedback, solicitarRevisionFeedback } from "@/services/feedback";
import { HttpError } from "@/services/http";
import { mensajeErrorModeracion } from "@/validations/feedback-moderation";
import { obtenerComision } from "@/services/academic";
import { PageHeader } from "@/components/ui/PageHeader";
import { Notice } from "@/components/ui/Notice";
import { Dialog } from "@/components/ui/Dialog";
import { feedbackEdicionHref, feedbackNavigation, feedbackSuccessHref } from "@/validations/feedback";
import { useFeedbackResource } from "./useFeedbackResource";
import { FeedbackCard } from "./FeedbackCard";
import { FeedbackModerationStatus } from "./FeedbackModerationStatus";
import { FeedbackHistorial } from "./ComisionFeedback";
import { feedbackSuccessMessage } from "@/validations/feedback";
import styles from "./feedback.module.css";
import presentation from "./ExperienciasPresentation.module.css";

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
  const [action, setAction] = useState<"ocultar" | "restaurar" | "revision" | null>(null);
  const [message, setMessage] = useState("");
  const pending = useRef(false);
  const navigation = feedbackNavigation(feedback?.contexto, params);
  const backHref = navigation.back.href;
  const restricted = feedback?.ocultoReportes || feedback?.ocultoAdministracion;
  const visibilityLabel = feedback?.ocultoAutor ? restricted ? "Quitar mi ocultamiento voluntario" : "Mostrar experiencia" : "Ocultar comentario";
  const visibilityHelpId = useId();
  async function moderate() {
    if (!feedback || !action || pending.current || feedback.versionModeracion === undefined) return;
    pending.current = true; setBusy(true); setError(""); setMessage("");
    try {
      const operation = action === "ocultar" ? ocultarFeedback : action === "restaurar" ? restaurarFeedback : solicitarRevisionFeedback;
      const result = await operation(feedback.id, feedback.versionModeracion);
      setMessage(action === "revision" ? "Tu solicitud está pendiente de revisión por el equipo administrativo." : action === "ocultar" ? "La experiencia se ocultó correctamente." : result.ocultoAdministracion || result.ocultoReportes ? "Levantaste tu ocultamiento. La experiencia permanece oculta por las otras restricciones indicadas." : "La experiencia volvió a ser visible.");
      setAction(null); resource.retry();
    } catch (failure) {
      setError(mensajeErrorModeracion(failure));
      if (failure instanceof HttpError && failure.status === 409) { setAction(null); resource.retry(); }
    } finally { pending.current = false; setBusy(false); }
  }
  async function remove() {
    if (!feedback || pending.current) return;
    pending.current = true; setBusy(true); setError("");
    try {
      await eliminarFeedback(feedback.id);
      router.push(feedbackSuccessHref(backHref, "El comentario se eliminó correctamente."));
    } catch (failure: unknown) {
      setError(mensajeErrorModeracion(failure, "Lo sentimos. No pudimos eliminar tu comentario, intentá nuevamente."));
      setConfirm(false);
    } finally { pending.current = false; setBusy(false); }
  }
  return <section className={styles.privatePage} aria-labelledby={headingId}>
    <div className={styles.privateHeader}><PageHeader id={headingId} title="Tu comentario" focusKey={feedbackId} back={navigation.back}
      breadcrumb={[...navigation.items, { label: "Tu comentario" }]} /></div>
    {feedbackSuccessMessage(params.get("successMessage")) ? <Notice tone="success">{feedbackSuccessMessage(params.get("successMessage"))}</Notice> : null}
    {resource.error ? <Notice tone="error">{resource.error} {!resource.notFound ? <button className="button" type="button" onClick={resource.retry}>Reintentar</button> : null}</Notice> : null}
    {resource.loading ? <BrandLoading message="Cargando comentario…" /> : null}
    {resource.data && !resource.data.propio ? <Notice tone="error">Solo podés consultar el detalle de tus propios comentarios.</Notice> : null}
    {error && !action ? <Notice tone="error" focusOnShow>{error}</Notice> : null}
    {message ? <Notice tone="success" focusOnShow>{message}</Notice> : null}
    {feedback ? <>
      <FeedbackModerationStatus feedback={feedback} />
      <FeedbackCard feedback={feedback} materiaHref={navigation.materiaHref ?? `/home/materias/${encodeURIComponent(feedback.contexto.materiaId)}`} actions={<>
        {(state.data?.activa || feedback.estadoModeracion === "RECHAZADO") ? <Link className={`button button-secondary ${styles.privateEdit}`} href={feedbackEdicionHref(feedback.id, params)} aria-label="Editar comentario"><Pencil size={17} strokeWidth={1.75} aria-hidden="true" focusable="false" />Editar</Link> : null}
        <button className={`button button-secondary ${styles.privateDelete}`} type="button" onClick={() => setConfirm(true)} disabled={busy} aria-label="Eliminar comentario"><Trash2 size={17} strokeWidth={1.75} aria-hidden="true" focusable="false" />Eliminar</button>
      </>} />
        {state.data && !state.data.activa && feedback.estadoModeracion !== "RECHAZADO" ? <Notice tone="warning">La comisión está inactiva. Podés retirar tu comentario, pero no editarlo.</Notice> : null}
        {state.error ? <Notice tone="warning">No pudimos comprobar si la comisión admite ediciones. <button className="button" type="button" onClick={state.retry}>Reintentar</button></Notice> : null}
        {feedback.estadoModeracion === "APROBADO" ? <div className={presentation.visibility}><button className="button button-secondary" type="button" disabled={busy} aria-describedby={restricted ? visibilityHelpId : undefined} onClick={() => setAction(feedback.ocultoAutor ? "restaurar" : "ocultar")}>
          {feedback.ocultoAutor ? <Eye size={17} aria-hidden="true" /> : <EyeOff size={17} aria-hidden="true" />}{visibilityLabel}
        </button>{restricted ? <p id={visibilityHelpId}>Esta acción solo modifica tu decisión de ocultamiento. La experiencia seguirá oculta por {feedback.ocultoReportes && feedback.ocultoAdministracion ? "reportes y por administración" : feedback.ocultoReportes ? "reportes" : "administración"}.</p> : null}</div> : null}
        {feedback.estadoModeracion === "RECHAZADO" ? <button className="button" type="button" disabled={busy} onClick={() => setAction("revision")}>Solicitar nueva revisión</button> : null}
        <FeedbackHistoryDisclosure key={`${feedback.id}:${feedback.versionModeracion}`} feedbackId={feedback.id} />
        <Dialog open={action !== null} onClose={() => setAction(null)} title={action === "revision" ? "Solicitar nueva revisión" : visibilityLabel} description={action === "revision" ? "Primero guardá una corrección real del texto. La solicitud quedará pendiente y no publica automáticamente." : action === "restaurar" ? "Solo se levantará tu ocultamiento. Las restricciones administrativas y preventivas seguirán vigentes." : restricted ? "Agregarás tu ocultamiento voluntario. Quitar esa decisión después no levantará las restricciones administrativas ni preventivas." : "La experiencia dejará de verse en la comunidad. Podrás levantar tu ocultamiento después."} busy={busy}>
          {error ? <Notice tone="error">{error}</Notice> : null}
          <div className="dialog-actions"><button className="button button-secondary" type="button" disabled={busy} onClick={() => setAction(null)}>Cancelar</button><button className="button" type="button" disabled={busy} onClick={() => void moderate()}>{busy ? "Procesando…" : "Confirmar"}</button></div>
        </Dialog>
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
