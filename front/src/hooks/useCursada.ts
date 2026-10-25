"use client";
import { useEffect, useState } from "react";
import { obtenerCursada, type CursadaDetalle } from "@/services/academic";
import { HttpError } from "@/services/http";
/** Same shape as `useMateria`, plus `notFound` so the screen can offer "Volver" instead of "Reintentar". */
export function useCursada(id: string) {
  const [result, setResult] = useState<{ key: string; cursada: CursadaDetalle | null; error: string; notFound: boolean } | null>(null);
  const [retryToken, setRetryToken] = useState(0);
  const requestKey = `${id}:${retryToken}`;
  useEffect(() => {
    let active = true;
    obtenerCursada(id).then((cursada) => {
      if (active) setResult({ key: requestKey, cursada, error: "", notFound: false });
    }).catch((failure: unknown) => {
      if (active) setResult({ key: requestKey, cursada: null, error: failure instanceof Error ? failure.message : "Lo sentimos. No pudimos recuperar la cursada. Intentá nuevamente.", notFound: failure instanceof HttpError && failure.status === 404 });
    });
    return () => { active = false; };
  }, [id, requestKey]);
  const current = result?.key === requestKey ? result : null;
  return { cursada: current?.cursada ?? null, error: current?.error ?? "", notFound: current?.notFound ?? false, retry: () => setRetryToken((value) => value + 1) };
}
