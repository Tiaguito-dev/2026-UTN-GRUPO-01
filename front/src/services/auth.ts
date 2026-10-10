import type { ChangePasswordInput, LoginInput, PublicAccount, RegisterInput, ResetPasswordInput } from "@/types/auth";
import { HttpError, requestJson } from "./http";
import { SessionCoordinator, type SessionRevision } from "./session-coordinator";

function sameRevision(first: SessionRevision | null, second: SessionRevision | null): boolean { return first?.id === second?.id; }
const CLOSED = ["logout", "reset", "change", "expired"];
function publicAccount(value: unknown): PublicAccount {
  if (!value || typeof value !== "object") throw new HttpError(502, "El servidor devolvió una cuenta inválida. Intentá nuevamente.");
  const account = value as Record<string, unknown>;
  if (typeof account.id !== "string" || !account.id || typeof account.email !== "string" || typeof account.displayName !== "string" || (account.role !== "ADMIN" && account.role !== "USER")) throw new HttpError(502, "El servidor devolvió una cuenta inválida. Intentá nuevamente.");
  return { id: account.id, email: account.email, displayName: account.displayName, role: account.role, ...(typeof account.createdAt === "string" ? { createdAt: account.createdAt } : {}) };
}

export class AuthService {
  readonly coordinator = new SessionCoordinator();
  private renewal: Promise<void> | null = null;
  private async rawMe(): Promise<PublicAccount> { return publicAccount(await requestJson("/auth/me")); }

  /** This helper runs under the existing cookie lock; it never recursively requests it. */
  private async renewLocked(observed: SessionRevision | null, mutation = false): Promise<void> {
    const current = this.coordinator.read();
    if (!sameRevision(observed, current)) {
      if (current && CLOSED.includes(current.kind)) throw new HttpError(401, "La sesión terminó. Iniciá sesión nuevamente.");
      if (mutation && current?.kind !== "refresh") throw new HttpError(409, "La cuenta cambió en otra pestaña. Comprobá la cuenta antes de volver a enviar el formulario.");
    }
    // Always probe after taking the lock: another tab may already have replaced the cookie.
    try {
      await this.rawMe();
      if (current?.kind === "refresh-uncertain") this.coordinator.publish("refresh");
      return;
    }
    catch (error) { if (!(error instanceof HttpError) || error.status !== 401) throw error; }
    if (current?.kind === "refresh-uncertain") throw new HttpError(0, "No pudimos confirmar la renovación anterior. Para evitar reutilizar una credencial, iniciá sesión nuevamente; también podés reintentar comprobar la cuenta.");
    try {
      publicAccount(await requestJson("/auth/refresh", { method: "POST" }));
      this.coordinator.publish("refresh");
    } catch (error) {
      if (error instanceof HttpError && error.status === 401) this.coordinator.publish("expired");
      if (error instanceof HttpError && (error.status === 0 || error.status >= 500)) this.coordinator.publish("refresh-uncertain");
      throw error;
    }
  }
  private renew(observed: SessionRevision | null): Promise<void> {
    if (this.renewal) return this.renewal;
    this.renewal = this.coordinator.lock(() => this.renewLocked(observed), true).finally(() => { this.renewal = null; });
    return this.renewal;
  }
  /** Only protected GETs can use generic recovery. Ambiguous mutations are never replayed. */
  async protectedGet<T>(path: string): Promise<T> {
    const observed = this.coordinator.read();
    try {
      const result = await requestJson<T>(path);
      if (observed?.kind === "refresh-uncertain") await this.coordinator.lock(async () => {
        if (sameRevision(observed, this.coordinator.read())) {
          await this.rawMe();
          this.coordinator.publish("refresh");
        }
      }, true);
      return result;
    }
    catch (error) {
      if (!(error instanceof HttpError) || error.status !== 401) throw error;
      await this.renew(observed);
      return requestJson<T>(path);
    }
  }
  /** Alta administrativa: un 401 lo genera el guard de sesión antes del handler, así que la
   *  escritura no se ejecutó y reintentarla una vez tras el refresh no puede duplicar el alta.
   *  Cualquier otro fallo (409, 404, 400, red) se devuelve sin reintentar. */
  async protectedPost<T>(path: string, body: unknown): Promise<T> {
    const observed = this.coordinator.read();
    try { return await requestJson<T>(path, { method: "POST", body }); }
    catch (error) {
      if (!(error instanceof HttpError) || error.status !== 401) throw error;
      await this.renew(observed);
      return requestJson<T>(path, { method: "POST", body });
    }
  }
  async me(): Promise<PublicAccount> { return publicAccount(await this.protectedGet("/auth/me")); }
  probe(): Promise<PublicAccount> { return this.rawMe(); }
  login(input: LoginInput, onSuccess?: (account: PublicAccount) => void): Promise<PublicAccount> {
    return this.coordinator.lock(async () => {
      const result = publicAccount(await requestJson("/auth/login", { method: "POST", body: { email: input.email.trim().toLowerCase(), password: input.password } }));
      this.coordinator.publish("login");
      onSuccess?.(result);
      return result;
    });
  }
  async register(input: RegisterInput): Promise<PublicAccount> {
    return publicAccount(await requestJson("/auth/register", { method: "POST", body: { email: input.email.trim().toLowerCase(), displayName: input.displayName.trim(), password: input.password } }));
  }
  async forgotPassword(input: { email: string }): Promise<string> {
    const result = await requestJson<{ message: string }>("/auth/forgot-password", { method: "POST", body: { email: input.email.trim().toLowerCase() } });
    return result.message;
  }
  resetPassword(input: ResetPasswordInput, onSuccess?: () => void): Promise<void> {
    return this.coordinator.lock(async () => {
      await requestJson<void>("/auth/reset-password", { method: "POST", body: input });
      this.coordinator.publish("reset");
      onSuccess?.();
    });
  }
  changePassword(input: ChangePasswordInput, expectedAccountId?: string, onSuccess?: () => void): Promise<void> {
    // A guard-generated 401 guarantees this mutation did not execute; all other failures
    // are returned without replay. The lock spans refresh/retry and password change.
    const observed = this.coordinator.read();
    return this.coordinator.lock(async () => {
      const current = this.coordinator.read();
      if (!sameRevision(observed, current) && current?.kind !== "refresh") throw new HttpError(409, "La cuenta cambió en otra pestaña. Comprobá la cuenta antes de continuar.");
      if (!expectedAccountId) throw new HttpError(409, "Comprobá la cuenta antes de cambiar la contraseña.");
      let renewed = false;
      let account: PublicAccount;
      try { account = await this.rawMe(); }
      catch (error) {
        if (!(error instanceof HttpError) || error.status !== 401) throw error;
        if (!this.coordinator.available) throw new HttpError(0, "No se puede renovar de forma segura en este navegador. Iniciá sesión nuevamente.");
        await this.renewLocked(observed, true);
        renewed = true;
        account = await this.rawMe();
      }
      if (account.id !== expectedAccountId) throw new HttpError(409, "La cuenta cambió en otra pestaña. Comprobá la cuenta antes de continuar.");
      try { await requestJson<void>("/auth/change-password", { method: "POST", body: input }); }
      catch (error) {
        if (!(error instanceof HttpError) || error.status !== 401 || renewed) throw error;
        if (!this.coordinator.available) throw new HttpError(0, "No se puede renovar de forma segura en este navegador. Iniciá sesión nuevamente.");
        await this.renewLocked(observed, true);
        await requestJson<void>("/auth/change-password", { method: "POST", body: input });
      }
      this.coordinator.publish("change");
      onSuccess?.();
    });
  }
  logout(onSuccess?: () => void): Promise<void> {
    return this.coordinator.lock(async () => {
      await requestJson<void>("/auth/logout", { method: "POST" });
      this.coordinator.publish("logout");
      onSuccess?.();
    });
  }
}

let browserService: AuthService | undefined;
export function getAuthService(): AuthService {
  if (typeof window === "undefined") throw new Error("El cliente de autenticación requiere el navegador.");
  return browserService ??= new AuthService();
}
