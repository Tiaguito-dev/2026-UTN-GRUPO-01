import express, { type Request } from "express";
import { describe, expect, it } from "vitest";
import { hasAllowedAuthTransport } from "../src/auth/presentation/http-security.js";
import { testAuthConfig } from "./auth-test.config.js";

const proxyIp = "192.168.240.10";
function request(remoteAddress: string, trustedProxies: string[], forwardedProto = "http"): Request {
  const app = express();
  app.set("trust proxy", trustedProxies.length ? trustedProxies : false);
  // Use Express' own secure/protocol getters and compiled proxy matching function.
  return Object.assign(Object.create(express.request) as Request, {
    app,
    socket: { remoteAddress, encrypted: false },
    headers: { "x-forwarded-proto": forwardedProto, "x-forwarded-for": "127.0.0.1", forwarded: "for=127.0.0.1;proto=https" },
  });
}

describe("Transporte de autenticación y proxy HTTP de desarrollo", () => {
  it("permite HTTP del proxy exacto configurado únicamente con excepción local explícita", () => {
    const config = testAuthConfig({ AUTH_TRUSTED_PROXIES: proxyIp });
    expect(hasAllowedAuthTransport(request(proxyIp, config.trustedProxies), config)).toBe(true);
  });
  it.each(["192.168.240.11", "203.0.113.10"])("rechaza socket no confiado %s aunque falsifique cabeceras", (remoteAddress) => {
    const config = testAuthConfig({ AUTH_TRUSTED_PROXIES: proxyIp });
    const incoming = request(remoteAddress, config.trustedProxies, "https");
    expect(incoming.secure).toBe(false);
    expect(hasAllowedAuthTransport(incoming, config)).toBe(false);
  });
  it("sin lista explícita no confía en el proxy ni en su IP declarada", () => {
    const config = testAuthConfig();
    expect(hasAllowedAuthTransport(request(proxyIp, []), config)).toBe(false);
  });
  it.each(["127.0.0.1", "::1", "::ffff:127.0.0.1"])("mantiene HTTP local directo %s", (remoteAddress) => {
    const config = testAuthConfig();
    expect(hasAllowedAuthTransport(request(remoteAddress, []), config)).toBe(true);
  });
  it("producción rechaza HTTP incluso desde proxy autorizado y acepta HTTPS reportado por ese proxy", () => {
    const config = testAuthConfig({ NODE_ENV: "production", AUTH_ALLOW_LOCAL_HTTP: "false", AUTH_PUBLIC_URL: "https://api.example.test", AUTH_ALLOWED_ORIGINS: "https://app.example.test", AUTH_PASSWORD_RESET_URL: "https://app.example.test/reset-password", AUTH_TRUSTED_PROXIES: proxyIp });
    expect(hasAllowedAuthTransport(request(proxyIp, config.trustedProxies), config)).toBe(false);
    expect(hasAllowedAuthTransport(request(proxyIp, config.trustedProxies, "https"), config)).toBe(true);
  });
  it("la configuración impide usar la excepción HTTP en producción o con URL pública remota", () => {
    expect(() => testAuthConfig({ NODE_ENV: "production", AUTH_TRUSTED_PROXIES: proxyIp })).toThrow();
    expect(() => testAuthConfig({ AUTH_PUBLIC_URL: "http://public.example.test", AUTH_TRUSTED_PROXIES: proxyIp })).toThrow();
  });
});
