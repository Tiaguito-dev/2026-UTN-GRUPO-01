"use client";
import { useEffect, useEffectEvent, useState } from "react";
import { HttpError } from "@/services/http";

/** Module-local resource hook: responses from a prior route never replace current data. */
export function useFeedbackResource<T>(resourceKey: string, fetchResource: () => Promise<T>) {
  const [retryToken, setRetryToken] = useState(0);
  const [result, setResult] = useState<{ key: string; data?: T; error: string; notFound: boolean } | null>(null);
  const key = JSON.stringify([resourceKey, retryToken]);
  const load = useEffectEvent(fetchResource);
  useEffect(() => {
    let active = true;
    load().then((data) => {
      if (active) setResult({ key, data, error: "", notFound: false });
    }).catch((failure: unknown) => {
      if (active) setResult({ key, error: failure instanceof Error ? failure.message : "Lo sentimos. No pudimos recuperar la información, intentá nuevamente.", notFound: failure instanceof HttpError && failure.status === 404 });
    });
    return () => { active = false; };
  }, [key]);
  const current = result?.key === key ? result : null;
  return { data: current?.data, error: current?.error ?? "", notFound: current?.notFound ?? false, loading: !current, retry: () => setRetryToken((value) => value + 1) };
}
