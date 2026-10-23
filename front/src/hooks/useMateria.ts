"use client";
import { useEffect, useState } from "react";
import type { Materia } from "@/types/materias";
import { obtenerMateria } from "@/services/materias";
/** Fetch local al módulo; descarta respuestas de materias anteriores al navegar. */
export function useMateria(id: string) {
  const [result, setResult] = useState<{ key: string; materia: Materia | null; error: string } | null>(null);
  const [retryToken, setRetryToken] = useState(0);
  const requestKey = `${id}:${retryToken}`;
  useEffect(() => {
    let active = true;
    obtenerMateria(id).then((materia) => {
      if (active) setResult({ key: requestKey, materia, error: "" });
    }).catch((failure: unknown) => {
      if (active) setResult({ key: requestKey, materia: null, error: failure instanceof Error ? failure.message : "Lo sentimos. No pudimos recuperar la materia. Intentá nuevamente." });
    });
    return () => { active = false; };
  }, [id, requestKey]);
  const current = result?.key === requestKey ? result : null;
  return { materia: current?.materia ?? null, error: current?.error ?? "", retry: () => setRetryToken((value) => value + 1) };
}
