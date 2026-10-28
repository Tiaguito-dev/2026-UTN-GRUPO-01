"use client";
import Link from "next/link";
import { useId, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { BookOpen, ChevronDown, LoaderCircle, Send } from "lucide-react";
import { obtenerComision, type ComisionDetalle } from "@/services/academic";
import { actualizarFeedback, crearFeedback, obtenerFeedback, obtenerFeedbackPropio } from "@/services/feedback";
import type { Feedback } from "@/types/feedback";
import type { ModalidadMateria } from "@/types/materias";
import { useAuth } from "@/hooks/useAuth";
import { useFormSubmission } from "@/hooks/useFormSubmission";
import { PageHeader } from "@/components/ui/PageHeader";
import { Notice } from "@/components/ui/Notice";
import { Dialog } from "@/components/ui/Dialog";
import { cargoLabel } from "@/validations/materias";
import { diferenciasFeedback, feedbackComisionHref, feedbackDetalleHref, feedbackOriginParams, feedbackSuccessHref, MAX_TEXTO_FEEDBACK, validarTextoFeedback } from "@/validations/feedback";
import { useFeedbackResource } from "./useFeedbackResource";
import styles from "./feedback.module.css";

interface FormResource { comision: ComisionDetalle | null; feedback: Feedback | null; propio: Feedback | null }

function contextPeriod(anio: number, modalidad: ModalidadMateria | null | undefined) {
  if (modalidad === "PRIMERO") return `1.er cuatrimestre de ${anio}`;
  if (modalidad === "SEGUNDO") return `2.º cuatrimestre de ${anio}`;
  return modalidad === "ANUAL" ? `Anual · ${anio}` : `Cursada ${anio}`;
}

export function FeedbackForm({ feedbackId, comisionId }: { feedbackId?: string; comisionId?: string }) {
  const headingId = useId();
  const params = useSearchParams();
  const resource = useFeedbackResource<FormResource>(`form:${feedbackId ?? ""}:${comisionId ?? ""}`, async () => {
    if (feedbackId) {
      const feedback = await obtenerFeedback(feedbackId);
      const comision = await obtenerComision(feedback.contexto.comisionId);
      return { comision, feedback, propio: feedback };
    }
    if (!comisionId) throw new Error("Elegí una comisión desde Materias para compartir tu experiencia.");
    const [comision, propio] = await Promise.all([obtenerComision(comisionId), obtenerFeedbackPropio(comisionId)]);
    return { comision, feedback: null, propio };
  });
  const context = resource.data?.feedback?.contexto;
  const comision = resource.data?.comision;
  const origin = feedbackOriginParams(params);
  const commissionHref = comision ? `${comisionHref(comision)}${origin.size ? `?${origin}` : ""}` : "/home/materias";
  const backHref = feedbackId ? feedbackDetalleHref(feedbackId) : commissionHref;
  const period = comision?.cursada.cuatrimestre;
  const modalidad = context ? context.modalidad ?? context.cuatrimestre : period !== undefined ? period : comision?.cursada.materia.modalidad;
  return <section className={styles.editorPage} aria-labelledby={headingId}>
    <header className={styles.editorHeader}>
      <PageHeader id={headingId} title={feedbackId ? "Editar comentario" : "Compartir mi experiencia"} focusKey={feedbackId ?? comisionId}
        back={{ href: backHref, label: feedbackId ? "Comentario" : "Comisión" }}
        breadcrumb={[{ label: "Materias", href: "/home/materias" }, ...(comision ? [{ label: `Comisión ${comision.nombre}`, href: commissionHref }] : []), { label: feedbackId ? "Editar comentario" : "Compartir experiencia" }]} />
    </header>
    {resource.error ? <Notice tone="error">{resource.error} {!resource.notFound ? <button className="button" type="button" onClick={resource.retry}>Reintentar</button> : null}</Notice> : null}
    {resource.loading ? <p role="status">Cargando formulario…</p> : null}
    {resource.data && comision ? <>
      <div className={styles.editorContext}>
        <BookOpen size={18} strokeWidth={1.75} aria-hidden="true" focusable="false" />
        <div><strong>{context?.materiaNombre ?? comision.cursada.materia.nombre}</strong><p>Comisión {context?.nombre ?? comision.nombre} · {contextPeriod(context?.anio ?? comision.cursada.anio, modalidad)}</p></div>
      </div>
      {!comision.activa ? <Notice tone="warning">Esta comisión está inactiva. No se pueden publicar ni editar comentarios.</Notice>
        : feedbackId && !resource.data.feedback?.propio ? <Notice tone="error">Solo podés editar tus propios comentarios.</Notice>
        : !feedbackId && resource.data.propio ? <Notice tone="warning">Ya tenés un comentario vigente en esta comisión. <Link href={feedbackDetalleHref(resource.data.propio.id)}>Ver mi comentario</Link></Notice>
        : <FeedbackEditor key={feedbackId ?? comision.id} comision={comision} original={resource.data.feedback} cancelHref={backHref} />}
    </> : null}
  </section>;
}

function comisionHref(comision: ComisionDetalle) {
  return feedbackComisionHref({ comisionId: comision.id, nombre: comision.nombre, materiaId: comision.cursada.materia.id, materiaNombre: comision.cursada.materia.nombre, cursadaId: comision.cursada.id, anio: comision.cursada.anio, cuatrimestre: null, modalidad: comision.cursada.materia.modalidad ?? null });
}

function FeedbackEditor({ comision, original, cancelHref }: { comision: ComisionDetalle; original: Feedback | null; cancelHref: string }) {
  const router = useRouter();
  const { account } = useAuth();
  const textId = useId();
  const identityId = useId();
  const profesorId = useId();
  const initialTarget = comision.profesores.length === 1 ? comision.profesores[0].id : "";
  const [texto, setTexto] = useState(original?.texto ?? "");
  const [anonimo, setAnonimo] = useState(original?.anonimo ?? false);
  const [target, setTarget] = useState(initialTarget);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const count = Array.from(texto.trim()).length;
  const dirty = texto !== (original?.texto ?? "") || anonimo !== (original?.anonimo ?? false) || (!original && target !== initialTarget);
  const publicName = account?.displayName?.trim() || "Nombre público no disponible";
  const targets = comision.profesores.length === 1
    ? [{ value: comision.profesores[0].id, title: comision.profesores[0].nombreCompleto, description: cargoLabel(comision.profesores[0].cargo) }]
    : [{ value: "", title: "La comisión en general", description: "La experiencia de cursar en esta comisión" }, ...comision.profesores.map((profesor) => ({ value: profesor.id, title: profesor.nombreCompleto, description: cargoLabel(profesor.cargo) }))];
  const { busy, errors, error, success, setSuccess, handleSubmit } = useFormSubmission({
    fields: ["texto", "anonimo", "profesorId"] as const,
    validate: (values) => {
      const textError = validarTextoFeedback(values.texto);
      return textError ? { texto: textError } : {};
    },
    fallbackError: "Lo sentimos. No pudimos guardar tu comentario, intentá nuevamente.",
    onSubmit: async (values) => {
      const text = values.texto.trim();
      const anonymous = values.anonimo === "true";
      if (original) {
        const changes = diferenciasFeedback(original, { texto: text, anonimo: anonymous });
        if (Object.keys(changes).length === 0) { setSuccess("No hay cambios para guardar."); return; }
        await actualizarFeedback(original.id, changes);
        router.push(feedbackSuccessHref(feedbackDetalleHref(original.id), "El comentario se actualizó correctamente."));
      } else {
        await crearFeedback(comision.id, { texto: text, anonimo: anonymous, ...(comision.profesores.length === 1 ? {} : { profesorId: values.profesorId || null }) });
        router.push(feedbackSuccessHref(cancelHref, "El comentario se publicó correctamente."));
      }
    },
  });
  function cancel() {
    if (busy) return;
    if (dirty) setConfirmCancel(true);
    else router.push(cancelHref);
  }
  return <>
    <div className={styles.editorSurface}><form onSubmit={handleSubmit} noValidate className={styles.editorForm} aria-busy={busy}>
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
      <div className="dialog-actions"><button className="button button-secondary" type="button" onClick={() => setConfirmCancel(false)} data-autofocus>Seguir escribiendo</button><button className="button" type="button" onClick={() => router.push(cancelHref)}>Descartar y volver</button></div>
    </Dialog>
  </>;
}
