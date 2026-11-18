"use client";

import { useRef, useState } from "react";
import { EyeOff } from "lucide-react";
import { Dialog } from "@/components/ui/Dialog";
import { Notice } from "@/components/ui/Notice";
import { obtenerFeedback, ocultarFeedback } from "@/services/feedback";
import { HttpError } from "@/services/http";
import { mensajeErrorModeracion } from "@/validations/feedback-moderation";
import type { FeedbackOwn } from "@/types/feedback";

/** The community projection never supplies the private moderation version. */
export function HideFeedExperienceAction({ feedbackId, onHidden, onRefresh }: {
  feedbackId: string; onHidden: () => void; onRefresh: (message: string) => void;
}) {
  const [detail, setDetail] = useState<FeedbackOwn | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const pending = useRef(false);

  async function prepare() {
    if (pending.current) return;
    pending.current = true; setBusy(true); setError("");
    try {
      const current = await obtenerFeedback(feedbackId);
      if (current.id !== feedbackId || !current.propio || current.estadoModeracion !== "APROBADO" || current.ocultoAutor || current.ocultoAdministracion || current.ocultoReportes) {
        onRefresh("La experiencia cambió y ya no admite esta acción. Actualizamos los comentarios."); return;
      }
      setDetail(current);
    } catch (failure) {
      setError(mensajeErrorModeracion(failure, "No pudimos comprobar tu experiencia. Intentá nuevamente."));
    } finally { pending.current = false; setBusy(false); }
  }

  async function hide() {
    if (!detail || pending.current) return;
    pending.current = true; setBusy(true); setError("");
    try {
      await ocultarFeedback(feedbackId, detail.versionModeracion);
      setDetail(null); onHidden();
    } catch (failure) {
      if (failure instanceof HttpError && failure.status === 409) {
        setDetail(null); onRefresh(mensajeErrorModeracion(failure));
      } else setError(mensajeErrorModeracion(failure));
    } finally { pending.current = false; setBusy(false); }
  }

  return <>
    <button className="button button-secondary" type="button" disabled={busy} onClick={() => void prepare()}><EyeOff size={16} aria-hidden="true" />{busy && !detail ? "Comprobando…" : "Ocultar experiencia"}</button>
    {error && !detail ? <Notice tone="error">{error}</Notice> : null}
    {detail ? <Dialog open title="Ocultar experiencia" description="Tu comentario dejará de verse en la comunidad. Seguirá disponible en Mis experiencias, donde podrás volver a mostrarlo. Las otras restricciones se conservarán." busy={busy} onClose={() => { setDetail(null); setError(""); }}>
      {error ? <Notice tone="error">{error}</Notice> : null}
      <div className="dialog-actions">
        <button className="button button-secondary" type="button" disabled={busy} onClick={() => { setDetail(null); setError(""); }}>Cancelar</button>
        <button className="button" type="button" disabled={busy} onClick={() => void hide()}>{busy ? "Ocultando…" : "Confirmar ocultamiento"}</button>
      </div>
    </Dialog> : null}
  </>;
}
