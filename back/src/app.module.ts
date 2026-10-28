import { Module } from "@nestjs/common";
import { HealthController } from "./health/health.controller.js";
import { PrismaModule } from "./infrastructure/prisma/prisma.module.js";
import { AuthModule } from "./auth/auth.module.js";
import { AcademicModule } from "./academic/academic.module.js";
import { UsersAdminModule } from "./users/users-admin.module.js";
import { ReviewsModule } from "./reviews/reviews.module.js";

@Module({
  imports: [PrismaModule, AuthModule, AcademicModule, UsersAdminModule, ReviewsModule],
  controllers: [HealthController],
})
export class AppModule {}
