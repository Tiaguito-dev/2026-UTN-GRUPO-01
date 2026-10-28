"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { obtenerProfesor, actualizarProfesor, actualizarCursada, actualizarComision } from "@/services/admin-academic";
import { obtenerCursada, obtenerComision, listarMaterias, type Profesor, type CursadaDetalle, type ComisionDetalle, type Cuatrimestre } from "@/services/academic";
import { useMateria } from "@/hooks/useMateria";
import { useAllPages } from "@/hooks/useAllPages";
import { useFormSubmission } from "@/hooks/useFormSubmission";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Notice } from "@/components/ui/Notice";
import { FormField } from "@/components/ui/FormField";
import { validateNombre, validateAnio, validateNumeroComision, ANIO_MINIMO, anioMaximo, NUMERO_COMISION_MINIMO, NUMERO_COMISION_MAXIMO } from "@/validations/academic";
import { carreraLabel, isCarrera } from "@/validations/materias";
import { adminListHref, adminSuccessHref, safeAdminReturnTo, type AdminSection } from "@/validations/admin";
import { bloqueoDeOpciones, opcionesListas } from "./opciones";

function useReturnTo(section: AdminSection) { const params = useSearchParams(); return safeAdminReturnTo(params.get("returnTo")) ?? adminListHref({ seccion: section, page: 1 }); }
function EditorPage({ title, returnTo, children }: { title: string; returnTo: string; children: ReactNode }) {
  const headingId = useId();
  return <section aria-labelledby={headingId}><PageHeader id={headingId} title={title} breadcrumb={[{ label: "Administración", href: returnTo }, { label: title }]} back={{ href: returnTo, label: "listado administrativo" }} /><Card variant="panel">{children}</Card></section>;
}
function DetailEditor<T>({ id, load, children }: { id: string; load: (id: string) => Promise<T>; children: (value: T) => ReactNode }) {
  const [attempt, setAttempt] = useState(0); const [result, setResult] = useState<{ key: string; data?: T; error?: string }>(); const key = `${id}:${attempt}`;
  useEffect(() => { let active = true; load(id).then((data) => { if (active) setResult({ key, data }); }, (error: unknown) => { if (active) setResult({ key, error: error instanceof Error ? error.message : "No pudimos cargar el registro." }); }); return () => { active = false; }; }, [id, key, load]);
  const current = result?.key === key ? result : undefined;
  if (current?.error) return <Notice tone="error">{current.error} <button className="button" type="button" onClick={() => setAttempt((n) => n + 1)}>Reintentar</button></Notice>;
  if (!current?.data) return <p role="status">Cargando registro…</p>;
  return children(current.data);
}
/** FormField currently initializes selects only; keep input initialization local to these editors. */
function useInitialInputs(values: Record<string, string>) {
  const ref = useRef<HTMLFormElement>(null); const initial = useRef(values);
  useEffect(() => { for (const [name, value] of Object.entries(initial.current)) { const input = ref.current?.elements.namedItem(name); if (input instanceof HTMLInputElement) input.value = value; } }, []);
  return ref;
}
function SubmitState({ error, success }: { error: string; success: string }) { return <>{error ? <Notice tone="error" focusOnShow>{error}</Notice> : null}{success ? <Notice tone="success">{success}</Notice> : null}</>; }
function SaveActions({ busy, returnTo }: { busy: boolean; returnTo: string }) { return <div className="dialog-actions"><Link className="button button-secondary" href={returnTo}>Cancelar</Link><button className="button" disabled={busy}>{busy ? "Guardando…" : "Guardar cambios"}</button></div>; }
export function EditarProfesor({ profesorId }: { profesorId: string }) { const returnTo = useReturnTo("profesores"); return <EditorPage title="Editar profesor" returnTo={returnTo}><DetailEditor id={profesorId} load={obtenerProfesor}>{(profesor) => <ProfesorEditor key={profesor.id} profesor={profesor} returnTo={returnTo} />}</DetailEditor></EditorPage>; }
function ProfesorEditor({ profesor, returnTo }: { profesor: Profesor; returnTo: string }) {
  const router = useRouter(); const ref = useInitialInputs({ nombreCompleto: profesor.nombreCompleto });
  const { busy, errors, error, success, setSuccess, handleSubmit } = useFormSubmission({ fields: ["nombreCompleto"] as const, validate: (values) => definedIssues({ nombreCompleto: validateNombre(values.nombreCompleto, 150) }), fallbackError: "No pudimos guardar el profesor.", onSubmit: async (values) => { const nombreCompleto = values.nombreCompleto.trim(); if (nombreCompleto === profesor.nombreCompleto) { setSuccess("No hay cambios para guardar."); return; } await actualizarProfesor(profesor.id, { nombreCompleto }); router.push(adminSuccessHref(returnTo, "Profesor actualizado correctamente.")); } });
  return <><SubmitState error={error} success={success} /><form ref={ref} onSubmit={handleSubmit} noValidate aria-busy={busy}><FormField name="nombreCompleto" label="Nombre completo" error={errors.nombreCompleto} /><SaveActions busy={busy} returnTo={returnTo} /></form></>;
}
export function EditarCursada({ cursadaId }: { cursadaId: string }) { const returnTo = useReturnTo("cursadas"); return <EditorPage title="Editar cursada" returnTo={returnTo}><DetailEditor id={cursadaId} load={obtenerCursada}>{(cursada) => <CursadaOptions key={cursada.id} cursada={cursada} returnTo={returnTo} />}</DetailEditor></EditorPage>; }
function CursadaOptions({ cursada, returnTo }: { cursada: CursadaDetalle; returnTo: string }) {
  const materias = useAllPages("materias", (page) => listarMaterias({ page, pageSize: 100 }));
  const blocked = bloqueoDeOpciones([{ ...materias, nombre: "materias", vacio: "No hay materias disponibles." }]);
  if (blocked) return blocked;
  return <CursadaEditor cursada={cursada} returnTo={returnTo} materias={opcionesListas(materias.state)} />;
}
function CursadaEditor({ cursada, returnTo, materias }: { cursada: CursadaDetalle; returnTo: string; materias: { id: string; nombre: string }[] }) {
  const router = useRouter(); const ref = useInitialInputs({ anio: String(cursada.anio) });
  const { busy, errors, error, success, setSuccess, handleSubmit } = useFormSubmission({ fields: ["materiaId", "anio", "cuatrimestre"] as const, validate: (values) => definedIssues({ materiaId: materias.some((m) => m.id === values.materiaId) ? undefined : "Elegí una materia disponible.", anio: validateAnio(values.anio), cuatrimestre: isCuatrimestre(values.cuatrimestre) ? undefined : "Elegí un período válido." }), fallbackError: "No pudimos guardar la cursada.", onSubmit: async (values) => {
    if (!isCuatrimestre(values.cuatrimestre)) return;
    const changes: { materiaId?: string; anio?: number; cuatrimestre?: Cuatrimestre } = {};
    if (values.materiaId !== cursada.materia.id) changes.materiaId = values.materiaId;
    if (Number(values.anio) !== cursada.anio) changes.anio = Number(values.anio);
    if (values.cuatrimestre !== cursada.cuatrimestre) changes.cuatrimestre = values.cuatrimestre;
    if (!Object.keys(changes).length) { setSuccess("No hay cambios para guardar."); return; }
    await actualizarCursada(cursada.id, changes);
    const target = changes.materiaId ? adminListHref({ seccion: "cursadas", materiaId: changes.materiaId, page: 1 }) : returnTo;
    router.push(adminSuccessHref(target, "Cursada actualizada correctamente."));
  } });
  return <><Notice tone="warning">Las comisiones y sus profesores permanecen asociados a esta cursada. No se permite moverla a una materia que no ofrezca las carreras de sus comisiones.</Notice><SubmitState error={error} success={success} /><form ref={ref} onSubmit={handleSubmit} noValidate aria-busy={busy}><FormField name="materiaId" label="Materia" defaultValue={cursada.materia.id} options={materias.map((m) => ({ value: m.id, label: m.nombre }))} error={errors.materiaId} /><FormField name="anio" label="Año" input={{ numeric: { min: ANIO_MINIMO, max: anioMaximo() } }} error={errors.anio} /><FormField name="cuatrimestre" label="Período" defaultValue={cursada.cuatrimestre ?? ""} options={[{ value: "PRIMERO", label: "Primer cuatrimestre" }, { value: "SEGUNDO", label: "Segundo cuatrimestre" }, { value: "ANUAL", label: "Anual" }]} error={errors.cuatrimestre} /><SaveActions busy={busy} returnTo={returnTo} /></form></>;
}
function isCuatrimestre(value: string): value is Cuatrimestre { return value === "PRIMERO" || value === "SEGUNDO" || value === "ANUAL"; }
export function EditarComision({ comisionId }: { comisionId: string }) { const returnTo = useReturnTo("comisiones"); return <EditorPage title="Editar comisión" returnTo={returnTo}><DetailEditor id={comisionId} load={obtenerComision}>{(comision) => <ComisionOptions key={comision.id} comision={comision} returnTo={returnTo} />}</DetailEditor></EditorPage>; }
function ComisionOptions({ comision, returnTo }: { comision: ComisionDetalle; returnTo: string }) {
  const { materia, error, retry } = useMateria(comision.cursada.materia.id);
  if (error) return <Notice tone="error">{error} <button className="button" type="button" onClick={retry}>Reintentar</button></Notice>;
  if (!materia) return <p role="status">Cargando carreras de la materia…</p>;
  return <ComisionEditor comision={comision} returnTo={returnTo} carreras={materia.carreras.map((entry) => entry.carrera)} />;
}
function ComisionEditor({ comision, returnTo, carreras }: { comision: ComisionDetalle; returnTo: string; carreras: string[] }) {
  const router = useRouter(); const ref = useInitialInputs({ numero: String(comision.numero) });
  const { busy, errors, error, success, setSuccess, handleSubmit } = useFormSubmission({ fields: ["carrera", "numero"] as const, validate: (values) => definedIssues({ carrera: carreras.includes(values.carrera) ? undefined : "Elegí una carrera de la materia.", numero: validateNumeroComision(values.numero) }), fallbackError: "No pudimos guardar la comisión.", onSubmit: async (values) => {
    if (!isCarrera(values.carrera)) return;
    const changes: { carrera?: typeof values.carrera; numero?: number } = {};
    if (values.carrera !== comision.carrera) changes.carrera = values.carrera;
    if (Number(values.numero) !== comision.numero) changes.numero = Number(values.numero);
    if (!Object.keys(changes).length) { setSuccess("No hay cambios para guardar."); return; }
    await actualizarComision(comision.id, changes); router.push(adminSuccessHref(returnTo, "Comisión actualizada correctamente."));
  } });
  return <><p>La cursada y los docentes asignados se conservan. El nombre se genera con la carrera y el número.</p><SubmitState error={error} success={success} /><form ref={ref} onSubmit={handleSubmit} noValidate aria-busy={busy}><FormField name="carrera" label="Carrera" defaultValue={comision.carrera} options={carreras.filter(isCarrera).map((carrera) => ({ value: carrera, label: `${carrera} — ${carreraLabel(carrera)}` }))} error={errors.carrera} /><FormField name="numero" label="Número de comisión" input={{ numeric: { min: NUMERO_COMISION_MINIMO, max: NUMERO_COMISION_MAXIMO } }} error={errors.numero} /><SaveActions busy={busy} returnTo={returnTo} /></form></>;
}

function definedIssues<K extends string>(issues: Partial<Record<K, string | undefined>>): Partial<Record<K, string>> { for (const key in issues) if (!issues[key]) delete issues[key]; return issues; }
