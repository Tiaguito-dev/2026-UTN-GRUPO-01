"use client";

import { useEffect, useState } from "react";
import { obtenerDetalleAdministrativo, type AdminRecordKind, type AdminRecord } from "@/services/admin-detail";

export function useAdminDetail(kind: AdminRecordKind, id: string, page = 1) {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{ key: string; data?: AdminRecord; error?: boolean }>();
  const key = `${kind}:${id}:${page}:${attempt}`;
  useEffect(() => {
    let active = true;
    obtenerDetalleAdministrativo(kind, id, page).then((data) => { if (active) setResult({ key, data }); }, () => { if (active) setResult({ key, error: true }); });
    return () => { active = false; };
  }, [kind, id, page, key]);
  const current = result?.key === key ? result : undefined;
  return { data: current?.data, error: current?.error, retry: () => setAttempt((value) => value + 1) };
}
