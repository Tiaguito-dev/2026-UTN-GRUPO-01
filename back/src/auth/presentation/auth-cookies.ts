import { parseCookie, stringifySetCookie } from "cookie";
import type { Request, Response } from "express";
import type { AuthConfig } from "../auth.config.js";

/** Ambiguous cookies never identify a credential. Values are not logged or echoed. */
export function readAuthCookie(request: Request, name: string): string | undefined {
  const raw = request.headers.cookie;
  if (!raw) return undefined;
  const matching = raw.split(";").filter((entry) => {
    const equals = entry.indexOf("=");
    return equals >= 0 && entry.slice(0, equals).trim() === name;
  });
  if (matching.length !== 1) return undefined;
  return parseCookie(raw)[name] || undefined;
}

interface CookieCredentials {
  accessToken: string;
  expiresAt: Date;
  refreshToken: string;
  refreshExpiresAt: Date;
}

function credentialCookie(config: AuthConfig, name: string, path: string, value: string, expiresAt: Date): string {
  return stringifySetCookie({
    name, value, path, expires: expiresAt,
    httpOnly: true, secure: config.cookieSecure, sameSite: config.cookieSameSite,
    maxAge: Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000)),
  });
}

export function setAuthCookies(response: Response, config: AuthConfig, credentials: CookieCredentials): void {
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("Set-Cookie", [
    credentialCookie(config, config.cookieName, "/", credentials.accessToken, credentials.expiresAt),
    credentialCookie(config, config.refreshCookieName, config.refreshCookiePath, credentials.refreshToken, credentials.refreshExpiresAt),
  ]);
}

export function clearAuthCookies(response: Response, config: AuthConfig): void {
  response.setHeader("Cache-Control", "no-store");
  const expired = new Date(0);
  response.setHeader("Set-Cookie", [
    credentialCookie(config, config.cookieName, "/", "", expired),
    credentialCookie(config, config.refreshCookieName, config.refreshCookiePath, "", expired),
  ]);
}
