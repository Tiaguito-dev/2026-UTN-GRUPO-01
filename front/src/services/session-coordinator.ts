import { HttpError } from "./http";

export type SessionEventKind = "login" | "refresh" | "refresh-uncertain" | "logout" | "reset" | "change" | "expired";
export interface SessionRevision { id: string; kind: SessionEventKind }
const KEY = "butchery.auth.revision";
const LOCK = "butchery.auth.cookies";
const CHANNEL = "butchery.auth.events";
const KINDS: SessionEventKind[] = ["login", "refresh", "refresh-uncertain", "logout", "reset", "change", "expired"];
export const COORDINATION_NOTICE = "Este navegador no permite coordinar la renovación entre pestañas. Usá un navegador con Web Locks y almacenamiento local habilitado; mientras tanto, iniciá sesión nuevamente cuando venza el acceso.";

export class SessionCoordinator {
  private channel: BroadcastChannel | null = null;
  private listeners = new Set<(revision: SessionRevision) => void>();
  private readonly storageListener = (event: StorageEvent) => { if (event.key === KEY) this.notifyCurrent(); };
  private enabled = false;
  constructor() {
    if (typeof window === "undefined") return;
    try {
      const probe = `${KEY}.probe.${crypto.randomUUID()}`;
      localStorage.setItem(probe, "1"); localStorage.removeItem(probe);
      this.enabled = typeof navigator.locks?.request === "function";
      if (typeof BroadcastChannel !== "undefined") {
        this.channel = new BroadcastChannel(CHANNEL);
        this.channel.onmessage = () => this.notifyCurrent();
      }
      window.addEventListener("storage", this.storageListener);
    } catch { this.enabled = false; }
  }
  get available(): boolean { return this.enabled; }
  read(): SessionRevision | null {
    try {
      const value = localStorage.getItem(KEY);
      if (!value) return null;
      const parsed = JSON.parse(value) as Record<string, unknown>;
      if (typeof parsed.id === "string" && /^[0-9a-f-]{36}$/i.test(parsed.id) && KINDS.includes(parsed.kind as SessionEventKind)) return { id: parsed.id, kind: parsed.kind as SessionEventKind };
    } catch { this.enabled = false; }
    return null;
  }
  subscribe(listener: (revision: SessionRevision) => void): () => void {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }
  private notifyCurrent(): void {
    const latest = this.read();
    if (latest) this.listeners.forEach((listener) => listener(latest));
  }
  publish(kind: SessionEventKind): void {
    const revision: SessionRevision = { id: crypto.randomUUID(), kind };
    try { localStorage.setItem(KEY, JSON.stringify(revision)); this.channel?.postMessage(revision); }
    catch { this.enabled = false; }
  }
  async lock<T>(action: () => Promise<T>, required = false): Promise<T> {
    if (!this.available) {
      if (required) throw new HttpError(0, COORDINATION_NOTICE);
      return action();
    }
    return navigator.locks.request(LOCK, action);
  }
}
