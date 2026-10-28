import { describe, expect, it } from "vitest";
import { readEmailConfig } from "../src/auth/email.config.js";
import { testAuthEnvironment } from "./auth-test.config.js";

const brevo = { EMAIL_PROVIDER: "brevo", BREVO_API_KEY: "private-api-key", EMAIL_FROM: "verified@example.test" };
describe("Selección segura del proveedor de correo", () => {
  // Caracterización previa al reemplazo del regex: required valida después de trim.
  const controles = [...Array.from({ length: 32 }, (_, code) => code), 127];
  const campos = ["BREVO_API_KEY", "EMAIL_FROM", "EMAIL_FROM_NAME"] as const;
  it.each(campos.flatMap((campo) => controles.map((code) => ({ campo, code }))))(
    "rechaza el control incrustado $code en $campo sin exponer el valor",
    ({ campo, code }) => {
      const value = campo === "EMAIL_FROM" ? `verified${String.fromCharCode(code)}user@example.test` : `left${String.fromCharCode(code)}right`;
      expect(() => readEmailConfig({ ...brevo, [campo]: value })).toThrow(`Configuración de email inválida: ${campo}.`);
    }
  );
  it.each([32, 126, 128])("admite el límite imprimible %i en clave y nombre", (code) => {
    const value = `left${String.fromCharCode(code)}right`;
    expect(readEmailConfig({ ...brevo, BREVO_API_KEY: value, EMAIL_FROM_NAME: value })).toMatchObject({ apiKey: value, fromName: value });
  });
  it.each([126, 128])("admite el límite compatible %i en dirección de remitente", (code) => {
    const from = `verified${String.fromCharCode(code)}user@example.test`;
    expect(readEmailConfig({ ...brevo, EMAIL_FROM: from })).toMatchObject({ from });
  });
  it("conserva el trim previo de los tres campos requeridos", () => {
    expect(readEmailConfig({ ...brevo, BREVO_API_KEY: "\tprivate-api-key\n", EMAIL_FROM: "\tverified@example.test\r\n", EMAIL_FROM_NAME: "\tComunidad UTN\n" })).toMatchObject({ apiKey: "private-api-key", from: "verified@example.test", fromName: "Comunidad UTN" });
  });
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
