"use client";

import { useEffect, useId, useState } from "react";
import { Card } from "@/components/ui/Card";
import { TerminosDialog } from "@/components/terminos/TerminosDialog";
import { obtenerTerminosCondiciones } from "@/services/terminos";
import type { TerminosCondiciones } from "@/types/auth";
import styles from "./ComunidadTerminos.module.css";

/** Consulta por apertura: no registra consentimiento ni modifica los formularios de Comunidad. */
export function ComunidadTerminos() {
  const headingId = useId();
  const [open, setOpen] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [settled, setSettled] = useState<{ attempt: number; documento: TerminosCondiciones | null; error?: string } | null>(null);

  useEffect(() => {
    if (!open) return;
    let active = true;
    obtenerTerminosCondiciones().then(
      documento => { if (active) setSettled({ attempt, documento }); },
      () => { if (active) setSettled({ attempt, documento: null, error: "No pudimos cargar los términos y condiciones. Intentá nuevamente." }); },
    );
    return () => { active = false; };
  }, [open, attempt]);
  const current = settled?.attempt === attempt ? settled : null;

  return <div className={styles.container}>
    <Card variant="panel" as="section" aria-labelledby={headingId}>
      <h2 className={styles.title} id={headingId}>Términos y condiciones</h2>
      <p className={styles.description}>Consultá las condiciones de uso de nuestra plataforma.</p>
      <button className="button button-secondary" type="button" aria-haspopup="dialog" onClick={event => {
        event.currentTarget.focus();
        setAttempt(value => value + 1); setOpen(true);
      }}>Ver términos y condiciones</button>
    </Card>
    {open ? <TerminosDialog documento={current?.documento ?? null} error={current?.error}
      onRetry={() => setAttempt(value => value + 1)} onClose={() => setOpen(false)} /> : null}
  </div>;
}
