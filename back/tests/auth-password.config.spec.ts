import { describe, expect, it } from "vitest";
import { readSmtpConfig } from "../src/auth/smtp.config.js";
import { testAuthConfig, testAuthEnvironment } from "./auth-test.config.js";

describe("Configuración segura de recuperación", () => {
  it("aplica TTL30min y configuración explícita del buzón local", () => {
    expect(testAuthConfig().passwordResetTtlSeconds).toBe(1800);
    expect(readSmtpConfig(testAuthEnvironment())).toMatchObject({ host: "127.0.0.1", port: 1025, from: "auth@example.test", secure: false, allowLocalPlaintext: true });
  });
  it.each([
    { AUTH_PASSWORD_RESET_URL: "" }, { AUTH_PASSWORD_RESET_URL: "https://attacker.example/reset" },
    { AUTH_PASSWORD_RESET_URL: "http://localhost:3000/reset?secret=value" }, { AUTH_PASSWORD_RESET_URL: "http://localhost:3000/reset#token" },
    { AUTH_PASSWORD_RESET_TTL_SECONDS: "0" }, { AUTH_PASSWORD_RESET_TTL_SECONDS: "86401" },
    { AUTH_PASSWORD_RESET_MIN_RESPONSE_MS: "499" }, { AUTH_PASSWORD_RESET_MIN_RESPONSE_MS: "500", SMTP_TIMEOUT_MS: "500" },
    { AUTH_FORGOT_PASSWORD_MAX_ATTEMPTS: "0" }, { AUTH_RESET_PASSWORD_WINDOW_SECONDS: "0" }, { AUTH_CHANGE_PASSWORD_MAX_ATTEMPTS: "0" },
  ])("rechaza configuración auth inválida %#", (env) => expect(() => testAuthConfig(env)).toThrow(/Configuración/));
  it.each([
    { SMTP_HOST: "" }, { SMTP_PORT: "0" }, { SMTP_FROM: "auth@example.test\r\nBcc: attacker@example.test" },
    { SMTP_SECURE: undefined }, { SMTP_SECURE: "true" }, { SMTP_ALLOW_LOCAL_PLAINTEXT: "yes" },
    { SMTP_HOST: "remote.example", SMTP_ALLOW_LOCAL_PLAINTEXT: "true" }, { NODE_ENV: "production" },
    { SMTP_USERNAME: "username", SMTP_PASSWORD: undefined }, { SMTP_USERNAME: undefined, SMTP_PASSWORD: "private" },
    { SMTP_TIMEOUT_MS: "249" }, { SMTP_ALLOW_LOCAL_PLAINTEXT: "false" },
  ])("rechaza configuración SMTP incompleta o insegura %#", (env) => expect(() => readSmtpConfig(testAuthEnvironment(env))).toThrow(/Configuración/));
  it("HTTPS SMTP de producción requiere credenciales y nunca las refleja al fallar", () => {
    const config = readSmtpConfig(testAuthEnvironment({ NODE_ENV: "production", SMTP_HOST: "smtp.example.test", SMTP_PORT: "465", SMTP_SECURE: "true", SMTP_ALLOW_LOCAL_PLAINTEXT: "false", SMTP_USERNAME: "service", SMTP_PASSWORD: "private smtp secret" }));
    expect(config.secure).toBe(true); expect(config.allowLocalPlaintext).toBe(false);
    try { readSmtpConfig(testAuthEnvironment({ SMTP_PORT: "private smtp secret" })); throw new Error("expected failure"); } catch (error) { expect(String(error)).not.toContain("private smtp secret"); }
  });
  it("autoriza Mailpit plaintext solo con host explícito y desarrollo", () => {
    const env = { SMTP_HOST: "mailpit", SMTP_LOCAL_PLAINTEXT_HOSTS: "localhost,127.0.0.1,::1,mailpit" };
    expect(readSmtpConfig(testAuthEnvironment(env))).toMatchObject({ host: "mailpit", allowLocalPlaintext: true, secure: false });
    expect(() => readSmtpConfig(testAuthEnvironment({ SMTP_HOST: "mailpit" }))).toThrow(/SMTP_ALLOW_LOCAL_PLAINTEXT/);
    expect(() => readSmtpConfig(testAuthEnvironment({ ...env, NODE_ENV: "production" }))).toThrow(/SMTP_ALLOW_LOCAL_PLAINTEXT/);
    expect(() => readSmtpConfig(testAuthEnvironment({ ...env, NODE_ENV: "test" }))).toThrow(/SMTP_ALLOW_LOCAL_PLAINTEXT/);
  });
  it.each(["", "*", "*.internal", "mailpit,", ",mailpit", "mailpit evil", "https://mailpit", "mailpit\r\nother", "mailpit/other", ".", ":", "-mailpit", "mailpit-", "mailpit..local"])(
    "rechaza una lista plaintext ambigua o inválida: %j", (hosts) => {
      expect(() => readSmtpConfig(testAuthEnvironment({ SMTP_LOCAL_PLAINTEXT_HOSTS: hosts }))).toThrow(/SMTP_LOCAL_PLAINTEXT_HOSTS/);
    },
  );
});
