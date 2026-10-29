"use client";

import Link from "next/link";
import { useId, useState, type ReactNode } from "react";
import { Eye, Pencil, Search, Trash2, type LucideIcon } from "lucide-react";
import type { AsyncState } from "@/hooks/usePaginatedFetch";
import type { PaginatedResult } from "@/services/pagination";
import { Notice } from "@/components/ui/Notice";
import { Pagination } from "@/components/ui/Pagination";
import { adminFormHref } from "@/validations/admin";
import { validateMateriaSearch } from "@/validations/materias";
import styles from "./AdminTables.module.css";

export interface AdminRow { id: string; cells: ReactNode[]; editable?: boolean; deletable?: boolean }

export function AdminTable({ title, columns, rows, actions }: { title: string; columns: string[]; rows: AdminRow[]; actions?: (row: AdminRow) => ReactNode }) {
  // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- La región con scroll necesita foco para desplazarse con teclado.
  return <div className={styles.tableWrap} role="region" aria-label={`Tabla de ${title.toLocaleLowerCase("es")}`} tabIndex={0}>
    <table className={styles.table}><caption>{title}</caption>
      <thead><tr>{columns.map((column) => <th key={column} scope="col">{column}</th>)}{actions ? <th scope="col" className={styles.actions}>Acciones</th> : null}</tr></thead>
      <tbody>{rows.map((row) => <tr key={row.id}>{row.cells.map((cell, i) => <td key={i}>{cell}</td>)}{actions ? <td className={styles.actions}><div className={styles.rowActions}>{actions(row)}</div></td> : null}</tr>)}</tbody>
    </table>
  </div>;
}

export function AdminRowActions({ row, kind, returnTo, onDelete }: { row: AdminRow; kind: string; returnTo: string; onDelete?: () => void }) {
  const path = `/home/admin/${kind}/${encodeURIComponent(row.id)}`;
  return <><ActionLink href={`${path}?${new URLSearchParams({ returnTo })}`} label={`Ver detalle de ${row.cells[0]}`} icon="view" />
    {row.editable !== false ? <ActionLink href={adminFormHref(`${path}/editar`, returnTo)} label={`Editar ${row.cells[0]}`} icon="edit" /> : null}
    {onDelete && row.deletable !== false ? <AdminActionButton label={`Dar de baja ${row.cells[0]}`} icon={Trash2} onClick={onDelete} /> : null}</>;
}

export function AdminActionButton({ label, icon: Icon, onClick, disabled = false }: { label: string; icon: LucideIcon; onClick: () => void; disabled?: boolean }) {
  const tooltipId = useId(); const [dismissed, setDismissed] = useState(false);
  return <span className={styles.action} onMouseLeave={() => setDismissed(false)}>
    <button type="button" className={styles.iconButton} disabled={disabled} aria-label={label} aria-describedby={dismissed ? undefined : tooltipId} onClick={onClick} onFocus={() => setDismissed(false)} onBlur={() => setDismissed(false)} onKeyDown={(event) => { if (event.key === "Escape") setDismissed(true); }}><Icon size={18} aria-hidden="true" /></button>
    <span id={tooltipId} role="tooltip" className={styles.tooltip} hidden={dismissed}>{label}</span>
  </span>;
}

function ActionLink({ href, label, icon }: { href: string; label: string; icon: "view" | "edit" }) {
  const tooltipId = useId(); const [dismissed, setDismissed] = useState(false);
  const Icon = icon === "view" ? Eye : Pencil;
  return <span className={styles.action} onMouseLeave={() => setDismissed(false)}>
    <Link href={href} className={styles.iconButton} aria-label={label} aria-describedby={dismissed ? undefined : tooltipId} onFocus={() => setDismissed(false)} onBlur={() => setDismissed(false)} onKeyDown={(event) => { if (event.key === "Escape") setDismissed(true); }}><Icon size={18} aria-hidden="true" /></Link>
    <span id={tooltipId} role="tooltip" className={styles.tooltip} hidden={dismissed}>{label}</span>
  </span>;
}

export function AdminListResult<T>({ state, retry, page, onPageChange, children, loadingMessage }: { state: AsyncState<PaginatedResult<T>>; retry: () => void; page: number; onPageChange: (page: number) => void; children: (result: PaginatedResult<T>) => ReactNode; loadingMessage: string }) {
  if (state.status === "loading") return <p role="status">{loadingMessage}</p>;
  if (state.status === "error") return <Notice tone="error">Lo sentimos. No pudimos recuperar la información. Intentá nuevamente. {state.error} <button className="button" type="button" onClick={retry}>Reintentar</button></Notice>;
  const result = state.data;
  return <>
    <p className={styles.summary} role="status">{result.total} {result.total === 1 ? "registro" : "registros"}{result.items.length ? ` · Mostrando ${(page - 1) * result.pageSize + 1}–${(page - 1) * result.pageSize + result.items.length}` : ""}</p>
    {result.items.length ? children(result) : <div className={styles.empty}><p>{result.total ? "No hay registros en esta página." : "No hay registros que coincidan con los filtros."}</p>{page > 1 ? <button className="button button-secondary" type="button" onClick={() => onPageChange(1)}>Volver a la primera página</button> : null}</div>}
    <Pagination page={page} pageSize={result.pageSize} total={result.total} onChange={onPageChange} />
  </>;
}

export function AdminSearch({ query, label = "Buscar por nombre", onSearch }: { query: string; label?: string; onSearch: (query: string) => void }) {
  const id = useId(); const [value, setValue] = useState(query); const [error, setError] = useState("");
  return <form role="search" className={styles.search} onSubmit={(event) => { event.preventDefault(); const issue = validateMateriaSearch(value); setError(issue ?? ""); if (!issue) onSearch(value.trim()); }}>
    <label htmlFor={id}>{label}</label><div className={styles.searchControls}><div className={styles.searchInput}><Search size={16} aria-hidden="true" /><input id={id} type="search" maxLength={150} placeholder={label.includes("email") ? "Nombre o email…" : "Nombre…"} value={value} aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : undefined} onChange={(event) => setValue(event.target.value)} /></div><button className="button button-secondary" type="submit">Buscar</button></div>
    {error ? <p id={`${id}-error`} className="field-error" role="alert">{error}</p> : null}
  </form>;
}

export function AdminSelect({ label, value, options, onChange, all = "Todos" }: { label: string; value: string; options: { value: string; label: string }[]; onChange: (value: string) => void; all?: string }) {
  const id = useId();
  return <div className={styles.filterField}><label htmlFor={id}>{label}</label><select id={id} value={value} onChange={(event) => onChange(event.target.value)}><option value="">{all}</option>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></div>;
}

