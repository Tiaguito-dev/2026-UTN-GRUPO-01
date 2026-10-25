"use client";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { useId, useState, type FormEvent } from "react";
import { listarMaterias } from "@/services/materias";
import type { AnioCarrera, Carrera, Materia } from "@/types/materias";
import { useFocusOnMount } from "@/hooks/useFocusOnMount";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import {
  ANIOS_CARRERA,
  CARRERAS,
  anioCarreraLabel,
  carreraShortLabel,
  carrerasResumenLabel,
  isAnioCarrera,
  isCarrera,
  materiaListHref,
  materiaDetailHref,
  parseMateriaPage,
  parseMateriaContext,
  validateMateriaSearch,
  NIVELES_ELECTIVA,
  nivelElectivaLabel,
  type MateriaContext,
} from "@/validations/materias";
import { PageHeader } from "@/components/ui/PageHeader";
import { PaginatedListView } from "@/components/ui/PaginatedListView";
import { Notice } from "@/components/ui/Notice";
import { Dialog } from "@/components/ui/Dialog";
import { FilterChips } from "@/components/ui/FilterChips";
import { RowLink } from "@/components/ui/RowLink";
import { MateriaForm } from "@/components/admin/MateriaForm";
import { PlusIcon } from "./detalle";
import styles from "./MateriasList.module.css";

export function MateriasList() {
  const params = useSearchParams();
  const router = useRouter();
  const rawCarrera = params.get("carrera");
  const carrera = isCarrera(rawCarrera) ? rawCarrera : undefined;
  const rawAnio = params.get("anioCarrera");
  const anio = carrera && isAnioCarrera(rawAnio) ? rawAnio : undefined;
  const page = parseMateriaPage(params.get("page"));
  const context = parseMateriaContext(params);
  const headingId = useId();
  const isAdmin = useIsAdmin();
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  return <section aria-labelledby={headingId}>
    <div className={styles.header}>
      <PageHeader id={headingId} title="Materias" description="Información para acercarte a cada materia con más contexto antes de cursarla." />
      {isAdmin ? <button className={`button ${styles.newButton}`} type="button" onClick={() => setCreating(true)}><PlusIcon />Nueva materia</button> : null}
    </div>
    {params.get("successMessage") ? <Notice tone="success">{params.get("successMessage")}</Notice> : null}
    {created ? <Notice tone="success">{created}</Notice> : null}
    {/* TASK-043: short alta that returns to this list, so it opens in a Dialog; the page stays as fallback. */}
    {isAdmin ? <Dialog open={creating} onClose={() => setCreating(false)} title="Nueva materia" description="El nombre no puede repetirse." busy={saving}>
      {creating ? <MateriaForm onCancel={() => setCreating(false)} onBusyChange={setSaving} onSuccess={(materia) => {
        setCreating(false);
        setCreated(`Materia creada: ${materia.nombre}.`);
        setRefreshKey((key) => key + 1);
      }} /> : null}
    </Dialog> : null}
    <div className={styles.filters}>
      <div className={styles.heading}>
        <p className={styles.title}>Filtros</p>
        <p className={styles.description}>Elegí tu carrera y después buscá por nombre o explorá por año.</p>
      </div>
      <div className={styles.careerGroup} role="group" aria-labelledby="carrera-label">
        <p id="carrera-label" className={styles.groupLabel}>Carrera</p>
        <div className={styles.careers}>
          <button className={`button ${styles.career}`} type="button" aria-pressed={!carrera} onClick={() => router.replace(materiaListHref(undefined, undefined, 1, { ...context, carrera: undefined, nivelElectiva: undefined }), { scroll: false })}><span className={styles.careerInitial} aria-hidden="true">∗</span>Todas</button>
          {CARRERAS.map((cod) => <button className={`button ${styles.career}`} key={cod} type="button" aria-pressed={carrera === cod} onClick={() => router.replace(materiaListHref(cod, undefined, 1, { ...context, carrera: cod, nivelElectiva: undefined }), { scroll: false })}><span className={styles.careerInitial} aria-hidden="true">{cod}</span>{carreraShortLabel(cod)}</button>)}
        </div>
      </div>
      <MateriaSearch key={context.q ?? ""} query={context.q ?? ""} onSearch={(q) => router.replace(materiaListHref(carrera, anio, 1, { ...context, q }), { scroll: false })} />
      {carrera ? (
        <FilterChips
          label="Año de la carrera"
          id="anio-carrera-label"
          className={styles.filterGroup}
          options={[
            { value: "", label: "Todos los años" },
            ...ANIOS_CARRERA.map((value) => ({
              value,
              label: value === "ELECTIVA" ? "Electivas" : anioCarreraLabel(value),
            })),
          ]}
          value={anio ?? ""}
          onChange={(value) =>
            router.replace(materiaListHref(carrera, value ? (value as AnioCarrera) : undefined, 1, context), { scroll: false })
          }
        />
      ) : null}
      {carrera && anio === "ELECTIVA" ? (
        <FilterChips
          label="Nivel de electiva"
          id="nivel-electiva-label"
          className={`${styles.filterGroup} ${styles.electiveGroup}`}
          options={[
            { value: "", label: "Todos los niveles" },
            ...NIVELES_ELECTIVA.map((nivel) => ({
              value: nivel,
              label: nivelElectivaLabel(nivel),
            })),
          ]}
          value={context.nivelElectiva ?? ""}
          onChange={(value) =>
            router.replace(
              materiaListHref(carrera, anio, 1, {
                ...context,
                nivelElectiva: value ? (value as typeof context.nivelElectiva) : undefined,
              }),
              { scroll: false }
            )
          }
        />
      ) : null}
    </div>
    <MateriasResults key={`${carrera ?? "todas"}:${anio ?? "todos"}:${page}:${context.q ?? ""}:${context.nivelElectiva ?? ""}`} carrera={carrera} anio={anio} page={page} context={context} refreshKey={refreshKey} />
  </section>;
}

function MateriasResults({ carrera, anio, page, context, refreshKey }: { carrera: Carrera | undefined; anio: AnioCarrera | undefined; page: number; context: MateriaContext; refreshKey: number }) {
  const router = useRouter();
  const resultsFocus = useFocusOnMount<HTMLDivElement>();
  const row = (materia: Materia) => {
    const fila = carrera ? materia.carreras.find((c) => c.carrera === carrera) : undefined;
    const badge = carrerasResumenLabel(materia.carreras);
    const detailParts: string[] = [];
    if (fila?.anioCarrera === "ELECTIVA") detailParts.push(nivelElectivaLabel(fila.nivelElectiva));
    if (badge) detailParts.push(badge);
    const detail = detailParts.length ? `— ${detailParts.join(" — ")}` : undefined;
    return (
      <RowLink
        key={materia.id}
        href={materiaDetailHref(materia.id, carrera, anio, page, context)}
        detail={detail}
      >
        {materia.nombre}
      </RowLink>
    );
  };
  return <div ref={resultsFocus} tabIndex={-1} className={styles.results}>
    <PaginatedListView resetKey="materias" page={page} refreshKey={refreshKey} onPageChange={(next) => router.replace(materiaListHref(carrera, anio, next, context), { scroll: false })} fetchPage={(next) => listarMaterias({ page: next, carrera, anioCarrera: anio, ...context })}
      loadingMessage="Cargando materias…" errorMessage="Lo sentimos. No pudimos recuperar las materias. Intentá nuevamente." empty={<p>No hay materias que coincidan con la búsqueda y los filtros.</p>}>
      {(result) => {
        if (!carrera) return <div className="academic-panel"><ul className="row-list">{result.items.map(row)}</ul></div>;
        return [...ANIOS_CARRERA, null].map((group) => {
          const items = result.items.filter((materia) => (materia.carreras.find((c) => c.carrera === carrera)?.anioCarrera ?? null) === group);
          if (!items.length) return null;
          const groupId = `materias-grupo-${group ?? "sin-anio"}`;
          return <section className="academic-panel" key={group ?? "sin-anio"} aria-labelledby={groupId}>
            <div className={styles.groupHeader}>
              <h2 id={groupId}><span className={styles.groupBadge} aria-hidden="true">{group === "ELECTIVA" ? "E" : group ?? "–"}</span>{anioCarreraLabel(group)}</h2>
              <span className={styles.groupCount}>{items.length === 1 ? "1 materia" : `${items.length} materias`}</span>
            </div>
            <ul className="row-list">{items.map(row)}</ul>
          </section>;
        });
      }}
    </PaginatedListView>
  </div>;
}

function MateriaSearch({ query, onSearch }: { query: string; onSearch: (q: string) => void }) {
  const [value, setValue] = useState(query);
  const [error, setError] = useState("");
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const issue = validateMateriaSearch(value);
    setError(issue ?? "");
    if (!issue) onSearch(value.trim());
  }
  return <form className={styles.search} onSubmit={submit} noValidate role="search">
    <div className={styles.searchField}><label htmlFor="materia-search">Buscar por nombre</label><div className={styles.searchControls}><input id="materia-search" name="q" type="search" value={value} onChange={(event) => setValue(event.target.value)} placeholder="Nombre de la materia" maxLength={150} aria-invalid={Boolean(error)} aria-describedby={error ? "materia-search-error" : undefined} /><button className={`button ${styles.searchButton}`} type="submit">Buscar</button></div>{error ? <p id="materia-search-error" role="alert" className="field-error">{error}</p> : null}</div>
    {value || query ? <button className={`button ${styles.clearButton}`} type="button" onClick={() => { setValue(""); setError(""); onSearch(""); }}>Limpiar búsqueda</button> : null}
  </form>;
}
