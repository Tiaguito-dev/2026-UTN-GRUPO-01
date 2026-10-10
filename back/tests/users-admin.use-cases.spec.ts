import { randomUUID } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { ListarUsuarios } from "../src/users/application/listar-usuarios.js";
import type { PublicUser } from "../src/users/domain/user.js";
import type { UserRepository } from "../src/users/domain/user.repository.js";
import { InvalidPaginationError } from "../src/shared/domain/errors.js";
import { paginate } from "./academic-fixture.js";

function fixture() {
  const usuarios: PublicUser[] = [];
  const users = {
    findAll: vi.fn(async (pagination) => paginate(usuarios, pagination)),
    findById: vi.fn(async () => null),
    findByEmail: vi.fn(async () => null),
    create: vi.fn(),
  } as unknown as UserRepository;

  function addUser(email: string): PublicUser {
    const user: PublicUser = { id: randomUUID(), email, displayName: "Persona", role: "USER", createdAt: new Date() };
    usuarios.push(user);
    return user;
  }

  return { users, addUser, listarUsuarios: new ListarUsuarios(users) };
}

describe("ListarUsuarios", () => {
  it("usa paginación default cuando no se envía input", async () => {
    const { listarUsuarios, addUser } = fixture();
    addUser("uno@alu.frlp.utn.edu.ar");
    addUser("dos@alu.frlp.utn.edu.ar");
    const result = await listarUsuarios.execute(undefined);
    expect(result).toMatchObject({ page: 1, pageSize: 20, total: 2 });
    expect(result.items).toHaveLength(2);
  });

  it("respeta paginación explícita", async () => {
    const { listarUsuarios, addUser } = fixture();
    addUser("uno@alu.frlp.utn.edu.ar");
    const segundo = addUser("dos@alu.frlp.utn.edu.ar");
    const result = await listarUsuarios.execute({ page: 2, pageSize: 1 });
    expect(result).toMatchObject({ page: 2, pageSize: 1, total: 2 });
    expect(result.items).toEqual([segundo]);
  });

  it("pageSize fuera de rango tira InvalidPaginationError sin consultar el repositorio", async () => {
    const { listarUsuarios, users } = fixture();
    await expect(listarUsuarios.execute({ pageSize: 101 })).rejects.toBeInstanceOf(InvalidPaginationError);
    expect(users.findAll).not.toHaveBeenCalled();
  });

  it("no expone passwordHash: el puerto devuelve solo campos públicos", async () => {
    const { listarUsuarios, addUser } = fixture();
    addUser("uno@alu.frlp.utn.edu.ar");
    const result = await listarUsuarios.execute(undefined);
    expect(Object.keys(result.items[0]!).sort()).toEqual(["createdAt", "displayName", "email", "id", "role"]);
  });
});
