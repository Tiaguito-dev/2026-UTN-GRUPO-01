import { describe, expect, it } from "vitest";
import { readEmailConfig } from "../src/auth/email.config.js";
import { testAuthEnvironment } from "./auth-test.config.js";

const brevo = { EMAIL_PROVIDER: "brevo", BREVO_API_KEY: "private-api-key", EMAIL_FROM: "verified@example.test" };
describe("Selección segura del proveedor de correo", () => {
  it("Brevo funciona sin configuración SMTP y usa nombre visible predeterminado", () => {
    expect(readEmailConfig(brevo)).toEqual({ provider: "brevo", apiKey: "private-api-key", from: "verified@example.test", fromName: "Profesor Butchery", timeoutMs: 1500 });
  });
  it("SMTP sigue siendo el proveedor predeterminado compatible", () => {
    expect(readEmailConfig(testAuthEnvironment())).toMatchObject({ provider: "smtp", smtp: { host: "127.0.0.1", port: 1025 } });
  });
  it("Brevo permite nombre y timeout explícitos e ignora SMTP inválido", () => {
    expect(readEmailConfig({ ...brevo, EMAIL_FROM_NAME: "Comunidad UTN", SMTP_TIMEOUT_MS: "2500", SMTP_PORT: "invalid", SMTP_HOST: "" })).toMatchObject({ provider: "brevo", fromName: "Comunidad UTN", timeoutMs: 2500 });
  });
  it.each([
    { EMAIL_PROVIDER: "unknown" }, { BREVO_API_KEY: undefined }, { BREVO_API_KEY: "" },
    { BREVO_API_KEY: "secret\r\nheader" }, { EMAIL_FROM: "" }, { EMAIL_FROM: "invalid" },
    { EMAIL_FROM: "verified@example.test\r\nBcc: attacker@example.test" },
    { EMAIL_FROM_NAME: "Name\r\nHeader" }, { SMTP_TIMEOUT_MS: "249" }, { SMTP_TIMEOUT_MS: "30001" },
  ])("rechaza configuración seleccionada inválida sin filtrar secretos %#", overrides => {
    expect(() => readEmailConfig({ ...brevo, ...overrides })).toThrow();
    try { readEmailConfig({ ...brevo, ...overrides }); } catch (error) { expect(String(error)).not.toContain("private-api-key"); }
  });
});
