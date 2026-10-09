import { randomBytes } from "node:crypto";
import { readAuthConfig } from "../src/auth/auth.config.js";

export const testOrigin = "http://localhost:3000";
// Providers SMTP are validated even when the email port is overridden by tests.
Object.assign(process.env, {
  NODE_ENV: "development",
  SMTP_HOST: process.env["TEST_SMTP_HOST"] ?? "127.0.0.1",
  SMTP_PORT: process.env["TEST_SMTP_PORT"] ?? "1025",
  SMTP_FROM: "auth@example.test", SMTP_SECURE: "false", SMTP_ALLOW_LOCAL_PLAINTEXT: "true",
  SMTP_TIMEOUT_MS: process.env["TEST_SMTP_TIMEOUT_MS"] ?? "250",
});
export function testAuthEnvironment(overrides: Record<string, string | undefined> = {}) {
  return {
    NODE_ENV: "development",
    AUTH_JWT_SECRET: randomBytes(32).toString("base64url"),
    AUTH_JWT_ISSUER: "butchery-test",
    AUTH_JWT_AUDIENCE: "butchery-test-client",
    AUTH_PUBLIC_URL: "http://localhost:3001",
    AUTH_ALLOWED_ORIGINS: testOrigin,
    AUTH_ALLOW_LOCAL_HTTP: "true",
    AUTH_COOKIE_SAME_SITE: "lax",
    AUTH_LOGIN_MAX_ATTEMPTS: "100",
    AUTH_LOGIN_WINDOW_SECONDS: "60",
    AUTH_PASSWORD_RESET_URL: `${testOrigin}/reset-password`,
    AUTH_PASSWORD_RESET_MIN_RESPONSE_MS: "500",
    SMTP_HOST: "127.0.0.1",
    SMTP_PORT: "1025",
    SMTP_FROM: "auth@example.test",
    SMTP_SECURE: "false",
    SMTP_ALLOW_LOCAL_PLAINTEXT: "true",
    SMTP_TIMEOUT_MS: "250",
    ...overrides,
  };
}
export const testAuthConfig = (overrides: Record<string, string | undefined> = {}) => readAuthConfig(testAuthEnvironment(overrides));
export const csrfHeaders = { Origin: testOrigin, "X-CSRF-Protection": "1", "Content-Type": "application/json" };
