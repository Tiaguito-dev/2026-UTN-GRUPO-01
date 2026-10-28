"use client";
import { useId, useState } from "react";
import { listarHistorialAdministrativo, type AdminHistoryKind } from "@/services/admin-history";
import { usePaginatedFetch } from "@/hooks/usePaginatedFetch";
import { Notice } from "@/components/ui/Notice";
import { Pagination } from "@/components/ui/Pagination";
import styles from "./AdminTables.module.css";

const FIELDS: Record<string, string> = { nombreCompleto: "Nombre completo", materiaId: "Materia", anio: "Año", cuatrimestre: "Período", carrera: "Carrera", numero: "Número", deletedAt: "Fecha de baja", disabledAt: "Fecha de desactivación", activa: "Estado", estado: "Estado" };
const ACTIONS: Record<string, string> = { EDICION: "Edición", ELIMINACION: "Eliminación", DESACTIVACION: "Desactivación", REACTIVACION: "Reactivación", ACTIVACION: "Activación" };
export function AdminHistory({ kind, id }: { kind: AdminHistoryKind; id: string }) {
  const headingId = useId(); const [page, setPage] = useState(1);
  const { state, retry } = usePaginatedFetch(`${kind}:${id}:historial`, (next) => listarHistorialAdministrativo(kind, id, { page: next, pageSize: 3 }), page);
  return <section className={styles.history} aria-labelledby={headingId}>
    <h2 id={headingId}>Historial de cambios</h2>
    {state.status === "loading" ? <p role="status">Cargando historial…</p> : state.status === "error" ? <Notice tone="error">Lo sentimos. No pudimos recuperar el historial. Intentá nuevamente. <button className="button button-secondary" type="button" onClick={retry}>Reintentar historial</button></Notice> : <>
      {state.data.items.length ? <ol className={styles.historyList}>{state.data.items.map((entry) => <li key={entry.id}><p><strong>{ACTIONS[entry.accion] ?? "Cambio administrativo"}</strong> · <time dateTime={entry.createdAt}>{new Date(entry.createdAt).toLocaleString("es-AR")}</time></p><dl>{entry.cambios.map((change, index) => <div key={`${change.campo}:${index}`}><dt>{FIELDS[change.campo] ?? change.campo}</dt><dd><span>Antes: {change.anterior ?? "Sin valor"}</span><span>Ahora: {change.nuevo ?? "Sin valor"}</span></dd></div>)}</dl></li>)}</ol> : <p>{state.data.total ? "No hay cambios en esta página." : "Todavía no hay cambios registrados."}</p>}
      {page > 1 && !state.data.items.length ? <button className="button button-secondary" type="button" onClick={() => setPage(1)}>Volver al inicio del historial</button> : null}
      <Pagination page={page} pageSize={3} total={state.data.total} onChange={setPage} />
    </>}
  </section>;
}
