import nodemailer from "nodemailer";
import type { PasswordResetEmail } from "../domain/password-reset-email.js";
import type { SmtpConfig } from "../smtp.config.js";

export class SmtpPasswordResetEmail implements PasswordResetEmail {
  constructor(private readonly config: SmtpConfig, private readonly resetUrl: string) {}

  async send(message: { email: string; token: string; expiresAt: Date }): Promise<void> {
    const url = new URL(this.resetUrl);
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
      await Promise.race([
        transport.sendMail({
          from: this.config.from, to: message.email,
          subject: "Recuperación de contraseña de Profesor Butchery",
          text: `Para restablecer tu contraseña, abrí este enlace:\n${url.toString()}\n\nEl enlace vence el ${message.expiresAt.toISOString()} y se puede utilizar una sola vez.\nSi no solicitaste recuperar tu contraseña, podés ignorar este mensaje.`,
        }),
        new Promise<never>((_resolve, reject) => {
          deadline = setTimeout(() => reject(new Error("PASSWORD_RESET_EMAIL_DELIVERY_FAILED")), this.config.timeoutMs);
        }),
      ]);
    } finally {
      if (deadline) clearTimeout(deadline);
      transport.close();
    }
  }
}
