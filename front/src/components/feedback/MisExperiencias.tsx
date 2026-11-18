"use client";
import Link from "next/link";
import { useRef, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Dialog } from "@/components/ui/Dialog";
import { Notice } from "@/components/ui/Notice";
import { listarFeedbackPropios, ocultarFeedback, restaurarFeedback } from "@/services/feedback";
import { HttpError } from "@/services/http";
import { mensajeErrorModeracion } from "@/validations/feedback-moderation";
import type { FeedbackOwn } from "@/types/feedback";
import presentation from "./ExperienciasPresentation.module.css";
import { useUrlPagination } from "@/hooks/useUrlPagination";
import { PaginatedListView } from "@/components/ui/PaginatedListView";
import { feedbackDetalleHref } from "@/validations/feedback";
import { ExperienceCard } from "./ExperienceCard";
import { FeedbackModerationStatus } from "./FeedbackModerationStatus";
import styles from "./feedback.module.css";

export function MisExperiencias() {
  const [selection, setSelection] = useState<FeedbackOwn | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const pending = useRef(false);
  async function changeVisibility() {
    if (!selection?.propio || selection.estadoModeracion !== "APROBADO" || pending.current) return;
    pending.current = true; setBusy(true); setError(""); setMessage("");
    try {
      const operation = selection.ocultoAutor ? restaurarFeedback : ocultarFeedback;
      const result = await operation(selection.id, selection.versionModeracion);
      setMessage(!selection.ocultoAutor ? "La experiencia se ocultó correctamente." : result.ocultoAdministracion || result.ocultoReportes ? "Levantaste tu ocultamiento. La experiencia permanece oculta por las otras restricciones indicadas." : "La experiencia volvió a ser visible.");
      setSelection(null); setRefreshKey(value => value + 1);
    } catch (failure) {
      setError(mensajeErrorModeracion(failure));
      if (failure instanceof HttpError && [403, 404, 409].includes(failure.status)) {
        setSelection(null); setRefreshKey(value => value + 1);
      }
    } finally { pending.current = false; setBusy(false); }
  }
  const { page, setPage } = useUrlPagination();
  const origin = new URLSearchParams({ origen: "experiencias", experienciasSeccion: "propias", experienciasPage: String(page) });
  return <>
    {message ? <Notice tone="success" focusOnShow>{message}</Notice> : null}
    {error && !selection ? <Notice tone="error" focusOnShow>{error}</Notice> : null}
    <PaginatedListView resetKey="mis-experiencias" refreshKey={refreshKey} page={page} onPageChange={setPage}
    fetchPage={(next) => listarFeedbackPropios({ page: next, pageSize: 9 })}
    loadingMessage="Cargando tus experiencias…" empty={<p>Todavía no compartiste experiencias.</p>}>
    {(result) => <ul className={`${styles.experienceList} ${presentation.ownList}`}>{result.items.map((feedback) => <li key={feedback.id}>
      <ExperienceCard feedback={feedback} showContext origin={origin} readOnly footer={<>
        <FeedbackModerationStatus feedback={feedback} variant="own" />
        {feedback.propio && feedback.estadoModeracion === "APROBADO" ? <button className="button button-secondary" type="button" disabled={busy} onClick={() => { setError(""); setMessage(""); setSelection(feedback); }}>
          {feedback.ocultoAutor ? <Eye size={16} aria-hidden="true" /> : <EyeOff size={16} aria-hidden="true" />}{feedback.ocultoAutor ? "Mostrar experiencia" : "Ocultar experiencia"}
        </button> : null}
        <Link className="button button-secondary" href={feedbackDetalleHref(feedback.id, origin)}>Ver mi experiencia</Link>
      </>} />
    </li>)}</ul>}
  </PaginatedListView>
    <Dialog open={selection !== null} onClose={() => setSelection(null)} busy={busy}
      title={selection?.ocultoAutor ? "Mostrar experiencia" : "Ocultar experiencia"}
      description={selection?.ocultoAutor ? "Solo se levantará tu ocultamiento. Las restricciones administrativas y preventivas seguirán vigentes." : "La experiencia dejará de verse en la comunidad. Podrás levantar tu ocultamiento después; las otras restricciones seguirán vigentes."}>
      {error ? <Notice tone="error">{error}</Notice> : null}
      <div className="dialog-actions">
        <button className="button button-secondary" type="button" disabled={busy} onClick={() => setSelection(null)}>Cancelar</button>
        <button className="button" type="button" disabled={busy} aria-busy={busy} onClick={() => void changeVisibility()}>{busy ? "Procesando…" : "Confirmar"}</button>
      </div>
    </Dialog>
  </>;
}
