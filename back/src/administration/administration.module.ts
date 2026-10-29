import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module.js";
import { PrismaModule } from "../infrastructure/prisma/prisma.module.js";
import { AdminDetailController } from "./admin-detail.controller.js";
import { AdminDetailService } from "./admin-detail.service.js";
@Module({ imports: [AuthModule, PrismaModule], controllers: [AdminDetailController], providers: [AdminDetailService] })
export class AdministrationModule {}
