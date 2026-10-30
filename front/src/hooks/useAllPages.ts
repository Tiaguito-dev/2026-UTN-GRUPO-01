"use client";
import { useEffect, useEffectEvent, useState } from "react";
import type { PaginatedResult } from "@/services/pagination";
import type { AsyncState } from "./usePaginatedFetch";

const MAX_PAGES = 20;

/**
 * Trae un listado completo para poblar un `<select>` de un formulario de alta: el backend pagina
 * todos los listados (pageSize máximo 100), y un select necesita todas las opciones de una.
 * `key` identifica el recurso; si viene vacío no hay nada que cargar todavía (select dependiente).
 * Tope de 20 páginas (2000 ítems al pedir páginas de 100); si el catálogo no se completa,
 * devuelve error en vez de publicar opciones parciales. Catálogos mayores necesitan búsqueda.
 */
export function useAllPages<T>(key: string, fetchPage: (page: number) => Promise<PaginatedResult<T>>) {
  const [retryToken, setRetryToken] = useState(0);
  // Same idea as `usePaginatedFetch`: a settled result only counts for the request it answers.
  const [settled, setSettled] = useState<{ request: string; state: AsyncState<T[]> } | null>(null);
  const request = JSON.stringify([key, retryToken]);
  const load = useEffectEvent((page: number) => fetchPage(page));

  useEffect(() => {
    if (!key) return;
    let active = true;
    (async () => {
      const collected: T[] = [];
      for (let page = 1; page <= MAX_PAGES; page += 1) {
        const result = await load(page);
        collected.push(...result.items);
        if (collected.length >= result.total) return collected;
        if (result.items.length === 0) throw new Error("No pudimos cargar todas las opciones. Intentá nuevamente.");
      }
      throw new Error("El catálogo supera el límite de carga. No se mostraron opciones incompletas.");
    })().then(
      (collected) => { if (active) setSettled({ request, state: { status: "ready", data: collected } }); },
      (failure: unknown) => {
        if (!active) return;
        setSettled({ request, state: { status: "error", error: failure instanceof Error ? failure.message : "No pudimos cargar las opciones. Intentá nuevamente.", notFound: false } });
      },
    );
    // Forget this result when the request ends, so coming back to the same key loads again.
    return () => { active = false; setSettled(null); };
  }, [key, request]);

  const state: AsyncState<T[]> = !key ? { status: "ready", data: NOTHING } : settled?.request === request ? settled.state : { status: "loading" };
  return { state, retry: () => setRetryToken((token) => token + 1) };
}

const NOTHING: never[] = [];
