"use client";
import Link from "next/link";
import { Plus } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useId, useState } from "react";
import { listarMaterias, listarProfesores, listarCursadasPorMateria, listarComisionesPorCursada, obtenerCursada, type CursadaDetalle } from "@/services/academic";
import type { PaginatedResult } from "@/services/pagination";
import { useUrlPagination } from "@/hooks/useUrlPagination";
import { obtenerMateria } from "@/services/materias";
import { usePaginatedFetch, type AsyncState } from "@/hooks/usePaginatedFetch";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { PageHeader } from "@/components/ui/PageHeader";
import { Notice } from "@/components/ui/Notice";
import { Dialog } from "@/components/ui/Dialog";
import { adminCreationHref, adminListHref, adminFormHref, readAdminFilters, safeAdminReturnTo, safeMateriaListOrigin, type AdminSection, type AdminContext } from "@/validations/admin";
import { cursadaDetailHref, cursadasListHref, materiaDetailHref } from "@/validations/admin-academic-navigation";
import type { BreadcrumbItem } from "@/components/ui/Breadcrumb";
import { ANIOS_CARRERA, CARRERAS, NIVELES_ELECTIVA, anioCarreraLabel, carreraLabel, nivelElectivaLabel } from "@/validations/materias";
import { periodoLabel } from "@/lib/format/periodo";
import { cargoLabel } from "@/lib/format/cargo";
import { AcademicDeleteDialog } from "./AcademicDeleteAction";
import { MateriaForm } from "./MateriaForm";
import { AltaCursada } from "./AltaCursada";
import { AltaProfesor } from "./AltaProfesor";
import { AdminParentSelector } from "./AdminParentSelector";
import { AdminTable, AdminListResult, AdminRowActions, AdminSearch, AdminSelect, type AdminRow } from "./AdminTable";
import styles from "./AdminTables.module.css";

type Kind = Exclude<AdminSection, "usuarios">;
const LABELS = { materias: "Materias", profesores: "Profesores", cursadas: "Cursadas", comisiones: "Comisiones" };
const NEW = { materias: "Nueva materia", profesores: "Nuevo profesor", cursadas: "Nueva cursada", comisiones: "Nueva comisión" };
const DESCRIPTIONS = { materias: "Consultá y administrá las materias por nombre, carrera y año.", profesores: "Buscá docentes y accedé a sus datos administrativos.", cursadas: "Administrá los períodos de cursada de cada materia.", comisiones: "Consultá comisiones por materia, período y carrera." };
const COLUMNS = { materias: ["Nombre", "Carreras y años"], profesores: ["Nombre completo"], cursadas: ["Período", "Comisiones", "Profesores"], comisiones: ["Comisión", "Carrera", "Número", "Docentes"] };
export function AdminAcademicList({ kind }: { kind: Kind }) {
  const headingId = useId(); const router = useRouter(); const params = useSearchParams();
  const { page, setPage } = useUrlPagination();
  const materiaId = params.get("materiaId") ?? ""; const cursadaId = params.get("cursadaId") ?? "";
  const materiaReturnTo = safeMateriaListOrigin(params.get("materiaReturnTo")) ?? "/home/admin/materias";
  const requestedBack = safeAdminReturnTo(params.get("returnTo"));
  const filters = readAdminFilters(params);
  const [deleting, setDeleting] = useState<AdminRow | null>(null);
  const [creating, setCreating] = useState(false); const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(""); const [refreshKey, setRefreshKey] = useState(0);
  const [outsideFilters, setOutsideFilters] = useState(false);
  const [parentResult, setParentResult] = useState<{ key: string; data: { materia?: { id: string; nombre: string }; cursada?: Pick<CursadaDetalle, "id" | "anio" | "cuatrimestre"> } } | null>(null);
  const parentKey = `${kind}:${materiaId}:${cursadaId}`;
  const parent = parentResult?.key === parentKey ? parentResult.data : null;
  useEffect(() => {
    if (!materiaId || (kind === "comisiones" && !cursadaId)) return;
    let active = true;
    const load = kind === "comisiones" ? obtenerCursada(cursadaId).then(cursada => {
      if (cursada.id !== cursadaId || cursada.materia.id !== materiaId) throw new Error("El período no pertenece a la materia seleccionada.");
      return { materia: cursada.materia, cursada };
    }) : obtenerMateria(materiaId).then(materia => {
      if (materia.id !== materiaId) throw new Error("No se encontró la materia seleccionada.");
      return { materia };
    });
    load.then(value => { if (active) setParentResult({ key: parentKey, data: value }); }, () => { if (active) setParentResult({ key: parentKey, data: {} }); });
    return () => { active = false; };
  }, [kind, materiaId, cursadaId, parentKey]);
  const contextual = (kind === "cursadas" && Boolean(materiaId)) || (kind === "comisiones" && Boolean(materiaId && cursadaId));
  // The parent level derives from the IDs in the URL; the list carries no returnTo of its own.
  const parentCursadasHref = cursadasListHref(materiaId, materiaReturnTo);
  const parentHref = kind === "cursadas" ? materiaDetailHref(materiaId, materiaReturnTo) : parent?.cursada ? cursadaDetailHref(parent.cursada.id, parentCursadasHref) : "/home/admin/cursadas";
  const returnTo = contextual ? parentHref : requestedBack;
  const context: AdminContext = { seccion: kind, page, materiaId, cursadaId, materiaReturnTo, ...filters };
  const href = adminListHref(context);
  const parentReady = kind !== "cursadas" && kind !== "comisiones" || Boolean(materiaId && parent?.materia && (kind !== "comisiones" || parent.cursada));
  const hierarchy: BreadcrumbItem[] = contextual && parent?.materia ? [
    { label: "Administración", href: "/home/admin" },
    { label: "Materias", href: materiaReturnTo },
    { label: parent.materia.nombre, href: materiaDetailHref(materiaId, materiaReturnTo) },
    ...(kind === "comisiones" && parent.cursada ? [{ label: "Cursadas", href: parentCursadasHref }, { label: `Cursada ${periodoLabel(parent.cursada.anio, parent.cursada.cuatrimestre)}`, href: cursadaDetailHref(parent.cursada.id, parentCursadasHref) }] : []),
    { label: LABELS[kind] },
  ] : [{ label: "Administración", href: "/home/admin" }, { label: LABELS[kind] }];
  const changeFilters = (next: Partial<AdminContext>) => router.replace(adminListHref({ ...context, ...next, page: 1 }), { scroll: false });
  const created = (text: string, record: Parameters<typeof adminCreationHref>[2] = {}) => { setOutsideFilters(new URL(adminCreationHref(href, text, record), "https://local.invalid").searchParams.has("creationOutsideFilters")); setCreating(false); setMessage(text); setRefreshKey((value) => value + 1); setPage(1); };
  const active = Boolean(filters.q || filters.carrera || filters.anioCarrera || filters.nivelElectiva);
  return <section className={styles.page} aria-labelledby={headingId}>
    <PageHeader id={headingId} title={LABELS[kind]} description={DESCRIPTIONS[kind]} back={contextual && returnTo ? { href: returnTo, label: "contexto administrativo" } : undefined} breadcrumb={hierarchy} />
    {message || params.get("successMessage") ? <Notice tone="success">{message || params.get("successMessage")}</Notice> : null}
    {outsideFilters || params.get("creationOutsideFilters") === "1" ? <Notice tone="warning">El registro se creó correctamente, pero no coincide con los filtros seleccionados. <button className="button button-secondary" type="button" onClick={() => { setOutsideFilters(false); router.replace(adminListHref({ seccion: kind, page: 1 }), { scroll: false }); }}>Limpiar filtros para buscar el registro</button></Notice> : null}
    <div className={styles.toolbar}><div className={styles.filters}>
      {kind === "materias" || kind === "profesores" ? <AdminSearch key={filters.q ?? ""} query={filters.q ?? ""} onSearch={(q) => changeFilters({ q })} /> : <AdminParentFilters kind={kind} materiaId={materiaId} cursadaId={cursadaId} onChange={(materia, cursada) => changeFilters({ materiaId: materia, cursadaId: cursada })} />}
      {kind === "materias" || kind === "comisiones" ? <AdminSelect label="Carrera" all="Todas las carreras" value={filters.carrera ?? ""} options={CARRERAS.map((value) => ({ value, label: carreraLabel(value) }))} onChange={(carrera) => changeFilters({ carrera })} /> : null}
      {kind === "materias" ? <><AdminSelect label="Año de la carrera" all="Todos los años" value={filters.anioCarrera ?? ""} options={ANIOS_CARRERA.map((value) => ({ value, label: anioCarreraLabel(value) }))} onChange={(anioCarrera) => changeFilters({ anioCarrera, nivelElectiva: undefined })} />{filters.anioCarrera === "ELECTIVA" ? <AdminSelect label="Nivel de electiva" all="Todos los niveles" value={filters.nivelElectiva ?? ""} options={NIVELES_ELECTIVA.map((value) => ({ value, label: nivelElectivaLabel(value) }))} onChange={(nivelElectiva) => changeFilters({ nivelElectiva })} /> : null}</> : null}
      {active ? <button className="button button-secondary" type="button" onClick={() => changeFilters({ q: undefined, carrera: undefined, anioCarrera: undefined, nivelElectiva: undefined })}>Limpiar filtros</button> : null}
    </div>{kind === "comisiones" ? <Link className={`button ${styles.create}`} href={`${adminFormHref("/home/admin/comisiones/nueva", href)}${cursadaId ? `&cursadaId=${encodeURIComponent(cursadaId)}` : ""}`}><Plus size={18} aria-hidden="true" />{NEW[kind]}</Link> : <button className={`button ${styles.create}`} type="button" disabled={kind === "cursadas" && !materiaId} onClick={() => setCreating(true)}><Plus size={18} aria-hidden="true" />{NEW[kind]}</button>}</div>
    {parentReady ? kind === "materias" ? <MateriasResults context={context} href={href} refreshKey={refreshKey} onPageChange={setPage} onDelete={setDeleting} /> : <CatalogResults kind={kind} context={context} href={href} refreshKey={refreshKey} onPageChange={setPage} onDelete={setDeleting} /> : <div className={styles.empty}>Elegí {kind === "cursadas" ? "una materia para ver sus cursadas." : "una materia y un período para ver sus comisiones."}</div>}
    {deleting ? <AcademicDeleteDialog key={deleting.id} kind={kind} id={deleting.id} label={deleting.cells[0]} onClose={() => setDeleting(null)} onSuccess={() => { setDeleting(null); setMessage("El registro se dio de baja correctamente."); setRefreshKey((value) => value + 1); }} /> : null}
    {kind !== "comisiones" ? <Dialog open={creating} onClose={() => setCreating(false)} title={NEW[kind]} busy={saving}>
      {creating ? kind === "materias" ? <MateriaForm onCancel={() => setCreating(false)} onBusyChange={setSaving} onSuccess={(materia) => created(`Materia creada: ${materia.nombre}.`, materia)} /> : kind === "profesores" ? <AltaProfesor onCancel={() => setCreating(false)} onBusyChange={setSaving} onSuccess={(text, nombreCompleto) => created(text, { nombreCompleto })} /> : materiaId ? <AltaCursada materiaId={materiaId} onCancel={() => setCreating(false)} onBusyChange={setSaving} onSuccess={(text) => created(text)} /> : null : null}
    </Dialog> : null}
  </section>;
}
function AdminParentFilters({ kind, materiaId, cursadaId, onChange }: { kind: "cursadas" | "comisiones"; materiaId: string; cursadaId: string; onChange: (materia: string, cursada?: string) => void }) {
  return <><AdminParentSelector label="Materia" resourceKey="admin-materias" value={materiaId} searchable fetchPage={async (page, q) => { const result = await listarMaterias({ page, pageSize: 9, q }); return { ...result, items: result.items.map((m) => ({ id: m.id, label: m.nombre })) }; }} fetchSelected={async (id) => { const materia = await obtenerMateria(id); return { id: materia.id, label: materia.nombre }; }} onChange={(id) => onChange(id)} />{kind === "comisiones" ? <AdminParentSelector label="Período" resourceKey={`admin-periodos:${materiaId}`} value={cursadaId} disabled={!materiaId} fetchPage={async (page) => { const result = await listarCursadasPorMateria(materiaId, { page, pageSize: 9 }); return { ...result, items: result.items.map((c) => ({ id: c.id, label: periodoLabel(c.anio, c.cuatrimestre) })) }; }} fetchSelected={async (id) => { const cursada = await obtenerCursada(id); return { id: cursada.id, label: periodoLabel(cursada.anio, cursada.cuatrimestre) }; }} onChange={(id) => onChange(materiaId, id)} /> : null}</>;
}
interface ResultsProps { context: AdminContext; href: string; refreshKey: number; onPageChange: (page: number) => void; onDelete: (row: AdminRow) => void }
function useAcademicPage<T>(state: AsyncState<PaginatedResult<T>>, page: number, onPageChange: (page: number) => void) {
  const lastPage = state.status === "ready" ? Math.max(1, Math.ceil(state.data.total / state.data.pageSize)) : undefined;
  useEffect(() => { if (lastPage !== undefined && page > lastPage) onPageChange(lastPage); }, [lastPage, page, onPageChange]);
}
function MateriasResults({ context, href, refreshKey, onPageChange, onDelete }: ResultsProps) {
  const filters = readAdminFilters(new URLSearchParams(href.split("?")[1]));
  const { state, retry } = usePaginatedFetch(JSON.stringify(filters), (page) => listarMaterias({ page, pageSize: 9, q: filters.q, carrera: filters.carrera, anioCarrera: filters.anioCarrera, nivelElectiva: filters.nivelElectiva }), context.page, refreshKey);
  useAcademicPage(state, context.page, onPageChange);
  return <AdminListResult loadingMessage="Cargando materias…" state={state} retry={retry} page={context.page} onPageChange={onPageChange}>{(result) => <AcademicTable kind="materias" href={href} onDelete={onDelete} rows={result.items.map((m) => ({ id: m.id, cells: [m.nombre, m.carreras.length ? m.carreras.map((c) => <div key={c.carrera}>{carreraLabel(c.carrera)} · {anioCarreraLabel(c.anioCarrera)}{c.nivelElectiva ? ` · ${nivelElectivaLabel(c.nivelElectiva)}` : ""}</div>) : "Sin carreras asignadas"], editable: !m.deletedAt, deletable: !m.deletedAt }))} />}</AdminListResult>;
}
function CatalogResults({ kind, context, href, refreshKey, onPageChange, onDelete }: ResultsProps & { kind: Exclude<Kind, "materias"> }) {
  const { state, retry } = usePaginatedFetch(`${kind}:${context.materiaId}:${context.cursadaId}:${context.q}:${context.carrera}`, (page) => fetchCatalogRows(kind, context, page), context.page, refreshKey);
  useAcademicPage(state, context.page, onPageChange);
  return <AdminListResult loadingMessage={`Cargando ${kind}…`} state={state} retry={retry} page={context.page} onPageChange={onPageChange}>{(data) => <AcademicTable kind={kind} href={href} rows={data.items} onDelete={onDelete} />}</AdminListResult>;
}
function AcademicTable({ kind, href, rows, onDelete }: { kind: Kind; href: string; rows: AdminRow[]; onDelete: (row: AdminRow) => void }) {
  const isAdmin = useIsAdmin();
  return <AdminTable title={LABELS[kind]} columns={COLUMNS[kind]} rows={rows} actions={(row) => <AdminRowActions row={row} kind={kind} returnTo={href} onDelete={isAdmin ? () => onDelete(row) : undefined} />} />;
}
async function fetchCatalogRows(kind: Exclude<Kind, "materias">, context: AdminContext, page: number): Promise<PaginatedResult<AdminRow>> {
  if (kind === "profesores") { const result = await listarProfesores({ page, pageSize: 9, q: context.q }); return { ...result, items: result.items.map((p) => ({ id: p.id, cells: [p.nombreCompleto], editable: !p.deletedAt, deletable: !p.deletedAt })) }; }
  if (kind === "cursadas") { const result = await listarCursadasPorMateria(context.materiaId ?? "", { page, pageSize: 9 }); return { ...result, items: result.items.map((c) => ({ id: c.id, cells: [periodoLabel(c.anio, c.cuatrimestre), String(c.comisiones), String(c.profesores)] })) }; }
  const filters = readAdminFilters(new URLSearchParams(context.carrera ? { carrera: context.carrera } : {}));
  const result = await listarComisionesPorCursada(context.cursadaId ?? "", { page, pageSize: 9, carrera: filters.carrera }); return { ...result, items: result.items.map((c) => ({ id: c.id, editable: !c.deletedAt && c.activa, deletable: !c.deletedAt, cells: [c.nombre, carreraLabel(c.carrera), String(c.numero), c.profesores.map((p) => `${p.nombreCompleto} (${cargoLabel(p.cargo)})`).join(", ") || "Sin docentes asignados"] })) };
}
