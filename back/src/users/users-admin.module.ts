import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module.js";
import { SharedModule } from "../shared/shared.module.js";
import { USER_REPOSITORY, type UserRepository } from "./domain/user.repository.js";
import { ListarUsuarios } from "./application/listar-usuarios.js";
import { UsersController } from "./users.controller.js";
import { UsersModule } from "./users.module.js";
import { PrismaModule } from "../infrastructure/prisma/prisma.module.js";
import { PrismaService } from "../infrastructure/prisma/prisma.service.js";
import { USER_ADMINISTRATION_REPOSITORY, type UserAdministrationRepository } from "./domain/user-administration.repository.js";
import { PrismaUserAdministrationRepository } from "./infrastructure/prisma-user-administration.repository.js";
import { CambiarEstadoUsuario } from "./application/cambiar-estado-usuario.js";
import { ListarHistorialUsuario } from "./application/listar-historial-usuario.js";

// Módulo aparte de UsersModule a propósito: el controlador necesita los guards de AuthModule,
// y AuthModule ya importa UsersModule. Si UsersModule importara AuthModule habría ciclo
// (resoluble solo con forwardRef). Esta composición es unidireccional:
// UsersAdminModule -> AuthModule -> UsersModule.
@Module({
  imports: [UsersModule, AuthModule, SharedModule, PrismaModule],
  controllers: [UsersController],
  providers: [{
    provide: ListarUsuarios,
    useFactory: (users: UserRepository) => new ListarUsuarios(users),
    inject: [USER_REPOSITORY],
  }, {
    provide: USER_ADMINISTRATION_REPOSITORY,
    useFactory: (prisma: PrismaService) => new PrismaUserAdministrationRepository(prisma),
    inject: [PrismaService],
  }, ...[CambiarEstadoUsuario, ListarHistorialUsuario].map((provide) => ({ provide,
    useFactory: (repository: UserAdministrationRepository) => new provide(repository), inject: [USER_ADMINISTRATION_REPOSITORY] }))],
})
export class UsersAdminModule {}
