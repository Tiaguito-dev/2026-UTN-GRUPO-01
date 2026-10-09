import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthService } from "../src/services/auth";
import { HttpError, requestJson } from "../src/services/http";
import { safeReturnPath, validateDisplayName, validateEmail, validateNewPassword } from "../src/validations/auth";
import { validateRegistrationInput } from "../../back/src/auth/domain/registration-input.js";

const account = { id: "public-account", email: "account@example.test", displayName: "Cuenta", role: "USER" };
const goodPassword = " contraseña sin recortar ";
let storage: Map<string, string>;
let messages: unknown[];
let fetchMock: ReturnType<typeof vi.fn>;
const reply = (status: number, body: unknown = account) => new Response(status === 204 ? null : JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const path = (input: unknown) => new URL(String(input)).pathname;
beforeEach(() => {
  storage = new Map(); messages = [];
  let tail: Promise<unknown> = Promise.resolve();
  vi.stubGlobal("window", { addEventListener: vi.fn() });
  vi.stubGlobal("localStorage", { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value), removeItem: (key: string) => storage.delete(key) });
  vi.stubGlobal("navigator", { locks: { request: (_name: string, action: () => Promise<unknown>) => { const pending = tail.then(action); tail = pending.catch(() => undefined); return pending; } } });
  vi.stubGlobal("BroadcastChannel", class { onmessage = null; postMessage(value: unknown) { messages.push(value); } });
  fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("NEXT_PUBLIC_API_URL", "http://localhost:3301"); vi.stubEnv("NEXT_PUBLIC_ALLOW_LOCAL_HTTP", "true");
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe("Cliente central y coordinación de sesión", () => {
  it("incluye cookies, no-store y CSRF sin recortar la contraseña", async () => {
    fetchMock.mockResolvedValue(reply(200));
    await new AuthService().login({ email: " ACCOUNT@EXAMPLE.TEST ", password: goodPassword });
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe("http://localhost:3301/auth/login");
    expect(options).toMatchObject({ credentials: "include", cache: "no-store", method: "POST", headers: { "X-CSRF-Protection": "1" } });
    expect(JSON.parse(options.body)).toEqual({ email: account.email, password: goodPassword });
    const marker = JSON.parse(storage.get("butchery.auth.revision")!);
    expect(Object.keys(marker).sort()).toEqual(["id", "kind"]); expect(marker.kind).toBe("login");
    expect(JSON.stringify(messages).includes(goodPassword)).toBe(false);
  });
  it("tres peticiones simultáneas comparten un refresh y se reintentan una vez", async () => {
    let renewed = false;
    fetchMock.mockImplementation(async (url: string) => {
      if (path(url) === "/auth/refresh") { renewed = true; return reply(200); }
      return reply(renewed ? 200 : 401);
    });
    const service = new AuthService();
    const results = await Promise.all([service.protectedGet("/test/protected"), service.protectedGet("/test/protected"), service.protectedGet("/test/protected")]);
    expect(results).toEqual([account, account, account]);
    expect(fetchMock.mock.calls.filter(([url]) => path(url) === "/auth/refresh")).toHaveLength(1);
    expect(fetchMock.mock.calls.filter(([url]) => path(url) === "/test/protected")).toHaveLength(6);
  });
  it("dos clientes bajo el mismo lock comprueban me antes de emitir otra rotación", async () => {
    let renewed = false;
    fetchMock.mockImplementation(async (url: string) => {
      if (path(url) === "/auth/refresh") { renewed = true; return reply(200); }
      return reply(renewed ? 200 : 401);
    });
    await Promise.all([new AuthService().me(), new AuthService().me()]);
    expect(fetchMock.mock.calls.filter(([url]) => path(url) === "/auth/refresh")).toHaveLength(1);
    expect(fetchMock.mock.calls.filter(([url]) => path(url) === "/auth/me")).toHaveLength(6);
  });
  it("un segundo 401 después de renovar no produce bucles", async () => {
    fetchMock.mockImplementation(async (url: string) => reply(path(url) === "/auth/refresh" ? 200 : 401));
    await expect(new AuthService().me()).rejects.toMatchObject({ status: 401 });
    expect(fetchMock.mock.calls.filter(([url]) => path(url) === "/auth/refresh")).toHaveLength(1);
  });
  it.each([403, 429, 500])("un %i en petición protegida no inicia refresh", async (status) => {
    fetchMock.mockResolvedValue(reply(status));
    await expect(new AuthService().me()).rejects.toMatchObject({ status });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it("refresh 401 publica cierre; refresh 500/red señala incertidumbre sin declarar cierre", async () => {
    for (const status of [401, 500, 0]) {
      storage.clear(); messages = []; fetchMock.mockReset();
      fetchMock.mockImplementation(async (url: string) => {
        if (path(url) !== "/auth/refresh") return reply(401);
        if (status === 0) throw new Error("Network unavailable");
        return reply(status);
      });
      const service = new AuthService(); await expect(service.me()).rejects.toMatchObject({ status });
      expect(service.coordinator.read()?.kind ?? null).toBe(status === 401 ? "expired" : "refresh-uncertain");
    }
  });
  it("una renovación ambigua no repite una rotación que pudo completarse", async () => {
    fetchMock.mockImplementation(async (url: string) => reply(path(url) === "/auth/refresh" ? 500 : 401));
    const service = new AuthService(); await expect(service.me()).rejects.toMatchObject({ status: 500 });
    await expect(service.me()).rejects.toMatchObject({ status: 0 });
    expect(fetchMock.mock.calls.filter(([url]) => path(url) === "/auth/refresh")).toHaveLength(1);
    fetchMock.mockImplementation(async () => reply(200)); await expect(service.me()).resolves.toEqual(account);
  });
  it("login, registro, recuperación, reset y logout no activan refresh", async () => {
    fetchMock.mockResolvedValue(reply(401)); const service = new AuthService();
    for (const operation of [
      () => service.login({ email: account.email, password: goodPassword }),
      () => service.register({ email: account.email, displayName: account.displayName, password: goodPassword }),
      () => service.forgotPassword({ email: account.email }),
      () => service.resetPassword({ token: "opaque-test-value", newPassword: goodPassword }),
      () => service.logout(),
    ]) await expect(operation()).rejects.toMatchObject({ status: 401 });
    expect(fetchMock).toHaveBeenCalledTimes(5); expect(service.coordinator.read()).toBeNull();
  });
  it("cambio se reintenta solo tras el 401 de guard; 500/red/403 nunca repiten mutación", async () => {
    let attempts = 0, expired = false;
    fetchMock.mockImplementation(async (url: string) => {
      if (path(url) === "/auth/change-password") { if (++attempts === 1) { expired = true; return reply(401); } return reply(204); }
      if (path(url) === "/auth/refresh") { expired = false; return reply(200); }
      return reply(expired ? 401 : 200);
    });
    const input = { currentPassword: goodPassword, newPassword: " nueva contraseña válida " };
    const service = new AuthService(); await service.changePassword(input, account.id);
    expect(attempts).toBe(2); expect(service.coordinator.read()?.kind).toBe("change");
    for (const status of [500, 403, 0]) {
      fetchMock.mockReset(); fetchMock.mockImplementation(async (url: string) => { if (path(url) === "/auth/me") return reply(200); if (!status) throw new Error("Network"); return reply(status); });
      await expect(service.changePassword(input, account.id)).rejects.toMatchObject({ status });
      expect(fetchMock.mock.calls.filter(([url]) => path(url) === "/auth/change-password")).toHaveLength(1);
    }
  });
  it("no modifica la contraseña de una cuenta diferente después de un cambio de cookies", async () => {
    fetchMock.mockResolvedValue(reply(200, { ...account, id: "different-account" }));
    await expect(new AuthService().changePassword({ currentPassword: goodPassword, newPassword: goodPassword }, account.id)).rejects.toMatchObject({ status: 409 });
    expect(fetchMock.mock.calls.some(([url]) => path(url) === "/auth/change-password")).toBe(false);
  });
  it("no renueva sin Web Locks y no publica logout si falló la red", async () => {
    vi.stubGlobal("navigator", {}); fetchMock.mockResolvedValue(reply(401));
    await expect(new AuthService().me()).rejects.toBeInstanceOf(HttpError);
    expect(fetchMock.mock.calls.some(([url]) => path(url) === "/auth/refresh")).toBe(false);
    fetchMock.mockRejectedValue(new Error("Network"));
    const service = new AuthService(); await expect(service.logout()).rejects.toMatchObject({ status: 0 });
    expect(service.coordinator.read()).toBeNull();
  });
  it("almacenamiento bloqueado evita una renovación sin coordinación", async () => {
    vi.stubGlobal("localStorage", { setItem: () => { throw new Error("Storage blocked"); }, getItem: () => null, removeItem: vi.fn() });
    fetchMock.mockResolvedValue(reply(401)); const service = new AuthService();
    expect(service.coordinator.available).toBe(false);
    await expect(service.me()).rejects.toMatchObject({ status: 0 });
    expect(fetchMock.mock.calls.some(([url]) => path(url) === "/auth/refresh")).toBe(false);
  });
  it("errores JSON y HTML tienen mensajes públicos consistentes", async () => {
    fetchMock.mockResolvedValue(reply(400, { message: "Entrada inválida." }));
    await expect(requestJson("/auth/login")).rejects.toMatchObject({ status: 400, message: "Entrada inválida." });
    fetchMock.mockResolvedValue(new Response("<html>private upstream trace</html>", { status: 502 }));
    await expect(requestJson("/auth/me")).rejects.toMatchObject({ status: 502, temporary: true });
  });
});

describe("Validaciones coherentes con el registro del backend", () => {
  it.each(["12345678", "😀".repeat(8), "a".repeat(128)])("acepta ocho caracteres y el máximo establecido", (password) => {
    expect(validateNewPassword(password)).toBeUndefined();
    expect(() => validateRegistrationInput({ email: "x@example.test", displayName: "Cuenta", password })).not.toThrow();
  });
  it.each(["1234567", "😀".repeat(7), "😀".repeat(129)])("rechaza siete caracteres y contraseñas demasiado largas", (password) => {
    expect(validateNewPassword(password)).toBeTruthy();
    expect(() => validateRegistrationInput({ email: "x@example.test", displayName: "Cuenta", password })).toThrow();
  });
  const cases = [
    { email: " ACCOUNT@EXAMPLE.TEST ", displayName: " Cuenta ", password: goodPassword },
    { email: "x..y@example.test", displayName: "Cuenta", password: goodPassword },
    { email: "x@localhost", displayName: "Cuenta", password: goodPassword },
    { email: "x@example.test", displayName: " ", password: goodPassword },
    { email: "x@example.test", displayName: "😀".repeat(100), password: "😀".repeat(15) },
    { email: "x@example.test", displayName: "Cuenta", password: "😀".repeat(129) },
    { email: "x@example.test", displayName: "Cuenta", password: "short" },
    { email: "x@example.test", displayName: "Cuenta", password: "long password\nwith control" },
  ];
  it.each(cases)("aceptación de datos coincide con backend", (input) => {
    let accepted = true; try { validateRegistrationInput(input); } catch { accepted = false; }
    expect(!validateEmail(input.email) && !validateDisplayName(input.displayName) && !validateNewPassword(input.password)).toBe(accepted);
  });
  it.each(["/home", "/account", "/account/change-password"])("permite el destino interno explícito %s", (value) => {
    expect(safeReturnPath(value)).toBe(value);
  });
  it.each(["/", "https://evil.example", "//evil.example", "/\\evil", "/account?next=https://evil.example", "/account\n", "/home?next=https://evil.example", "/home/../login", "/account/change-password?next=https://evil.example", "/account/change-password/../login", null, undefined, "javascript:alert(1)"])("destino público, ausente o inseguro lleva al home interno", (value) => {
    expect(safeReturnPath(value)).toBe("/home");
  });
});
