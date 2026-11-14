// @vitest-environment jsdom
import { useContext, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook } from "@testing-library/react";
import { AuthContext, AuthProvider } from "@/components/auth/AuthProvider";
import { HttpError } from "@/services/http";
import type { PublicAccount } from "@/types/auth";
import type { SessionRevision } from "@/services/session-coordinator";

const { service } = vi.hoisted(() => ({ service: {
  me: vi.fn(), probe: vi.fn(), login: vi.fn(), logout: vi.fn(),
  coordinator: { available: true, read: vi.fn(), subscribe: vi.fn() },
} }));
const { router } = vi.hoisted(() => ({ router: { replace: vi.fn() } }));
vi.mock("@/services/auth", () => ({ getAuthService: () => service }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/services/session", () => ({ getSessionService: () => ({ getEndReason: () => null }) }));
// El monitor de inactividad tiene sus propios tests; estos caracterizan la comprobación de cuenta.
vi.mock("@/components/auth/SessionIdleMonitor", () => ({ SessionIdleMonitor: () => null }));

const account: PublicAccount = { id: "user-1", email: "a@frlp.utn.edu.ar", displayName: "Cuenta", role: "USER" };
const wrapper = ({ children }: { children: ReactNode }) => <AuthProvider>{children}</AuthProvider>;
const useSession = () => useContext(AuthContext)!;
let visible = "visible";

beforeEach(() => {
  vi.resetAllMocks();
  vi.useFakeTimers();
  visible = "visible";
  vi.spyOn(document, "visibilityState", "get").mockImplementation(() => visible as DocumentVisibilityState);
  service.me.mockResolvedValue(account);
  service.coordinator.read.mockReturnValue(null);
  service.coordinator.subscribe.mockReturnValue(() => {});
  service.logout.mockImplementation(async (onSuccess: () => void) => { onSuccess(); });
  service.login.mockImplementation(async (_input: unknown, onSuccess: (user: PublicAccount) => void) => { onSuccess(account); return account; });
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

async function mountSession() {
  const view = renderHook(useSession, { wrapper });
  await act(async () => {});
  expect(view.result.current.status).toBe("authenticated");
  return view;
}

describe("comprobación de expiración en una pestaña abierta", () => {
  it("consulta cada minuto sin ocultar la cuenta ni cambiar a checking durante la petición", async () => {
    const view = await mountSession();
    let resolve!: (value: PublicAccount) => void;
    service.me.mockReturnValueOnce(new Promise<PublicAccount>((done) => { resolve = done; }));
    await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });
    expect(service.me).toHaveBeenCalledTimes(2);
    expect(view.result.current.status).toBe("authenticated");
    expect(view.result.current.account).toEqual(account);
    await act(async () => { resolve(account); });
    expect(view.result.current.status).toBe("authenticated");
  });

  it("cierra el estado local cuando el servidor confirma que la sesión expiró", async () => {
    const view = await mountSession();
    service.me.mockRejectedValueOnce(new HttpError(401, "La sesión terminó."));
    await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });
    expect(view.result.current.status).toBe("anonymous");
    expect(view.result.current.account).toBeNull();
    await act(async () => { await vi.advanceTimersByTimeAsync(120_000); });
    expect(service.me).toHaveBeenCalledTimes(2);
  });

  it("al recuperar foco comprueba la sesión y descarta comprobaciones solapadas", async () => {
    await mountSession();
    let resolve!: (value: PublicAccount) => void;
    service.me.mockReturnValueOnce(new Promise<PublicAccount>((done) => { resolve = done; }));
    await act(async () => { window.dispatchEvent(new Event("focus")); });
    expect(service.me).toHaveBeenCalledTimes(2);
    await act(async () => {
      window.dispatchEvent(new Event("focus"));
      document.dispatchEvent(new Event("visibilitychange"));
      await vi.advanceTimersByTimeAsync(60_000);
    });
    expect(service.me).toHaveBeenCalledTimes(2);
    await act(async () => { resolve(account); });
  });

  it("no consulta oculta y comprueba al volver a ser visible", async () => {
    await mountSession();
    visible = "hidden";
    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
      window.dispatchEvent(new Event("focus"));
      await vi.advanceTimersByTimeAsync(120_000);
    });
    expect(service.me).toHaveBeenCalledTimes(1);
    visible = "visible";
    await act(async () => { document.dispatchEvent(new Event("visibilitychange")); });
    expect(service.me).toHaveBeenCalledTimes(2);
  });

  it("conserva la cuenta ante un fallo de red y recupera la comprobación posterior", async () => {
    const view = await mountSession();
    service.me.mockRejectedValueOnce(new HttpError(0, "Sin conexión. Intentá nuevamente."));
    await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });
    expect(view.result.current.status).toBe("temporary-error");
    expect(view.result.current.account).toEqual(account);
    expect(view.result.current.error).toContain("Sin conexión");
    await act(async () => { window.dispatchEvent(new Event("focus")); });
    expect(view.result.current.status).toBe("authenticated");
    expect(view.result.current.error).toBeNull();
  });

  it("una respuesta pendiente no vuelve a autenticar después de logout", async () => {
    const view = await mountSession();
    let resolve!: (value: PublicAccount) => void;
    service.me.mockReturnValueOnce(new Promise<PublicAccount>((done) => { resolve = done; }));
    await act(async () => { window.dispatchEvent(new Event("focus")); });
    expect(service.me).toHaveBeenCalledTimes(2);
    await act(async () => { await view.result.current.logout(); });
    await act(async () => { resolve(account); });
    expect(view.result.current.status).toBe("anonymous");
    expect(view.result.current.account).toBeNull();
  });

  it("una respuesta pendiente no sobrescribe una cuenta recién autenticada", async () => {
    const view = await mountSession();
    let resolve!: (value: PublicAccount) => void;
    service.me.mockReturnValueOnce(new Promise<PublicAccount>((done) => { resolve = done; }));
    await act(async () => { window.dispatchEvent(new Event("focus")); });
    expect(service.me).toHaveBeenCalledTimes(2);
    const next = { ...account, id: "user-2", displayName: "Otra cuenta" };
    service.login.mockImplementationOnce(async (_input: unknown, onSuccess: (user: PublicAccount) => void) => { onSuccess(next); return next; });
    await act(async () => { await view.result.current.login({ email: next.email, password: "password" }); });
    await act(async () => { resolve(account); });
    expect(view.result.current.account).toEqual(next);
  });

  it("elimina temporizador y eventos al desmontarse", async () => {
    const view = await mountSession();
    view.unmount();
    await act(async () => {
      window.dispatchEvent(new Event("focus"));
      document.dispatchEvent(new Event("visibilitychange"));
      await vi.advanceTimersByTimeAsync(120_000);
    });
    expect(service.me).toHaveBeenCalledTimes(1);
  });
  it("un login externo suspende el monitor anterior aunque la cuenta sea la misma", async () => {
    const view = await mountSession();
    let finish!: (value: PublicAccount) => void;
    service.probe.mockReturnValueOnce(new Promise<PublicAccount>((resolve) => { finish = resolve; }));
    const revision: SessionRevision = { id: "4f58866d-b72c-4fee-bfe5-aa218d2c2c69", kind: "login" };
    service.coordinator.read.mockReturnValue(revision);
    const notify = service.coordinator.subscribe.mock.calls[0]![0] as (event: SessionRevision) => void;
    await act(async () => { notify(revision); });
    // checking desmonta la política antigua mientras verifica el nuevo login.
    expect(view.result.current.status).toBe("checking");
    await act(async () => { finish(account); });
    expect(view.result.current.status).toBe("authenticated");
    expect(view.result.current.account).toEqual(account);
  });
});
