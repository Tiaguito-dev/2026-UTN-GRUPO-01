"use client";

import { useEffect, useState } from "react";
import { obtenerDetalleAdministrativo } from "@/services/admin-detail";
import { comisionDetalleSchema } from "@/services/schemas";
import type { ComisionDetalle } from "@/services/academic";
import { comisionNavigation } from "@/validations/admin-academic-navigation";

/** Keep the URL (and therefore the sidebar) consistent with a confirmed fallback. */
export function useDiscardInvalidAdminOrigin(invalid: boolean) {
  useEffect(() => {
    if (!invalid) return;
    const url = new URL(window.location.href);
    if (!/^\/home\/admin\/(profesores|experiencias)\/[^/]+$/.test(url.pathname) || !url.searchParams.has("returnTo")) return;
    url.searchParams.delete("returnTo");
    // Next integrates native history updates with usePathname/useSearchParams.
    window.history.replaceState(null, "", `${url.pathname}${url.search}`);
  }, [invalid]);
}

/** Read the real parent only for existing cross-section links; URLs never grant access. */
export function useAdminCommissionOrigin(origin: string) {
  const url = new URL(origin, "https://local.invalid");
  const id = url.pathname.match(/^\/home\/admin\/comisiones\/([^/]+)$/)?.[1] ?? "";
  const [result, setResult] = useState<{ id: string; data?: ComisionDetalle; error?: boolean }>();
  useEffect(() => {
    if (!id) return;
    let active = true;
    obtenerDetalleAdministrativo("comisiones", id).then(response => {
      const data = comisionDetalleSchema.parse(response.registro);
      if (active) setResult({ id, data });
    }).catch(() => { if (active) setResult({ id, error: true }); });
    return () => { active = false; };
  }, [id]);
  const current = result?.id === id ? result : undefined;
  return {
    id, error: Boolean(current?.error), data: current?.data,
    navigation: current?.data ? comisionNavigation(url.searchParams, current.data) : null,
  };
}
