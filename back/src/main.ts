import { config } from "dotenv";
import { NestFactory } from "@nestjs/core";
import { resolve } from "node:path";
import { AppModule } from "./app.module.js";

config({
  path: [resolve(process.cwd(), ".env"), resolve(process.cwd(), "../.env")],
});

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const port = Number(process.env["PORT"] ?? process.env["BACKEND_PORT"] ?? 3001);

  await app.listen(port);
}

await bootstrap();
