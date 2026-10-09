import { Test } from "@nestjs/testing";
import { describe, expect, it, vi } from "vitest";
import { HealthController } from "../src/health/health.controller.js";
import { PrismaService } from "../src/infrastructure/prisma/prisma.service.js";

async function healthApp(query: ReturnType<typeof vi.fn>) {
  const moduleRef = await Test.createTestingModule({
    controllers: [HealthController],
    providers: [{ provide: PrismaService, useValue: { $queryRaw: query } }],
  }).compile();
  const app = moduleRef.createNestApplication();
  app.useLogger(false);
  await app.listen(0, "127.0.0.1");
  return app;
}

describe("HealthController", () => {
  it("informa que el backend está disponible", async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [{ provide: PrismaService, useValue: {} }],
    }).compile();

    const controller = moduleRef.get(HealthController);

    expect(controller.check()).toEqual({
      status: "ok",
      service: "back",
    });
    await moduleRef.close();
  }, 20000);

  it("readiness consulta SELECT 1 y devuelve el mismo contrato público", async () => {
    const query = vi.fn().mockResolvedValue([{ "?column?": 1 }]);
    const app = await healthApp(query);
    try {
      const response = await fetch(`${await app.getUrl()}/health/ready`);
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ status: "ok", service: "back" });
      expect(query).toHaveBeenCalledTimes(1);
      expect(query.mock.calls[0]?.[0]).toEqual(["SELECT 1"]);
    } finally { await app.close(); }
  }, 20000);

  it("readiness falla con 503 sin detalles de DB y liveness sigue disponible", async () => {
    const query = vi.fn().mockRejectedValue(new Error("postgres://private:secret@db:5432/internal stack"));
    const app = await healthApp(query);
    try {
      const url = await app.getUrl();
      const ready = await fetch(`${url}/health/ready`);
      expect(ready.status).toBe(503);
      const body = await ready.json();
      expect(body).toEqual({ statusCode: 503, error: "Service Unavailable", message: "El servicio no está listo. Intente nuevamente." });
      expect(JSON.stringify(body)).not.toMatch(/postgres|private|secret|stack|internal/u);
      const alive = await fetch(`${url}/health`);
      expect(alive.status).toBe(200);
      expect(await alive.json()).toEqual({ status: "ok", service: "back" });
      expect(query).toHaveBeenCalledTimes(1);
    } finally { await app.close(); }
  }, 20000);
});
