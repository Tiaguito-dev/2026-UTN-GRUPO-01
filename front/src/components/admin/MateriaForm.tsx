"use client";

import { useRef, useState, type FormEvent } from "react";
import { crearMateria, actualizarMateria } from "@/services/materias";
import type { Carrera, Materia, MateriaCarrera, MateriaInput } from "@/types/materias";
import { MAX_NOMBRE_MATERIA, validateNombre } from "@/validations/academic";
import {
  ANIOS_CARRERA,
  CARRERAS,
  anioCarreraLabel,
  carreraLabel,
  isAnioCarrera,
  isCarrera,
  NIVELES_ELECTIVA,
  isNivelElectiva,
  nivelElectivaLabel,
  MODALIDADES_MATERIA,
  isModalidadMateria,
  modalidadLabel,
} from "@/validations/materias";
import { Notice } from "@/components/ui/Notice";
import { SELECT_PLACEHOLDER } from "@/lib/messages";

export function MateriaForm({
  materia,
  onSuccess,
  onCancel,
  onBusyChange,
}: {
  materia?: Materia;
  onSuccess: (materia: Materia) => void;
  onCancel?: () => void;
  /** Inside a Dialog, its `busy` follows the submission (TASK-043). */
  onBusyChange?: (busy: boolean) => void;
}) {
  const submitting = useRef(false);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [selectedCarreras, setSelectedCarreras] = useState<Carrera[]>(
    materia ? materia.carreras.map((c) => c.carrera) : []
  );
  const [selectedYear, setSelectedYear] = useState(materia?.carreras[0]?.anioCarrera ?? "");
  const [selectedNivel, setSelectedNivel] = useState(materia?.carreras[0]?.nivelElectiva ?? "");
  const [selectedModalidad, setSelectedModalidad] = useState(materia?.modalidad ?? "");

  const aniosDistintos = materia
    ? new Set(materia.carreras.map((c) => `${c.anioCarrera}:${c.nivelElectiva ?? ""}`)).size > 1
    : false;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const rawNombre = String(data.get("nombre") ?? "");
    const nombre = rawNombre.trim();
    const modalidad = data.get("modalidad");
    const anioCarrera = data.get("anioCarrera");
    const rawNivel = data.get("nivelElectiva");
    const nivelElectiva = anioCarrera === "ELECTIVA" && isNivelElectiva(rawNivel) ? rawNivel : null;

    const nextErrors: Record<string, string> = {};
    const issue = validateNombre(rawNombre, MAX_NOMBRE_MATERIA);
    if (issue) nextErrors.nombre = issue;
    if (!isModalidadMateria(modalidad)) nextErrors.modalidad = "Elegí la modalidad de la materia.";
    if (selectedCarreras.length === 0) nextErrors.carreras = "Elegí al menos una carrera.";
    if (!isAnioCarrera(anioCarrera)) nextErrors.anioCarrera = "Elegí un año entre 1 y 5 o Electiva.";
    if (anioCarrera === "ELECTIVA" && !isNivelElectiva(rawNivel)) {
      nextErrors.nivelElectiva = "Elegí el nivel 3, 4 o 5 de la electiva.";
    }

    setErrors(nextErrors);
    setError("");
    setNotice("");
    if (Object.keys(nextErrors).length || !isAnioCarrera(anioCarrera) || !isModalidadMateria(modalidad)) {
      const firstKey = Object.keys(nextErrors)[0];
      if (firstKey === "carreras") form.querySelector<HTMLElement>('select[name="carreras"]')?.focus();
      else form.querySelector<HTMLElement>(`[name="${firstKey}"]`)?.focus();
      return;
    }

    const relationFieldsChanged = !materia || selectedYear !== materia.carreras[0]?.anioCarrera
      || nivelElectiva !== (materia.carreras[0]?.nivelElectiva ?? null)
      || [...selectedCarreras].sort().join(",") !== materia.carreras.map((row) => row.carrera).sort().join(",");
    const carrerasInput: MateriaCarrera[] = materia && !relationFieldsChanged ? materia.carreras : selectedCarreras.map((carrera) => ({
      carrera,
      anioCarrera,
      nivelElectiva,
    }));
    const input: MateriaInput = { nombre, modalidad, carreras: carrerasInput };
    const changes: Partial<MateriaInput> = {};
    if (materia?.nombre !== nombre) changes.nombre = nombre;
    if (materia?.modalidad !== modalidad) changes.modalidad = modalidad;

    const prevSerialized = materia?.carreras
      .map((c) => `${c.carrera}:${c.anioCarrera}:${c.nivelElectiva ?? ""}`)
      .sort()
      .join(",");
    const nextSerialized = carrerasInput
      .map((c) => `${c.carrera}:${c.anioCarrera}:${c.nivelElectiva ?? ""}`)
      .sort()
      .join(",");
    if (materia && prevSerialized !== nextSerialized) {
      changes.carreras = carrerasInput;
    }

    if (materia && !Object.keys(changes).length) {
      setNotice("No hay cambios para guardar.");
      return;
    }

    submitting.current = true;
    setBusy(true);
    onBusyChange?.(true);
    try {
      const result = materia ? await actualizarMateria(materia.id, changes) : await crearMateria(input);
      onSuccess(result);
    } catch (failure) {
      setError(`Lo sentimos. No pudimos guardar la materia. ${failure instanceof Error ? failure.message : "Intentá nuevamente."}`);
    } finally {
      submitting.current = false;
      setBusy(false);
      onBusyChange?.(false);
    }
  }

  // BUG-03: a field that changes drops its own error; the change event bubbles to the form.
  // Changing Año also drops the nivel error: that field hides and must not reappear stale.
  function clearError(event: FormEvent<HTMLFormElement>) {
    const name = (event.target as { name?: string }).name;
    const names = name === "anioCarrera" ? [name, "nivelElectiva"] : name ? [name] : [];
    if (names.length) setErrors((current) => {
      if (!names.some((key) => key in current)) return current;
      const next = { ...current };
      for (const key of names) delete next[key];
      return next;
    });
  }

  return (
    <>
      {aniosDistintos ? (
        <Notice tone="warning">
          Esta materia tiene años distintos según la carrera. Si modificás las carreras o el año, todas usarán el año elegido.
        </Notice>
      ) : null}
      {error ? <Notice tone="error" focusOnShow>{error}</Notice> : null}
      {notice ? <p role="status">{notice}</p> : null}
      <form onSubmit={submit} onChange={clearError} noValidate aria-busy={busy}>
        <div className="field">
          <label htmlFor="nombre">Nombre de la materia</label>
          <input
            id="nombre"
            name="nombre"
            defaultValue={materia?.nombre ?? ""}
            maxLength={MAX_NOMBRE_MATERIA}
            required
            aria-invalid={Boolean(errors.nombre)}
            aria-describedby={errors.nombre ? "nombre-error" : undefined}
          />
          {errors.nombre ? <p id="nombre-error" className="field-error">{errors.nombre}</p> : null}
        </div>
        <div className="field">
          <label htmlFor="modalidad">Modalidad</label>
          <select id="modalidad" name="modalidad" value={selectedModalidad} onChange={(event) => setSelectedModalidad(event.target.value)} required aria-invalid={Boolean(errors.modalidad)} aria-describedby={`modalidad-hint${errors.modalidad ? " modalidad-error" : ""}`}>
            <option value="">{SELECT_PLACEHOLDER}</option>
            {MODALIDADES_MATERIA.map((value) => <option key={value} value={value}>{modalidadLabel(value)}</option>)}
          </select>
          <p id="modalidad-hint" className="hint">Puede ser anual o cuatrimestral, también para materias electivas. La cursada identifica el año.</p>
          {errors.modalidad ? <p id="modalidad-error" className="field-error">{errors.modalidad}</p> : null}
        </div>
        <div className="field">
          <label htmlFor="carreras">Carreras</label>
          <select id="carreras" name="carreras" multiple size={5} value={selectedCarreras} required aria-invalid={Boolean(errors.carreras)} aria-describedby={`carreras-hint${errors.carreras ? " carreras-error" : ""}`} onChange={(event) => setSelectedCarreras(Array.from(event.currentTarget.selectedOptions, (option) => option.value).filter(isCarrera))}>
            {CARRERAS.map((carrera) => <option key={carrera} value={carrera}>{carrera} — {carreraLabel(carrera)}</option>)}
          </select>
          <p id="carreras-hint" className="hint">Podés seleccionar varias carreras con Ctrl (Windows), Comando (Mac) o Shift para un rango.</p>
          {errors.carreras ? <p id="carreras-error" className="field-error">{errors.carreras}</p> : null}
        </div>
        <div className="field">
          <label htmlFor="anioCarrera">Año de la carrera</label>
          <select
            id="anioCarrera"
            name="anioCarrera"
            value={selectedYear}
            onChange={(event) => setSelectedYear(event.target.value)}
            required
            aria-invalid={Boolean(errors.anioCarrera)}
            aria-describedby={errors.anioCarrera ? "anioCarrera-error" : undefined}
          >
            <option value="">{SELECT_PLACEHOLDER}</option>
            {ANIOS_CARRERA.map((anio) => (
              <option key={anio} value={anio}>{anioCarreraLabel(anio)}</option>
            ))}
          </select>
          {errors.anioCarrera ? <p id="anioCarrera-error" className="field-error">{errors.anioCarrera}</p> : null}
        </div>
        {selectedYear === "ELECTIVA" ? (
          <div className="field">
            <label htmlFor="nivelElectiva">Nivel de electiva</label>
            <select
              id="nivelElectiva"
              name="nivelElectiva"
              value={selectedNivel}
              onChange={(e) => setSelectedNivel(e.target.value)}
              required
              aria-invalid={Boolean(errors.nivelElectiva)}
              aria-describedby={errors.nivelElectiva ? "nivelElectiva-error" : undefined}
            >
              <option value="">Elegí un nivel</option>
              {NIVELES_ELECTIVA.map((nivel) => (
                <option key={nivel} value={nivel}>{nivelElectivaLabel(nivel)}</option>
              ))}
            </select>
            {errors.nivelElectiva ? <p id="nivelElectiva-error" className="field-error">{errors.nivelElectiva}</p> : null}
          </div>
        ) : null}
        <div className={onCancel ? "dialog-actions" : undefined}>
          {onCancel ? (
            <button type="button" className="button button-secondary" onClick={onCancel}>
              Cancelar
            </button>
          ) : null}
          <button className={`button ${onCancel ? "" : "submit"}`} disabled={busy}>
            {busy ? "Guardando…" : materia ? "Guardar cambios" : "Crear materia"}
          </button>
        </div>
      </form>
    </>
  );
}
