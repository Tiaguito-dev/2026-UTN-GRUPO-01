"use client";
import { useEffect, useEffectEvent, useState } from "react";
import type { PaginatedResult } from "@/services/pagination";
import { HttpError } from "@/services/http";

export type AsyncState<T> = { status: "loading" } | { status: "ready"; data: T } | { status: "error"; error: string; notFound: boolean };

/**
 * Fetches `page` of the resource identified by `resetKey` (e.g. a materiaId). The page comes from
 * outside (usually `useUrlPagination`), so this hook keeps no page of its own.
 */
export function usePaginatedFetch<T>(resetKey: string, fetchPage: (page: number) => Promise<PaginatedResult<T>>, page: number) {
  const [retryToken, setRetryToken] = useState(0);
  // Each settled response remembers the request it answers; a newer request reads as loading.
  const [settled, setSettled] = useState<{ request: string; state: AsyncState<PaginatedResult<T>> } | null>(null);
  const request = JSON.stringify([resetKey, page, retryToken]);
  const load = useEffectEvent(() => fetchPage(page));

  useEffect(() => {
    let active = true;
    load().then(
      (data) => { if (active) setSettled({ request, state: { status: "ready", data } }); },
      (failure: unknown) => {
        if (!active) return;
        setSettled({ request, state: {
          status: "error",
          error: failure instanceof Error ? failure.message : "No pudimos completar la solicitud. Intentá nuevamente.",
          notFound: failure instanceof HttpError && failure.status === 404,
        } });
      },
    );
    return () => { active = false; };
  }, [request]);

  const state: AsyncState<PaginatedResult<T>> = settled?.request === request ? settled.state : { status: "loading" };
  return { state, retry: () => setRetryToken((token) => token + 1) };
}
