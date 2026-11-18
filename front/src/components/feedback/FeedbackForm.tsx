"use client";
import Link from "next/link";
import { useId, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { BookOpen, ChevronDown, LoaderCircle, Send } from "lucide-react";
import { obtenerComision, type ComisionDetalle } from "@/services/academic";
import { actualizarFeedback, crearFeedback, obtenerFeedback, obtenerFeedbackPropio } from "@/services/feedback";
import { mensajeErrorModeracion } from "@/validations/feedback-moderation";
import { FeedbackModerationStatus } from "./FeedbackModerationStatus";
import { HttpError } from "@/services/http";
import type { Feedback } from "@/types/feedback";
import type { ModalidadMateria } from "@/types/materias";
import { useAuth } from "@/hooks/useAuth";
import { useFormSubmission } from "@/hooks/useFormSubmission";
import { PageHeader } from "@/components/ui/PageHeader";
import { Notice } from "@/components/ui/Notice";
import { Dialog } from "@/components/ui/Dialog";
import { cargoLabel } from "@/validations/materias";
import { diferenciasFeedback, feedbackDetalleHref, feedbackNavigation, feedbackSuccessHref, MAX_TEXTO_FEEDBACK, validarTextoFeedback, validarPuntuacionFeedback } from "@/validations/feedback";
import { SelectorEstrellas } from "./SelectorEstrellas";
import { useFeedbackDraft } from "./FeedbackDraftProvider";
import { useFeedbackResource } from "./useFeedbackResource";
import styles from "./feedback.module.css";

type EditorComision = Pick<ComisionDetalle, "id" | "cursadaId" | "nombre" | "activa" | "profesores" | "cursada">;
interface FormResource { comision: EditorComision | null; feedback: Feedback | null; propio: Feedback | null }

function contextPeriod(anio: number, modalidad: ModalidadMateria | null | undefined) {
  if (modalidad === "PRIMERO") return `1.er cuatrimestre de ${anio}`;
  if (modalidad === "SEGUNDO") return `2.º cuatrimestre de ${anio}`;
  return modalidad === "ANUAL" ? `Anual · ${anio}` : `Cursada ${anio}`;
}

export function FeedbackForm({ feedbackId, comisionId }: { feedbackId?: string; comisionId?: string }) {
  const headingId = useId();
  const { account } = useAuth();
  const params = useSearchParams();
  const resource = useFeedbackResource<FormResource>(`form:${account?.id ?? ""}:${feedbackId ?? ""}:${comisionId ?? ""}`, async () => {
    if (feedbackId) {
      const feedback = await obtenerFeedback(feedbackId);
      const snapshot = feedback.contexto;
      const comision: EditorComision = feedback.estadoModeracion === "RECHAZADO" ? {
        id: snapshot.comisionId, cursadaId: snapshot.cursadaId, nombre: snapshot.nombre, activa: false,
        profesores: feedback.profesor ? [feedback.profesor] : [],
        cursada: { id: snapshot.cursadaId, anio: snapshot.anio, cuatrimestre: snapshot.cuatrimestre, materia: { id: snapshot.materiaId, nombre: snapshot.materiaNombre, modalidad: snapshot.modalidad } },
      } : await obtenerComision(snapshot.comisionId);
      return { comision, feedback, propio: feedback };
    }
    if (!comisionId) throw new Error("Elegí una comisión desde Materias para compartir tu experiencia.");
    const [comision, propio] = await Promise.all([obtenerComision(comisionId), obtenerFeedbackPropio(comisionId)]);
    return { comision, feedback: null, propio };
  });
  const context = resource.data?.feedback?.contexto;
  const comision = resource.data?.comision;
  const navigation = feedbackNavigation(context ?? (comision ? comisionContext(comision) : null), params);
  const backHref = feedbackId ? feedbackDetalleHref(feedbackId, params) : params.get("origen") === "inicio" ? navigation.back.href : navigation.commissionHref;
  const period = comision?.cursada.cuatrimestre;
  const modalidad = context ? context.modalidad ?? context.cuatrimestre : period !== undefined ? period : comision?.cursada.materia.modalidad;
  return <section className={styles.editorPage} aria-labelledby={headingId}>
    <header className={styles.editorHeader}>
      <PageHeader id={headingId} title={feedbackId ? "Editar comentario" : "Compartir mi experiencia"} focusKey={feedbackId ?? comisionId}
        back={{ href: backHref, label: feedbackId ? "tu comentario" : params.get("origen") === "inicio" ? "Inicio" : "Comisión" }}
        breadcrumb={[...navigation.items, ...(feedbackId ? [{ label: "Tu comentario", href: backHref }] : []), { label: feedbackId ? "Editar comentario" : "Compartir experiencia" }]} />
    </header>
    {resource.error ? <Notice tone="error">{resource.error} {!resource.notFound ? <button className="button" type="button" onClick={resource.retry}>Reintentar</button> : null}</Notice> : null}
    {resource.loading ? <p role="status">Cargando formulario…</p> : null}
    {resource.data && comision ? <>
      <div className={styles.editorContext}>
        <BookOpen size={18} strokeWidth={1.75} aria-hidden="true" focusable="false" />
        <div><strong>{context?.materiaNombre ?? comision.cursada.materia.nombre}</strong><p>Comisión {context?.nombre ?? comision.nombre} · {contextPeriod(context?.anio ?? comision.cursada.anio, modalidad)}</p></div>
      </div>
      {!comision.activa && resource.data.feedback?.estadoModeracion !== "RECHAZADO" ? <Notice tone="warning">Esta comisión está inactiva. No se pueden publicar ni editar comentarios.</Notice>
        : feedbackId && !resource.data.feedback?.propio ? <Notice tone="error">Solo podés editar tus propios comentarios.</Notice>
        : !feedbackId && resource.data.propio ? <Notice tone="warning">Ya tenés un comentario vigente en esta comisión. <Link href={feedbackDetalleHref(resource.data.propio.id, params)}>Ver mi comentario</Link></Notice>
        : <FeedbackEditor key={JSON.stringify([account?.id ?? null, feedbackId ?? comision.id])} comision={comision} original={resource.data.feedback} cancelHref={backHref} />}
    </> : null}
  </section>;
}

function comisionContext(comision: EditorComision) {
  return { comisionId: comision.id, nombre: comision.nombre, materiaId: comision.cursada.materia.id, materiaNombre: comision.cursada.materia.nombre, cursadaId: comision.cursada.id, anio: comision.cursada.anio, cuatrimestre: comision.cursada.cuatrimestre ?? null, modalidad: comision.cursada.cuatrimestre !== undefined ? comision.cursada.cuatrimestre : comision.cursada.materia.modalidad ?? null };
}

function FeedbackEditor({ comision, original: initialOriginal, cancelHref }: { comision: EditorComision; original: Feedback | null; cancelHref: string }) {
  const router = useRouter();
  const { account } = useAuth();
  const [original, setOriginal] = useState(initialOriginal);
  const textId = useId();
  const identityId = useId();
  const profesorId = useId();
  const initialTarget = comision.profesores.length === 1 ? comision.profesores[0].id : "";
  const draftKey = JSON.stringify([comision.cursada.materia.id, comision.cursadaId, comision.id, original?.id ?? null]);
  const { draft: { texto, anonimo, puntuacion, target }, setField, discardDraft } = useFeedbackDraft(draftKey,
    { texto: original?.texto ?? "", anonimo: original?.anonimo ?? false, puntuacion: original?.puntuacion ?? null, target: initialTarget },
    comision.profesores.length === 1 ? [initialTarget] : ["", ...comision.profesores.map(profesor => profesor.id)]);
  const setTexto = (value: string) => setField("texto", value);
  const setAnonimo = (value: boolean) => setField("anonimo", value);
  const setPuntuacion = (value: number | null) => setField("puntuacion", value);
  const setTarget = (value: string) => setField("target", value);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [currentVersion, setCurrentVersion] = useState(original?.versionModeracion);
  const [conflict, setConflict] = useState(false);
  const count = Array.from(texto.trim()).length;
  const dirty = texto !== (original?.texto ?? "") || anonimo !== (original?.anonimo ?? false) || puntuacion !== (original?.puntuacion ?? null) || (!original && target !== initialTarget);
  const requiredRating = !original || original.puntuacion !== null;
  const publicName = account?.displayName?.trim() || "Nombre público no disponible";
  const targets = comision.profesores.length === 1
    ? [{ value: comision.profesores[0].id, title: comision.profesores[0].nombreCompleto, description: cargoLabel(comision.profesores[0].cargo) }]
    : [{ value: "", title: "La comisión en general", description: "La experiencia de cursar en esta comisión" }, ...comision.profesores.map((profesor) => ({ value: profesor.id, title: profesor.nombreCompleto, description: cargoLabel(profesor.cargo) }))];
  const { busy, errors, error, success, setSuccess, handleSubmit, handleChange } = useFormSubmission({
    fields: ["texto", "anonimo", "profesorId", "puntuacion"] as const,
    validate: (values) => {
      const textError = validarTextoFeedback(values.texto);
      const ratingError = validarPuntuacionFeedback(values.puntuacion, requiredRating);
      return {
        ...(textError ? { texto: textError } : {}),
        ...(ratingError ? { puntuacion: ratingError } : {}),
      };
    },
    fallbackError: "Lo sentimos. No pudimos guardar tu comentario, intentá nuevamente.",
    onSubmit: async (values) => {
      const text = values.texto.trim();
      const anonymous = values.anonimo === "true";
      if (original) {
        const changes = diferenciasFeedback(original, { texto: text, anonimo: anonymous, puntuacion: values.puntuacion === "" ? null : Number(values.puntuacion) });
        if (Object.keys(changes).length === 0) { setSuccess("No hay cambios para guardar."); return; }
        if (currentVersion === undefined) throw new Error("Lo sentimos. No pudimos verificar la versión del comentario. Volvé al detalle y reintentá.");
        if (conflict) throw new Error("Revisá el conflicto antes de guardar tus cambios sobre la versión actual.");
        try {
          await actualizarFeedback(original.id, { ...changes, versionEsperada: currentVersion });
        } catch (failure) {
          if (failure instanceof HttpError && failure.status === 409) {
            let current: Feedback;
            try { current = await obtenerFeedback(original.id); }
            catch { throw new Error("Lo sentimos. No pudimos recuperar la versión actual. Tu borrador se conserva; volvé al detalle antes de intentar guardar nuevamente."); }
            setOriginal(current); setCurrentVersion(current.versionModeracion); setConflict(true);
          }
          throw new Error(mensajeErrorModeracion(failure));
        }
        discardDraft();
        router.push(feedbackSuccessHref(cancelHref, original.estadoModeracion === "RECHAZADO" ? "Los cambios se guardaron. La experiencia continúa rechazada hasta que solicites una nueva revisión." : "El comentario se actualizó correctamente. Está pendiente de revisión por el equipo administrativo."));
      } else {
        try {
          await crearFeedback(comision.id, {
            texto: text, anonimo: anonymous, puntuacion: Number(values.puntuacion),
            ...(comision.profesores.length === 1 ? {} : { profesorId: values.profesorId || null }),
          });
        } catch (failure) {
          throw new Error(mensajeErrorModeracion(failure));
        }
        discardDraft();
        router.push(feedbackSuccessHref("/home", "La experiencia se guardó correctamente. Tu comentario está pendiente de revisión por el equipo administrativo."));
      }
    },
  });
  function cancel() {
    if (busy) return;
    if (dirty) setConfirmCancel(true);
    else { discardDraft(); router.push(cancelHref); }
  }
  return <>
    {original ? <FeedbackModerationStatus feedback={original} /> : null}
    {conflict ? <Notice tone="warning">El comentario cambió. Tu borrador se conserva. Compará la versión actual en el detalle antes de continuar. <Link href={cancelHref} target="_blank" rel="noopener">Consultar versión actual</Link> <button className="button button-secondary" type="button" onClick={() => setConflict(false)}>Conservar mi borrador y continuar</button></Notice> : null}
    <div className={styles.editorSurface}><form onSubmit={handleSubmit} onChange={handleChange} noValidate className={styles.editorForm} aria-busy={busy}>
      {error ? <Notice tone="error" focusOnShow>{error}</Notice> : null}
      {success ? <Notice tone="success" focusOnShow>{success}</Notice> : null}
      <fieldset className={styles.editorBlock}>
        <legend>¿A quién se refiere tu comentario?</legend>
        <p className={styles.editorHelp} id={`${profesorId}-hint`}>{original ? "La referencia original se conserva al editar." : comision.profesores.length === 1 ? "Esta comisión tiene un único docente y la referencia se asigna automáticamente." : "Elegí el contexto de la experiencia que vas a compartir"}</p>
        {original ? <p className={styles.editorReference}>Referencia original: <strong>{original.profesor?.nombreCompleto ?? "la comisión en general"}</strong>.</p>
          : targets.length <= 3 ? <div className={styles.editorTargetOptions}>{targets.map((option, index) => <label className={styles.editorOption} key={option.value} htmlFor={`${profesorId}-${index}`}>
            <input id={`${profesorId}-${index}`} type="radio" name="profesorId" value={option.value} checked={target === option.value} onChange={() => setTarget(option.value)} disabled={busy} aria-describedby={`${profesorId}-hint`} />
            <strong>{option.title}</strong><span className={styles.editorOptionDescription}>{option.description}</span>
          </label>)}</div>
          : <div className={styles.editorSelect}>
            <label className="sr-only" htmlFor={profesorId}>¿A quién se refiere tu comentario?</label>
            <select id={profesorId} name="profesorId" value={target} onChange={(event) => setTarget(event.target.value)} disabled={busy} aria-describedby={`${profesorId}-hint`}>{targets.map((option) => <option key={option.value} value={option.value}>{option.title}{option.value ? ` · ${option.description}` : ""}</option>)}</select>
            <ChevronDown size={18} strokeWidth={1.75} aria-hidden="true" focusable="false" />
          </div>}
      </fieldset>
      <div className={styles.editorWriting}>
        <label htmlFor={textId}>Tu experiencia</label>
        <p id={`${textId}-prompt`} className={styles.editorHelp}>¿Cómo fueron las clases, las evaluaciones y el acompañamiento durante la cursada?</p>
        <textarea className={styles.editorTextarea} id={textId} name="texto" value={texto} onChange={(event) => setTexto(event.target.value)} required rows={8} disabled={busy}
          placeholder="Contá cómo fue cursar…" aria-invalid={Boolean(errors.texto)} aria-describedby={`${textId}-prompt ${textId}-hint ${textId}-count${errors.texto ? ` ${textId}-error` : ""}`} />
        <div className={styles.editorTextHelp}><p id={`${textId}-hint`}>Evitá incluir datos personales de otras personas</p><span id={`${textId}-count`} className={count > MAX_TEXTO_FEEDBACK ? styles.editorCounterError : count >= 2700 ? styles.editorCounterNear : undefined}>{count} / {MAX_TEXTO_FEEDBACK}</span></div>
        {errors.texto ? <p id={`${textId}-error`} className="field-error">{errors.texto}</p> : null}
      </div>
      <SelectorEstrellas value={puntuacion} onChange={setPuntuacion} disabled={busy} required={requiredRating} error={errors.puntuacion} />
      <fieldset className={`${styles.editorBlock} ${styles.editorIdentity}`}>
        <legend>Cómo aparecerá tu comentario</legend>
        <p className={styles.editorHelp}>Elegí qué identidad verán los demás estudiantes</p>
        <div className={styles.editorIdentityOptions}>
          <label className={styles.editorOption} htmlFor={`${identityId}-name`}><input id={`${identityId}-name`} type="radio" name="anonimo" value="false" checked={!anonimo} onChange={() => setAnonimo(false)} disabled={busy} aria-describedby={`${identityId}-hint`} /><strong>Con mi nombre</strong><span className={styles.editorOptionDescription}>Se mostrará: {publicName}</span></label>
          <label className={styles.editorOption} htmlFor={`${identityId}-anonymous`}><input id={`${identityId}-anonymous`} type="radio" name="anonimo" value="true" checked={anonimo} onChange={() => setAnonimo(true)} disabled={busy} aria-describedby={`${identityId}-hint`} /><strong>De forma anónima</strong><span className={styles.editorOptionDescription}>Se mostrará: Anónimo</span></label>
        </div>
        <p className={styles.editorHelp} id={`${identityId}-hint`}>{anonimo ? "Otros usuarios no verán tu nombre. Tu cuenta seguirá vinculada al comentario para que puedas administrarlo" : "Tu nombre público aparecerá junto al comentario. Después podrás administrarlo desde tu cuenta"}</p>
      </fieldset>
      <footer className={styles.editorFooter}>
        <div className={styles.editorActions}><button className="button" type="submit" disabled={busy}>{busy ? <LoaderCircle className={styles.editorSpinner} size={18} strokeWidth={1.75} aria-hidden="true" focusable="false" /> : <Send size={18} strokeWidth={1.75} aria-hidden="true" focusable="false" />}{busy ? original ? "Guardando…" : "Publicando…" : original ? "Guardar cambios" : "Publicar comentario"}</button><button className="button button-secondary" type="button" disabled={busy} onClick={cancel}>Cancelar</button></div>
        <p className={styles.editorHelp}>Podés mantener un comentario vigente por comisión</p>
      </footer>
    </form></div>
    <Dialog open={confirmCancel} onClose={() => setConfirmCancel(false)} title="Descartar cambios" description="Tenés cambios sin guardar. Si salís, se perderán." busy={busy}>
      <div className="dialog-actions"><button className="button button-secondary" type="button" onClick={() => setConfirmCancel(false)} data-autofocus>Seguir escribiendo</button><button className="button" type="button" onClick={() => { discardDraft(); router.push(cancelHref); }}>Descartar y volver</button></div>
    </Dialog>
  </>;
}
