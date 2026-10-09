import { Module } from "@nestjs/common";
import { HealthController } from "./health/health.controller.js";
import { PrismaModule } from "./infrastructure/prisma/prisma.module.js";
import { AuthModule } from "./auth/auth.module.js";

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [HealthController],
})
export class AppModule {}
