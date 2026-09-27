import { Test } from "@nestjs/testing";
import { describe, expect, it } from "vitest";
import { HealthController } from "../src/health/health.controller.js";

describe("HealthController", () => {
  it("informa que el backend está disponible", async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [HealthController],
    }).compile();

    const controller = moduleRef.get(HealthController);

    expect(controller.check()).toEqual({
      status: "ok",
      service: "back",
    });
  });
});
