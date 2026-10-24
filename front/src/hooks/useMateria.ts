"use client";
import { useEffect, useState } from "react";
import type { Materia } from "@/types/materias";
import { obtenerMateria } from "@/services/materias";
import { HttpError } from "@/services/http";
/** Fetch local al módulo; descarta respuestas de materias anteriores al navegar. */
export function useMateria(id: string) {
  const [result, setResult] = useState<{ key: string; materia: Materia | null; error: string; notFound: boolean } | null>(null);
  const [retryToken, setRetryToken] = useState(0);
  const requestKey = `${id}:${retryToken}`;
  useEffect(() => {
    let active = true;
    obtenerMateria(id).then((materia) => {
      if (active) setResult({ key: requestKey, materia, error: "", notFound: false });
    }).catch((failure: unknown) => {
      if (active) setResult({ key: requestKey, materia: null, error: failure instanceof Error ? failure.message : "Lo sentimos. No pudimos recuperar la materia. Intentá nuevamente.", notFound: failure instanceof HttpError && failure.status === 404 });
    });
    return () => { active = false; };
  }, [id, requestKey]);
  const current = result?.key === requestKey ? result : null;
  return { materia: current?.materia ?? null, error: current?.error ?? "", notFound: current?.notFound ?? false, retry: () => setRetryToken((value) => value + 1) };
}
