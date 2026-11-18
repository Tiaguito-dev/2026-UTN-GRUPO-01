import type { AuthStatus } from "@/types/auth";
export interface FeedbackDraftValues { texto: string; puntuacion: number | null; target: string; anonimo: boolean }
export const FEEDBACK_DRAFT_TTL = 5 * 60_000;
export const FEEDBACK_DRAFT_LIMIT = 3;
const MAX_TEXT_UNITS = 12_000;
interface Entry { value: FeedbackDraftValues | null; token: symbol; interrupted: boolean; expiresAt: number }
/** One provider owns one bounded memory. This class never accesses browser storage. */
export class FeedbackDraftMemory {
  private owner: string | null;
  private authenticated: boolean;
  private readonly entries = new Map<string, Entry>();
  constructor(owner: string | null, private readonly now: () => number = Date.now) { this.owner = owner; this.authenticated = owner !== null; }
  clear() { this.entries.clear(); this.owner = null; this.authenticated = false; }
  prune() { for (const [key, entry] of this.entries) if (entry.interrupted && entry.expiresAt <= this.now()) this.entries.delete(key); }
  observe(status: AuthStatus, owner: string | null) {
    this.prune();
    if (status === "anonymous" || !owner) { this.clear(); return; }
    if (this.owner !== owner) this.clear();
    if (status === "authenticated") { this.owner = owner; this.authenticated = true; return; }
    this.authenticated = false;
    for (const entry of this.entries.values()) if (!entry.interrupted) { entry.interrupted = true; entry.expiresAt = this.now() + FEEDBACK_DRAFT_TTL; }
  }
  read(owner: string, key: string): FeedbackDraftValues | null {
    const entry = this.entries.get(key);
    return this.owner === owner && entry?.interrupted && entry.expiresAt > this.now() && entry.value ? { ...entry.value } : null;
  }
  private bounded(value: FeedbackDraftValues): FeedbackDraftValues | null {
    return value.texto.length <= MAX_TEXT_UNITS && value.target.length <= 128 ? { texto: value.texto, puntuacion: value.puntuacion, target: value.target, anonimo: value.anonimo } : null;
  }
  activate(owner: string, key: string, token: symbol, value: FeedbackDraftValues) {
    this.prune();
    if (!this.authenticated || this.owner !== owner) return;
    this.entries.delete(key); this.entries.set(key, { value: this.bounded(value), token, interrupted: false, expiresAt: Infinity });
    while (this.entries.size > FEEDBACK_DRAFT_LIMIT) this.entries.delete(this.entries.keys().next().value!);
  }
  write(owner: string, key: string, token: symbol, value: FeedbackDraftValues) {
    const entry = this.entries.get(key);
    if (this.authenticated && this.owner === owner && entry?.token === token && !entry.interrupted) entry.value = this.bounded(value);
  }
  release(owner: string, key: string, token: symbol) {
    const entry = this.entries.get(key);
    if (this.owner === owner && entry?.token === token && !entry.interrupted) this.entries.delete(key);
  }
  discard(owner: string, key: string, token: symbol) {
    if (this.owner === owner && this.entries.get(key)?.token === token) this.entries.delete(key);
  }
}
