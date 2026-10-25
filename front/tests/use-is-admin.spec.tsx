// @vitest-environment jsdom
import type { ReactNode } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, renderHook } from "@testing-library/react";
import { AuthContext, type AuthContextValue } from "@/components/auth/AuthProvider";
import type { PublicAccount } from "@/types/auth";
import { useIsAdmin } from "@/hooks/useIsAdmin";

afterEach(cleanup);

// TASK-049 §5: test AuthContext; only `account` matters to the hook.
function isAdminWith(account: PublicAccount | null) {
  const value = { status: account ? "authenticated" : "checking", account } as AuthContextValue;
  const wrapper = ({ children }: { children: ReactNode }) => <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
  return renderHook(() => useIsAdmin(), { wrapper }).result.current;
}

const cuenta = (role: PublicAccount["role"]): PublicAccount => ({ id: "a1", email: "a@frlp.utn.edu.ar", displayName: "Cuenta", role });

describe("useIsAdmin", () => {
  it("cuenta con rol ADMIN → true", () => {
    expect(isAdminWith(cuenta("ADMIN"))).toBe(true);
  });
  it("cuenta con rol USER → false", () => {
    expect(isAdminWith(cuenta("USER"))).toBe(false);
  });
  it("sin cuenta (sesión cargando) → false, sin acciones de admin que después desaparezcan", () => {
    expect(isAdminWith(null)).toBe(false);
  });
});
