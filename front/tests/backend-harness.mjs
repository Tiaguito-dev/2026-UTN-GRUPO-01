/** Exclusively a Playwright fixture. Never used by the product server. */
import "reflect-metadata";
import { randomBytes } from "node:crypto";
import { Controller, Get, Post, Req, Res, UseGuards } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { SignJWT, jwtVerify } from "jose";
import { parseCookie, stringifySetCookie } from "cookie";
import { AppModule } from "../../back/dist/app.module.js";
import { AuthModule } from "../../back/dist/auth/auth.module.js";
import { AUTH_CONFIG } from "../../back/dist/auth/auth.config.js";
import { PrismaService } from "../../back/dist/infrastructure/prisma/prisma.service.js";
import { AuthenticationGuard } from "../../back/dist/auth/presentation/authentication.guard.js";
import { RolesGuard } from "../../back/dist/auth/presentation/roles.guard.js";
import { Roles } from "../../back/dist/auth/presentation/roles.decorator.js";
import { configureAuthHttp } from "../../back/dist/auth/presentation/http-security.js";

const origin = process.env.H5_FRONT_URL ?? "http://localhost:3300";
Object.assign(process.env, {
  NODE_ENV: "development", AUTH_ALLOW_LOCAL_HTTP: "true",
  AUTH_PUBLIC_URL: "http://localhost:3301", AUTH_ALLOWED_ORIGINS: origin,
  AUTH_PASSWORD_RESET_URL: `${origin}/reset-password`,
  AUTH_JWT_SECRET: randomBytes(32).toString("base64url"),
  AUTH_JWT_ISSUER: "butchery-browser-tests", AUTH_JWT_AUDIENCE: "butchery-browser-tests",
  AUTH_LOGIN_MAX_ATTEMPTS: "1000", AUTH_REFRESH_MAX_ATTEMPTS: "1000",
  AUTH_FORGOT_PASSWORD_MAX_ATTEMPTS: "1000", AUTH_RESET_PASSWORD_MAX_ATTEMPTS: "1000", AUTH_CHANGE_PASSWORD_MAX_ATTEMPTS: "1000",
  SMTP_HOST: "127.0.0.1", SMTP_PORT: process.env.TEST_SMTP_PORT ?? "1025",
  SMTP_FROM: "butchery@example.test", SMTP_SECURE: "false", SMTP_ALLOW_LOCAL_PLAINTEXT: "true",
});
let prisma, config;
class BrowserFixtureController {
  admin() { return { allowed: true }; }
  async expire(request, response) {
    const raw = parseCookie(request.headers.cookie ?? "")[config.cookieName];
    const { payload } = await jwtVerify(raw, config.jwtSecret, { algorithms: ["HS256"], issuer: config.issuer, audience: config.audience });
    const now = Math.floor(Date.now() / 1000);
    await prisma.session.update({ where: { id: payload.sessionId }, data: { createdAt: new Date((now - 61) * 1000) } });
    const value = await new SignJWT({ sessionId: payload.sessionId }).setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setSubject(payload.sub).setIssuedAt(now - 60).setExpirationTime(now - 1).setIssuer(config.issuer).setAudience(config.audience).sign(config.jwtSecret);
    response.setHeader("Set-Cookie", stringifySetCookie({ name: config.cookieName, value, path: "/", httpOnly: true, sameSite: "lax", maxAge: 900 }));
    return { expired: true };
  }
}
Controller("test")(BrowserFixtureController);
for (const [name, method] of [["admin", Get("admin")], ["expire", Post("expire-access")]]) {
  const descriptor = Object.getOwnPropertyDescriptor(BrowserFixtureController.prototype, name);
  method(BrowserFixtureController.prototype, name, descriptor);
  UseGuards(AuthenticationGuard, ...(name === "admin" ? [RolesGuard] : []))(BrowserFixtureController.prototype, name, descriptor);
  if (name === "admin") Roles("ADMIN")(BrowserFixtureController.prototype, name, descriptor);
}
Req()(BrowserFixtureController.prototype, "expire", 0);
Res({ passthrough: true })(BrowserFixtureController.prototype, "expire", 1);
const module = await Test.createTestingModule({ imports: [AppModule, AuthModule], controllers: [BrowserFixtureController] }).compile();
const app = module.createNestApplication();
app.useLogger(false);
prisma = app.get(PrismaService); config = app.get(AUTH_CONFIG);
configureAuthHttp(app, config);
await app.listen(3301, "127.0.0.1");
console.log("Browser backend fixture ready (no request logging).");
for (const signal of ["SIGTERM", "SIGINT"]) process.on(signal, async () => { await app.close(); process.exit(0); });
