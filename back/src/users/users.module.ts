import { Module } from "@nestjs/common";
import { PrismaModule } from "../infrastructure/prisma/prisma.module.js";
import { PrismaService } from "../infrastructure/prisma/prisma.service.js";
import { USER_REPOSITORY } from "./domain/user.repository.js";
import { PrismaUserRepository } from "./infrastructure/prisma-user.repository.js";

@Module({
  imports: [PrismaModule],
  providers: [{
    provide: USER_REPOSITORY,
    useFactory: (prisma: PrismaService) => new PrismaUserRepository(prisma),
    inject: [PrismaService],
  }],
  exports: [USER_REPOSITORY],
})
export class UsersModule {}
