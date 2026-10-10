import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module.js";
import { SharedModule } from "../shared/shared.module.js";
import { USER_REPOSITORY, type UserRepository } from "./domain/user.repository.js";
import { ListarUsuarios } from "./application/listar-usuarios.js";
import { UsersController } from "./users.controller.js";
import { UsersModule } from "./users.module.js";

// Módulo aparte de UsersModule a propósito: el controlador necesita los guards de AuthModule,
// y AuthModule ya importa UsersModule. Si UsersModule importara AuthModule habría ciclo
// (resoluble solo con forwardRef). Esta composición es unidireccional:
// UsersAdminModule -> AuthModule -> UsersModule.
@Module({
  imports: [UsersModule, AuthModule, SharedModule],
  controllers: [UsersController],
  providers: [{
    provide: ListarUsuarios,
    useFactory: (users: UserRepository) => new ListarUsuarios(users),
    inject: [USER_REPOSITORY],
  }],
})
export class UsersAdminModule {}
