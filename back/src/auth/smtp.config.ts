import { isIP } from "node:net";

export const SMTP_CONFIG = Symbol("SMTP_CONFIG");

export interface SmtpConfig {
  host: string;
  port: number;
  from: string;
  secure: boolean;
  allowLocalPlaintext: boolean;
  auth?: { user: string; pass: string };
  timeoutMs: number;
}

export function readSmtpConfig(env: NodeJS.ProcessEnv): SmtpConfig {
  const fail = (name: string): never => { throw new Error(`Configuración de email inválida: ${name}.`); };
  const required = (name: string): string => {
    const value = env[name]?.trim();
    if (!value || /[\u0000-\u001f\u007f]/u.test(value)) return fail(name);
    return value;
  };
  const boolean = (name: string, optional = false): boolean => {
    if (optional && env[name] === undefined) return false;
    if (!["true", "false"].includes(env[name] ?? "")) return fail(name);
    return env[name] === "true";
  };
  const integer = (name: string, fallback: number | undefined, max: number): number => {
    const raw = env[name] ?? (fallback === undefined ? "" : String(fallback));
    if (!/^[1-9][0-9]*$/.test(raw) || !Number.isSafeInteger(Number(raw)) || Number(raw) > max) return fail(name);
    return Number(raw);
  };
  const host = required("SMTP_HOST");
  if (!/^[A-Za-z0-9.:-]+$/.test(host)) fail("SMTP_HOST");
  const from = required("SMTP_FROM");
  if (!/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(from)) fail("SMTP_FROM");
  const secure = boolean("SMTP_SECURE");
  const allowLocalPlaintext = boolean("SMTP_ALLOW_LOCAL_PLAINTEXT", true);
  const plaintextHosts = (env.SMTP_LOCAL_PLAINTEXT_HOSTS ?? "localhost,127.0.0.1,::1").split(",").map((value) => value.trim().toLowerCase());
  const validHost = (value: string): boolean => isIP(value) !== 0 ||
    (value.length <= 253 && value.split(".").every((label) => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label)));
  if (plaintextHosts.some((value) => !validHost(value))) fail("SMTP_LOCAL_PLAINTEXT_HOSTS");
  if (allowLocalPlaintext && (env.NODE_ENV !== "development" || !plaintextHosts.includes(host.toLowerCase()) || secure)) fail("SMTP_ALLOW_LOCAL_PLAINTEXT");
  const username = env.SMTP_USERNAME;
  const password = env.SMTP_PASSWORD;
  if ((username === undefined || username === "") !== (password === undefined || password === "")) fail("SMTP_USERNAME/SMTP_PASSWORD");
  if (!allowLocalPlaintext && (!username || !password)) fail("SMTP_USERNAME/SMTP_PASSWORD");
  const timeoutMs = integer("SMTP_TIMEOUT_MS", 1500, 30000);
  if (timeoutMs < 250) fail("SMTP_TIMEOUT_MS");
  return { host, port: integer("SMTP_PORT", undefined, 65535), from, secure, allowLocalPlaintext,
    ...(username && password ? { auth: { user: required("SMTP_USERNAME"), pass: password } } : {}), timeoutMs };
}
