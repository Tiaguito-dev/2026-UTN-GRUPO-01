"use client";

import { useId, useRef, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Notice } from "@/components/ui/Notice";
import { useFormSubmission } from "@/hooks/useFormSubmission";
import { CATEGORIA_SUGERENCIA_LABEL } from "@/lib/format/sugerencia";
import { registrarSugerencia } from "@/services/comunidad";
import { HttpError } from "@/services/http";
import { CATEGORIAS_SUGERENCIA, type SugerenciaInput } from "@/types/comunidad";
import { esCategoriaSugerencia, MAX_CONTENIDO_SUGERENCIA, validarSugerencia } from "@/validations/sugerencia";
import styles from "./SugerenciaForm.module.css";

const SUCCESS = "¡Gracias por tu sugerencia! Tu opinión nos ayuda a seguir mejorando Professors' Butchery.";
const NEW_ATTEMPT = "Para enviar otro contenido, elegí Nueva sugerencia.";

/** No guarda borradores privados en storage ni agrega una lectura pública de los envíos. */
export function SugerenciaForm() {
  const id = useId();
  const [categoria, setCategoria] = useState("");
  const [contenido, setContenido] = useState("");
  const attempt = useRef<SugerenciaInput | null>(null);
  const [hasAttempt, setHasAttempt] = useState(false);
  const { busy, errors, error, success, setError, setSuccess, handleSubmit, handleChange } = useFormSubmission({
    fields: ["categoria", "contenido"] as const,
    validate: validarSugerencia,
    fallbackError: "No pudimos enviar tu sugerencia. Intentá nuevamente.",
    onSubmit: async values => {
      if (!esCategoriaSugerencia(values.categoria)) return;
      const text = values.contenido.trim();
      if (attempt.current && (attempt.current.categoria !== values.categoria || attempt.current.contenido !== text)) throw new Error(NEW_ATTEMPT);
      if (!attempt.current) attempt.current = { solicitudId: crypto.randomUUID(), categoria: values.categoria, contenido: text };
      setHasAttempt(true);
      try { await registrarSugerencia(attempt.current); }
      catch (failure) {
        if (failure instanceof HttpError && failure.status === 409) throw new Error(NEW_ATTEMPT);
        throw new Error("No pudimos enviar tu sugerencia. Intentá nuevamente.");
      }
      attempt.current = null;
      setHasAttempt(false);
      setCategoria(""); setContenido("");
      setSuccess(SUCCESS);
    },
  });

  return <Card variant="panel" as="section" aria-labelledby={`${id}-title`}>
    <h2 className={styles.title} id={`${id}-title`}>Dale una sugerencia a los creadores.</h2>
    <p className={styles.description}>Tu opinión nos ayuda a mejorar la plataforma. Contanos qué podemos hacer mejor.</p>
    <form className={styles.form} onSubmit={handleSubmit} onChange={handleChange} noValidate aria-busy={busy}>
      {error ? <Notice tone="error" focusOnShow>{error}</Notice> : null}
      {success ? <Notice tone="success">{success}</Notice> : null}
      <div>
        <label htmlFor={`${id}-categoria`}>Categoría</label>
        <select id={`${id}-categoria`} name="categoria" value={categoria} required disabled={busy} aria-invalid={Boolean(errors.categoria)}
          aria-describedby={errors.categoria ? `${id}-categoria-error` : undefined} onChange={event => setCategoria(event.target.value)}>
          <option value="">Elegí una categoría</option>
          {CATEGORIAS_SUGERENCIA.map(value => <option value={value} key={value}>{CATEGORIA_SUGERENCIA_LABEL[value]}</option>)}
        </select>
        {errors.categoria ? <p className="field-error" id={`${id}-categoria-error`}>{errors.categoria}</p> : null}
      </div>
      <div>
        <label htmlFor={`${id}-contenido`}>Sugerencia</label>
        <textarea className={styles.textarea} id={`${id}-contenido`} name="contenido" value={contenido} required rows={7} disabled={busy}
          maxLength={MAX_CONTENIDO_SUGERENCIA} aria-invalid={Boolean(errors.contenido)}
          aria-describedby={[`${id}-count`, `${id}-privacy`, errors.contenido ? `${id}-contenido-error` : ""].filter(Boolean).join(" ")}
          onChange={event => setContenido(event.target.value)} />
        <p className={styles.count} id={`${id}-count`}>{contenido.length} / {MAX_CONTENIDO_SUGERENCIA} caracteres</p>
        {errors.contenido ? <p className="field-error" id={`${id}-contenido-error`}>{errors.contenido}</p> : null}
      </div>
      <p className={styles.privacy} id={`${id}-privacy`}>Solo los administradores podrán leer tu sugerencia.</p>
      <button className="button" type="submit" disabled={busy} aria-busy={busy}>{busy ? "Enviando…" : "Enviar sugerencia"}</button>
      {hasAttempt && !busy ? <div className={styles.retry}>
        <p>El intento anterior podría haberse registrado. Reintentá sin cambiar los datos para evitar duplicados. Para enviar otro contenido, elegí Nueva sugerencia.</p>
        <button className="button button-secondary" type="button" disabled={busy} onClick={() => { attempt.current = null; setHasAttempt(false); setError(""); setSuccess(""); }}>Nueva sugerencia</button>
      </div> : null}
    </form>
  </Card>;
}
