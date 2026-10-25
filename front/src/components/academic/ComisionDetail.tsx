"use client";

import Link from "next/link";
import { useEffect, useId, useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import {
  asignarProfesorComision,
  CARGOS,
  listarComisionesPorCursada,
  listarProfesores,
  obtenerComision,
  quitarProfesorComision,
  type CargoDocente,
  type Comision,
  type ComisionDetalle,
  type Profesor,
} from "@/services/academic";
import { HttpError } from "@/services/http";
import {
  cargoLabel,
  carreraLabel,
  isAnioCarrera,
  isCarrera,
  materiaDetailHref,
  materiaListHref,
  parseMateriaContext,
  parseMateriaPage,
} from "@/validations/materias";
import { PageHeader } from "@/components/ui/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Notice } from "@/components/ui/Notice";
import { RowLink } from "@/components/ui/RowLink";
import { periodoLabel } from "@/lib/format/periodo";
import { PlusIcon, iniciales } from "./detalle";

export function ComisionDetail({
  materiaId,
  cursadaId,
  comisionId,
}: {
  materiaId: string;
  cursadaId: string;
  comisionId: string;
}) {
  const headingId = useId();
  const isAdmin = useIsAdmin();
  const params = useSearchParams();
  const rawCarrera = params.get("carrera");
  const carrera = isCarrera(rawCarrera) ? rawCarrera : undefined;
  const rawAnio = params.get("anioCarrera");
  const anio = isAnioCarrera(rawAnio) ? rawAnio : undefined;
  const listadoPage = parseMateriaPage(params.get("listadoPage"));
  const context = parseMateriaContext(params);

  const [comision, setComision] = useState<ComisionDetalle | null>(null);
  const [error, setError] = useState("");
  const [notFound, setNotFound] = useState(false);
  const [actionError, setActionError] = useState("");
  const [busy, setBusy] = useState(false);
  const [retryToken, setRetryToken] = useState(0);

  const [comisionesCursada, setComisionesCursada] = useState<Comision[]>([]);
  const [profesoresTotales, setProfesoresTotales] = useState<Profesor[]>([]);
  const [nuevoProfesorId, setNuevoProfesorId] = useState("");
  const [nuevoCargo, setNuevoCargo] = useState<CargoDocente>("TITULAR");

  useEffect(() => {
    let active = true;
    obtenerComision(comisionId)
      .then((data) => {
        if (active) {
          setComision(data);
          setError("");
          setNotFound(false);
        }
      })
      .catch((err: unknown) => {
        if (active) {
          setComision(null);
          setError(err instanceof Error ? err.message : "No pudimos recuperar la comisión.");
          setNotFound(err instanceof HttpError && err.status === 404);
        }
      });
    return () => {
      active = false;
    };
  }, [comisionId, retryToken]);

  useEffect(() => {
    if (comision) {
      document.title = `Comisión ${comision.nombre} | Profesor Butchery`;
    }
  }, [comision]);

  // Load the commissions of the same cursada; the current one is marked in the list.
  useEffect(() => {
    let active = true;
    listarComisionesPorCursada(cursadaId, { pageSize: 100 })
      .then((res) => {
        if (active) setComisionesCursada(res.items);
      })
      .catch(() => {
        // Soft failure, other commissions section remains empty
      });
    return () => {
      active = false;
    };
  }, [cursadaId, comisionId]);

  // Load all professors for admin selection
  useEffect(() => {
    if (!isAdmin) return;
    let active = true;
    listarProfesores({ pageSize: 100 })
      .then((res) => {
        if (active) setProfesoresTotales(res.items);
      })
      .catch(() => {
        // Soft failure
      });
    return () => {
      active = false;
    };
  }, [isAdmin]);

  const realMateriaId = comision?.cursada.materia.id ?? materiaId;
  const realCursadaId = comision?.cursada.id ?? cursadaId;
  const materiasHref = materiaListHref(carrera, anio, listadoPage, context);
  const materiaHref = materiaDetailHref(realMateriaId, carrera, anio, listadoPage, context);

  const contextQuery = new URLSearchParams();
  if (carrera) contextQuery.set("carrera", carrera);
  if (anio) contextQuery.set("anioCarrera", anio);
  if (listadoPage > 1) contextQuery.set("listadoPage", String(listadoPage));
  if (context.q) contextQuery.set("q", context.q);
  if (context.nivelElectiva) contextQuery.set("nivelElectiva", context.nivelElectiva);
  const queryString = contextQuery.size ? `?${contextQuery}` : "";

  const cursadaHref = `/home/materias/${encodeURIComponent(realMateriaId)}/cursadas/${encodeURIComponent(realCursadaId)}${queryString}`;
  const back = <Link href={cursadaHref}>Volver a las comisiones del período</Link>;

  async function handleCambiarCargo(profesorId: string, cargo: CargoDocente) {
    setActionError("");
    setBusy(true);
    try {
      await asignarProfesorComision(comisionId, profesorId, cargo);
      setRetryToken((n) => n + 1);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "No pudimos actualizar el cargo.");
    } finally {
      setBusy(false);
    }
  }

  async function handleQuitar(profesorId: string) {
    setActionError("");
    setBusy(true);
    try {
      await quitarProfesorComision(comisionId, profesorId);
      setRetryToken((n) => n + 1);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "No pudimos quitar al profesor.");
    } finally {
      setBusy(false);
    }
  }

  async function handleAsignar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!nuevoProfesorId) return;
    setActionError("");
    setBusy(true);
    try {
      await asignarProfesorComision(comisionId, nuevoProfesorId, nuevoCargo);
      setNuevoProfesorId("");
      setNuevoCargo("TITULAR");
      setRetryToken((n) => n + 1);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "No pudimos asignar al profesor.");
    } finally {
      setBusy(false);
    }
  }

  const comisionLabel = comision?.nombre ?? (error ? "Comisión" : "Cargando…");
  const titulo = comision ? `Comisión ${comision.nombre}` : comisionLabel;
  const materiaLabel = comision?.cursada.materia.nombre ?? "Materia";
  const periodoNombre = comision
    ? periodoLabel(comision.cursada.anio, comision.cursada.cuatrimestre)
    : "Período";

  const profesoresDisponibles = profesoresTotales.filter(
    (pt) => !comision?.profesores.some((p) => p.id === pt.id)
  );

  return (
    <section aria-labelledby={headingId}>
      <div className="academic-detail-header">
        <PageHeader
          id={headingId}
          title={titulo}
          eyebrow={comision ? `${materiaLabel} · ${periodoNombre}` : undefined}
          back={{ href: cursadaHref, label: periodoNombre }}
          breadcrumb={[
            { label: "Materias", href: materiasHref },
            { label: materiaLabel, href: materiaHref },
            { label: periodoNombre, href: cursadaHref },
            { label: comisionLabel },
          ]}
          focusKey={comisionId}
        />
        {comision ? (
          <div className="academic-badges">
            <span className="academic-tag academic-tag-primary">{carreraLabel(comision.carrera)}</span>
            {isAdmin ? <span className={`academic-tag ${comision.activa ? "academic-tag-success" : ""}`}>{comision.activa ? "Activa" : "Inactiva"}</span> : null}
          </div>
        ) : null}
      </div>
      {error ? (
        <Notice tone="error">
          Lo sentimos. No pudimos recuperar la comisión. {error}{" "}
          {notFound ? back : <button className="button" type="button" onClick={() => setRetryToken((n) => n + 1)}>Reintentar</button>}
        </Notice>
      ) : null}
      {!comision && !error ? <p role="status">Cargando comisión…</p> : null}
      {comision ? (
        <div className="academic-columns">
          <div className="academic-main">
            <section className="academic-panel" aria-labelledby={`${headingId}-profesores`}>
              <div className="academic-panel-header">
                <div>
                  <h2 id={`${headingId}-profesores`}>Profesores</h2>
                  <p>Quiénes dictan esta comisión y con qué cargo.</p>
                </div>
                {isAdmin ? (
                  // TASK-043 decision 2: jumps to the assign form below; focus moves in code.
                  <a
                    className="button button-secondary"
                    href={`#${ASIGNAR_PROFESOR_ID}`}
                    onClick={(event) => {
                      event.preventDefault();
                      document.getElementById(ASIGNAR_PROFESOR_ID)?.focus();
                    }}
                  >
                    <PlusIcon />
                    Asignar profesor
                  </a>
                ) : null}
              </div>
              <div className="academic-panel-body">
                {actionError ? <Notice tone="error">{actionError}</Notice> : null}
                {comision.profesores.length === 0 ? (
                  <p className="academic-empty">No hay profesores asignados a esta comisión.</p>
                ) : (
                  <ul className="row-list">
                    {comision.profesores.map((p) => (
                      <li key={p.id} className="academic-person">
                        <span className="academic-avatar" aria-hidden="true">{iniciales(p.nombreCompleto)}</span>
                        <span className="academic-person-name">{p.nombreCompleto}</span>
                        {isAdmin ? (
                          <span className="academic-person-actions">
                            <label htmlFor={`cargo-${p.id}`} className="sr-only">
                              Cambiar cargo de {p.nombreCompleto}
                            </label>
                            <select
                              id={`cargo-${p.id}`}
                              value={p.cargo}
                              disabled={busy}
                              onChange={(e) => handleCambiarCargo(p.id, e.target.value as CargoDocente)}
                            >
                              {CARGOS.map((c) => (
                                <option key={c} value={c}>
                                  {cargoLabel(c)}
                                </option>
                              ))}
                            </select>
                            <button className="button button-secondary"
                              type="button"
                              disabled={busy}
                              onClick={() => handleQuitar(p.id)}
                            >
                              Quitar
                            </button>
                          </span>
                        ) : (
                          <span className="academic-tag">{cargoLabel(p.cargo)}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}

                {isAdmin ? (
                  <form className="academic-assign" onSubmit={handleAsignar} aria-labelledby={`${headingId}-asignar`}>
                    <h3 id={`${headingId}-asignar`}>Asignar profesor</h3>
                    <div className="field">
                      <label htmlFor={ASIGNAR_PROFESOR_ID}>Profesor</label>
                      <select
                        id={ASIGNAR_PROFESOR_ID}
                        value={nuevoProfesorId}
                        disabled={busy}
                        onChange={(e) => setNuevoProfesorId(e.target.value)}
                      >
                        <option value="">Elegí un profesor</option>
                        {profesoresDisponibles.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.nombreCompleto}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="field">
                      <label htmlFor="asignar-cargo">Cargo</label>
                      <select
                        id="asignar-cargo"
                        value={nuevoCargo}
                        disabled={busy}
                        onChange={(e) => setNuevoCargo(e.target.value as CargoDocente)}
                      >
                        {CARGOS.map((c) => (
                          <option key={c} value={c}>
                            {cargoLabel(c)}
                          </option>
                        ))}
                      </select>
                    </div>
                    <button className="button submit"
                      type="submit"
                      disabled={busy || !nuevoProfesorId}
                    >
                      {busy ? "Guardando…" : "Asignar profesor"}
                    </button>
                  </form>
                ) : null}
              </div>
            </section>

            <section className="academic-panel" aria-labelledby={`${headingId}-experiencias`}>
              <div className="academic-panel-header">
                <div>
                  <h2 id={`${headingId}-experiencias`}>Experiencias de esta comisión</h2>
                  <p>Lo que cuentan quienes cursaron en esta comisión.</p>
                </div>
                <Badge tone="upcoming">Próximamente</Badge>
              </div>
              <p className="academic-empty">
                <strong>Todavía no se pueden compartir experiencias.</strong>
                Cuando esté disponible, acá vas a poder leer y dejar tu experiencia sobre el dictado de esta comisión.
              </p>
            </section>

            {isAdmin ? <p className="academic-note">La edición y la baja de comisiones todavía no están disponibles.</p> : null}
          </div>

          <div className="academic-aside">
            {isAdmin ? (
              <section className="academic-panel" aria-labelledby={`${headingId}-datos`}>
                <div className="academic-panel-header"><h2 id={`${headingId}-datos`}>Datos de la comisión</h2></div>
                <dl className="academic-data">
                  <div><dt>Nombre</dt><dd>{comision.nombre}</dd></div>
                  <div><dt>Carrera</dt><dd>{carreraLabel(comision.carrera)} ({comision.carrera})</dd></div>
                  <div><dt>Estado</dt><dd>{comision.activa ? "Activa" : "Inactiva"}</dd></div>
                  <div><dt>Fecha de alta</dt><dd>{new Date(comision.createdAt).toLocaleString("es-AR")}</dd></div>
                </dl>
              </section>
            ) : null}

            <section className="academic-panel" aria-labelledby={`${headingId}-otras`}>
              <div className="academic-panel-header"><h2 id={`${headingId}-otras`}>Otras comisiones</h2></div>
              <div className="academic-panel-body">
                {comisionesCursada.every((otra) => otra.id === comisionId) ? (
                  <p className="academic-empty">No hay otras comisiones en este período.</p>
                ) : (
                  <ul className="row-list">
                    {comisionesCursada.map((otra) => (
                      <RowLink
                        key={otra.id}
                        href={`/home/materias/${encodeURIComponent(realMateriaId)}/cursadas/${encodeURIComponent(realCursadaId)}/comisiones/${encodeURIComponent(otra.id)}${queryString}`}
                        current={otra.id === comisionId}
                        trailing={otra.id === comisionId ? "Actual" : (otra.activa ? undefined : <span className="academic-tag">Inactiva</span>)}
                      >
                        {otra.nombre}
                      </RowLink>
                    ))}
                  </ul>
                )}
              </div>
            </section>
          </div>
        </div>
      ) : null}
    </section>
  );
}

const ASIGNAR_PROFESOR_ID = "asignar-profesor";
