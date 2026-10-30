import type { BrevoEmailConfig } from "../email.config.js";
import type { VerificationEmail } from "../domain/email-verification.js";
import type { PasswordResetEmail } from "../domain/password-reset-email.js";

interface EmailMessage { email: string; token: string; expiresAt: Date }

async function send(config: BrevoEmailConfig, email: string, subject: string, textContent: string): Promise<void> {
  const controller = new AbortController();
  let deadline: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      (async () => {
        const response = await fetch("https://api.brevo.com/v3/smtp/email", {
          method: "POST", redirect: "error", signal: controller.signal,
          headers: { "api-key": config.apiKey, "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({ sender: { email: config.from, name: config.fromName },
            to: [{ email }], subject, textContent }),
        });
        if (response.status !== 201) throw new Error("EMAIL_DELIVERY_FAILED");
        const body: unknown = await response.json();
        if (typeof body !== "object" || body === null || !("messageId" in body) ||
          typeof body.messageId !== "string" || !body.messageId.trim()) throw new Error("EMAIL_DELIVERY_FAILED");
      })(),
      new Promise<never>((_resolve, reject) => {
        deadline = setTimeout(() => {
          controller.abort();
          reject(new Error("EMAIL_DELIVERY_FAILED"));
        }, config.timeoutMs);
      }),
    ]);
  } catch {
    // Never propagate provider bodies, HTTP metadata or credentials to application logs.
    throw new Error("EMAIL_DELIVERY_FAILED");
  } finally {
    if (deadline !== undefined) clearTimeout(deadline);
    controller.abort();
  }
}

export class BrevoVerificationEmail implements VerificationEmail {
  constructor(private readonly config: BrevoEmailConfig, private readonly frontendUrl: string) {}
  async send(message: EmailMessage): Promise<void> {
    const url = new URL("/verify-email", this.frontendUrl);
    url.searchParams.set("token", message.token);
    await send(this.config, message.email, "Verificá tu correo institucional - Profesor Butchery",
      `Para verificar tu correo institucional y habilitar tu cuenta, abrí este enlace:\n${url.toString()}\n\nEl enlace vence el ${message.expiresAt.toISOString()} y se puede utilizar una sola vez.\nSi no solicitaste esta cuenta, podés ignorar este mensaje.`);
  }
}

export class BrevoPasswordResetEmail implements PasswordResetEmail {
  constructor(private readonly config: BrevoEmailConfig, private readonly frontendUrl: string) {}
  async send(message: EmailMessage): Promise<void> {
    const url = new URL(this.frontendUrl);
    url.searchParams.set("token", message.token);
    await send(this.config, message.email, "Recuperación de contraseña de Profesor Butchery",
      `Para restablecer tu contraseña, abrí este enlace:\n${url.toString()}\n\nEl enlace vence el ${message.expiresAt.toISOString()} y se puede utilizar una sola vez.\nSi no solicitaste recuperar tu contraseña, podés ignorar este mensaje.`);
  }
}
