import type { INestApplication } from "@nestjs/common";
import type { Express, Request, Response, NextFunction } from "express";
import { rateLimit } from "express-rate-limit";
import type { AuthConfig } from "../auth.config.js";

function reject(response: Response, statusCode: number, error: string, message: string): void {
  response.setHeader("Cache-Control", "no-store");
  response.status(statusCode).json({ statusCode, error, message });
}

function isLoopback(address: string | undefined): boolean {
  if (!address) return false;
  return address === "::1" || /^127\./.test(address) || /^::ffff:127\./i.test(address);
}

export function hasAllowedAuthTransport(request: Request, config: AuthConfig): boolean {
  if (request.secure) return true;
  if (!config.allowLocalHttp) return false;
  const remoteAddress = request.socket.remoteAddress;
  if (isLoopback(remoteAddress)) return true;
  if (!remoteAddress || !config.trustedProxies.length) return false;
  // Only the configured proxy's socket is trusted. Client headers cannot opt into HTTP.
  const trustProxy = request.app.get("trust proxy fn") as unknown;
  return typeof trustProxy === "function" && trustProxy(remoteAddress, 0) === true;
}

/** Install before app.init/listen, so even parser and middleware failures are protected. */
export function configureAuthHttp(app: INestApplication, config: AuthConfig): void {
  const expressApp = app.getHttpAdapter().getInstance() as Express;
  expressApp.set("trust proxy", config.trustedProxies.length ? config.trustedProxies : false);
  app.use((request: Request, response: Response, next: NextFunction) => {
    if (/^\/auth(?:\/|$)/i.test(request.path)) response.setHeader("Cache-Control", "no-store");
    next();
  });
  app.enableCors({
    origin: config.allowedOrigins,
    credentials: true,
    methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "X-CSRF-Protection"],
    maxAge: 600,
  });
  const loginLimiter = rateLimit({
    windowMs: config.loginWindowSeconds * 1000,
    limit: config.loginMaxAttempts,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    // Forwarded headers are deliberately ignored unless an explicit proxy is trusted.
    validate: { xForwardedForHeader: false, forwardedHeader: false },
    handler: (_request, response) => reject(response, 429, "Too Many Requests", "Se alcanzó el límite de intentos. Espere e intente nuevamente."),
  });
  const refreshLimiter = rateLimit({
    windowMs: config.refreshWindowSeconds * 1000,
    limit: config.refreshMaxAttempts,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    validate: { xForwardedForHeader: false, forwardedHeader: false },
    handler: (_request, response) => reject(response, 429, "Too Many Requests", "Se alcanzó el límite de renovaciones. Espere e intente nuevamente."),
  });
  const passwordLimits: [string, { limit: number; window: number }][] = [
    ["forgot-password", { limit: config.forgotPasswordMaxAttempts, window: config.forgotPasswordWindowSeconds }],
    ["reset-password", { limit: config.resetPasswordMaxAttempts, window: config.resetPasswordWindowSeconds }],
    ["change-password", { limit: config.changePasswordMaxAttempts, window: config.changePasswordWindowSeconds }],
  ];
  const passwordLimiters = new Map(passwordLimits.map(([path, { limit, window }]) => {
    return [path, rateLimit({
      windowMs: window * 1000, limit, standardHeaders: "draft-8", legacyHeaders: false,
      validate: { xForwardedForHeader: false, forwardedHeader: false },
      handler: (_request, response) => reject(response, 429, "Too Many Requests", "Se alcanzó el límite de intentos. Espere e intente nuevamente."),
    })] as const;
  }));
  app.use((request: Request, response: Response, next: NextFunction) => {
    if (request.method === "POST" && /^\/auth\/login\/?$/i.test(request.path)) {
      loginLimiter(request, response, next);
      return;
    }
    if (request.method === "POST" && /^\/auth\/refresh\/?$/i.test(request.path)) {
      refreshLimiter(request, response, next);
      return;
    }
    if (request.method === "POST") {
      const operation = /^\/auth\/(forgot-password|reset-password|change-password)\/?$/i.exec(request.path)?.[1]?.toLowerCase();
      const limiter = operation ? passwordLimiters.get(operation) : undefined;
      if (limiter) { limiter(request, response, next); return; }
    }
    next();
  });
  app.use((request: Request, response: Response, next: NextFunction) => {
    const authPath = /^\/auth(?:\/|$)/i.test(request.path);
    if (authPath && !hasAllowedAuthTransport(request, config)) {
      reject(response, 403, "Forbidden", "Esta operación requiere una conexión segura.");
      return;
    }
    if (!["GET", "HEAD", "OPTIONS"].includes(request.method)) {
      const origin = request.headers.origin;
      if (typeof origin !== "string" || !config.allowedOrigins.includes(origin) || request.headers["x-csrf-protection"] !== "1") {
        reject(response, 403, "Forbidden", "La solicitud no pudo validarse. Actualice la página e intente nuevamente.");
        return;
      }
      if (request.method === "POST" && /^\/auth\/(?:login|register|forgot-password|reset-password|change-password)\/?$/i.test(request.path) && !request.is("application/json")) {
        reject(response, 400, "Bad Request", "La petición debe utilizar formato JSON.");
        return;
      }
    }
    next();
  });
}
