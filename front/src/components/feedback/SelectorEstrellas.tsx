"use client";

import { useId } from "react";
import { Star } from "lucide-react";
import styles from "./feedback.module.css";

export function SelectorEstrellas({ value, onChange, disabled = false, required = true, error }: {
  value: number | null;
  onChange: (value: number) => void;
  disabled?: boolean;
  required?: boolean;
  error?: string;
}) {
  const id = useId();
  const description = `${id}-hint${error ? ` ${id}-error` : ""}`;
  return <fieldset className={styles.editorBlock} disabled={disabled} aria-invalid={Boolean(error)} aria-describedby={description}>
    <legend>Valoración de la materia</legend>
    <p id={`${id}-hint`} className={styles.editorHelp}>{required
      ? "Elegí de 1 a 5 estrellas para compartir tu valoración."
      : "Este comentario histórico no tiene estrellas. Podés conservarlo así o agregar una valoración."}</p>
    <div className={styles.starOptions}>
      {[1, 2, 3, 4, 5].map(score => <label key={score} htmlFor={`${id}-${score}`}
        className={`${styles.starOption}${value !== null && score <= value ? ` ${styles.starSelected}` : ""}`}>
        <input className={styles.starInput} id={`${id}-${score}`} type="radio" name="puntuacion" value={score}
          aria-label={score === 1 ? "1 estrella" : `${score} estrellas`} checked={value === score}
          onChange={() => onChange(score)} disabled={disabled} required={required}
          aria-describedby={description} />
        <Star size={28} strokeWidth={1.75} aria-hidden="true" focusable="false" />
      </label>)}
    </div>
    <p className={styles.editorHelp} aria-live="polite">{value === null ? "Sin seleccionar" : `${value} de 5 estrellas`}</p>
    {error ? <p className="field-error" id={`${id}-error`} role="alert">{error}</p> : null}
  </fieldset>;
}
