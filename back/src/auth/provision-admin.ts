import "reflect-metadata";
import type { INestApplicationContext } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { config } from "dotenv";
import { resolve } from "node:path";
import { ProvisionAdmin } from "./application/provision-admin.js";
import { AdminProvisionModule } from "./admin-provision.module.js";
import { AdminProvisionConflictError, InvalidRegistrationInputError } from "./domain/errors.js";

config({
  path: [resolve(process.cwd(), ".env"), resolve(process.cwd(), "../.env")],
  quiet: true,
});

async function provision(): Promise<void> {
  let app: INestApplicationContext | undefined;
  try {
    const input = {
      email: process.env["ADMIN_EMAIL"],
      displayName: process.env["ADMIN_DISPLAY_NAME"],
      password: process.env["ADMIN_PASSWORD"],
    };
    if (!process.env["DATABASE_URL"] || !input.email || !input.displayName || !input.password) {
      console.error("Defina DATABASE_URL, ADMIN_EMAIL, ADMIN_DISPLAY_NAME y ADMIN_PASSWORD para provisionar la cuenta administrativa.");
      process.exitCode = 1;
      return;
    }
    app = await NestFactory.createApplicationContext(AdminProvisionModule, { logger: false, abortOnError: false });
    const result = await app.get(ProvisionAdmin).execute(input);
    console.log(result.status === "created"
      ? "Cuenta administrativa creada correctamente."
      : "La cuenta administrativa ya existe. No se realizaron cambios.");
  } catch (error: unknown) {
    if (error instanceof InvalidRegistrationInputError || error instanceof AdminProvisionConflictError) {
      console.error(error.message);
    } else {
      console.error("No se pudo provisionar la cuenta administrativa. Revise la configuración y la disponibilidad de la base de datos.");
    }
    process.exitCode = 1;
  } finally {
    if (app) {
      try {
        await app.close();
      } catch {
        console.error("No se pudo cerrar la conexión de provisión administrativa.");
        process.exitCode = 1;
      }
    }
  }
}

await provision();
