"use client";
import { useEffect, useState } from "react";
import type { PaginatedResult } from "@/services/pagination";

const MAX_PAGES = 20;

/**
 * Trae un listado completo para poblar un `<select>` de un formulario de alta: el backend pagina
 * todos los listados (pageSize máximo 100), y un select necesita todas las opciones de una.
 * `key` identifica el recurso; si viene vacío no hay nada que cargar todavía (select dependiente).
 * ponytail: tope de 20 páginas (2000 ítems); con catálogos más grandes hace falta un endpoint de
 * búsqueda por texto en vez de un select.
 */
export function useAllPages<T>(key: string, fetchPage: (page: number) => Promise<PaginatedResult<T>>) {
  const [items, setItems] = useState<T[] | null>(null);
  const [error, setError] = useState("");
  const [retryToken, setRetryToken] = useState(0);

  useEffect(() => {
    let active = true;
    setItems(key ? null : []);
    setError("");
    if (!key) return;
    (async () => {
      const collected: T[] = [];
      for (let page = 1; page <= MAX_PAGES; page += 1) {
        const result = await fetchPage(page);
        collected.push(...result.items);
        if (result.items.length === 0 || collected.length >= result.total) break;
      }
      return collected;
    })()
      .then((collected) => { if (active) setItems(collected); })
      .catch((failure: unknown) => {
        if (!active) return;
        setError(failure instanceof Error ? failure.message : "No pudimos cargar las opciones. Intentá nuevamente.");
      });
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, retryToken]);

  return { items, error, retry: () => setRetryToken((token) => token + 1) };
}
