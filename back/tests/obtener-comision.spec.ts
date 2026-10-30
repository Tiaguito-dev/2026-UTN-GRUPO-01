import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { ObtenerComision } from "../src/academic/application/obtener-comision.js";
import { ComisionNotFoundError, InvalidIdError } from "../src/academic/application/errors.js";
import { fixture } from "./academic-fixture.js";

// TASK-041: GET /comisiones/:comisionId a nivel caso de uso. El criterio de borrado vive en
// ComisionRepository.findDetalleById; academic.integration.spec.ts lo verifica contra PostgreSQL.

describe("ObtenerComision", () => {
  function conComision() {
    const f = fixture();
    const materia = f.addMateria("Análisis II", "2");
    const cursada = f.addCursada(materia.id, 2025);
    const comision = f.addComision(cursada.id, "S", 31);
    return { ...f, materia, cursada, comision, obtener: new ObtenerComision(f.comisionRepository) };
  }

  it("devuelve la comisión con profesores por cargo y la cursada con su materia", async () => {
    const { obtener, comisionRepository, addProfesor, asignaciones, materia, cursada, comision } = conComision();
    const [zoe, bruno] = [addProfesor("Zoe Jtp"), addProfesor("Bruno Titular")];
    asignaciones.set(`${comision.id}:${zoe.id}`, "JTP");
    asignaciones.set(`${comision.id}:${bruno.id}`, "TITULAR");
    await expect(obtener.execute(comision.id)).resolves.toStrictEqual({
      id: comision.id, cursadaId: cursada.id, nombre: "S-31", activa: true, carrera: "S", numero: 31,
      profesores: [
        { id: bruno.id, nombreCompleto: "Bruno Titular", cargo: "TITULAR" },
        { id: zoe.id, nombreCompleto: "Zoe Jtp", cargo: "JTP" },
      ],
      createdAt: comision.createdAt, deletedAt: null,
      cursada: { id: cursada.id, anio: 2025, materia: { id: materia.id, nombre: "Análisis II", modalidad: "ANUAL" } },
    });
    expect(comisionRepository.findDetalleById).toHaveBeenCalledWith(comision.id);
  });

  it("una comisión inactiva se devuelve con la marca", async () => {
    const { obtener, comision } = conComision();
    comision.activa = false;
    await expect(obtener.execute(comision.id)).resolves.toMatchObject({ id: comision.id, activa: false });
  });

  it("id no-UUID tira InvalidIdError sin tocar el repositorio", async () => {
    const { obtener, comisionRepository } = conComision();
    await expect(obtener.execute("not-a-uuid")).rejects.toBeInstanceOf(InvalidIdError);
    expect(comisionRepository.findDetalleById).not.toHaveBeenCalled();
  });

  it("id inexistente tira ComisionNotFoundError (404)", async () => {
    const { obtener } = conComision();
    const promesa = obtener.execute(randomUUID());
    await expect(promesa).rejects.toBeInstanceOf(ComisionNotFoundError);
    await expect(promesa).rejects.toMatchObject({ httpStatus: 404, message: "La comisión solicitada no existe." });
  });

  it.each(["comision", "cursada", "materia"] as const)("con la %s dada de baja tira ComisionNotFoundError", async (borrada) => {
    const f = conComision();
    f[borrada].deletedAt = new Date();
    await expect(f.obtener.execute(f.comision.id)).rejects.toBeInstanceOf(ComisionNotFoundError);
  });
});
