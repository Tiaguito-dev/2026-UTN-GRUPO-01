"use client";
import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useAuth } from "@/hooks/useAuth";
import { FeedbackDraftMemory, type FeedbackDraftValues } from "./feedback-draft-memory";
interface Scope { memory: FeedbackDraftMemory; owner: string | null; enabled: boolean }
const DraftContext = createContext<Scope | null>(null);
/** Remains mounted outside the session guard, but never grants access or renders a draft. */
export function FeedbackDraftProvider({ children }: { children: ReactNode }) {
  const { status, account } = useAuth(); const owner = account?.id ?? null;
  const [memory] = useState(() => new FeedbackDraftMemory(status === "authenticated" ? owner : null));
  useLayoutEffect(() => { memory.observe(status, owner); }, [memory, status, owner]);
  useEffect(() => { const timer = window.setInterval(() => memory.prune(), 30_000); return () => { window.clearInterval(timer); memory.clear(); }; }, [memory]);
  const scope = useMemo(() => ({ memory, owner, enabled: status === "authenticated" && owner !== null }), [memory, owner, status]);
  return <DraftContext.Provider value={scope}>{children}</DraftContext.Provider>;
}
export function useFeedbackDraft(key: string, defaults: FeedbackDraftValues, allowedTargets: string[]) {
  const scope = useContext(DraftContext);
  const [token] = useState(() => Symbol("feedback-draft"));
  const [initial] = useState(() => {
    const saved = scope?.enabled && scope.owner ? scope.memory.read(scope.owner, key) : null;
    return saved ? { ...saved, target: allowedTargets.includes(saved.target) ? saved.target : defaults.target } : defaults;
  });
  const [draft, setDraft] = useState(initial); const current = useRef(initial);
  useEffect(() => {
    if (!scope?.enabled || !scope.owner) return;
    scope.memory.activate(scope.owner, key, token, initial);
    return () => scope.memory.release(scope.owner!, key, token);
  }, [scope, key, token, initial]);
  const setField = useCallback(<K extends keyof FeedbackDraftValues,>(field: K, value: FeedbackDraftValues[K]) => {
    const next = { ...current.current, [field]: value }; current.current = next;
    if (scope?.enabled && scope.owner) scope.memory.write(scope.owner, key, token, next);
    setDraft(next);
  }, [scope, key, token]);
  const discardDraft = useCallback(() => { if (scope?.owner) scope.memory.discard(scope.owner, key, token); }, [scope, key, token]);
  return { draft, setField, discardDraft };
}
