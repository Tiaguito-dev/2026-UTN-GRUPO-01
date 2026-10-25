"use client";

import { useEffect, useRef, type ReactNode } from "react";

export type NoticeTone = "error" | "success" | "warning";

/** Errors are announced as `alert`, the rest as `status`. `focusOnShow` moves focus to the notice when it mounts. */
export function Notice({ tone, focusOnShow = false, children }: { tone: NoticeTone; focusOnShow?: boolean; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { if (focusOnShow) ref.current?.focus(); }, [focusOnShow]);
  return <div ref={ref} role={tone === "error" ? "alert" : "status"} tabIndex={focusOnShow ? -1 : undefined} className={`notice ${tone}`}>{children}</div>;
}
