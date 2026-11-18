"use client";

import { useEffect, useId, useRef } from "react";
import { Dialog } from "@/components/ui/Dialog";
import { Notice } from "@/components/ui/Notice";
import type { TerminosCondiciones } from "@/types/auth";
import styles from "./TerminosDialog.module.css";

/** Visor del documento recibido; la carga y cualquier aceptación pertenecen al consumidor. */
export function TerminosDialog({ documento, error, onRetry, onClose, documentId }: {
  documento: TerminosCondiciones | null;
  error?: string;
  onRetry?: () => void;
  onClose: () => void;
  documentId?: string;
}) {
  const generatedId = useId();
  const id = documentId ?? `${generatedId}-documento`;
  const regionRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const close = closeRef.current;
    const dialog = close?.closest<HTMLDialogElement>("dialog");
    // Reintentar puede retirar el botón enfocado. No desplazar a quien ya está dentro del modal.
    if (dialog?.open && !dialog.contains(document.activeElement)) (regionRef.current ?? close)?.focus();
  }, [documento, error]);
  return <Dialog open onClose={onClose} title="Términos y condiciones" description={documento ? `Versión ${documento.version}` : undefined}>
    {error ? <Notice tone="error">{error}{onRetry ? <> <button className="button button-secondary" type="button" onClick={onRetry}>Reintentar términos y condiciones</button></> : null}</Notice>
      : documento ? <>
        {/* eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- La región desplazable recibe foco para leer y desplazar los términos con teclado. */}
        <div ref={regionRef} id={id} className={styles.document} role="region" aria-label="Texto de los términos y condiciones" tabIndex={0} data-autofocus>
          {documento.secciones.map((seccion, index) => <section className={styles.section} key={`${index}-${seccion.titulo}`} aria-labelledby={`${id}-seccion-${index}`}>
            <h3 id={`${id}-seccion-${index}`}>{seccion.titulo}</h3>
            {seccion.parrafos.map((parrafo, paragraph) => <p key={`${index}-${paragraph}`}>{parrafo}</p>)}
          </section>)}
        </div>
      </> : <p role="status">Cargando términos y condiciones…</p>}
    <div className="dialog-actions"><button ref={closeRef} className="button" type="button" onClick={onClose}>Cerrar</button></div>
  </Dialog>;
}
