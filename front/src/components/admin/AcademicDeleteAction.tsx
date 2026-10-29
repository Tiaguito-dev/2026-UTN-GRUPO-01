"use client";

import { useState, type ReactNode } from "react";
import { Trash2 } from "lucide-react";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { eliminarAcademico, type AcademicAdminKind } from "@/services/admin-academic";
import { AdminConfirmDialog } from "./AdminConfirmDialog";

const labels: Record<AcademicAdminKind, string> = { materias: "materia", profesores: "profesor", cursadas: "período", comisiones: "comisión" };
const effects: Record<AcademicAdminKind, string> = {
  materias: "Si tiene períodos de cursada vigentes asociados, la baja se bloqueará. Dales de baja primero.",
  profesores: "Si tiene asignaciones en comisiones vigentes, la baja se bloqueará. Desvinculalo de esas comisiones primero.",
  cursadas: "Si tiene comisiones vigentes asociadas, la baja se bloqueará. Dales de baja primero.",
  comisiones: "No admitirá nuevas experiencias, ediciones ni asignaciones docentes. Se conservarán las relaciones existentes.",
};

export function AcademicDeleteDialog({ kind, id, label, onClose, onSuccess, onAttempt }: { kind: AcademicAdminKind; id: string; label: ReactNode; onClose: () => void; onSuccess: () => void; onAttempt?: () => void }) {
  return <AdminConfirmDialog title={`Dar de baja ${labels[kind]}`} confirmLabel="Confirmar baja" onClose={onClose} onConfirm={async () => {
    try { await eliminarAcademico(kind, id); }
    catch (failure) { onAttempt?.(); throw failure; }
    onSuccess();
  }}>
    <p>¿Querés dar de baja {label}?</p>
    <p>El registro quedará inactivo. Se conservarán sus datos y el historial.</p>
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
