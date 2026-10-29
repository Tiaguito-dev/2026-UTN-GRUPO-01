"use client";

import Link from "next/link";
import { useEffect, useId, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import {
  listarComisionesPorCursada,
  obtenerComision,
  type Comision,
  type ComisionDetalle,
} from "@/services/academic";
import { HttpError } from "@/services/http";
import {
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
import { DocentesComision } from "./DocentesComision";

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
  const [retryToken, setRetryToken] = useState(0);

  const [comisionesCursada, setComisionesCursada] = useState<Comision[]>([]);

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

  const comisionLabel = comision?.nombre ?? (error ? "Comisión" : "Cargando…");
  const titulo = comision ? `Comisión ${comision.nombre}` : comisionLabel;
  const materiaLabel = comision?.cursada.materia.nombre ?? "Materia";
  const periodoNombre = comision
    ? periodoLabel(comision.cursada.anio, comision.cursada.cuatrimestre)
    : "Período";

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
            <DocentesComision key={comision.id} comisionId={comision.id} profesores={comision.profesores} onChange={(profesores) => setComision((current) => current ? { ...current, profesores } : current)} />

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
