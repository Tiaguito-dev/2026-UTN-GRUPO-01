import "reflect-metadata";
import { randomUUID } from "node:crypto";
import { Test } from "@nestjs/testing";
import { PrismaPg } from "@prisma/adapter-pg";
import { describe, expect, it } from "vitest";
import { AppModule } from "../src/app.module.js";
import { AUTH_CONFIG } from "../src/auth/auth.config.js";
import { PrismaService } from "../src/infrastructure/prisma/prisma.service.js";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { configureAuthHttp } from "../src/auth/presentation/http-security.js";
import { CryptoRefreshTokenService } from "../src/auth/infrastructure/crypto-refresh-token.service.js";
import { csrfHeaders, testAuthConfig } from "./auth-test.config.js";

const databaseUrl = process.env["TEST_DATABASE_URL"], mailbox = process.env["TEST_MAILPIT_API_URL"];
describe.skipIf(!databaseUrl || !mailbox)("Recuperación completa vía SMTP real y Mailpit", () => {
  it("solicita, recibe enlace del frontend en buzón y restablece sin exponer credencial", async () => {
    const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl! }) }); await prisma.$connect();
    const config = testAuthConfig({ SMTP_TIMEOUT_MS: "1500", AUTH_PASSWORD_RESET_MIN_RESPONSE_MS: "2000" });
    const module = await Test.createTestingModule({ imports: [AppModule] }).overrideProvider(PrismaService).useValue(prisma).overrideProvider(AUTH_CONFIG).useValue(config).compile();
    const app = module.createNestApplication(); app.useLogger(false); configureAuthHttp(app, config); await app.listen(0, "127.0.0.1");
    let id: string | undefined;
    const post = (path: string, body: unknown) => fetch(`${base}${path}`, { method: "POST", headers: csrfHeaders, body: JSON.stringify(body) });
    const base = await app.getUrl(); const email = `smtp-${randomUUID()}@alu.frlp.utn.edu.ar`; const original = " original smtp password "; const replacement = " replacement smtp password ";
    try {
      const registration = await post("/auth/register", { email, displayName: "SMTP", password: original }); expect(registration.status).toBe(201); id = (await registration.json()).id;
      const request = await post("/auth/forgot-password", { email }); expect(request.status).toBe(202); const publicBody = JSON.stringify(await request.json());
      const search = await fetch(`${mailbox}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`); expect(search.status).toBe(200);
      const found = await search.json(); expect(found.messages).toHaveLength(1);
      const detail = await (await fetch(`${mailbox}/api/v1/message/${found.messages[0].ID}`)).json();
      expect(detail.Text).toMatch(/vence|ignorar|solicitaste/u);
      const link = detail.Text.match(/https?:\/\/[^\s]+/u)?.[0]; expect(link).toBeTruthy(); const parsed = new URL(link); expect(`${parsed.origin}${parsed.pathname}`).toBe(config.passwordResetUrl);
      const token = parsed.searchParams.get("token")!; expect(Buffer.from(token, "base64url")).toHaveLength(32); expect(publicBody).not.toContain(token);
      const stored = await prisma.passwordResetCredential.findUniqueOrThrow({ where: { tokenHash: new CryptoRefreshTokenService().hash(token)! } }); expect(stored.deliveredAt).not.toBeNull(); expect(JSON.stringify(stored)).not.toContain(token);
      expect((await post("/auth/reset-password", { token, newPassword: replacement })).status).toBe(204);
      expect((await post("/auth/login", { email, password: original })).status).toBe(401); expect((await post("/auth/login", { email, password: replacement })).status).toBe(200);
      expect((await post("/auth/reset-password", { token, newPassword: replacement })).status).toBe(400);
    } finally {
      if (id) { await prisma.passwordResetCredential.deleteMany({ where: { userId: id } }); await prisma.refreshCredential.deleteMany({ where: { session: { userId: id } } }); await prisma.session.deleteMany({ where: { userId: id } }); await prisma.user.delete({ where: { id } }); }
      await app.close(); await prisma.$disconnect();
    }
  }, 20000);
});
