"use client";
import { useId, useRef, useState } from "react";
import { useFormSubmission } from "@/hooks/useFormSubmission";
import { Notice } from "@/components/ui/Notice";
import { validarTextoFeedback } from "@/validations/feedback";
import { crearRespuestaFeedback, editarRespuestaFeedback } from "@/services/feedback-feed";
import { HttpError } from "@/services/http";
import type { FeedbackRespuesta, FeedbackRespuestaInput, FeedbackRespuestaEdicion } from "@/types/feedback-feed";
import styles from "./FeedPrincipal.module.css";
export function FeedbackRespuestaForm({ feedbackId, original, onSaved, onUnavailable, unavailable = false }: {
  feedbackId: string; original?: FeedbackRespuesta; onSaved: (reply: FeedbackRespuesta) => void; onUnavailable: () => void; unavailable?: boolean;
}) {
  const id = useId(); const [texto, setTexto] = useState(original?.texto ?? ""); const [anonimo, setAnonimo] = useState(original?.anonimo ?? false);
  const attempt = useRef<FeedbackRespuestaInput | null>(null); const [hasAttempt, setHasAttempt] = useState(false);
  const { busy, errors, error, success, setSuccess, handleSubmit, handleChange } = useFormSubmission({
    fields: ["texto", "anonimo"] as const,
    validate: values => { const message = validarTextoFeedback(values.texto); return message ? { texto: message } : {}; },
    fallbackError: "No pudimos guardar la respuesta. Intentá nuevamente.",
    onSubmit: async values => {
      if (unavailable || (original && !original.propio)) return;
      const text = values.texto.trim(); const anonymous = values.anonimo === "true";
      try {
        let result: FeedbackRespuesta;
        if (original) {
          const changes: FeedbackRespuestaEdicion = {};
          if (text !== original.texto) changes.texto = text;
          if (anonymous !== original.anonimo) changes.anonimo = anonymous;
          if (!Object.keys(changes).length) { setSuccess("No hay cambios para guardar."); return; }
          result = await editarRespuestaFeedback(original.id, changes);
        } else {
          if (attempt.current && (attempt.current.texto !== text || attempt.current.anonimo !== anonymous)) throw new Error("Para publicar otro contenido, elegí Nueva respuesta.");
          if (!attempt.current) attempt.current = { solicitudId: crypto.randomUUID(), texto: text, anonimo: anonymous };
          setHasAttempt(true);
          result = await crearRespuestaFeedback(feedbackId, attempt.current);
          attempt.current = null; setHasAttempt(false); setTexto(""); setAnonimo(false);
        }
        setSuccess(original ? "La respuesta se actualizó." : "La respuesta se publicó.");
        onSaved(result);
      } catch (failure) { if (failure instanceof HttpError && failure.status === 404) onUnavailable(); throw failure; }
    },
  });
  if (original && !original.propio) return <Notice tone="error">Solo podés gestionar tus propias respuestas.</Notice>;
  return <form className={styles.replyForm} onSubmit={handleSubmit} onChange={handleChange} noValidate aria-busy={busy}>
    {error ? <Notice tone="error" focusOnShow>{error}</Notice> : null}{success ? <Notice tone="success">{success}</Notice> : null}
    <label htmlFor={id}>{original ? "Editar tu respuesta" : "Tu respuesta"}</label>
    <textarea id={id} name="texto" value={texto} onChange={event => setTexto(event.target.value)} rows={3} required disabled={busy} readOnly={unavailable} aria-invalid={Boolean(errors.texto)} aria-describedby={errors.texto ? `${id}-error` : undefined} />
    {errors.texto ? <p id={`${id}-error`} role="alert">{errors.texto}</p> : null}
    <label><input name="anonimo" type="checkbox" value="true" checked={anonimo} onChange={event => setAnonimo(event.target.checked)} disabled={busy || unavailable} /> Publicar de forma anónima</label>
    <button className="button" type="submit" disabled={busy || unavailable}>{busy ? "Guardando…" : original ? "Guardar respuesta" : "Publicar respuesta"}</button>
    {!original && hasAttempt ? <><p>El reintento conserva su solicitud. Para publicar otro contenido, iniciá una nueva respuesta.</p><button className="button button-secondary" type="button" disabled={busy || unavailable} onClick={() => { attempt.current = null; setHasAttempt(false); }}>Nueva respuesta</button></> : null}
  </form>;
}
