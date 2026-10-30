import nodemailer from "nodemailer";
import type { VerificationEmail } from "../domain/email-verification.js";
import type { SmtpConfig } from "../smtp.config.js";

export class SmtpVerificationEmail implements VerificationEmail {
  constructor(private readonly config: SmtpConfig, private readonly frontendUrl: string) {}

  async send(message: { email: string; token: string; expiresAt: Date }): Promise<void> {
    const url = new URL("/verify-email", this.frontendUrl);
    url.searchParams.set("token", message.token);
    const transport = nodemailer.createTransport({
      host: this.config.host, port: this.config.port, secure: this.config.secure,
      auth: this.config.auth, requireTLS: !this.config.allowLocalPlaintext,
      ignoreTLS: this.config.allowLocalPlaintext,
      tls: { rejectUnauthorized: true },
      connectionTimeout: this.config.timeoutMs, greetingTimeout: this.config.timeoutMs,
      socketTimeout: this.config.timeoutMs, logger: false, debug: false,
      disableFileAccess: true, disableUrlAccess: true,
    });
    let deadline: ReturnType<typeof setTimeout> | undefined;
    try {
      const result = await Promise.race([
        transport.sendMail({
          from: this.config.from, to: message.email,
          subject: "Verificá tu correo institucional - Profesor Butchery",
          text: `Para verificar tu correo institucional y habilitar tu cuenta, abrí este enlace:\n${url.toString()}\n\nEl enlace vence el ${message.expiresAt.toISOString()} y se puede utilizar una sola vez.\nSi no solicitaste esta cuenta, podés ignorar este mensaje.`,
        }),
        new Promise<never>((_resolve, reject) => {
          deadline = setTimeout(() => reject(new Error("VERIFICATION_EMAIL_DELIVERY_FAILED")), this.config.timeoutMs);
        }),
      ]);
      if (!result.accepted?.length || result.rejected?.length) throw new Error("VERIFICATION_EMAIL_DELIVERY_FAILED");
    } finally {
      if (deadline) clearTimeout(deadline);
      transport.close();
    }
  }
}
