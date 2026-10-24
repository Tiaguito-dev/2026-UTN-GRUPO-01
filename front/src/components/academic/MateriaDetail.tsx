"use client";
import Link from "next/link";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { useMateria } from "@/hooks/useMateria";
import { usePaginatedFetch } from "@/hooks/usePaginatedFetch";
import { listarHistorialMateria } from "@/services/materias";
import { isAnioCarrera, materiaListHref, materiaDetailHref, anioCarreraLabel, parseMateriaPage, parseMateriaContext, nivelElectivaLabel } from "@/validations/materias";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { CursadasList } from "./CursadasList";
import { Pagination } from "@/components/ui/Pagination";
import { Card } from "@/components/ui/Card";
import { Notice } from "@/components/ui/Notice";
export function MateriaDetail({ materiaId }: { materiaId: string }) {
  const { account } = useAuth();
  const params = useSearchParams();
  const rawAnio = params.get("anioCarrera");
  const context = parseMateriaContext(params);
  const anio = isAnioCarrera(rawAnio) ? rawAnio : undefined;
  const listadoPage = parseMateriaPage(params.get("listadoPage"));
  const backHref = materiaListHref(anio, listadoPage, context);
  const detailHref = materiaDetailHref(materiaId, anio, listadoPage, context);
  const { materia, error, retry } = useMateria(materiaId);
  return <>
    <section aria-labelledby="materia-heading">
      <Breadcrumb items={[{ label: "Materias", href: backHref }, { label: materia?.nombre ?? "Materia" }]} />
      <h1 id="materia-heading">{materia?.nombre ?? "Materia"}</h1>
      {params.get("successMessage") ? <Notice tone="success">{params.get("successMessage")}</Notice> : null}
      {error ? <Notice tone="error">Lo sentimos. No pudimos recuperar la materia. {error} <button className="button" onClick={retry} type="button">Reintentar</button></Notice> : null}
      {!materia && !error ? <p role="status">Cargando materia…</p> : null}
      {materia ? <>
        <Card variant="panel"><h2>Datos de la materia</h2><dl><dt>Nombre</dt><dd>{materia.nombre}</dd><dt>Año de la carrera</dt><dd>{anioCarreraLabel(materia.anioCarrera)}</dd>{materia.anioCarrera === "ELECTIVA" ? <><dt>Nivel de electiva</dt><dd>{nivelElectivaLabel(materia.nivelElectiva)}</dd></> : null}</dl></Card>
        <Card variant="panel"><h2>Auditoría</h2><dl><dt>Fecha de alta</dt><dd>{new Date(materia.createdAt).toLocaleString("es-AR")}</dd><dt>Estado</dt><dd>{materia.deletedAt ? "Inactiva" : "Activa"}</dd></dl></Card>
        <MateriaHistory key={materiaId} materiaId={materiaId} />
        {account?.role === "ADMIN" && !materia.deletedAt ? <p><Link href={`/home/admin/materias/${encodeURIComponent(materiaId)}/editar${detailHref.includes("?") ? detailHref.slice(detailHref.indexOf("?")) : ""}`}>Editar</Link></p> : null}
      </> : null}
      <p><Link href={backHref}>Volver</Link></p>
    </section>
    {materia ? <CursadasList materiaId={materiaId} materiaNombre={materia.nombre} materiasHref={backHref} embedded /> : null}
  </>;
}
function MateriaHistory({ materiaId }: { materiaId: string }) {
  // Local page, not the URL: on this screen `?page` belongs to the cursadas list. `key={materiaId}` restarts it.
  const [page, setPage] = useState(1);
  const { state, retry } = usePaginatedFetch(`historial:${materiaId}`, (next) => listarHistorialMateria(materiaId, { page: next }), page);
  return <Card variant="panel"><h2>Historial de cambios</h2>
    {state.status === "loading" ? <p role="status">Cargando historial…</p> : null}
    {state.status === "error" ? <p role="alert">Lo sentimos. No pudimos recuperar el historial. {state.error} <button className="button" type="button" onClick={retry}>Reintentar</button></p> : null}
    {state.status === "ready" ? <>
      {state.data.items.length ? <ul>{state.data.items.map((entry) => <li key={entry.id}><p>{new Date(entry.createdAt).toLocaleString("es-AR")} — Usuario: {entry.actorId}</p><ul>{entry.cambios.map((change) => <li key={change.campo}>{historyFieldLabel(change.campo)}: {historyValue(change.campo, change.anterior)} → {historyValue(change.campo, change.nuevo)}</li>)}</ul></li>)}</ul> : <p>No hay cambios registrados.</p>}
      <Pagination page={page} pageSize={state.data.pageSize} total={state.data.total} onChange={setPage} />
    </> : null}
  </Card>;
}

function historyFieldLabel(campo: string) { return campo === "nombre" ? "Nombre" : campo === "nivelElectiva" ? "Nivel de electiva" : "Año de la carrera"; }
function historyValue(campo: string, value: string | null) {
  if (!value) return "Sin valor";
  if (campo === "nivelElectiva" && (value === "3" || value === "4" || value === "5")) return nivelElectivaLabel(value);
  if (campo === "anioCarrera" && isAnioCarrera(value)) return anioCarreraLabel(value);
  return value;
}
