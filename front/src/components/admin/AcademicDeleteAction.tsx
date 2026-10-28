"use client";

import { useState, type ReactNode } from "react";
import { Trash2 } from "lucide-react";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { eliminarAcademico, type AcademicAdminKind } from "@/services/admin-academic";
import { AdminConfirmDialog } from "./AdminConfirmDialog";

const labels: Record<AcademicAdminKind, string> = { materias: "materia", profesores: "profesor", cursadas: "período", comisiones: "comisión" };
const effects: Record<AcademicAdminKind, string> = {
  materias: "No se podrá usar para crear nuevos períodos. Si tiene períodos vigentes, la operación se bloqueará.",
  profesores: "No se ofrecerá para nuevas asignaciones. Si tiene asignaciones en comisiones vigentes, primero deberás desvincularlo de esas comisiones. Dar de baja al profesor es distinto de quitar una asignación.",
  cursadas: "No se podrá usar para crear nuevas comisiones. Si tiene comisiones vigentes, la operación se bloqueará.",
  comisiones: "Quedará inactiva y no admitirá nuevas experiencias, ediciones ni asignaciones docentes. Se conservarán sus asignaciones y referencias históricas.",
};

export function AcademicDeleteDialog({ kind, id, label, onClose, onSuccess, onAttempt }: { kind: AcademicAdminKind; id: string; label: ReactNode; onClose: () => void; onSuccess: () => void; onAttempt?: () => void }) {
  return <AdminConfirmDialog title={`Dar de baja ${labels[kind]}`} confirmLabel="Confirmar baja" onClose={onClose} onConfirm={async () => {
    try { await eliminarAcademico(kind, id); }
    catch (failure) { onAttempt?.(); throw failure; }
    onSuccess();
  }}>
    <p>¿Querés dar de baja {label}?</p>
    <p>Identificador: {id}</p>
    <p>La baja es lógica: dejará de aparecer en los listados y selectores de registros vigentes. Se conservarán el registro, sus experiencias, relaciones y el historial.</p>
    <p>{effects[kind]}</p>
  </AdminConfirmDialog>;
}

export function AcademicDeleteAction({ kind, id, label, onSuccess, onAttempt }: { kind: AcademicAdminKind; id: string; label: string; onSuccess: () => void; onAttempt?: () => void }) {
  const isAdmin = useIsAdmin();
  const [confirm, setConfirm] = useState(false);
  if (!isAdmin) return null;
  return <>
    <button className="button button-secondary" type="button" aria-label={`Dar de baja ${labels[kind]} ${label}`} onClick={() => setConfirm(true)}><Trash2 size={18} aria-hidden="true" />Dar de baja {labels[kind]}</button>
    {confirm ? <AcademicDeleteDialog kind={kind} id={id} label={label} onClose={() => setConfirm(false)} onAttempt={onAttempt} onSuccess={() => {
      setConfirm(false); onSuccess();
    }} /> : null}
  </>;
}
