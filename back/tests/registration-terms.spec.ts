import { describe, expect, it, vi } from "vitest";
import { RegisterUser } from "../src/auth/application/register-user.js";
import type { UserRepository } from "../src/users/domain/user.repository.js";

const account = { email: "terms@alu.frlp.utn.edu.ar", displayName: "Estudiante", password: "contraseña segura" };

describe("Consentimiento explícito al registrar", () => {
  it.each([undefined, false, "true", 1, null])("rechaza aceptación ausente o no booleana: %s", async aceptaTerminos => {
    const users = { findByEmail: vi.fn(), create: vi.fn() } as unknown as UserRepository;
    const passwords = { hash: vi.fn(), verify: vi.fn() };
    const register = new RegisterUser(users, passwords, { requestForUser: vi.fn() });
    await expect(register.execute({ ...account, ...(aceptaTerminos === undefined ? {} : { aceptaTerminos }), versionTerminos: "terminos-2026-11-17" }))
      .rejects.toThrow("Debés aceptar los términos y condiciones para crear tu cuenta");
    expect(users.create).not.toHaveBeenCalled();
    expect(passwords.hash).not.toHaveBeenCalled();
  });
  it.each([undefined, "1", "terminos-antiguos", 1])("rechaza versión ausente o ajena sin generar hash: %s", async versionTerminos => {
    const users = { findByEmail: vi.fn(), create: vi.fn() } as unknown as UserRepository;
    const passwords = { hash: vi.fn(), verify: vi.fn() };
    const register = new RegisterUser(users, passwords, { requestForUser: vi.fn() });
    await expect(register.execute({ ...account, aceptaTerminos: true, versionTerminos }))
      .rejects.toThrow("Los términos y condiciones cambiaron. Leelos nuevamente y aceptá la versión vigente.");
    expect(users.create).not.toHaveBeenCalled();
    expect(passwords.hash).not.toHaveBeenCalled();
  });
});
