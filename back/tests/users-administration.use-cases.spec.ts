import { randomUUID } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { CambiarEstadoUsuario } from "../src/users/application/cambiar-estado-usuario.js";
import { canAuthenticate } from "../src/users/domain/user.js";

describe("Estados de usuarios TASK-070", () => {
  it("valida el contrato estricto y delega UUID, estado y actor", async () => {
    const id = randomUUID(); const actorId = randomUUID();
    const repository = { setActive: vi.fn().mockResolvedValue({ id, disabledAt: null }), findHistorial: vi.fn() };
    const useCase = new CambiarEstadoUsuario(repository);
    await useCase.execute(id, { activo: true }, actorId);
    expect(repository.setActive).toHaveBeenCalledExactlyOnceWith(id, true, actorId);
    for (const body of [{ activo: "true" }, { activo: 1 }, {}, { activo: false, role: "ADMIN" }, null]) {
      await expect(useCase.execute(id, body, actorId)).rejects.toMatchObject({ httpStatus: 400 });
    }
    await expect(useCase.execute("no-uuid", { activo: true }, actorId)).rejects.toMatchObject({ httpStatus: 400 });
    expect(repository.setActive).toHaveBeenCalledTimes(1);
  });

  it("impide autodesactivación antes de tocar el puerto", async () => {
    const id = randomUUID(); const repository = { setActive: vi.fn(), findHistorial: vi.fn() };
    await expect(new CambiarEstadoUsuario(repository).execute(id, { activo: false }, id)).rejects.toMatchObject({ httpStatus: 409 });
    expect(repository.setActive).not.toHaveBeenCalled();
  });

  it("un ADMIN o USER con disabledAt no puede autenticarse aunque haya verificado su email", () => {
    const disabledAt = new Date();
    for (const role of ["ADMIN", "USER"] as const) {
      expect(canAuthenticate({ role, emailVerifiedAt: new Date(), disabledAt })).toBe(false);
      expect(canAuthenticate({ role, emailVerifiedAt: new Date(), disabledAt: null })).toBe(true);
    }
  });
});
