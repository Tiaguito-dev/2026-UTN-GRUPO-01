"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useId, useState } from "react";
import { listarMaterias, listarProfesores, listarCursadasPorMateria, listarComisionesPorCursada } from "@/services/academic";
import type { PaginatedResult } from "@/services/pagination";
import { useUrlPagination } from "@/hooks/useUrlPagination";
import { useAllPages } from "@/hooks/useAllPages";
import { PageHeader } from "@/components/ui/PageHeader";
import { PaginatedListView } from "@/components/ui/PaginatedListView";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Notice } from "@/components/ui/Notice";
import { FormField } from "@/components/ui/FormField";
import { Dialog } from "@/components/ui/Dialog";
import { adminListHref, adminFormHref, type AdminSection } from "@/validations/admin";
import { carrerasResumenLabel } from "@/validations/materias";
import { periodoLabel } from "@/lib/format/periodo";
import { MateriaForm } from "./MateriaForm";
import { AltaCursada } from "./AltaCursada";
import { AltaProfesor } from "./AltaProfesor";
import { bloqueoDeOpciones, opcionesListas } from "./opciones";
import styles from "./AdminTables.module.css";

type Kind = Exclude<AdminSection, "usuarios">;
type Row = { id: string; cells: string[] };
const LABELS = { materias: "Materias", profesores: "Profesores", cursadas: "Cursadas", comisiones: "Comisiones" };
const SINGLE = { materias: "materia", profesores: "profesor", cursadas: "cursada", comisiones: "comisión" };
const COLUMNS = { materias: ["Nombre", "Carreras"], profesores: ["Nombre completo"], cursadas: ["Período", "Comisiones", "Profesores"], comisiones: ["Comisión", "Carrera", "Número", "Docentes"] };
export function AdminAcademicList({ kind }: { kind: Kind }) {
  const headingId = useId(); const router = useRouter(); const params = useSearchParams();
  const { page, setPage } = useUrlPagination();
  const materiaId = params.get("materiaId") ?? ""; const cursadaId = params.get("cursadaId") ?? "";
  const [creating, setCreating] = useState(false); const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(""); const [refreshKey, setRefreshKey] = useState(0);
  const context = { seccion: kind, page, materiaId, cursadaId };
  const href = adminListHref(context);
  const parentReady = kind !== "cursadas" && kind !== "comisiones" || Boolean(materiaId && (kind !== "comisiones" || cursadaId));
  const created = (text: string) => { setCreating(false); setMessage(text); setRefreshKey((value) => value + 1); };
  const changeParent = (materia: string, cursada?: string) => router.replace(adminListHref({ seccion: kind, page: 1, materiaId: materia, cursadaId: cursada }), { scroll: false });
  return <section aria-labelledby={headingId}>
    <PageHeader id={headingId} title={LABELS[kind]} description={`Administración de ${kind}.`} breadcrumb={[{ label: "Administración", href: "/home/admin" }, { label: LABELS[kind] }]} />
    <div className={styles.toolbar}>{kind === "comisiones" ? <Link className="button" href={`${adminFormHref("/home/admin/comisiones/nueva", href)}${cursadaId ? `&cursadaId=${encodeURIComponent(cursadaId)}` : ""}`}>Crear comisión</Link> : <button className="button" type="button" onClick={() => setCreating(true)}>Crear {SINGLE[kind]}</button>}</div>
    {message || params.get("successMessage") ? <Notice tone="success">{message || params.get("successMessage")}</Notice> : null}
    {kind === "cursadas" || kind === "comisiones" ? <AdminParentFilters kind={kind} materiaId={materiaId} cursadaId={cursadaId} onChange={changeParent} /> : null}
    {parentReady ? <PaginatedListView resetKey={`${kind}:${materiaId}:${cursadaId}`} page={page} refreshKey={refreshKey} onPageChange={setPage} fetchPage={(next) => fetchRows(kind, materiaId, cursadaId, next)} loadingMessage={`Cargando ${kind}…`} empty={<EmptyState action={<Link href="/home/admin">Volver al panel de administración</Link>}>No hay registros para mostrar.</EmptyState>}>
      {(result) => <Card variant="panel"><div className={styles.tableWrap}><table className={styles.table}><caption>{LABELS[kind]}: {result.total} registros</caption><thead><tr>{COLUMNS[kind].map((column) => <th scope="col" key={column}>{column}</th>)}<th scope="col" className={styles.actions}>Acciones</th></tr></thead><tbody>{result.items.map((row) => <tr key={row.id}>{row.cells.map((cell, index) => <td key={index}>{cell}</td>)}<td className={styles.actions}><Link className="button button-secondary" aria-label={`Editar ${row.cells[0]}`} href={adminFormHref(`/home/admin/${kind}/${encodeURIComponent(row.id)}/editar`, href)}>Editar</Link></td></tr>)}</tbody></table></div></Card>}
    </PaginatedListView> : <EmptyState>Elegí {kind === "cursadas" ? "una materia para ver sus cursadas." : "una materia y una cursada para ver sus comisiones."}</EmptyState>}
    {kind !== "comisiones" ? <Dialog open={creating} onClose={() => setCreating(false)} title={`Crear ${SINGLE[kind]}`} busy={saving}>
      {creating ? kind === "materias" ? <MateriaForm onCancel={() => setCreating(false)} onBusyChange={setSaving} onSuccess={(materia) => created(`Materia creada: ${materia.nombre}.`)} /> : kind === "profesores" ? <AltaProfesor onCancel={() => setCreating(false)} onBusyChange={setSaving} onSuccess={created} /> : materiaId ? <AltaCursada materiaId={materiaId} onCancel={() => setCreating(false)} onBusyChange={setSaving} onSuccess={created} /> : <Notice tone="warning">Seleccioná una materia antes de crear una cursada.</Notice> : null}
    </Dialog> : null}
  </section>;
}
function AdminParentFilters({ kind, materiaId, cursadaId, onChange }: { kind: "cursadas" | "comisiones"; materiaId: string; cursadaId: string; onChange: (materia: string, cursada?: string) => void }) {
  const materias = useAllPages("materias", (page) => listarMaterias({ page, pageSize: 100 }));
  const cursadas = useAllPages(kind === "comisiones" ? materiaId : "", (page) => listarCursadasPorMateria(materiaId, { page, pageSize: 100 }));
  const blocked = bloqueoDeOpciones([{ ...materias, nombre: "materias", vacio: "Todavía no hay materias." }, ...(kind === "comisiones" && materiaId ? [{ ...cursadas, nombre: "cursadas", vacio: "Esta materia no tiene cursadas." }] : [])]);
  return <div className={styles.filters}>{blocked}<FormField name="admin-materia" label="Materia" required={false} value={materiaId} options={opcionesListas(materias.state).map((m) => ({ value: m.id, label: m.nombre }))} onChange={(id) => onChange(id)} />{kind === "comisiones" ? <FormField name="admin-cursada" label="Cursada" required={false} value={cursadaId} options={opcionesListas(cursadas.state).map((c) => ({ value: c.id, label: periodoLabel(c.anio, c.cuatrimestre) }))} onChange={(id) => onChange(materiaId, id)} /> : null}</div>;
}
async function fetchRows(kind: Kind, materiaId: string, cursadaId: string, page: number): Promise<PaginatedResult<Row>> {
  if (kind === "materias") { const result = await listarMaterias({ page, pageSize: 9 }); return { ...result, items: result.items.map((m) => ({ id: m.id, cells: [m.nombre, carrerasResumenLabel(m.carreras)] })) }; }
  if (kind === "profesores") { const result = await listarProfesores({ page, pageSize: 20 }); return { ...result, items: result.items.map((p) => ({ id: p.id, cells: [p.nombreCompleto] })) }; }
  if (kind === "cursadas") { const result = await listarCursadasPorMateria(materiaId, { page, pageSize: 20 }); return { ...result, items: result.items.map((c) => ({ id: c.id, cells: [periodoLabel(c.anio, c.cuatrimestre), String(c.comisiones), String(c.profesores)] })) }; }
  const result = await listarComisionesPorCursada(cursadaId, { page, pageSize: 20 }); return { ...result, items: result.items.map((c) => ({ id: c.id, cells: [c.nombre, c.carrera, String(c.numero), c.profesores.map((p) => `${p.nombreCompleto} (${p.cargo})`).join(", ") || "Sin docentes asignados"] })) };
}
