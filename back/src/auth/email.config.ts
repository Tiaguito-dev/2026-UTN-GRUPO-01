import { readSmtpConfig, type SmtpConfig } from "./smtp.config.js";

export const EMAIL_CONFIG = Symbol("EMAIL_CONFIG");

export interface BrevoEmailConfig {
  provider: "brevo";
  apiKey: string;
  from: string;
  fromName: string;
  timeoutMs: number;
}

export type EmailConfig = { provider: "smtp"; smtp: SmtpConfig } | BrevoEmailConfig;

export function readEmailConfig(env: NodeJS.ProcessEnv): EmailConfig {
  const provider = env.EMAIL_PROVIDER ?? "smtp";
  const fail = (name: string): never => { throw new Error(`Configuración de email inválida: ${name}.`); };
  if (provider === "smtp") return { provider, smtp: readSmtpConfig(env) };
  if (provider !== "brevo") return fail("EMAIL_PROVIDER");
  const required = (name: string, fallback?: string): string => {
    const value = (env[name] ?? fallback)?.trim();
    if (!value || [...value].some((character) => {
      const code = character.charCodeAt(0);
      return code < 32 || code === 127;
    })) return fail(name);
    return value;
  };
  const apiKey = required("BREVO_API_KEY");
  const from = required("EMAIL_FROM");
  if (!/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(from)) fail("EMAIL_FROM");
  const fromName = required("EMAIL_FROM_NAME", "Profesor Butchery");
  const rawTimeout = env.SMTP_TIMEOUT_MS ?? "1500";
  if (!/^[1-9][0-9]*$/.test(rawTimeout)) fail("SMTP_TIMEOUT_MS");
  const timeoutMs = Number(rawTimeout);
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 250 || timeoutMs > 30000) fail("SMTP_TIMEOUT_MS");
  return { provider, apiKey, from, fromName, timeoutMs };
}
