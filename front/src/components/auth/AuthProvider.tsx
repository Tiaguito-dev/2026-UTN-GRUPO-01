"use client";

import { createContext, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import type { AuthStatus, ChangePasswordInput, LoginInput, PublicAccount, RegisterInput, ResetPasswordInput } from "@/types/auth";
import { getAuthService } from "@/services/auth";
import { HttpError } from "@/services/http";
import type { SessionRevision } from "@/services/session-coordinator";

export interface AuthContextValue {
  status: AuthStatus;
  account: PublicAccount | null;
  error: string | null;
  coordinationAvailable: boolean;
  checkSession(): Promise<void>;
  login(input: LoginInput): Promise<void>;
  register(input: RegisterInput): Promise<PublicAccount>;
  forgotPassword(input: { email: string }): Promise<string>;
  resetPassword(input: ResetPasswordInput): Promise<void>;
  changePassword(input: ChangePasswordInput): Promise<void>;
  logout(): Promise<void>;
}
export const AuthContext = createContext<AuthContextValue | null>(null);
export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("checking");
  const [account, setAccount] = useState<PublicAccount | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [coordinationAvailable, setCoordinationAvailable] = useState(true);
  const generation = useRef(0);
  const clear = useCallback(() => {
    generation.current += 1;
    setAccount(null); setError(null); setStatus("anonymous");
  }, []);
  const failure = useCallback((caught: unknown) => {
    if (caught instanceof HttpError && caught.status === 401) { clear(); return; }
    setError(caught instanceof Error ? caught.message : "No pudimos comprobar tu sesión. Intentá nuevamente.");
    setStatus("temporary-error");
  }, [clear]);
  const checkSession = useCallback(async () => {
    const service = getAuthService();
    const version = ++generation.current;
    const observed = service.coordinator.read()?.id;
    const currentResultAllowed = () => {
      const latest = service.coordinator.read();
      return generation.current === version && (latest?.id === observed || !latest || ["refresh", "refresh-uncertain", "expired"].includes(latest.kind));
    };
    setStatus("checking"); setError(null);
    try {
      const user = await service.me();
      if (!currentResultAllowed()) return;
      setAccount(user); setStatus("authenticated");
    } catch (caught) { if (currentResultAllowed()) failure(caught); }
    finally { setCoordinationAvailable(service.coordinator.available); }
  }, [failure]);
  useEffect(() => {
    const service = getAuthService();
    let seen = service.coordinator.read()?.id;
    let active = true;
    const synchronize = async (revision: SessionRevision) => {
      // Read the current metadata rather than trusting a possibly delayed channel message.
      const latest = service.coordinator.read();
      if (!latest || latest.id !== revision.id || seen === latest.id) return;
      seen = latest.id;
      if (["logout", "reset", "change", "expired"].includes(latest.kind)) { clear(); return; }
      const version = ++generation.current;
      if (latest.kind === "refresh-uncertain") {
        setError("No pudimos confirmar la renovación. Reintentá comprobar la cuenta o iniciá sesión nuevamente.");
        setStatus("temporary-error");
        return;
      }
      try {
        const user = await service.probe();
        if (!active || generation.current !== version || service.coordinator.read()?.id !== latest.id) return;
        setAccount(user); setError(null); setStatus("authenticated");
      } catch (caught) { if (active && generation.current === version && service.coordinator.read()?.id === latest.id) failure(caught); }
    };
    const unsubscribe = service.coordinator.subscribe((revision) => { void synchronize(revision); });
    void checkSession();
    return () => { active = false; generation.current += 1; unsubscribe(); };
  }, [checkSession, clear, failure]);
  const login = async (input: LoginInput) => {
    await getAuthService().login(input, (user) => {
      // Success is applied before releasing the cookie lock; later tab events can supersede it.
      generation.current += 1;
      setAccount(user); setError(null); setStatus("authenticated");
    });
  };
  const resetPassword = async (input: ResetPasswordInput) => { await getAuthService().resetPassword(input, clear); };
  const changePassword = async (input: ChangePasswordInput) => {
    try { await getAuthService().changePassword(input, account?.id, clear); }
    catch (caught) {
      if (caught instanceof HttpError && (caught.temporary || caught.status === 401 || caught.status === 409)) failure(caught);
      throw caught;
    }
  };
  const logout = async () => {
    try { await getAuthService().logout(clear); }
    catch (caught) {
      // Keeping the account avoids asserting that a failed request revoked the server session.
      setError("No pudimos confirmar el cierre de sesión. Intentá nuevamente.");
      throw caught;
    }
  };
  return <AuthContext.Provider value={{ status, account, error, coordinationAvailable, checkSession, login,
    register: (input) => getAuthService().register(input), forgotPassword: (input) => getAuthService().forgotPassword(input),
    resetPassword, changePassword, logout }}>{children}</AuthContext.Provider>;
}
