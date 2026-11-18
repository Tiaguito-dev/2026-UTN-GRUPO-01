"use client";

import { useId, useRef, useState } from "react";
import { Dialog } from "@/components/ui/Dialog";
import { Notice } from "@/components/ui/Notice";
import { moderarFeedback } from "@/services/feedback";
import { HttpError } from "@/services/http";
import type { AccionModeracionAdmin } from "@/types/feedback-moderation";
import { explicacionModeracion, mensajeErrorModeracion, validarMotivoModeracion } from "@/validations/feedback-moderation";
import styles from "./AdminModeration.module.css";

const labels: Record<AccionModeracionAdmin, string> = {
  APROBACION: "Aprobar experiencia", RECHAZO: "Rechazar experiencia",
  OCULTAMIENTO_ADMIN: "Ocultar por administración", RESTITUCION_ADMIN: "Restituir ocultamiento administrativo",
  RESTITUCION_REPORTES: "Restituir ocultamiento preventivo",
};
const impacts: Record<AccionModeracionAdmin, string> = {
  APROBACION: "La experiencia quedará aprobada. Será pública únicamente si no conserva causas de ocultamiento.",
  RECHAZO: "La experiencia dejará de ser pública. El autor verá el motivo y podrá corregirla para solicitar otra revisión.",
  OCULTAMIENTO_ADMIN: "La experiencia dejará de ser pública inmediatamente, conservando su estado de aprobación.",
  RESTITUCION_ADMIN: "Se levantará exclusivamente el ocultamiento administrativo. Las demás restricciones permanecerán vigentes.",
  RESTITUCION_REPORTES: "Se levantará exclusivamente el ocultamiento por reportes. Requiere menos de tres denunciantes distintos con reportes abiertos; las demás restricciones permanecerán vigentes.",
};

export function AdminModerationActions({ id, record, own = false, denunciantesAbiertos, onRefresh }: {
  id: string; record: Record<string, unknown>; own?: boolean; denunciantesAbiertos?: number; onRefresh: (conflict?: boolean) => void;
}) {
  const [action, setAction] = useState<AccionModeracionAdmin | null>(null);
  const [notice, setNotice] = useState("");
  if (record.deletedAt || typeof record.versionModeracion !== "number") return null;
  const version = record.versionModeracion;
  const approved = record.estadoModeracion === "APROBADO";
  const actions: AccionModeracionAdmin[] = [
    ...(record.estadoModeracion === "PENDIENTE" && !own ? ["APROBACION" as const] : []),
    ...(approved || record.estadoModeracion === "PENDIENTE" ? ["RECHAZO" as const] : []),
    ...(record.ocultoAdministracion ? ["RESTITUCION_ADMIN" as const] : approved ? ["OCULTAMIENTO_ADMIN" as const] : []),
    ...(record.ocultoReportes && denunciantesAbiertos !== undefined && denunciantesAbiertos < 3 ? ["RESTITUCION_REPORTES" as const] : []),
  ];
  return <div className={styles.actions}>
    {notice ? <Notice tone="success">{notice}</Notice> : null}
    {actions.map(value => <button key={value} className="button button-secondary" type="button" onClick={() => { setNotice(""); setAction(value); }}>{labels[value]}</button>)}
    {record.ocultoReportes && denunciantesAbiertos !== undefined && denunciantesAbiertos >= 3 ? <p>Resolvé o desestimá reportes hasta que haya menos de tres denunciantes distintos con reportes abiertos antes de restituir.</p> : null}
    {action ? <AdminDecisionDialog title={labels[action]} impact={impacts[action]} onClose={() => setAction(null)} onConfirm={async motivo => {
      try { await moderarFeedback(id, { accion: action, versionEsperada: version, motivo }); }
      catch (error) { if (error instanceof HttpError && error.status === 409) onRefresh(true); throw error; }
      setNotice("La decisión se registró correctamente. Se actualizará la situación de la experiencia."); setAction(null); onRefresh();
    }} /> : null}
  </div>;
}

export function AdminDecisionDialog({ title, impact, onClose, onConfirm }: {
  title: string; impact: string; onClose: () => void; onConfirm: (motivo: string) => Promise<void>;
}) {
  const id = useId(); const pending = useRef(false);
  const [motivo, setMotivo] = useState(""); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  return <Dialog open title={title} description={impact} busy={busy} onClose={onClose}>
    <form className={styles.form} onSubmit={async event => {
      event.preventDefault(); if (pending.current) return;
      const issue = validarMotivoModeracion(motivo); if (issue) { setError(issue); return; }
      pending.current = true; setBusy(true); setError("");
      try { await onConfirm(motivo.trim()); } catch (failure) { setError(mensajeErrorModeracion(failure)); }
      finally { pending.current = false; setBusy(false); }
    }}>
      <label htmlFor={id}>Justificación obligatoria</label>
      <textarea id={id} value={motivo} onChange={event => setMotivo(event.target.value)} maxLength={1000} rows={3} required disabled={busy} placeholder="Explicá el motivo de la decisión" aria-describedby={error ? `${id}-error` : undefined} data-autofocus />
      {error ? <div id={`${id}-error`}><Notice tone="error" focusOnShow>{error}</Notice></div> : null}
      <div className="dialog-actions"><button className="button button-secondary" type="button" disabled={busy} onClick={onClose}>Cancelar</button><button className="button" type="submit" disabled={busy} aria-busy={busy}>{busy ? "Procesando…" : "Confirmar decisión"}</button></div>
    </form>
  </Dialog>;
}

export function AdminModerationStatus({ record }: { record: Record<string, unknown> }) {
  const causes = [record.ocultoAutor ? "Oculta por el autor" : "", record.ocultoAdministracion ? "Oculta por administración" : "", record.ocultoReportes ? "Oculta preventivamente por reportes" : ""].filter(Boolean);
  const state = record.deletedAt ? "Eliminada" : record.estadoModeracion === "PENDIENTE" ? "Pendiente de revisión" : record.estadoModeracion === "RECHAZADO" ? "Rechazada" : causes.length ? "Aprobada, sin visibilidad pública" : "Publicada";
  return <div><strong>{state}</strong>{causes.length ? <ul>{causes.map(cause => <li key={cause}>{cause}</li>)}</ul> : null}{record.estadoModeracion === "RECHAZADO" && typeof record.motivoRechazo === "string" ? <p>Motivo del rechazo: {explicacionModeracion(record.motivoRechazo)}</p> : null}</div>;
}
