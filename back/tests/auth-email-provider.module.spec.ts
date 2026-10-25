import "reflect-metadata";
import { Test } from "@nestjs/testing";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppModule } from "../src/app.module.js";
import { PrismaService } from "../src/infrastructure/prisma/prisma.service.js";
import { EMAIL_CONFIG } from "../src/auth/email.config.js";
import { VERIFICATION_EMAIL } from "../src/auth/domain/email-verification.js";
import { PASSWORD_RESET_EMAIL } from "../src/auth/domain/password-reset-email.js";
import { BrevoVerificationEmail, BrevoPasswordResetEmail } from "../src/auth/infrastructure/brevo-email.js";
import { SmtpVerificationEmail } from "../src/auth/infrastructure/smtp-verification-email.js";
import { SmtpPasswordResetEmail } from "../src/auth/infrastructure/smtp-password-reset-email.js";
import { testAuthEnvironment } from "./auth-test.config.js";

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
describe("DI real de proveedores de correo", () => {
  it("arranca Brevo sin SMTP y conecta verificación y recuperación al mismo proveedor", async () => {
    const env = testAuthEnvironment({ EMAIL_PROVIDER: "brevo", BREVO_API_KEY: "private-api-key", EMAIL_FROM: "verified@example.test" });
    for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value);
    for (const key of ["SMTP_HOST", "SMTP_PORT", "SMTP_USERNAME", "SMTP_PASSWORD", "SMTP_SECURE", "SMTP_ALLOW_LOCAL_PLAINTEXT"]) vi.stubEnv(key, undefined);
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ messageId: "accepted" }), { status: 201 }));
    vi.stubGlobal("fetch", fetch);
    const module = await Test.createTestingModule({ imports: [AppModule] }).overrideProvider(PrismaService).useValue({}).compile();
    try {
      expect(module.get(EMAIL_CONFIG)).toMatchObject({ provider: "brevo" });
      const verification = module.get(VERIFICATION_EMAIL), recovery = module.get(PASSWORD_RESET_EMAIL);
      expect(verification).toBeInstanceOf(BrevoVerificationEmail); expect(recovery).toBeInstanceOf(BrevoPasswordResetEmail);
      const message = { email: "student@alu.frlp.utn.edu.ar", token: "private-token", expiresAt: new Date("2026-10-23T12:00:00Z") };
      await verification.send(message);
      // Fetch produces an independent response per call; consumed response bodies cannot be reused.
      fetch.mockResolvedValueOnce(new Response(JSON.stringify({ messageId: "second" }), { status: 201 }));
      await recovery.send(message);
      expect(fetch).toHaveBeenCalledTimes(2);
      expect(JSON.parse(fetch.mock.calls[0]![1].body).textContent).toContain("/verify-email?token=private-token");
      expect(JSON.parse(fetch.mock.calls[1]![1].body).textContent).toContain("/reset-password?token=private-token");
    } finally { await module.close(); }
  });
  it("sin selección explícita conserva ambos adaptadores SMTP", async () => {
    for (const [key, value] of Object.entries(testAuthEnvironment())) vi.stubEnv(key, value);
    vi.stubEnv("EMAIL_PROVIDER", undefined);
    const module = await Test.createTestingModule({ imports: [AppModule] }).overrideProvider(PrismaService).useValue({}).compile();
    try {
      expect(module.get(EMAIL_CONFIG)).toMatchObject({ provider: "smtp" });
      expect(module.get(VERIFICATION_EMAIL)).toBeInstanceOf(SmtpVerificationEmail);
      expect(module.get(PASSWORD_RESET_EMAIL)).toBeInstanceOf(SmtpPasswordResetEmail);
    } finally { await module.close(); }
  });
});
