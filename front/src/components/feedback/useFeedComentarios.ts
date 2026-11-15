"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { listarFeedComentarios } from "@/services/feedback-feed";
import type { FeedbackFeedItem } from "@/types/feedback-feed";
interface WindowState {
  items: FeedbackFeedItem[];
  nextCursor: string | null;
  hasMore: boolean;
  loading: boolean;
  loaded: boolean;
  error: string;
}
const empty = (): WindowState => ({ items: [], nextCursor: null, hasMore: true, loading: false, loaded: false, error: "" });
const newWindow = () => ({ state: empty(), cursors: new Set<string>(), inFlight: false });
/** Each refresh replaces the window identity, invalidating every older response. */
export function useFeedComentarios() {
  const current = useRef(newWindow());
  const [state, setState] = useState<WindowState>({ ...empty(), loading: true });
  const loadMore = useCallback(async () => {
    const window = current.current;
    if (window.inFlight || !window.state.hasMore) return;
    window.inFlight = true;
    window.state = { ...window.state, loading: true, error: "" };
    setState(window.state);
    try {
      const cursor = window.state.nextCursor;
      const page = cursor === null ? await listarFeedComentarios() : await listarFeedComentarios(cursor);
      if (current.current !== window) return;
      if (page.nextCursor !== null && (page.nextCursor === cursor || window.cursors.has(page.nextCursor))) {
        throw new Error("La página no avanzó. Podés reintentar o actualizar el feed.");
      }
      const seen = new Set(window.state.items.map(item => item.id));
      const added = page.items.filter(item => { if (seen.has(item.id)) return false; seen.add(item.id); return true; });
      if (cursor !== null) window.cursors.add(cursor);
      window.state = { items: [...window.state.items, ...added], nextCursor: page.nextCursor, hasMore: page.hasMore, loaded: true, loading: false, error: "" };
    } catch (failure) {
      if (current.current !== window) return;
      window.state = { ...window.state, loading: false, error: failure instanceof Error ? failure.message : "No pudimos cargar los comentarios. Intentá nuevamente." };
    } finally {
      window.inFlight = false;
      if (current.current === window) setState(window.state);
    }
  }, []);
  const refresh = useCallback(() => { current.current = newWindow(); void loadMore(); }, [loadMore]);
  const loadAutomatically = useCallback(() => {
    if (current.current.state.loaded && !current.current.state.error) void loadMore();
  }, [loadMore]);
  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => { if (active) void loadMore(); });
    return () => { active = false; current.current = newWindow(); };
  }, [loadMore]);
  return { ...state, loadMore, refresh, loadAutomatically };
}
