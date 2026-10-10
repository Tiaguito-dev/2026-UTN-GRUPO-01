import { randomUUID } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { RegisterUser } from "../src/auth/application/register-user.js";
import { ProvisionAdmin } from "../src/auth/application/provision-admin.js";
import { InvalidRegistrationInputError, AdminProvisionConflictError } from "../src/auth/domain/errors.js";
import type { PasswordHasher } from "../src/auth/domain/password-hasher.js";
import { EmailAlreadyRegisteredError } from "../src/users/domain/errors.js";
import { toPublicUser, type User } from "../src/users/domain/user.js";
import type { UserRepository } from "../src/users/domain/user.repository.js";

const validInput = { email: "Person+tag@Alu.Frlp.Utn.Edu.Ar", displayName: " Persona ", password: " una contraseña segura " };

function fixture() {
  const accounts = new Map<string, User>();
  const repository: UserRepository = {
    findAll: vi.fn(async (pagination) => {
      const items = [...accounts.values()].map(toPublicUser);
      const start = (pagination.page - 1) * pagination.pageSize;
      return { items: items.slice(start, start + pagination.pageSize), total: items.length, page: pagination.page, pageSize: pagination.pageSize };
    }),
    findById: vi.fn(async (id: string) => [...accounts.values()].find((user) => user.id === id) ?? null),
    findByEmail: vi.fn(async (email: string) => accounts.get(email) ?? null),
    create: vi.fn(async (input) => {
      if (accounts.has(input.email)) throw new EmailAlreadyRegisteredError();
      const user: User = { ...input, id: randomUUID(), createdAt: new Date() };
      accounts.set(input.email, user);
      return user;
    }),
  };
  const hasher: PasswordHasher = { hash: vi.fn(async () => "private-hash"), verify: vi.fn(async () => true) };
  return { accounts, repository, hasher, register: new RegisterUser(repository, hasher), provision: new ProvisionAdmin(repository, hasher) };
}

describe("RegisterUser", () => {
  it("normaliza email y nombre, conserva la contraseña exacta y devuelve solo datos públicos", async () => {
    const { register, accounts, hasher } = fixture();
    const result = await register.execute(validInput);
    expect(hasher.hash).toHaveBeenCalledWith(validInput.password);
    expect(result).toEqual({ id: expect.any(String), email: "person+tag@alu.frlp.utn.edu.ar", displayName: "Persona", role: "USER", createdAt: expect.any(Date) });
    expect(accounts.get(result.email)?.passwordHash).toBe("private-hash");
    expect(Object.keys(result).sort()).toEqual(["createdAt", "displayName", "email", "id", "role"]);
  });

  it.each([
    null, [], "invalid", {},
    { ...validInput, role: "USER" }, { ...validInput, role: "ADMIN" },
    { ...validInput, unexpected: true },
    { ...validInput, email: "missing-domain" }, { ...validInput, email: "person@localhost" },
    { ...validInput, email: "person\n@example.com" }, { ...validInput, email: 42 },
    { ...validInput, email: "estudiante@gmail.com" }, { ...validInput, email: "evil-alu.frlp.utn.edu.ar@attacker.com" },
    { ...validInput, email: "estudiante@evilalu.frlp.utn.edu.ar" },
    { ...validInput, displayName: "  " }, { ...validInput, displayName: "a".repeat(101) },
    { ...validInput, displayName: "Name\u0000" },
    { ...validInput, password: "short" }, { ...validInput, password: "a".repeat(129) },
    { ...validInput, password: null },
  ])("rechaza entrada inválida antes de persistir: %#", async (input) => {
    const { register, repository, hasher } = fixture();
    await expect(register.execute(input)).rejects.toBeInstanceOf(InvalidRegistrationInputError);
    expect(repository.create).not.toHaveBeenCalled();
    expect(hasher.hash).not.toHaveBeenCalled();
  });

  it("cuenta puntos de código Unicode en la contraseña sin normalizarlos", async () => {
    const { register, hasher } = fixture();
    const password = "😀".repeat(8);
    await register.execute({ ...validInput, password });
    expect(hasher.hash).toHaveBeenCalledWith(password);
  });

  it.each(["12345678", "😀".repeat(8), "a".repeat(128)])("acepta los límites de longitud sin modificar la contraseña", async (password) => {
    const { register, hasher } = fixture();
    await register.execute({ ...validInput, password });
    expect(hasher.hash).toHaveBeenCalledWith(password);
  });

  it.each(["1234567", "😀".repeat(7), "😀".repeat(129)])("rechaza fuera de los límites antes de generar el hash", async (password) => {
    const { register, repository, hasher } = fixture();
    await expect(register.execute({ ...validInput, password })).rejects.toBeInstanceOf(InvalidRegistrationInputError);
    expect(hasher.hash).not.toHaveBeenCalled();
    expect(repository.create).not.toHaveBeenCalled();
  });

  it("rechaza un duplicado normalizado sin cambiar la cuenta", async () => {
    const { register, accounts } = fixture();
    await register.execute(validInput);
    await expect(register.execute({ ...validInput, email: " PERSON+TAG@ALU.FRLP.UTN.EDU.AR " })).rejects.toBeInstanceOf(EmailAlreadyRegisteredError);
    expect(accounts.size).toBe(1);
  });

  it("propaga el conflicto de persistencia aunque la consulta previa no lo detecte", async () => {
    const { register, repository } = fixture();
    vi.mocked(repository.create).mockRejectedValueOnce(new EmailAlreadyRegisteredError());
    await expect(register.execute(validInput)).rejects.toBeInstanceOf(EmailAlreadyRegisteredError);
  });

  it("acepta un email del dominio institucional exacto", async () => {
    const { register } = fixture();
    const result = await register.execute({ ...validInput, email: "nombre@alu.frlp.utn.edu.ar" });
    expect(result.email).toBe("nombre@alu.frlp.utn.edu.ar");
  });
});

describe("ProvisionAdmin", () => {
  it("crea ADMIN y su segunda ejecución conserva contraseña y nombre", async () => {
    const { provision, accounts, hasher } = fixture();
    const first = await provision.execute(validInput);
    const second = await provision.execute({ ...validInput, displayName: "Otro nombre", password: "Otra contraseña segura" });
    expect(first.status).toBe("created");
    expect(first.user.role).toBe("ADMIN");
    expect(second).toEqual({ status: "already-exists", user: first.user });
    expect(accounts.size).toBe(1);
    expect(hasher.hash).toHaveBeenCalledTimes(1);
    expect(first.user).not.toHaveProperty("passwordHash");
  });

  it("aborta ante USER y no lo promueve", async () => {
    const { register, provision, accounts } = fixture();
    await register.execute(validInput);
    await expect(provision.execute(validInput)).rejects.toBeInstanceOf(AdminProvisionConflictError);
    expect(accounts.get("person+tag@alu.frlp.utn.edu.ar")?.role).toBe("USER");
  });

  it.each(["ADMIN", "USER"] as const)("resuelve una carrera de creación sin promover %s", async (role) => {
    const { provision, repository } = fixture();
    const concurrent: User = { id: randomUUID(), email: "person+tag@alu.frlp.utn.edu.ar", displayName: "Existente", passwordHash: "unchanged", role, createdAt: new Date() };
    vi.mocked(repository.findByEmail).mockResolvedValueOnce(null).mockResolvedValueOnce(concurrent);
    vi.mocked(repository.create).mockRejectedValueOnce(new EmailAlreadyRegisteredError());
    if (role === "ADMIN") {
      await expect(provision.execute(validInput)).resolves.toEqual({ status: "already-exists", user: { id: concurrent.id, email: concurrent.email, displayName: concurrent.displayName, role, createdAt: concurrent.createdAt } });
    } else {
      await expect(provision.execute(validInput)).rejects.toBeInstanceOf(AdminProvisionConflictError);
    }
  });

  it("acepta un email no institucional para la provisión de ADMIN", async () => {
    const { provision } = fixture();
    const result = await provision.execute({ ...validInput, email: "admin@gmail.com" });
    expect(result.status).toBe("created");
    expect(result.user.email).toBe("admin@gmail.com");
  });
});
