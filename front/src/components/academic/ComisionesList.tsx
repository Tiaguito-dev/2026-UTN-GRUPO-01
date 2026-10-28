"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  isAnioCarrera,
  isCarrera,
  parseMateriaPage,
  materiaListHref,
  materiaDetailHref,
  parseMateriaContext,
  carreraLabel,
  carreraShortLabel,
  cargoLabel,
} from "@/validations/materias";
import { useId, useState } from "react";
import { listarComisionesPorCursada } from "@/services/academic";
import type { Carrera } from "@/types/materias";
import { useCursada } from "@/hooks/useCursada";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { useUrlPagination } from "@/hooks/useUrlPagination";
import { PageHeader } from "@/components/ui/PageHeader";
import { PaginatedListView } from "@/components/ui/PaginatedListView";
import { Notice } from "@/components/ui/Notice";
import { FilterChips } from "@/components/ui/FilterChips";
import { periodoLabel } from "@/lib/format/periodo";
import { adminFormHref, adminListHref } from "@/validations/admin";
import { Chevron } from "./detalle";
import styles from "./ComisionesList.module.css";

export function ComisionesList({ materiaId, cursadaId }: { materiaId: string; cursadaId: string }) {
  const headingId = useId();
  const comisionesHeadingId = useId();
  const isAdmin = useIsAdmin();
  const context = useSearchParams();
  const rawCarrera = context.get("carrera");
  const urlCarrera = isCarrera(rawCarrera) ? rawCarrera : undefined;
  const rawYear = context.get("anioCarrera");
  const careerYear = isAnioCarrera(rawYear) ? rawYear : undefined;
  const listPage = parseMateriaPage(context.get("listadoPage"));
  const { cursada, error, notFound, retry } = useCursada(cursadaId);
  const materiaLabel = cursada?.materia.nombre ?? (error ? "Materia" : "Cargando…");
  const periodoActual = cursada ? periodoLabel(cursada.anio) : error ? "Cursada" : "Cargando…";

  const { page, setPage } = useUrlPagination();
  const [carreraFilter, setCarreraFilter] = useState<Carrera | undefined>(undefined);

  const backHref = materiaDetailHref(cursada?.materia.id ?? materiaId, urlCarrera, careerYear, listPage, parseMateriaContext(context));
  const back = <Link href={backHref}>Volver a las cursadas de {cursada?.materia.nombre ?? "la materia"}</Link>;
  const realMateriaId = cursada?.materia.id ?? materiaId;

  const detailQueryParams = new URLSearchParams();
  if (urlCarrera) detailQueryParams.set("carrera", urlCarrera);
  if (careerYear) detailQueryParams.set("anioCarrera", careerYear);
  if (listPage > 1) detailQueryParams.set("listadoPage", String(listPage));
  const detailSearch = detailQueryParams.size ? `?${detailQueryParams}` : "";

  return <section aria-labelledby={headingId}>
    <div className="academic-detail-header">
      <PageHeader
        id={headingId}
        title={periodoActual}
        eyebrow={cursada ? cursada.materia.nombre : undefined}
        focusKey={cursadaId}
        back={{ href: backHref, label: materiaLabel }}
        breadcrumb={[
          { label: "Materias", href: materiaListHref(urlCarrera, careerYear, listPage, parseMateriaContext(context)) },
          { label: materiaLabel, href: backHref },
          { label: periodoActual },
        ]}
      />
    </div>
    {error ? <Notice tone="error">{error} {notFound ? back : <button className="button" type="button" onClick={retry}>Reintentar</button>}</Notice> : <section className="academic-panel" aria-labelledby={comisionesHeadingId}>
      <div className="academic-panel-header">
        <div>
          <h2 id={comisionesHeadingId}>Comisiones</h2>
          <p>Cada comisión, de qué carrera es y quiénes la dictan.</p>
        </div>
        {/* TASK-043 decision 2: the alta page receives the cursada preselected. */}
        {isAdmin ? <Link className="button" href={`${adminFormHref("/home/admin/comisiones/nueva", adminListHref({ seccion: "comisiones", page, materiaId: realMateriaId, cursadaId, carrera: carreraFilter }))}&cursadaId=${encodeURIComponent(cursadaId)}`}>Nueva comisión</Link> : null}
      </div>
      <div className="academic-panel-body">
        <PaginatedListView resetKey={cursadaId} page={page} onPageChange={setPage} fetchPage={(next) => listarComisionesPorCursada(cursadaId, { page: next, pageSize: 100 })} loadingMessage="Cargando comisiones…"
          notFoundAction={back} empty={<p className="academic-empty"><strong>Esta cursada todavía no tiene comisiones cargadas.</strong>{isAdmin ? " Creá la primera con Nueva comisión: la cursada ya va a venir elegida." : null} {back}</p>}>
          {(result) => {
            const carrerasPresentes = Array.from(new Set(result.items.map((c) => c.carrera)));
            const items = carreraFilter ? result.items.filter((c) => c.carrera === carreraFilter) : result.items;
            return <>
              {carrerasPresentes.length > 1 ? (
                <div className={styles.chipsFilter}>
                  <FilterChips
                    label="Filtrar por carrera"
                    labelHidden
                    options={[
                      { value: "", label: "Todas las carreras" },
                      ...carrerasPresentes.map((c) => ({
                        value: c,
                        label: `${carreraShortLabel(c)} (${c})`,
                      })),
                    ]}
                    value={carreraFilter ?? ""}
                    onChange={(v) => setCarreraFilter(v ? (v as Carrera) : undefined)}
                  />
                </div>
              ) : null}
              <ul className={styles.grid}>
                {items.map((comision) => <li key={comision.id} className={`${styles.card} ${comision.activa ? "" : styles.inactive}`}>
                  <span className={styles.cardHead}>
                    <span className={styles.letter} aria-hidden="true">{comision.carrera}</span>
                    <span className={styles.cardTitle}>
                      <Link href={`/home/materias/${realMateriaId}/cursadas/${cursadaId}/comisiones/${comision.id}${detailSearch}`}>{comision.nombre}</Link>
                      <span className={styles.carrera}>{carreraLabel(comision.carrera)}</span>
                    </span>
                    <Chevron />
                  </span>
                  {comision.profesores.length ? <ul className={styles.profesores}>
                    {comision.profesores.map((p) => <li key={p.id}>{`${p.nombreCompleto} (${cargoLabel(p.cargo)})`}</li>)}
                  </ul> : <span className={styles.sinProfesores}>Sin profesores asignados</span>}
                  {!comision.activa ? <span className="academic-tag">Inactiva</span> : null}
                </li>)}
              </ul>
            </>;
          }}
        </PaginatedListView>
      </div>
    </section>}
  </section>;
}
