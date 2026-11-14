import type { SessionEndReason, SessionStatus } from "@/types/session";
import { AuthService, getAuthService } from "./auth";
import { HttpError, requestJson } from "./http";
import { sessionStatusSchema } from "./session-schema";

const KEY = "butchery.auth.session-status";
const CHANNEL = "butchery.auth.session-status-events";
const ACTIVITY_INTERVAL = 15_000;
interface StoredStatus {
  accountId: string;
  revisionId: string | null;
  status: SessionStatus;
  receivedAt: number;
  activityAt: number;
}

/** Deadlines are server values. Browser storage only coordinates tabs, never authenticates. */
export class SessionService {
  private readonly listeners = new Set<(status: SessionStatus, receivedAt?: number) => void>();
  private channel: BroadcastChannel | null = null;
  private accountId: string | null = null;
  private memory: StoredStatus | null = null;
  private readonly onStorage = (event: StorageEvent) => { if (event.key === KEY) this.notify(); };

  constructor(private readonly auth: AuthService = getAuthService()) {
    if (typeof window === "undefined") return;
    window.addEventListener("storage", this.onStorage);
    if (typeof BroadcastChannel !== "undefined") {
      this.channel = new BroadcastChannel(CHANNEL);
      this.channel.onmessage = () => this.notify();
    }
  }

  subscribe(listener: (status: SessionStatus, receivedAt?: number) => void): () => void {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  /** A display hint only: cookie revocation can arrive before the monitor handles its timer. */
  getEndReason(accountId: string | null): SessionEndReason | null {
    const previous = this.memory;
    if (!accountId || !previous || previous.accountId !== accountId) return null;
    const idle = Date.parse(previous.status.idleExpiresAt);
    const absolute = Date.parse(previous.status.absoluteExpiresAt);
    return Date.parse(this.adjusted(previous).serverNow) >= Math.min(idle, absolute)
      ? idle < absolute ? "idle" : "absolute" : null;
  }

  private read(accountId: string): StoredStatus | null {
    let candidate: unknown = this.memory;
    try { const value = localStorage.getItem(KEY); if (value) candidate = JSON.parse(value); } catch { /* The cookie coordinator reports storage failures to the user. */ }
    if (!candidate || typeof candidate !== "object") return null;
    const value = candidate as Record<string, unknown>;
    if (value.accountId !== accountId || value.revisionId !== (this.auth.coordinator.read()?.id ?? null)
      || typeof value.receivedAt !== "number" || !Number.isFinite(value.receivedAt)
      || typeof value.activityAt !== "number" || !Number.isFinite(value.activityAt)) return null;
    const parsed = sessionStatusSchema.safeParse(value.status);
    return parsed.success ? { accountId, revisionId: value.revisionId as string | null, status: parsed.data, receivedAt: value.receivedAt, activityAt: value.activityAt } : null;
  }

  private adjusted(value: StoredStatus): SessionStatus {
    return { ...value.status, serverNow: new Date(Date.parse(value.status.serverNow) + Math.max(0, Date.now() - value.receivedAt)).toISOString() };
  }

  private notify(): void {
    if (!this.accountId) return;
    const shared = this.read(this.accountId);
    if (shared) this.listeners.forEach((listener) => listener(shared.status, shared.receivedAt));
  }

  private store(stored: StoredStatus): void {
    this.memory = stored;
    try { localStorage.setItem(KEY, JSON.stringify(stored)); this.channel?.postMessage(null); } catch { /* Server deadlines still apply without browser storage. */ }
    this.listeners.forEach((listener) => listener(stored.status, stored.receivedAt));
  }

  private publish(accountId: string, status: SessionStatus, activityAt?: number): SessionStatus {
    this.accountId = accountId;
    const previous = this.read(accountId);
    const stored: StoredStatus = {
      accountId, revisionId: this.auth.coordinator.read()?.id ?? null, status,
      receivedAt: Date.now(), activityAt: activityAt ?? previous?.activityAt ?? 0,
    };
    this.store(stored);
    return status;
  }

  getStatus(accountId: string): Promise<SessionStatus> {
    this.accountId = accountId;
    return this.auth.withSessionLock(accountId, async (request) => this.publish(accountId, await request("/auth/session", "GET", sessionStatusSchema)));
  }

  activity(accountId: string): Promise<SessionStatus> {
    return this.auth.withSessionLock(accountId, async (request) => {
      const previous = this.read(accountId);
      if (previous && (Date.now() - previous.activityAt < ACTIVITY_INTERVAL || Date.parse(this.adjusted(previous).serverNow) >= Date.parse(previous.status.warningAt))) {
        return previous.status;
      }
      const sentAt = Date.now();
      // Reserve before sending: a failed response must not cause another tab to repeat a write.
      if (previous) this.store({ ...previous, activityAt: sentAt });
      const status = await request("/auth/session/activity", "POST", sessionStatusSchema);
      return this.publish(accountId, status, sentAt);
    });
  }

  renew(accountId: string): Promise<SessionStatus> {
    return this.auth.withSessionLock(accountId, async (request) => {
      // Resolve a previous uncertain response or renewal from another tab without replaying it.
      const current = await request("/auth/session", "GET", sessionStatusSchema);
      if (Date.parse(current.serverNow) < Date.parse(current.warningAt)) return this.publish(accountId, current);
      if (Date.parse(current.absoluteExpiresAt) <= Date.parse(current.idleExpiresAt)) {
        throw new HttpError(409, "La sesión alcanzó su límite de duración. Iniciá sesión nuevamente.");
      }
      return this.publish(accountId, await request("/auth/session/renew", "POST", sessionStatusSchema), Date.now());
    });
  }

  /** null means the server rejected the old session. A renewed session is returned intact. */
  async expire(accountId: string): Promise<SessionStatus | null> {
    const observed = this.auth.coordinator.read()?.id;
    try {
      return await this.auth.withSessionLock(accountId, async (request) => {
        try {
          const current = await request("/auth/session", "GET", sessionStatusSchema);
          const deadline = Math.min(Date.parse(current.idleExpiresAt), Date.parse(current.absoluteExpiresAt));
          if (Date.parse(current.serverNow) < deadline) return this.publish(accountId, current);
          await requestJson("/auth/logout", { method: "POST" });
          this.auth.coordinator.publish("expired");
          return null;
        } catch (error) {
          // Still inside the cookie lock: no new login can be replaced by this local closure.
          if (!(error instanceof HttpError) || error.status !== 409) this.auth.coordinator.publish("expired");
          throw error;
        }
      });
    } catch (error) {
      // A preflight/network failure can happen before the action starts. Only close its revision.
      if ((!(error instanceof HttpError) || error.status !== 409) && this.auth.coordinator.read()?.id === observed) {
        this.auth.coordinator.publish("expired");
      }
      if (error instanceof HttpError && error.status === 401) return null;
      throw error;
    }
  }

  async close(accountId: string): Promise<void> {
    const observed = this.auth.coordinator.read()?.id;
    try {
      await this.auth.withSessionLock(accountId, async () => {
        try { await requestJson("/auth/logout", { method: "POST" }); }
        finally { this.auth.coordinator.publish("logout"); }
      });
    } catch (error) {
      if ((!(error instanceof HttpError) || error.status !== 409) && this.auth.coordinator.read()?.id === observed) {
        this.auth.coordinator.publish("logout");
      }
      throw error;
    }
  }
}

let service: SessionService | undefined;
export function getSessionService(): SessionService {
  if (typeof window === "undefined") throw new Error("La sesión requiere el navegador.");
  return service ??= new SessionService();
}
