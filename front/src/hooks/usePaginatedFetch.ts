"use client";
import { useEffect, useRef, useState } from "react";
import type { PaginatedResult } from "@/services/academic";
import { HttpError } from "@/services/http";

export type FetchStatus = "loading" | "ready" | "error";

/** resetKey identifies the resource being listed (e.g. a materiaId); changing it goes back to page 1. */
export function usePaginatedFetch<T>(resetKey: string, fetchPage: (page: number) => Promise<PaginatedResult<T>>, initialPage = 1) {
  const [page, setPage] = useState(initialPage);
  const [status, setStatus] = useState<FetchStatus>("loading");
  const [result, setResult] = useState<PaginatedResult<T> | null>(null);
  const [error, setError] = useState("");
  const [notFound, setNotFound] = useState(false);
  const [retryToken, setRetryToken] = useState(0);
  const previousResetKey = useRef(resetKey);

  useEffect(() => {
    if (previousResetKey.current !== resetKey) { previousResetKey.current = resetKey; setPage(1); }
  }, [resetKey]);

  useEffect(() => {
    let active = true;
    setStatus("loading");
    setError("");
    setNotFound(false);
    fetchPage(page)
      .then((data) => { if (active) { setResult(data); setStatus("ready"); } })
      .catch((failure: unknown) => {
        if (!active) return;
        setError(failure instanceof Error ? failure.message : "No pudimos completar la solicitud. Intentá nuevamente.");
        setNotFound(failure instanceof HttpError && failure.status === 404);
        setStatus("error");
      });
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey, page, retryToken]);

  const retry = () => setRetryToken((token) => token + 1);

  return { status, result, error, notFound, page, setPage, retry };
}
