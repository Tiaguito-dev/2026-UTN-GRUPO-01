import { Controller, Get, ServiceUnavailableException } from "@nestjs/common";
import { PrismaService } from "../infrastructure/prisma/prisma.service.js";

interface HealthResponse {
  status: "ok";
  service: "back";
}

@Controller("health")
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  check(): HealthResponse {
    return {
      status: "ok",
      service: "back",
    };
  }

  @Get("ready")
  async ready(): Promise<HealthResponse> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return this.check();
    } catch {
      throw new ServiceUnavailableException("El servicio no está listo. Intente nuevamente.");
    }
  }
}
