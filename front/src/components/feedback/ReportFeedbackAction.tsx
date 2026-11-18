"use client";
import { useId, useRef, useState, type FormEvent } from "react";
import { Flag } from "lucide-react";
import { Dialog } from "@/components/ui/Dialog";
import { Notice } from "@/components/ui/Notice";
import { crearReporteFeedback } from "@/services/feedback-reportes";
import { HttpError } from "@/services/http";
import { mensajeErrorModeracion, reporteMotivos, validarDescripcionReporte } from "@/validations/feedback-moderation";
import styles from "./feedback.module.css";

export function ReportFeedbackAction({ feedbackId, onReported }: { feedbackId: string; onReported?: () => void }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const pending = useRef(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (pending.current) return;
    const option = reporteMotivos.find(row => row.value === motivo);
    const validation = !option ? "Elegí un motivo para reportar." : validarDescripcionReporte(descripcion);
    if (validation || !option) { setError(validation); return; }
    pending.current = true; setBusy(true); setError("");
    try {
      await crearReporteFeedback(feedbackId, { motivo: option.value, ...(descripcion.trim() ? { descripcion: descripcion.trim() } : {}) });
      setSuccess(true); setOpen(false);
      onReported?.();
    } catch (failure) {
      setError(mensajeErrorModeracion(failure));
      if (failure instanceof HttpError && failure.status === 404) setUnavailable(true);
    } finally { pending.current = false; setBusy(false); }
  }
  return <div>
    {success ? <Notice tone="success">El reporte se envió correctamente. El equipo administrativo lo revisará.</Notice> : <button className="button button-secondary" type="button" disabled={unavailable} onClick={() => setOpen(true)}><Flag size={16} aria-hidden="true" />Reportar</button>}
    <Dialog open={open} onClose={() => setOpen(false)} title="Reportar experiencia" description="Indicá el motivo. Tu identidad solo estará disponible para el equipo administrativo autorizado." busy={busy}>
      <form onSubmit={submit} className={styles.stack} noValidate aria-busy={busy}>
        {error ? <Notice tone="error" focusOnShow>{error}</Notice> : null}
        <label htmlFor={`${id}-motivo`}>Motivo obligatorio</label>
        <select id={`${id}-motivo`} required value={motivo} disabled={busy} onChange={event => setMotivo(event.target.value)}><option value="">Seleccioná un motivo</option>{reporteMotivos.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
        <label htmlFor={`${id}-descripcion`}>Descripción opcional</label>
        <textarea id={`${id}-descripcion`} rows={3} value={descripcion} disabled={busy} maxLength={1000} onChange={event => setDescripcion(event.target.value)} placeholder="Agregá contexto para el equipo administrativo" />
        <div className="dialog-actions"><button className="button button-secondary" type="button" disabled={busy} onClick={() => setOpen(false)}>Cancelar</button><button className="button" type="submit" disabled={busy || unavailable}>{busy ? "Enviando…" : "Enviar reporte"}</button></div>
      </form>
    </Dialog>
  </div>;
}
