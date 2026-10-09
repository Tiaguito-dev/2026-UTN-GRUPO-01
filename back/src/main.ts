import { config } from "dotenv";
import { NestFactory } from "@nestjs/core";
import { resolve } from "node:path";
import { AppModule } from "./app.module.js";
import { AUTH_CONFIG, readAuthConfig, type AuthConfig } from "./auth/auth.config.js";
import { configureAuthHttp } from "./auth/presentation/http-security.js";
import { readSmtpConfig } from "./auth/smtp.config.js";

config({
  path: [resolve(process.cwd(), ".env"), resolve(process.cwd(), "../.env")],
  quiet: true,
});

async function bootstrap(): Promise<void> {
  // Validate before Nest startup logging, so missing keys never lead to a listening server.
  readAuthConfig(process.env);
  readSmtpConfig(process.env);
  const app = await NestFactory.create(AppModule, { abortOnError: false });
  app.enableShutdownHooks();
  configureAuthHttp(app, app.get<AuthConfig>(AUTH_CONFIG));
  const port = Number(process.env["PORT"] ?? process.env["BACKEND_PORT"] ?? 3001);

  await app.listen(port);
}

try {
  await bootstrap();
} catch {
  console.error("No se pudo iniciar el backend. Revise la configuración de autenticación y base de datos.");
  process.exitCode = 1;
}
