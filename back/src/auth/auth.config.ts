import { isIP } from "node:net";

export const AUTH_CONFIG = Symbol("AUTH_CONFIG");

export interface AuthConfig {
  jwtSecret: Uint8Array;
  issuer: string;
  audience: string;
  accessTtlSeconds: number;
  sessionTtlSeconds: number;
  allowedOrigins: string[];
  publicUrl: string;
  allowLocalHttp: boolean;
  cookieSecure: boolean;
  cookieSameSite: "none" | "lax" | "strict";
  cookieName: string;
  refreshCookieName: string;
  refreshCookiePath: "/auth";
  loginMaxAttempts: number;
  loginWindowSeconds: number;
  refreshMaxAttempts: number;
  refreshWindowSeconds: number;
  passwordResetTtlSeconds: number;
  passwordResetUrl: string;
  passwordResetMinResponseMs: number;
  forgotPasswordMaxAttempts: number;
  forgotPasswordWindowSeconds: number;
  resetPasswordMaxAttempts: number;
  resetPasswordWindowSeconds: number;
  changePasswordMaxAttempts: number;
  changePasswordWindowSeconds: number;
  trustedProxies: string[];
  trustedProxyHops: number;
}

export function readAuthConfig(env: NodeJS.ProcessEnv): AuthConfig {
  const fail = (name: string): never => { throw new Error(`Configuración de autenticación inválida: ${name}.`); };
  const required = (name: string): string => {
    const value = env[name]?.trim();
    if (!value || /[\u0000-\u001f\u007f]/u.test(value)) return fail(name);
    return value;
  };
  const integer = (name: string, fallback: number, min: number, max: number): number => {
    const value = env[name] ?? String(fallback);
    if (!/^[1-9][0-9]*$/.test(value)) return fail(name);
    const parsed = Number(value);
    if (!Number.isSafeInteger(parsed) || parsed < min || parsed > max) return fail(name);
    return parsed;
  };
  if (env.AUTH_ALLOW_LOCAL_HTTP !== undefined && !["true", "false"].includes(env.AUTH_ALLOW_LOCAL_HTTP)) fail("AUTH_ALLOW_LOCAL_HTTP");
  const allowLocalHttp = env.AUTH_ALLOW_LOCAL_HTTP === "true";
  if (allowLocalHttp && env.NODE_ENV !== "development") fail("AUTH_ALLOW_LOCAL_HTTP");
  const origin = (value: string, name: string): URL => {
    let url: URL;
    try { url = new URL(value); } catch { return fail(name); }
    if (url.origin !== value || url.username || url.password || !["http:", "https:"].includes(url.protocol)) return fail(name);
    const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    if (url.protocol === "http:" && (!allowLocalHttp || !loopback)) return fail(name);
    return url;
  };
  const publicUrl = required("AUTH_PUBLIC_URL");
  const publicOrigin = origin(publicUrl, "AUTH_PUBLIC_URL");
  const allowedOrigins = required("AUTH_ALLOWED_ORIGINS").split(",").map((value) => value.trim());
  for (const value of allowedOrigins) origin(value, "AUTH_ALLOWED_ORIGINS");
  if (new Set(allowedOrigins).size !== allowedOrigins.length) fail("AUTH_ALLOWED_ORIGINS");
  if (allowLocalHttp && (publicOrigin.protocol !== "http:" || allowedOrigins.some((value) => new URL(value).protocol !== "http:"))) fail("AUTH_ALLOW_LOCAL_HTTP");
  const secret = required("AUTH_JWT_SECRET");
  if (!/^[A-Za-z0-9_-]+$/.test(secret)) fail("AUTH_JWT_SECRET");
  const jwtSecret = Buffer.from(secret, "base64url");
  if (jwtSecret.length < 32 || jwtSecret.toString("base64url") !== secret) fail("AUTH_JWT_SECRET");
  const cookieSecure = publicOrigin.protocol === "https:";
  const cookieSameSite = env.AUTH_COOKIE_SAME_SITE ?? (cookieSecure ? "none" : "lax");
  if (!["none", "lax", "strict"].includes(cookieSameSite) || (!cookieSecure && cookieSameSite === "none")) fail("AUTH_COOKIE_SAME_SITE");
  const trustedProxies = env.AUTH_TRUSTED_PROXIES?.split(",").map((value) => value.trim()) ?? [];
  for (const value of trustedProxies) {
    const segments = value.split("/");
    const ipVersion = isIP(segments[0]!);
    if (!ipVersion || segments.length > 2 || (segments.length === 2 &&
      (!/^(0|[1-9][0-9]*)$/.test(segments[1]!) || Number(segments[1]) > (ipVersion === 4 ? 32 : 128) || Number(segments[1]) === 0))) fail("AUTH_TRUSTED_PROXIES");
  }
  // Managed platforms (Render, Fly, Cloud Run) terminate TLS at an edge whose internal address
  // is neither stable nor documented, so no IP list can describe it. A hop count still rejects
  // client-supplied forwarded entries: Express keeps only the hops its own edge appended.
  const trustedProxyHops = env.AUTH_TRUSTED_PROXY_HOPS === undefined ? 0 : integer("AUTH_TRUSTED_PROXY_HOPS", 1, 1, 10);
  if (trustedProxyHops && trustedProxies.length) fail("AUTH_TRUSTED_PROXY_HOPS");
  const accessTtlSeconds = integer("AUTH_ACCESS_TTL_SECONDS", 900, 60, 3600);
  const sessionTtlSeconds = integer("AUTH_SESSION_TTL_SECONDS", 604800, 60, 2592000);
  if (sessionTtlSeconds < accessTtlSeconds) fail("AUTH_SESSION_TTL_SECONDS");
  const passwordResetUrl = required("AUTH_PASSWORD_RESET_URL");
  let resetUrl: URL;
  try { resetUrl = new URL(passwordResetUrl); } catch { return fail("AUTH_PASSWORD_RESET_URL"); }
  if (resetUrl.username || resetUrl.password || resetUrl.search || resetUrl.hash
    || !allowedOrigins.includes(resetUrl.origin)) fail("AUTH_PASSWORD_RESET_URL");
  origin(resetUrl.origin, "AUTH_PASSWORD_RESET_URL");
  const smtpTimeoutMs = integer("SMTP_TIMEOUT_MS", 1500, 250, 30000);
  const passwordResetMinResponseMs = integer("AUTH_PASSWORD_RESET_MIN_RESPONSE_MS", 2000, 500, 60000);
  if (passwordResetMinResponseMs < smtpTimeoutMs + 250) fail("AUTH_PASSWORD_RESET_MIN_RESPONSE_MS");
  return {
    jwtSecret, issuer: required("AUTH_JWT_ISSUER"), audience: required("AUTH_JWT_AUDIENCE"),
    accessTtlSeconds, sessionTtlSeconds, allowedOrigins, publicUrl, allowLocalHttp,
    cookieSecure, cookieSameSite: cookieSameSite as AuthConfig["cookieSameSite"],
    cookieName: cookieSecure ? "__Host-butchery_access" : "butchery_access",
    refreshCookieName: cookieSecure ? "__Secure-butchery_refresh" : "butchery_refresh",
    refreshCookiePath: "/auth",
    loginMaxAttempts: integer("AUTH_LOGIN_MAX_ATTEMPTS", 10, 1, 1000),
    loginWindowSeconds: integer("AUTH_LOGIN_WINDOW_SECONDS", 900, 1, 86400), trustedProxies, trustedProxyHops,
    refreshMaxAttempts: integer("AUTH_REFRESH_MAX_ATTEMPTS", 30, 1, 1000),
    refreshWindowSeconds: integer("AUTH_REFRESH_WINDOW_SECONDS", 900, 1, 86400),
    passwordResetTtlSeconds: integer("AUTH_PASSWORD_RESET_TTL_SECONDS", 1800, 60, 86400),
    passwordResetUrl, passwordResetMinResponseMs,
    forgotPasswordMaxAttempts: integer("AUTH_FORGOT_PASSWORD_MAX_ATTEMPTS", 5, 1, 1000),
    forgotPasswordWindowSeconds: integer("AUTH_FORGOT_PASSWORD_WINDOW_SECONDS", 900, 1, 86400),
    resetPasswordMaxAttempts: integer("AUTH_RESET_PASSWORD_MAX_ATTEMPTS", 10, 1, 1000),
    resetPasswordWindowSeconds: integer("AUTH_RESET_PASSWORD_WINDOW_SECONDS", 900, 1, 86400),
    changePasswordMaxAttempts: integer("AUTH_CHANGE_PASSWORD_MAX_ATTEMPTS", 10, 1, 1000),
    changePasswordWindowSeconds: integer("AUTH_CHANGE_PASSWORD_WINDOW_SECONDS", 900, 1, 86400),
  };
}
