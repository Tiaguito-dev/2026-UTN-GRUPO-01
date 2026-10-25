"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";

/**
 * Modal over the native `<dialog>` with `showModal()`: top layer, inert background, trapped focus.
 * Controlled by `open`; Escape and "Cerrar" ask the parent to close through `onClose`. While `busy`,
 * neither closes. "Cerrar" goes after the body in the DOM so the initial focus lands on the first
 * control of the body. The footer is the consumer's `.dialog-actions`.
 */
export function Dialog({ open, onClose, title, description, busy = false, children }: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  busy?: boolean;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!open || !dialog) return;
    const opener = document.activeElement;
    if (!dialog.open) {
      dialog.showModal();
      // React's autoFocus focuses on commit, before showModal(), and is lost: `data-autofocus` picks another control.
      dialog.querySelector<HTMLElement>("[data-autofocus]")?.focus();
    }
    return () => {
      if (dialog.open) dialog.close();
      if (opener instanceof HTMLElement) opener.focus();
    };
  }, [open]);

  // Escape fires `cancel` and then `close`. Chrome skips `cancel` on a repeated Escape without user
  // activation, so a native close while `open` is still true is handled here: reopen if busy.
  // `dialog.open` is true again when the event comes from a close that already reopened (Strict Mode).
  function handleNativeClose() {
    const dialog = ref.current;
    if (!open || !dialog || dialog.open) return;
    if (busy) dialog.showModal();
    else onClose();
  }

  return <dialog ref={ref} className="dialog" aria-labelledby={titleId} aria-describedby={description ? descriptionId : undefined}
    onCancel={(event) => { if (busy) event.preventDefault(); }} onClose={handleNativeClose}>
    <h2 id={titleId} className="dialog-title">{title}</h2>
    {description ? <p id={descriptionId} className="dialog-description">{description}</p> : null}
    {children}
    <button type="button" className="dialog-close" aria-label="Cerrar" disabled={busy} onClick={onClose}>
      <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
    </button>
  </dialog>;
}
