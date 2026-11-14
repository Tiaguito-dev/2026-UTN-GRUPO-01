import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthService } from "@/services/auth";
import { HttpError } from "@/services/http";
import { SessionService } from "@/services/session";
import type { SessionStatus } from "@/types/session";

const account = { id: "account-1", email: "account@example.test", displayName: "Cuenta", role: "USER" };
const baseline = Date.parse("2026-11-13T12:00:00Z");
const state = (warningSeconds = 1680, expirySeconds = 1800): SessionStatus => ({
  serverNow: new Date(Date.now()).toISOString(), warningAt: new Date(Date.now() + warningSeconds * 1000).toISOString(),
  idleExpiresAt: new Date(Date.now() + expirySeconds * 1000).toISOString(), absoluteExpiresAt: new Date(baseline + 604800_000).toISOString(),
});
const reply = (body: unknown, status = 200) => new Response(status === 204 ? null : JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const path = (url: unknown) => new URL(String(url)).pathname;
let storage: Map<string, string>;
let fetchMock: ReturnType<typeof vi.fn>;
let server: SessionStatus;
beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(baseline);
  storage = new Map(); server = state();
  let tail: Promise<unknown> = Promise.resolve();
  vi.stubGlobal("window", { addEventListener: vi.fn() });
  vi.stubGlobal("localStorage", { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value), removeItem: (key: string) => storage.delete(key) });
  vi.stubGlobal("navigator", { locks: { request: (_name: string, action: () => Promise<unknown>) => { const pending = tail.then(action); tail = pending.catch(() => undefined); return pending; } } });
  vi.stubGlobal("BroadcastChannel", class { onmessage = null; postMessage() {} });
  fetchMock = vi.fn(async (url: string) => reply(path(url) === "/auth/me" || path(url) === "/auth/login" ? account : server));
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("NEXT_PUBLIC_API_URL", "http://localhost:3301"); vi.stubEnv("NEXT_PUBLIC_ALLOW_LOCAL_HTTP", "true");
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
const writes = (suffix: string) => fetchMock.mock.calls.filter(([url, options]) => path(url).endsWith(suffix) && options?.method === "POST");

describe("servicio de política de sesión", () => {
  it("consulta plazos sin credenciales en storage y sin escribir actividad", async () => {
    const service = new SessionService(new AuthService());
    await expect(service.getStatus(account.id)).resolves.toEqual(server);
    const call = fetchMock.mock.calls.find(([url]) => path(url) === "/auth/session");
    expect(call?.[1]).toMatchObject({ method: "GET", credentials: "include", cache: "no-store" });
    expect(writes("/activity")).toHaveLength(0);
    const stored = JSON.parse(storage.get("butchery.auth.session-status")!);
    expect(Object.keys(stored).sort()).toEqual(["accountId", "activityAt", "receivedAt", "revisionId", "status"]);
    expect(JSON.stringify(stored)).not.toMatch(/cookie|accessToken|refreshToken|password/);
  });

  it("dos pestañas agrupan actividad en una solicitud cada quince segundos", async () => {
    const first = new SessionService(new AuthService()); const second = new SessionService(new AuthService());
    await first.getStatus(account.id); await second.getStatus(account.id);
    await Promise.all([first.activity(account.id), second.activity(account.id), first.activity(account.id)]);
    expect(writes("/activity")).toHaveLength(1);
    vi.setSystemTime(baseline + 15_000); server = state();
    await Promise.all([second.activity(account.id), first.activity(account.id)]);
    expect(writes("/activity")).toHaveLength(2);
    expect(writes("/activity")[0]?.[1]).toMatchObject({ headers: { "X-CSRF-Protection": "1" } });
  });

  it("al comenzar el aviso no envía más actividad aunque haya interacción", async () => {
    const service = new SessionService(new AuthService()); server = state(0, 120);
    await service.getStatus(account.id); await service.activity(account.id);
    expect(writes("/activity")).toHaveLength(0);
  });

  it("renueva explícitamente una sola vez si otra pestaña ya confirmó", async () => {
    server = state(0, 120);
    fetchMock.mockImplementation(async (url: string) => {
      if (path(url) === "/auth/me") return reply(account);
      if (path(url) === "/auth/session/renew") { server = state(); return reply(server); }
      return reply(server);
    });
    const first = new SessionService(new AuthService()); const second = new SessionService(new AuthService());
    await Promise.all([first.renew(account.id), second.renew(account.id)]);
    expect(writes("/renew")).toHaveLength(1);
  });

  it("un resultado ambiguo de renovación se comprueba antes de reintentar y no se reproduce", async () => {
    server = state(0, 120);
    fetchMock.mockImplementation(async (url: string) => {
      if (path(url) === "/auth/me") return reply(account);
      if (path(url) === "/auth/session/renew") { server = state(); return reply({ message: "No pudimos confirmar la respuesta." }, 500); }
      return reply(server);
    });
    const service = new SessionService(new AuthService());
    await expect(service.renew(account.id)).rejects.toMatchObject({ status: 500 });
    await expect(service.renew(account.id)).resolves.toEqual(server);
    expect(writes("/renew")).toHaveLength(1);
  });

  it("al vencer una pestaña consulta el servidor y conserva la renovación de otra", async () => {
    const service = new SessionService(new AuthService());
    await service.getStatus(account.id); vi.setSystemTime(baseline + 1800_000); server = state();
    await expect(service.expire(account.id)).resolves.toEqual(server);
    expect(writes("/logout")).toHaveLength(0);
  });

  it("un cierre encolado no revoca un nuevo login de la misma cuenta", async () => {
    const auth = new AuthService(); const service = new SessionService(auth);
    let release!: () => void;
    const blocker = auth.coordinator.lock(() => new Promise<void>((resolve) => { release = resolve; }));
    await Promise.resolve();
    const login = auth.login({ email: account.email, password: "test-password" });
    const closing = service.close(account.id);
    const rejected = expect(closing).rejects.toBeInstanceOf(HttpError);
    release(); await blocker; await login; await rejected;
    expect(writes("/logout")).toHaveLength(0);
  });

  it("no extiende el límite absoluto y pide un nuevo login", async () => {
    server = { ...state(0, 1800), absoluteExpiresAt: new Date(baseline + 60_000).toISOString() };
    const service = new SessionService(new AuthService());
    await expect(service.renew(account.id)).rejects.toMatchObject({ status: 409 });
    expect(writes("/renew")).toHaveLength(0);
  });

  it("rechaza metadata inválida y errores de red sin inventar plazos", async () => {
    fetchMock.mockImplementation(async (url: string) => reply(path(url) === "/auth/me" ? account : { serverNow: "invalid" }));
    await expect(new SessionService(new AuthService()).getStatus(account.id)).rejects.toBeTruthy();
    fetchMock.mockRejectedValueOnce(new TypeError("offline"));
    await expect(new SessionService(new AuthService()).getStatus(account.id)).rejects.toMatchObject({ status: 0 });
  });
  it("un cierre sin red deja marca local y no permite restaurar la cuenta con cookies anteriores", async () => {
    const auth = new AuthService(); const service = new SessionService(auth);
    fetchMock.mockImplementation(async (url: string) => {
      if (path(url) === "/auth/logout") throw new TypeError("offline");
      return reply(account);
    });
    await expect(service.close(account.id)).rejects.toMatchObject({ status: 0 });
    expect(auth.coordinator.read()?.kind).toBe("logout");
    fetchMock.mockClear();
    await expect(auth.me()).rejects.toMatchObject({ status: 401 });
    await expect(auth.probe()).rejects.toMatchObject({ status: 401 });
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("la expiración sin conexión cierra localmente sin prometer una revocación remota", async () => {
    const auth = new AuthService(); const service = new SessionService(auth);
    fetchMock.mockRejectedValueOnce(new TypeError("offline"));
    await expect(service.expire(account.id)).rejects.toMatchObject({ status: 0 });
    expect(auth.coordinator.read()?.kind).toBe("expired");
    expect(writes("/logout")).toHaveLength(0);
    await expect(auth.me()).rejects.toMatchObject({ status: 401 });
  });
});
