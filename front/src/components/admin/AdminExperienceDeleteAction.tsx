"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { eliminarFeedback } from "@/services/feedback";
import { AdminConfirmDialog } from "./AdminConfirmDialog";
import styles from "./AdminMateriaDetail.module.css";

export function AdminExperienceDeleteAction({ id, onSuccess }: { id: string; onSuccess: () => void }) {
  const isAdmin = useIsAdmin();
  const [confirm, setConfirm] = useState(false);
  if (!isAdmin) return null;
  return <>
    <button className={`button button-secondary ${styles.remove}`} type="button" onClick={() => setConfirm(true)}><Trash2 size={17} aria-hidden="true" />Eliminar comentario</button>
    {confirm ? <AdminConfirmDialog title="Eliminar comentario" confirmLabel="Confirmar eliminación" onClose={() => setConfirm(false)} onConfirm={async () => {
      await eliminarFeedback(id);
      setConfirm(false);
      onSuccess();
    }}>
      <p>¿Querés eliminar esta experiencia?</p>
      <p>El comentario dejará de ser visible para la comunidad. Se conservarán sus datos y el historial.</p>
    </AdminConfirmDialog> : null}
  </>;
}
