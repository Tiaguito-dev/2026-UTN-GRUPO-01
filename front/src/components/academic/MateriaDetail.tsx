"use client";
import Link from "next/link";
import { useId, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { useMateria } from "@/hooks/useMateria";
import { usePaginatedFetch } from "@/hooks/usePaginatedFetch";
import { listarHistorialMateria } from "@/services/materias";
import {
  isAnioCarrera,
  isCarrera,
  materiaListHref,
  materiaDetailHref,
  anioCarreraLabel,
  carrerasResumenLabel,
  parseMateriaPage,
  parseMateriaContext,
  nivelElectivaLabel,
  modalidadLabel,
  isModalidadMateria,
} from "@/validations/materias";
import { PageHeader } from "@/components/ui/PageHeader";
import { Pagination } from "@/components/ui/Pagination";
import { Notice } from "@/components/ui/Notice";
import { ComisionesMateria } from "./ComisionesMateria";
import { experienciasBack } from "@/validations/feedback";

export function MateriaDetail({ materiaId }: { materiaId: string }) {
  const headingId = useId();
  const isAdmin = useIsAdmin();
  const params = useSearchParams();
  const rawCarrera = params.get("carrera");
  const carrera = isCarrera(rawCarrera) ? rawCarrera : undefined;
  const rawAnio = params.get("anioCarrera");
  const anio = isAnioCarrera(rawAnio) ? rawAnio : undefined;
  const context = parseMateriaContext(params);
  const listadoPage = parseMateriaPage(params.get("listadoPage"));
  const backHref = materiaListHref(carrera, anio, listadoPage, context);
  const detailHref = materiaDetailHref(materiaId, carrera, anio, listadoPage, context);
  const editHref = `/home/admin/materias/${encodeURIComponent(materiaId)}/editar${detailHref.includes("?") ? detailHref.slice(detailHref.indexOf("?")) : ""}`;
  const { materia, error, notFound, retry } = useMateria(materiaId);
  const materiaLabel = materia?.nombre ?? (error ? "Materia" : "Cargando…");
  // The year badge follows the career of the listing context, or the first one of the materia.
  const fila = materia ? materia.carreras.find((c) => c.carrera === carrera) ?? materia.carreras[0] : undefined;

  return <section aria-labelledby={headingId}>
    <div className="academic-detail-header">
      <PageHeader
        id={headingId}
        title={materiaLabel}
        focusKey={materiaId}
        back={experienciasBack(params) ?? { href: backHref, label: "Materias" }}
        breadcrumb={[{ label: "Materias", href: backHref }, { label: materiaLabel }]}
      />
      {materia ? <div className="academic-heading-row">
        <div className="academic-badges">
          {fila ? <span className="academic-tag academic-tag-primary">{anioCarreraLabel(fila.anioCarrera)}{fila.anioCarrera === "ELECTIVA" && fila.nivelElectiva ? ` · ${nivelElectivaLabel(fila.nivelElectiva)}` : ""}</span> : null}
          <span className="academic-tag">{materia.carreras.length ? carrerasResumenLabel(materia.carreras) : "Sin carreras asignadas"}</span>
          {isAdmin ? <span className={`academic-tag ${materia.deletedAt ? "" : "academic-tag-success"}`}>{materia.deletedAt ? "Inactiva" : "Activa"}</span> : null}
        </div>
        {isAdmin && !materia.deletedAt ? <Link className="button button-secondary" href={editHref}>Editar materia</Link> : null}
      </div> : null}
      {materia ? <p className="system-description">Modalidad: {modalidadLabel(materia.modalidad)}</p> : null}
    </div>
    {params.get("successMessage") ? <Notice tone="success">{params.get("successMessage")}</Notice> : null}
    {error ? <Notice tone="error">Lo sentimos. No pudimos recuperar la materia. {error} {notFound ? <Link href={backHref}>Volver al listado de materias</Link> : <button className="button" onClick={retry} type="button">Reintentar</button>}</Notice> : null}
    {!materia && !error ? <p role="status">Cargando materia…</p> : null}
    {materia ? <div className="academic-columns">
      <div className="academic-main">
        <ComisionesMateria key={materiaId} materiaId={materiaId} materiaNombre={materia.nombre} materiasHref={backHref} />
      </div>
      {isAdmin ? <div className="academic-aside">
        <MateriaHistory key={materiaId} materiaId={materiaId} materiaCreatedAt={materia.createdAt} />
      </div> : null}
    </div> : null}
  </section>;
}

// TASK-045: history is only rendered for ADMIN (and only ADMIN fetches it).
export function MateriaHistory({ materiaId, materiaCreatedAt }: { materiaId: string; materiaCreatedAt: string }) {
  const headingId = useId();
  const [page, setPage] = useState(1);
  const { state, retry } = usePaginatedFetch(`historial:${materiaId}`, (next) => listarHistorialMateria(materiaId, { page: next }), page);
  return <section className="academic-panel" aria-labelledby={headingId}>
    <div className="academic-panel-header"><h2 id={headingId}>Historial de cambios</h2></div>
    {state.status === "loading" ? <p className="academic-empty" role="status">Cargando historial…</p> : null}
    {state.status === "error" ? <p className="academic-empty" role="alert">Lo sentimos. No pudimos recuperar el historial. {state.error} <button className="button" type="button" onClick={retry}>Reintentar</button></p> : null}
    {state.status === "ready" ? <>
      {/* TASK-054: "Alta de la materia" se agrega como última entrada de la última página, sin actor ni diffs. */}
      <ol className="academic-timeline">
        {state.data.items.map((entry) => {
          const actorName = entry.actor.displayName || "Usuario";
          return <li key={entry.id}>
            <div className="academic-timeline-rail" aria-hidden="true">
              <span className="academic-avatar">{initials(actorName)}</span>
            </div>
            <div className="academic-timeline-body">
              <p className="academic-timeline-actor">{actorName}</p>
              <p className="academic-timeline-date"><time dateTime={entry.createdAt}>{new Date(entry.createdAt).toLocaleString("es-AR")}</time>{entry.cambios.length > 1 ? ` · ${entry.cambios.length} campos` : ""}</p>
              {entry.cambios.map((change) => <div key={change.campo}>
                <p className="academic-timeline-field">{historyFieldLabel(change.campo)}</p>
                <p className="academic-timeline-change">
                  <span className="academic-timeline-before"><span className="sr-only">Antes: </span>{historyValue(change.campo, change.anterior)}</span>
                  <span aria-hidden="true">→</span>
                  <span className="academic-timeline-after"><span className="sr-only">Ahora: </span>{historyValue(change.campo, change.nuevo)}</span>
                </p>
              </div>)}
            </div>
          </li>;
        })}
        {page >= Math.max(1, Math.ceil(state.data.total / state.data.pageSize)) ? <li key="alta">
          <div className="academic-timeline-rail" aria-hidden="true" />
          <div className="academic-timeline-body">
            <p className="academic-timeline-actor">Alta de la materia</p>
            <p className="academic-timeline-date"><time dateTime={materiaCreatedAt}>{new Date(materiaCreatedAt).toLocaleString("es-AR")}</time></p>
          </div>
        </li> : null}
      </ol>
      <div className="academic-timeline-footer"><Pagination page={page} pageSize={state.data.pageSize} total={state.data.total} onChange={setPage} /></div>
    </> : null}
  </section>;
}

/** Iniciales del actor (hasta 2 letras); para el fallback sin nombre, `actorName` ya llega como "Usuario". */
function initials(actorName: string) {
  const letters = actorName.trim().split(/\s+/u).filter(Boolean).slice(0, 2).map((word) => word[0]?.toUpperCase() ?? "");
  return letters.join("") || "?";
}

function historyFieldLabel(campo: string) {
  return campo === "nombre" ? "Nombre" : campo === "modalidad" ? "Modalidad" : campo === "nivelElectiva" ? "Nivel de electiva" : campo === "carreras" ? "Carreras" : "Año de la carrera";
}

function historyValue(campo: string, value: string | null) {
  if (campo === "modalidad") return modalidadLabel(isModalidadMateria(value) ? value : null);
  if (!value) return "Sin valor";
  if (campo === "nivelElectiva" && (value === "3" || value === "4" || value === "5")) return nivelElectivaLabel(value);
  if (campo === "anioCarrera" && isAnioCarrera(value)) return anioCarreraLabel(value);
  return value;
}
