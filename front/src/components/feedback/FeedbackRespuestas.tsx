"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { usePaginatedFetch } from "@/hooks/usePaginatedFetch";
import { Notice } from "@/components/ui/Notice";
import { Dialog } from "@/components/ui/Dialog";
import { Pagination } from "@/components/ui/Pagination";
import { listarRespuestasFeedback, eliminarRespuestaFeedback } from "@/services/feedback-feed";
import { HttpError } from "@/services/http";
import type { FeedbackRespuesta } from "@/types/feedback-feed";
import { FeedbackRespuestaForm } from "./FeedbackRespuestaForm";
import styles from "./FeedPrincipal.module.css";
export function FeedbackRespuestas({ feedbackId, onCount, onUnavailable, unavailable = false }: {
  feedbackId: string; onCount: (count: number) => void; onUnavailable: () => void; unavailable?: boolean;
}) {
  const [page, setPage] = useState(1); const [version, setVersion] = useState(0); const [editing, setEditing] = useState<{ reply: FeedbackRespuesta; token: number } | null>(null);
  const editSequence = useRef(0);
  const { state, retry } = usePaginatedFetch(`replies:${feedbackId}:${unavailable}`, next => unavailable ? Promise.resolve({ items: [], total: 0, page: 1, pageSize: 20 }) : listarRespuestasFeedback(feedbackId, { page: next, pageSize: 20 }), page, version);
  useEffect(() => {
    if (unavailable) return;
    if (state.status === "ready") onCount(state.data.total);
    if (state.status === "error" && state.notFound) onUnavailable();
  }, [state, onCount, onUnavailable, unavailable]);
  const changed = useCallback(() => { setPage(1); setVersion(value => value + 1); }, []);
  return <div className={styles.replies}>
    <h3>Respuestas</h3>
    {!unavailable ? state.status === "loading" ? <p role="status">Cargando respuestas…</p> : state.status === "error" ? <Notice tone="error">{state.error} <button className="button button-secondary" type="button" onClick={retry}>Reintentar respuestas</button></Notice> : <>
      {state.data.items.length ? <ul className={styles.replyList}>{state.data.items.map(reply => <li key={reply.id}><Respuesta reply={reply} onChanged={changed} onEdit={() => setEditing({ reply, token: ++editSequence.current })} onUnavailable={changed} /></li>)}</ul> : <p role="status">Todavía no hay respuestas.</p>}
      <Pagination page={page} pageSize={state.data.pageSize} total={state.data.total} onChange={setPage} />
    </> : null}
    {editing ? <div><FeedbackRespuestaForm key={`${editing.reply.id}:${editing.token}`} feedbackId={feedbackId} original={editing.reply} unavailable={unavailable} onUnavailable={changed} onSaved={() => { setEditing(current => current?.token === editing.token ? null : current); changed(); }} /><button className="button button-secondary" type="button" onClick={() => setEditing(null)}>Cancelar edición</button></div> : null}
    <FeedbackRespuestaForm feedbackId={feedbackId} unavailable={unavailable} onUnavailable={changed} onSaved={changed} />
  </div>;
}
function Respuesta({ reply, onChanged, onEdit, onUnavailable }: { reply: FeedbackRespuesta; onChanged: () => void; onEdit: () => void; onUnavailable: () => void }) {
  const [confirm, setConfirm] = useState(false); const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const pending = useRef(false);
  async function remove() {
    if (pending.current || !reply.propio) return;
    pending.current = true; setBusy(true); setError("");
    try { await eliminarRespuestaFeedback(reply.id); setConfirm(false); onChanged(); }
    catch (failure) { if (failure instanceof HttpError && failure.status === 404) onUnavailable(); setError(failure instanceof Error ? failure.message : "No pudimos eliminar la respuesta."); }
    finally { pending.current = false; setBusy(false); }
  }
  const author = reply.anonimo ? "Anónimo" : reply.autor?.displayName ?? "Usuario";
  return <article className={styles.replyCard} aria-label={`Respuesta de ${author}`}>
    <p className={styles.replyMeta}><strong>{author}</strong> <time dateTime={reply.createdAt}>{new Date(reply.createdAt).toLocaleString("es-AR")}</time>{reply.updatedAt !== reply.createdAt ? " · Editada" : ""}</p>
    <p className={styles.replyText}>{reply.texto}</p>
    {reply.propio ? <div className={styles.replyActions}><button className="button button-secondary" type="button" disabled={busy} onClick={onEdit}>Editar respuesta</button><button className="button button-secondary" type="button" disabled={busy} onClick={() => setConfirm(true)}>Eliminar respuesta</button></div> : null}
    {confirm ? <Dialog open title="Eliminar respuesta" busy={busy} onClose={() => setConfirm(false)}>
      <p>¿Querés eliminar tu respuesta?</p>{error ? <Notice tone="error">{error}</Notice> : null}
      <button className="button button-secondary" type="button" disabled={busy} onClick={() => setConfirm(false)}>Cancelar</button><button className="button" type="button" disabled={busy} onClick={() => void remove()}>Confirmar eliminación</button>
    </Dialog> : null}
  </article>;
}
