import { HttpError } from "@/services/http";
import type { SessionService } from "@/services/session";
import type { SessionEndReason, SessionStatus } from "@/types/session";

type Pending = "check" | "renew" | "close" | "expire" | null;
const ACTIVITY_EVENTS = ["pointerdown", "pointermove", "keydown", "wheel", "touchmove", "click"];
export interface SessionIdleView {
  status: SessionStatus | null;
  now: number;
  pending: Pending;
  error: string;
  success: string;
  blocked: boolean;
}

/** Browser lifecycle and requests stay outside React rendering; one controller per account. */
export class SessionIdleController {
  private active = false;
  private ended = false;
  private checking = false;
  private expiring = false;
  private mutating = false;
  private wallAt = 0;
  private monotonicAt = 0;
  private serverAt = 0;
  private confirmedServerAt = -Infinity;
  private tickTimer: number | undefined;
  private pollTimer: number | undefined;
  private activityTimer: number | undefined;
  private activityPending = false;
  private activitySentAt = -Infinity;
  private unsubscribe: (() => void) | undefined;
  private view: SessionIdleView = { status: null, now: 0, pending: null, error: "", success: "", blocked: true };

  constructor(private readonly accountId: string, private readonly service: SessionService,
    private readonly notify: (view: SessionIdleView) => void, private readonly onEnd: (reason: SessionEndReason) => void) {}

  private set(update: Partial<SessionIdleView>) {
    if (!this.active || this.ended) return;
    this.view = { ...this.view, ...update };
    this.notify(this.view);
  }
  private now(): number {
    return this.serverAt + Math.max(0, Date.now() - this.wallAt, performance.now() - this.monotonicAt);
  }
  private reason(): SessionEndReason {
    if (!this.view.status) return "expired";
    return Date.parse(this.view.status.idleExpiresAt) < Date.parse(this.view.status.absoluteExpiresAt) ? "idle" : "absolute";
  }
  private deadline(): number {
    return this.view.status ? Math.min(Date.parse(this.view.status.idleExpiresAt), Date.parse(this.view.status.absoluteExpiresAt)) : Infinity;
  }
  private finish(reason = this.reason()) {
    if (!this.active || this.ended) return;
    this.ended = true;
    this.onEnd(reason);
  }
  private acceptShared = (status: SessionStatus, receivedAt?: number) => {
    this.accept(status, false, receivedAt);
  };
  private accept(status: SessionStatus, authoritative = true, receivedAt?: number) {
    if (!this.active || this.ended) return;
    const serverNow = Date.parse(status.serverNow);
    if (serverNow < this.confirmedServerAt) return;
    // Cache observations keep the real server timestamp separate from their local age.
    // An authoritative response must be able to correct an estimate after a wall-clock jump.
    if (authoritative || receivedAt !== undefined) this.confirmedServerAt = serverNow;
    this.serverAt = serverNow + (receivedAt === undefined ? 0 : Math.max(0, Date.now() - receivedAt));
    this.wallAt = Date.now(); this.monotonicAt = performance.now();
    const deadline = Math.min(Date.parse(status.idleExpiresAt), Date.parse(status.absoluteExpiresAt));
    this.set({ status, now: this.serverAt, error: "", blocked: this.serverAt >= deadline });
    this.tick();
  }
  private fail(error: unknown, fallback: string) {
    if (!this.active || this.ended) return;
    if (error instanceof HttpError && error.status === 401) { this.finish(); return; }
    this.set({ error: error instanceof Error ? error.message : fallback, blocked: !this.view.status || this.now() >= this.deadline() });
  }
  private tick = () => {
    if (!this.active || this.ended || !this.view.status) return;
    const now = this.now();
    this.set({ now, success: now >= Date.parse(this.view.status.warningAt) ? "" : this.view.success });
    if (now >= this.deadline()) void this.expire();
  };
  private resume = () => {
    if (document.visibilityState !== "visible") return;
    this.tick();
    if (!this.expiring) void this.check();
  };
  private activity = (event: Event) => {
    if (!event.isTrusted || document.visibilityState !== "visible") return;
    if (this.view.success) this.set({ success: "" });
    if (!this.view.status || this.ended
      || this.now() >= Date.parse(this.view.status.warningAt) || this.mutating || this.expiring) return;
    this.activityPending = true;
    if (this.activityTimer !== undefined) return;
    const delay = Math.max(0, 15_000 - (Date.now() - this.activitySentAt));
    if (!delay) void this.sendActivity();
    else this.activityTimer = window.setTimeout(() => { this.activityTimer = undefined; void this.sendActivity(); }, delay);
  };
  private async sendActivity() {
    if (!this.active || this.ended || !this.activityPending || document.visibilityState !== "visible"
      || !this.view.status || this.now() >= Date.parse(this.view.status.warningAt)) return;
    this.activityPending = false;
    this.activitySentAt = Date.now();
    try {
      const status = await this.service.activity(this.accountId);
      // A throttled activity returns the cached raw status; it must not reset elapsed time.
      if (Date.parse(status.serverNow) > this.confirmedServerAt) this.accept(status);
    }
    catch (error) { this.fail(error, "Lo sentimos. No pudimos registrar tu actividad. Intentá comprobar la sesión nuevamente."); }
  }

  async check() {
    if (!this.active || this.ended || this.checking || this.expiring) return;
    this.checking = true;
    if (!this.view.status) this.set({ pending: "check" });
    try { this.accept(await this.service.getStatus(this.accountId)); }
    catch (error) { this.fail(error, "Lo sentimos. No pudimos comprobar tu sesión. Intentá nuevamente."); }
    finally { this.checking = false; if (this.view.pending === "check") this.set({ pending: null }); }
  }
  async renew() {
    if (!this.active || this.ended || this.mutating || this.expiring || this.now() >= this.deadline()) return;
    this.mutating = true;
    this.set({ pending: "renew", error: "" });
    try {
      this.accept(await this.service.renew(this.accountId));
      this.set({ success: "La sesión se renovó correctamente." });
    }
    catch (error) { this.fail(error, "Lo sentimos. No pudimos renovar la sesión. Intentá nuevamente."); }
    finally { this.mutating = false; if (this.view.pending === "renew") this.set({ pending: null }); }
  }
  async close() {
    if (!this.active || this.ended || this.mutating || this.expiring) return;
    this.mutating = true;
    this.set({ pending: "close", blocked: true });
    try { await this.service.close(this.accountId); }
    catch (error) {
      // A changed identity must not be closed by an old screen.
      if (error instanceof HttpError && error.status === 409) {
        this.mutating = false; this.set({ pending: null }); void this.check(); return;
      }
      // Local closure is required even when remote revocation could not be confirmed.
    }
    this.finish(this.reason() === "absolute" ? "absolute" : "logout");
  }
  private async expire() {
    if (!this.active || this.ended || this.expiring) return;
    this.expiring = true;
    this.set({ pending: "expire", blocked: true });
    try {
      const current = await this.service.expire(this.accountId);
      if (current) this.accept(current);
      else this.finish();
    } catch (error) {
      if (error instanceof HttpError && error.status === 409) {
        this.set({ error: error.message });
      } else this.finish();
    } finally {
      this.expiring = false;
      if (this.view.pending === "expire") this.set({ pending: null });
    }
  }

  start() {
    this.active = true;
    this.unsubscribe = this.service.subscribe(this.acceptShared);
    this.tickTimer = window.setInterval(this.tick, 1000);
    this.pollTimer = window.setInterval(() => { if (document.visibilityState === "visible") void this.check(); }, 60_000);
    window.addEventListener("focus", this.resume);
    document.addEventListener("visibilitychange", this.resume);
    for (const event of ACTIVITY_EVENTS) document.addEventListener(event, this.activity, { passive: true, capture: true });
    void this.check();
    return () => {
      this.active = false;
      window.clearInterval(this.tickTimer); window.clearInterval(this.pollTimer); window.clearTimeout(this.activityTimer);
      window.removeEventListener("focus", this.resume); document.removeEventListener("visibilitychange", this.resume);
      for (const event of ACTIVITY_EVENTS) document.removeEventListener(event, this.activity, true);
      this.unsubscribe?.();
    };
  }
}
