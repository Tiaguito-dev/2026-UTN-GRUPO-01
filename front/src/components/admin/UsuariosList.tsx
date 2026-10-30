"use client";

import { useId, useState } from "react";
import { Eye, UserCheck, UserX } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { cambiarEstadoUsuario, listarUsuarios, type UsuarioRegistrado } from "@/services/users";
import { useUrlPagination } from "@/hooks/useUrlPagination";
import { usePaginatedFetch } from "@/hooks/usePaginatedFetch";
import { useAuth } from "@/hooks/useAuth";
import { PageHeader } from "@/components/ui/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Notice } from "@/components/ui/Notice";
import { ROLE_LABEL } from "@/lib/format/role";
import { adminListHref, readAdminFilters } from "@/validations/admin";
import { AdminTable, AdminListResult, AdminSearch, AdminSelect, AdminActionButton } from "./AdminTable";
import { AdminConfirmDialog } from "./AdminConfirmDialog";
import styles from "./AdminTables.module.css";

function fecha(valor: string): string {
  const date = new Date(valor);
  return Number.isNaN(date.getTime()) ? "fecha no disponible" : date.toLocaleDateString("es-AR");
}

export function UsuariosList() {
  const headingId = useId(); const router = useRouter(); const params = useSearchParams();
  const { account } = useAuth(); const { page, setPage } = useUrlPagination();
  const filters = readAdminFilters(params);
  const [selected, setSelected] = useState<UsuarioRegistrado | null>(null);
  const [refresh, setRefresh] = useState(0); const [message, setMessage] = useState("");
  const { state, retry } = usePaginatedFetch(`usuarios:${filters.q}:${filters.rol}:${filters.estado}`, (next) => listarUsuarios({ page: next, pageSize: 9, q: filters.q, rol: filters.rol, estado: filters.estado }), page, refresh);
  const navigate = (next: { q?: string; rol?: string; estado?: string }) => router.replace(adminListHref({ seccion: "usuarios", ...filters, ...next, page: 1 }), { scroll: false });
  return <section className={styles.page} aria-labelledby={headingId}>
    <PageHeader id={headingId} title="Usuarios registrados" description="Buscá cuentas por nombre, email, rol o estado y administrá su acceso." breadcrumb={[{ label: "Administración", href: "/home/admin" }, { label: "Usuarios registrados" }]} />
    {message ? <Notice tone="success">{message}</Notice> : null}
    <div className={styles.toolbar}><div className={styles.filters}>
      <AdminSearch key={filters.q ?? ""} query={filters.q ?? ""} label="Buscar por nombre o email" onSearch={(q) => navigate({ q })} />
      <AdminSelect label="Rol" all="Todos los roles" value={filters.rol ?? ""} options={Object.entries(ROLE_LABEL).map(([value, label]) => ({ value, label }))} onChange={(rol) => navigate({ rol })} />
      <AdminSelect label="Estado" all="Todos los estados" value={filters.estado ?? ""} options={[{ value: "ACTIVO", label: "Activo" }, { value: "INACTIVO", label: "Inactivo" }]} onChange={(estado) => navigate({ estado })} />
      {filters.q || filters.rol || filters.estado ? <button className="button button-secondary" type="button" onClick={() => navigate({ q: undefined, rol: undefined, estado: undefined })}>Limpiar filtros</button> : null}
    </div></div>
    <AdminListResult loadingMessage="Cargando usuarios…" state={state} retry={retry} page={page} onPageChange={setPage}>
      {(data) => <AdminTable title="Usuarios registrados" columns={["Nombre visible", "Email", "Rol", "Estado", "Fecha de alta"]} rows={data.items.map((usuario) => ({ id: usuario.id, cells: [usuario.displayName, usuario.email, <Badge key="role" tone="role">{ROLE_LABEL[usuario.role]}</Badge>, usuario.disabledAt ? "Inactivo" : "Activo", fecha(usuario.createdAt)] }))} actions={(row) => {
        const usuario = data.items.find((user) => user.id === row.id)!;
        return <><AdminActionButton label={`Ver detalle de ${usuario.displayName} (${usuario.email})`} icon={Eye} onClick={() => router.push(`/home/admin/usuarios/${encodeURIComponent(usuario.id)}?${new URLSearchParams({ returnTo: adminListHref({ seccion: "usuarios", ...filters, page }) })}`)} />{account?.role === "ADMIN" && usuario.id !== account.id ? <AdminActionButton label={`${usuario.disabledAt ? "Reactivar" : "Desactivar"} usuario ${usuario.displayName} (${usuario.email})`} icon={usuario.disabledAt ? UserCheck : UserX} onClick={() => setSelected(usuario)} /> : null}</>;
      }} />}
    </AdminListResult>
    {selected ? <AdminConfirmDialog key={selected.id} title={selected.disabledAt ? "Reactivar usuario" : "Desactivar usuario"} confirmLabel={selected.disabledAt ? "Confirmar reactivación" : "Confirmar desactivación"} onClose={() => setSelected(null)} onConfirm={async () => { await cambiarEstadoUsuario(selected.id, Boolean(selected.disabledAt)); setMessage(selected.disabledAt ? "Usuario reactivado correctamente." : "Usuario desactivado correctamente."); setSelected(null); setRefresh((value) => value + 1); }}><p>{selected.disabledAt ? `¿Querés reactivar a ${selected.displayName} (${selected.email})? Deberá iniciar sesión nuevamente; las sesiones revocadas no se restaurarán.` : `¿Querés desactivar a ${selected.displayName} (${selected.email})? Se cerrarán sus sesiones y no podrá acceder hasta que se reactive su cuenta. Se conservarán su cuenta, sus comentarios y su historial.`}</p></AdminConfirmDialog> : null}
  </section>;
}
