"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { crearMateria, actualizarMateria } from "@/services/materias";
import type { Materia, MateriaInput } from "@/types/materias";
import { MAX_NOMBRE_MATERIA, validateNombre } from "@/validations/academic";
import { ANIOS_CARRERA, anioCarreraLabel, isAnioCarrera, NIVELES_ELECTIVA, isNivelElectiva, nivelElectivaLabel, parseMateriaContext, materiaListHref, parseMateriaPage } from "@/validations/materias";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { Card } from "@/components/ui/Card";
import { Notice } from "@/components/ui/Notice";
import { SELECT_PLACEHOLDER } from "@/lib/messages";

export function MateriaForm({ materia, detailHref }: { materia?: Materia; detailHref?: string }) {
  const router = useRouter();
  const submitting = useRef(false);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [selectedYear, setSelectedYear] = useState(materia?.anioCarrera ?? "");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const rawNombre = String(data.get("nombre") ?? "");
    const nombre = rawNombre.trim();
    const anioCarrera = data.get("anioCarrera");
    const rawNivel = data.get("nivelElectiva");
    const nivelElectiva = anioCarrera === "ELECTIVA" && isNivelElectiva(rawNivel) ? rawNivel : null;
    const nextErrors: Record<string, string> = {};
    const issue = validateNombre(rawNombre, MAX_NOMBRE_MATERIA);
    if (issue) nextErrors.nombre = issue;
    if (!isAnioCarrera(anioCarrera)) nextErrors.anioCarrera = "Elegí un año entre 1 y 5 o Electiva.";
    if (anioCarrera === "ELECTIVA" && !isNivelElectiva(rawNivel)) nextErrors.nivelElectiva = "Elegí el nivel 3, 4 o 5 de la electiva.";
    setErrors(nextErrors); setError(""); setNotice("");
    if (Object.keys(nextErrors).length || !isAnioCarrera(anioCarrera)) { form.querySelector<HTMLElement>(`[name="${Object.keys(nextErrors)[0]}"]`)?.focus(); return; }
    const input: MateriaInput = { nombre, anioCarrera, ...(nivelElectiva ? { nivelElectiva } : {}) };
    const changes: Partial<MateriaInput> = {};
    if (materia?.nombre !== nombre) changes.nombre = nombre;
    if (materia?.anioCarrera !== anioCarrera) changes.anioCarrera = anioCarrera;
    if (materia && (materia.nivelElectiva ?? null) !== nivelElectiva) changes.nivelElectiva = nivelElectiva;
    if (materia && !Object.keys(changes).length) { setNotice("No hay cambios para guardar."); return; }
    submitting.current = true; setBusy(true);
    try {
      if (materia) await actualizarMateria(materia.id, changes); else await crearMateria(input);
      const target = materia ? detailHref ?? `/home/materias/${encodeURIComponent(materia.id)}` : "/home/materias";
      const message = materia ? "Materia actualizada correctamente." : `Materia creada: ${nombre}.`;
      router.push(`${target}${target.includes("?") ? "&" : "?"}successMessage=${encodeURIComponent(message)}`);
    } catch (failure) { setError(`Lo sentimos. No pudimos guardar la materia. ${failure instanceof Error ? failure.message : "Intentá nuevamente."}`); }
    finally { submitting.current = false; setBusy(false); }
  }
  const listContext = new URL(detailHref ?? "/home/materias", "https://local.invalid").searchParams;
  const listYear = listContext.get("anioCarrera");
  const backList = materiaListHref(isAnioCarrera(listYear) ? listYear : undefined, parseMateriaPage(listContext.get("listadoPage")), parseMateriaContext(listContext));
  return <section aria-labelledby="materia-form-heading">
    <Breadcrumb items={[{ label: "Materias", href: backList }, { label: materia ? "Editar materia" : "Nueva materia" }]} />
    <h1 id="materia-form-heading">{materia ? "Editar materia" : "Nueva materia"}</h1>
    <Card variant="panel">
      {error ? <Notice tone="error">{error}</Notice> : null}
      {notice ? <p role="status">{notice}</p> : null}
      <form onSubmit={submit} noValidate aria-busy={busy}>
        <div className="field"><label htmlFor="nombre">Nombre de la materia</label><input id="nombre" name="nombre" defaultValue={materia?.nombre ?? ""} maxLength={MAX_NOMBRE_MATERIA} required aria-invalid={Boolean(errors.nombre)} aria-describedby={errors.nombre ? "nombre-error" : undefined} />{errors.nombre ? <p id="nombre-error" className="field-error">{errors.nombre}</p> : null}</div>
        <div className="field"><label htmlFor="anioCarrera">Año de la carrera</label><select id="anioCarrera" name="anioCarrera" value={selectedYear} onChange={(event) => setSelectedYear(event.target.value)} required aria-invalid={Boolean(errors.anioCarrera)} aria-describedby={errors.anioCarrera ? "anioCarrera-error" : undefined}>
          <option value="">{SELECT_PLACEHOLDER}</option>{ANIOS_CARRERA.map((anio) => <option key={anio} value={anio}>{anioCarreraLabel(anio)}</option>)}
        </select>{errors.anioCarrera ? <p id="anioCarrera-error" className="field-error">{errors.anioCarrera}</p> : null}</div>
        {selectedYear === "ELECTIVA" ? <div className="field"><label htmlFor="nivelElectiva">Nivel de electiva</label><select id="nivelElectiva" name="nivelElectiva" defaultValue={materia?.nivelElectiva ?? ""} required aria-invalid={Boolean(errors.nivelElectiva)} aria-describedby={errors.nivelElectiva ? "nivelElectiva-error" : undefined}><option value="">Elegí un nivel</option>{NIVELES_ELECTIVA.map((nivel) => <option key={nivel} value={nivel}>{nivelElectivaLabel(nivel)}</option>)}</select>{errors.nivelElectiva ? <p id="nivelElectiva-error" className="field-error">{errors.nivelElectiva}</p> : null}</div> : null}
        <button className="button submit" disabled={busy}>{busy ? "Guardando…" : materia ? "Guardar cambios" : "Crear materia"}</button>
      </form>
    </Card>
    <div className="form-links"><Link href={detailHref ?? "/home/materias"}>Volver</Link></div>
  </section>;
}
