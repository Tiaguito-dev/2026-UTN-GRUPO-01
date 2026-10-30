"use client";
import Link from "next/link";
import { Search, ChevronRight } from "lucide-react";
import { useSearchParams, useRouter } from "next/navigation";
import { useId, useState, type FormEvent } from "react";
import { listarMaterias } from "@/services/materias";
import type { AnioCarrera, Carrera, Materia, MateriaCarrera } from "@/types/materias";
import { useFocusOnMount } from "@/hooks/useFocusOnMount";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { usePaginatedFetch } from "@/hooks/usePaginatedFetch";
import { ANIOS_CARRERA, CARRERAS, anioCarreraLabel, carreraLabel, carreraShortLabel, isAnioCarrera, isCarrera, materiaListHref, materiaDetailHref, modalidadLabel, parseMateriaPage, parseMateriaContext, validateMateriaSearch, nivelElectivaLabel, type MateriaContext } from "@/validations/materias";
import { PageHeader } from "@/components/ui/PageHeader";
import { Pagination } from "@/components/ui/Pagination";
import { Notice } from "@/components/ui/Notice";
import { Dialog } from "@/components/ui/Dialog";
import { MateriaForm } from "@/components/admin/MateriaForm";
import { PlusIcon } from "./detalle";
import styles from "./MateriasList.module.css";

const YEAR_GROUP_LABEL: Record<AnioCarrera, string> = { "1": "Primer año", "2": "Segundo año", "3": "Tercer año", "4": "Cuarto año", "5": "Quinto año", ELECTIVA: "Electivas" };

export function MateriasList() {
  const params = useSearchParams();
  const router = useRouter();
  const rawCarrera = params.get("carrera");
  const carrera = isCarrera(rawCarrera) ? rawCarrera : undefined;
  const rawAnio = params.get("anioCarrera");
  const anio = isAnioCarrera(rawAnio) ? rawAnio : undefined;
  const page = parseMateriaPage(params.get("page"));
  const context = parseMateriaContext(params);
  const headingId = useId();
  const carreraId = useId();
  const anioId = useId();
  const isAdmin = useIsAdmin();
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const activeFilters = Boolean(carrera || anio || context.q || context.nivelElectiva);
  const filterLabels = [carrera ? carreraShortLabel(carrera) : "", anio ? anio === "ELECTIVA" ? "Electivas" : anioCarreraLabel(anio) : "", context.nivelElectiva ? nivelElectivaLabel(context.nivelElectiva) : "", context.q ? `“${context.q}”` : ""].filter(Boolean);

  return <section className={styles.page} aria-labelledby={headingId}>
    <div className={styles.header}>
      <PageHeader id={headingId} title="Materias" description="Explorá las materias por carrera, año o nombre y conocé las experiencias de sus comisiones." />
      {isAdmin ? <button className={`button ${styles.newButton}`} type="button" onClick={() => setCreating(true)}><PlusIcon />Nueva materia</button> : null}
    </div>
    {params.get("successMessage") ? <Notice tone="success">{params.get("successMessage")}</Notice> : null}
    {created ? <Notice tone="success">{created}</Notice> : null}
    {isAdmin ? <Dialog open={creating} onClose={() => setCreating(false)} title="Nueva materia" description="El nombre no puede repetirse." busy={saving}>
      {creating ? <MateriaForm onCancel={() => setCreating(false)} onBusyChange={setSaving} onSuccess={(materia) => {
        setCreating(false); setCreated(`Materia creada: ${materia.nombre}.`); setRefreshKey((key) => key + 1);
      }} /> : null}
    </Dialog> : null}
    <div className={styles.filters}>
      <div className={styles.filterFields}>
        <div className={styles.filterField}>
          <label htmlFor={carreraId}>Carrera</label>
          <select id={carreraId} value={carrera ?? ""} onChange={(event) => {
            const next = isCarrera(event.target.value) ? event.target.value : undefined;
            router.replace(materiaListHref(next, anio, 1, { ...context, carrera: next }), { scroll: false });
          }}>
            <option value="">Todas las carreras</option>{CARRERAS.map((value) => <option key={value} value={value}>{carreraShortLabel(value)}</option>)}
          </select>
        </div>
        <div className={styles.filterField}>
          <label htmlFor={anioId}>Año de la carrera</label>
          <select id={anioId} value={anio ?? ""} onChange={(event) => {
            const next = isAnioCarrera(event.target.value) ? event.target.value : undefined;
            router.replace(materiaListHref(carrera, next, 1, { ...context, nivelElectiva: next === "ELECTIVA" ? context.nivelElectiva : undefined }), { scroll: false });
          }}>
            <option value="">Todos los años</option>{ANIOS_CARRERA.map((value) => <option key={value} value={value}>{value === "ELECTIVA" ? "Electivas" : anioCarreraLabel(value)}</option>)}
          </select>
        </div>
        <MateriaSearch key={context.q ?? ""} query={context.q ?? ""} onSearch={(q) => router.replace(materiaListHref(carrera, anio, 1, { ...context, q }), { scroll: false })} />
      </div>
      {activeFilters ? <div className={styles.filterSummary}>
        <p>Filtros: {filterLabels.join(" · ")}</p>
        <button className={styles.clearButton} type="button" onClick={() => router.replace("/home/materias", { scroll: false })}>Limpiar filtros</button>
      </div> : null}
    </div>
    <MateriasResults key={`${carrera ?? "todas"}:${anio ?? "todos"}:${page}:${context.q ?? ""}:${context.nivelElectiva ?? ""}`} carrera={carrera} anio={anio} page={page} context={context} refreshKey={refreshKey} />
  </section>;
}

function matchingAssociations(materia: Materia, carrera: Carrera | undefined, anio: AnioCarrera | undefined, context: MateriaContext): MateriaCarrera[] {
  return materia.carreras.filter((association) => (!carrera || association.carrera === carrera) && (!anio || association.anioCarrera === anio) && (!context.nivelElectiva || association.nivelElectiva === context.nivelElectiva));
}

function compareMaterias(first: Materia, second: Materia): number {
  const normalize = (value: string) => value.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase("es");
  return normalize(first.nombre).localeCompare(normalize(second.nombre), "es") || first.id.localeCompare(second.id);
}

function associationMetadata(association: MateriaCarrera): string {
  return association.anioCarrera === "ELECTIVA"
    ? `${carreraLabel(association.carrera)} · Electiva · ${association.nivelElectiva ? `Nivel ${association.nivelElectiva}` : "Sin nivel asignado"}`
    : `${carreraLabel(association.carrera)} · ${anioCarreraLabel(association.anioCarrera)}`;
}

function MateriasResults({ carrera, anio, page, context, refreshKey }: { carrera: Carrera | undefined; anio: AnioCarrera | undefined; page: number; context: MateriaContext; refreshKey: number }) {
  const router = useRouter();
  const groupPrefix = useId();
  const resultsFocus = useFocusOnMount<HTMLDivElement>();
  const resetKey = JSON.stringify(["materias", carrera, anio, context.q, context.nivelElectiva]);
  const { state, retry } = usePaginatedFetch(resetKey, (next) => listarMaterias({ page: next, carrera, anioCarrera: anio, ...context }), page, refreshKey);
  const changePage = (next: number) => router.replace(materiaListHref(carrera, anio, next, context), { scroll: false });
  const filterSummary = [carrera ? carreraShortLabel(carrera) : "Todas las carreras", anio ? YEAR_GROUP_LABEL[anio] : "Todos los años", context.q ? `“${context.q}”` : ""].filter(Boolean).join(" · ");
  return <div ref={resultsFocus} tabIndex={-1} className={styles.results}>
    {state.status === "loading" ? <p role="status">Cargando materias…</p> : state.status === "error" ? <Notice tone="error">Lo sentimos. No pudimos recuperar las materias. Intentá nuevamente. {state.error} <button className="button" type="button" onClick={retry}>Reintentar</button></Notice> : <>
      <div className={styles.resultSummary}>
        <p className={styles.resultTotal}>{state.data.total === 1 ? "1 materia" : `${state.data.total} materias`}<span className={styles.resultFilters}> · {filterSummary}</span></p>
        {state.data.items.length ? <p className={styles.resultRange}>Mostrando {(state.data.page - 1) * state.data.pageSize + 1}–{Math.min(state.data.total, (state.data.page - 1) * state.data.pageSize + state.data.items.length)} de {state.data.total}</p> : null}
      </div>
      {!anio && state.data.items.length ? <p className={styles.projectionNote}>Una materia puede aparecer en varios años; se cuenta una sola vez en el total.</p> : null}
      {state.data.items.length === 0 ? state.data.total === 0 ? <div className={styles.empty}><p>No hay materias que coincidan con la búsqueda y los filtros.</p><button className="button button-secondary" type="button" onClick={() => router.replace("/home/materias", { scroll: false })}>Limpiar búsqueda y filtros</button></div> : <p>No hay materias en esta página. <button className="button button-secondary" type="button" onClick={() => changePage(1)}>Volver a la primera página</button></p> : [...ANIOS_CARRERA, null].map((group) => {
        const entries = state.data.items.flatMap((materia) => {
          const associations = matchingAssociations(materia, carrera, anio, context).filter((association) => association.anioCarrera === group);
          return associations.length || (group === null && !carrera && !anio && !context.nivelElectiva && materia.carreras.length === 0) ? [{ materia, associations }] : [];
        });
        if (!entries.length) return null;
        entries.sort((first, second) => compareMaterias(first.materia, second.materia));
        const groupId = `${groupPrefix}-${group ?? "sin-anio"}`;
        return <section className={styles.group} key={group ?? "sin-anio"} aria-labelledby={groupId}>
          <div className={styles.groupHeader}><h2 id={groupId}>{group ? YEAR_GROUP_LABEL[group] : "Sin año asignado"}</h2><span className={styles.groupCount}>{entries.length === 1 ? "1 materia" : `${entries.length} materias`}</span></div>
          <ul className={styles.rows}>{entries.map(({ materia, associations }) => <li key={materia.id}>
            <Link className={styles.row} href={materiaDetailHref(materia.id, carrera, anio, page, context)}>
              <span className={styles.rowText}><span className={styles.rowTitle}>{materia.nombre}</span>
                {associations.length ? <span className={styles.rowMetadata}>{associations.map(associationMetadata).join(" / ")}</span> : null}
                <span className={styles.rowMetadata}>{modalidadLabel(materia.modalidad)}</span>
              </span><ChevronRight className={styles.chevron} aria-hidden="true" focusable="false" size={18} strokeWidth={1.75} />
            </Link>
          </li>)}</ul>
        </section>;
      })}
      <Pagination page={page} pageSize={state.data.pageSize} total={state.data.total} onChange={changePage} />
    </>}
  </div>;
}

function MateriaSearch({ query, onSearch }: { query: string; onSearch: (q: string) => void }) {
  const searchId = useId();
  const [value, setValue] = useState(query);
  const [error, setError] = useState("");
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const issue = validateMateriaSearch(value);
    setError(issue ?? "");
    if (!issue) onSearch(value.trim());
  }
  return <form className={`${styles.search} ${styles.filterField}`} onSubmit={submit} noValidate role="search">
    <label htmlFor={searchId}>Buscar por nombre</label>
    <div className={styles.searchControls}>
      <div className={styles.searchInput}><Search className={styles.searchIcon} aria-hidden="true" focusable="false" size={18} strokeWidth={1.75} /><input id={searchId} name="q" type="search" value={value} onChange={(event) => setValue(event.target.value)} placeholder="Nombre de la materia" aria-invalid={Boolean(error)} aria-describedby={error ? `${searchId}-error` : undefined} /></div>
      <button className={`button ${styles.searchButton}`} type="submit">Buscar</button>
    </div>
    {error ? <p id={`${searchId}-error`} role="alert" className="field-error">{error}</p> : null}
  </form>;
}
