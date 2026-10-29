import { randomUUID } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import type { PrismaService } from "../src/infrastructure/prisma/prisma.service.js";
import { PrismaUserAdministrationRepository } from "../src/users/infrastructure/prisma-user-administration.repository.js";

function fixture() {
  const actorId = randomUUID(); const id = randomUUID();
  const tx = {
    $queryRaw: vi.fn().mockResolvedValue([]),
    user: {
      findUnique: vi.fn().mockResolvedValueOnce({ role: "ADMIN", disabledAt: null })
        .mockResolvedValueOnce({ id, role: "ADMIN", disabledAt: null }),
      count: vi.fn().mockResolvedValue(1), update: vi.fn(),
    },
    session: { updateMany: vi.fn() }, administracionHistorial: { create: vi.fn() },
  };
  const prisma = { $transaction: async (work: (client: typeof tx) => Promise<unknown>) => work(tx) };
  return { id, actorId, tx, repository: new PrismaUserAdministrationRepository(prisma as unknown as PrismaService) };
}

describe("protecciones transaccionales del estado de usuarios", () => {
  it("rechaza la baja si la lectura protegida encuentra un solo ADMIN activo", async () => {
    // Escenario defensivo del repositorio, sin desactivar administradores ajenos a fixtures.
    const { repository, id, actorId, tx } = fixture();
    await expect(repository.setActive(id, false, actorId)).rejects.toMatchObject({ httpStatus: 409 });
    expect(tx.user.update).not.toHaveBeenCalled();
    expect(tx.session.updateMany).not.toHaveBeenCalled();
    expect(tx.administracionHistorial.create).not.toHaveBeenCalled();
  });

  it("revalida al actor dentro de la transacción aunque el guard hubiera autorizado previamente", async () => {
    const { repository, id, actorId, tx } = fixture();
    tx.user.findUnique.mockReset().mockResolvedValue({ role: "ADMIN", disabledAt: new Date() });
    await expect(repository.setActive(id, false, actorId)).rejects.toMatchObject({ httpStatus: 403 });
    expect(tx.user.findUnique).toHaveBeenCalledTimes(1);
    expect(tx.user.update).not.toHaveBeenCalled();
    expect(tx.session.updateMany).not.toHaveBeenCalled();
    expect(tx.administracionHistorial.create).not.toHaveBeenCalled();
  });
});
