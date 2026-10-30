import { afterEach, describe, expect, it, vi } from "vitest";
import { BrevoVerificationEmail, BrevoPasswordResetEmail } from "../src/auth/infrastructure/brevo-email.js";
import type { BrevoEmailConfig } from "../src/auth/email.config.js";

const config: BrevoEmailConfig = { provider: "brevo", apiKey: "private-api-secret", from: "verified@example.test", fromName: "Profesor Butchery", timeoutMs: 250 };
const message = { email: "student@alu.frlp.utn.edu.ar", token: "opaque-private-token", expiresAt: new Date("2026-10-23T12:00:00Z") };
const url = "https://community.example.test/reset-password";
const adapters = [["verify", BrevoVerificationEmail, "/verify-email"], ["reset", BrevoPasswordResetEmail, "/reset-password"]] as const;
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });
describe.each(adapters)("Brevo %s", (_name, Adapter, route) => {
  it("acepta 201 con messageId y construye remitente, destinatario y enlace seguros", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ messageId: "<provider-id>" }), { status: 201 })); vi.stubGlobal("fetch", fetch);
    await new Adapter(config, url).send(message);
    expect(fetch).toHaveBeenCalledTimes(1);
    const [endpoint, request] = fetch.mock.calls[0]!;
    expect(endpoint).toBe("https://api.brevo.com/v3/smtp/email");
    expect(request).toMatchObject({ method: "POST", redirect: "error" });
    expect(new Headers(request.headers).get("api-key")).toBe(config.apiKey);
    expect(request.signal).toBeInstanceOf(AbortSignal);
    const body = JSON.parse(request.body);
    expect(body.sender).toEqual({ email: config.from, name: config.fromName });
    expect(body.to).toEqual([{ email: message.email }]);
    expect(body.subject).toMatch(/Profesor Butchery/);
    expect(body.textContent).toContain(`https://community.example.test${route}?token=${message.token}`);
    expect(body.textContent).toContain(message.expiresAt.toISOString());
    expect(request.body).not.toContain(config.apiKey);
  });
  it.each([400, 401, 429, 500, 302])("rechaza HTTP %i sin reflejar el cuerpo privado", async status => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ message: config.apiKey }), { status })); vi.stubGlobal("fetch", fetch);
    await expect(new Adapter(config, url).send(message)).rejects.toThrow("EMAIL_DELIVERY_FAILED"); expect(fetch).toHaveBeenCalledTimes(1);
  });
  it.each(["{}", '{"messageId":""}', '{"messageId":42}', "not-json", "null"])("rechaza respuestas inválidas %s", async body => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(body, { status: 201 })));
    await expect(new Adapter(config, url).send(message)).rejects.toThrow("EMAIL_DELIVERY_FAILED");
  });
  it("oculta errores de red y no reintenta", async () => {
    const fetch = vi.fn().mockRejectedValue(new Error(config.apiKey)); vi.stubGlobal("fetch", fetch);
    await expect(new Adapter(config, url).send(message)).rejects.toThrow(/^EMAIL_DELIVERY_FAILED$/); expect(fetch).toHaveBeenCalledTimes(1);
  });
  it.each(["request", "body"])("el deadline cubre %s y aborta sin filtrar secretos", async stage => {
    vi.useFakeTimers();
    const fetch = vi.fn().mockImplementation(async () => stage === "request" ? new Promise(() => {}) : { status: 201, ok: true, json: () => new Promise(() => {}) });
    vi.stubGlobal("fetch", fetch);
    const assertion = expect(new Adapter(config, url).send(message)).rejects.toThrow(/^EMAIL_DELIVERY_FAILED$/);
    await vi.advanceTimersByTimeAsync(251); await assertion;
    expect(fetch.mock.calls[0]![1].signal.aborted).toBe(true); expect(fetch).toHaveBeenCalledTimes(1);
  });
});
