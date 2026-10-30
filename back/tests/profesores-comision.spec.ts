// Administrative mutations now forward an optional actor for transactional audit.
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { AsignarProfesorComision } from "../src/academic/application/asignar-profesor-comision.js";
import { QuitarProfesorComision } from "../src/academic/application/quitar-profesor-comision.js";
import {
  CAMPOS_NO_PERMITIDOS,
  ComisionNotFoundError,
  InvalidAcademicInputError,
  InvalidIdError,
  ProfesorNoAsignadoError,
  ProfesorNotFoundError,
} from "../src/academic/application/errors.js";
import { fixture } from "./academic-fixture.js";

// TASK-040: PUT/DELETE /comisiones/:comisionId/profesores/:profesorId a nivel caso de uso.

describe("Profesores por comisión", () => {
  function conComision() {
    const f = fixture();
    const cursada = f.addCursada(f.addMateria("Álgebra", "1").id);
    const comision = f.addComision(cursada.id, "S", 1);
    const profesor = f.addProfesor("Ada Lovelace");
    return {
      ...f, comision, profesor,
      asignar: new AsignarProfesorComision(f.comisionRepository, f.profesorRepository),
      quitar: new QuitarProfesorComision(f.comisionRepository, f.profesorRepository),
    };
  }
  const clave = (comisionId: string, profesorId: string) => `${comisionId}:${profesorId}`;

  describe("AsignarProfesorComision", () => {
    it.each(["TITULAR", "ADJUNTO", "JTP"])("asigna con cargo %s y devuelve id, nombre y cargo", async (cargo) => {
      const { asignar, comisionRepository, asignaciones, comision, profesor } = conComision();
      await expect(asignar.execute(comision.id, profesor.id, { cargo })).resolves.toStrictEqual({ id: profesor.id, nombreCompleto: "Ada Lovelace", cargo });
      expect(comisionRepository.asignarProfesor).toHaveBeenCalledWith(comision.id, profesor.id, cargo, undefined);
      expect(asignaciones.get(clave(comision.id, profesor.id))).toBe(cargo);
    });

    it("volver a asignar cambia el cargo (upsert)", async () => {
      const { asignar, asignaciones, comision, profesor } = conComision();
      await asignar.execute(comision.id, profesor.id, { cargo: "TITULAR" });
      await expect(asignar.execute(comision.id, profesor.id, { cargo: "JTP" })).resolves.toMatchObject({ cargo: "JTP" });
      expect(asignaciones.get(clave(comision.id, profesor.id))).toBe("JTP");
      expect(asignaciones.size).toBe(1);
    });

    it.each([
      ["en minúscula", { cargo: "titular" }],
      ["desconocido", { cargo: "AYUDANTE" }],
      ["vacío", { cargo: "" }],
      ["numérico", { cargo: 1 }],
      ["faltante", {}],
      ["con cuerpo nulo", null],
    ])("rechaza cargo %s sin tocar el repositorio", async (_caso, body) => {
      const { asignar, comisionRepository, comision, profesor } = conComision();
      await expect(asignar.execute(comision.id, profesor.id, body)).rejects.toBeInstanceOf(InvalidAcademicInputError);
      expect(comisionRepository.asignarProfesor).not.toHaveBeenCalled();
    });

    it("rechaza un cuerpo con campos de más", async () => {
      const { asignar, comision, profesor } = conComision();
      await expect(asignar.execute(comision.id, profesor.id, { cargo: "JTP", desde: "2026" })).rejects.toThrow(CAMPOS_NO_PERMITIDOS);
    });

    it.each(["comisionId", "profesorId"])("%s no-UUID tira InvalidIdError", async (campo) => {
      const { asignar, comision, profesor } = conComision();
      const ids = { comisionId: comision.id, profesorId: profesor.id, [campo]: "not-a-uuid" };
      await expect(asignar.execute(ids.comisionId, ids.profesorId, { cargo: "JTP" })).rejects.toBeInstanceOf(InvalidIdError);
    });

    it("comisión inexistente tira ComisionNotFoundError (404)", async () => {
      const { asignar, comisionRepository, profesor } = conComision();
      const promesa = asignar.execute(randomUUID(), profesor.id, { cargo: "JTP" });
      await expect(promesa).rejects.toBeInstanceOf(ComisionNotFoundError);
      await expect(promesa).rejects.toMatchObject({ httpStatus: 404 });
      expect(comisionRepository.asignarProfesor).not.toHaveBeenCalled();
    });

    it("comisión dada de baja tira ComisionNotFoundError", async () => {
      const { asignar, comision, profesor } = conComision();
      comision.deletedAt = new Date();
      await expect(asignar.execute(comision.id, profesor.id, { cargo: "JTP" })).rejects.toBeInstanceOf(ComisionNotFoundError);
    });

    it("profesor inexistente tira ProfesorNotFoundError", async () => {
      const { asignar, comisionRepository, comision } = conComision();
      await expect(asignar.execute(comision.id, randomUUID(), { cargo: "JTP" })).rejects.toBeInstanceOf(ProfesorNotFoundError);
      expect(comisionRepository.asignarProfesor).not.toHaveBeenCalled();
    });

    it("profesor dado de baja tira ProfesorNotFoundError", async () => {
      const { asignar, comision, profesor } = conComision();
      profesor.deletedAt = new Date();
      await expect(asignar.execute(comision.id, profesor.id, { cargo: "JTP" })).rejects.toBeInstanceOf(ProfesorNotFoundError);
    });
  });

  describe("QuitarProfesorComision", () => {
    it("quita la asignación y no devuelve nada", async () => {
      const { asignar, quitar, comisionRepository, asignaciones, comision, profesor } = conComision();
      await asignar.execute(comision.id, profesor.id, { cargo: "ADJUNTO" });
      await expect(quitar.execute(comision.id, profesor.id)).resolves.toBeUndefined();
      expect(comisionRepository.quitarProfesor).toHaveBeenCalledWith(comision.id, profesor.id, undefined);
      expect(asignaciones.has(clave(comision.id, profesor.id))).toBe(false);
    });

    it("profesor no asignado tira ProfesorNoAsignadoError (404)", async () => {
      const { quitar, comision, profesor } = conComision();
      const promesa = quitar.execute(comision.id, profesor.id);
      await expect(promesa).rejects.toBeInstanceOf(ProfesorNoAsignadoError);
      await expect(promesa).rejects.toMatchObject({ httpStatus: 404 });
    });

    it("comisión inexistente tira ComisionNotFoundError sin quitar", async () => {
      const { quitar, comisionRepository, profesor } = conComision();
      await expect(quitar.execute(randomUUID(), profesor.id)).rejects.toBeInstanceOf(ComisionNotFoundError);
      expect(comisionRepository.quitarProfesor).not.toHaveBeenCalled();
    });

    it("profesor inexistente tira ProfesorNotFoundError sin quitar", async () => {
      const { quitar, comisionRepository, comision } = conComision();
      await expect(quitar.execute(comision.id, randomUUID())).rejects.toBeInstanceOf(ProfesorNotFoundError);
      expect(comisionRepository.quitarProfesor).not.toHaveBeenCalled();
    });

    it("ids no-UUID tiran InvalidIdError", async () => {
      const { quitar, comision } = conComision();
      await expect(quitar.execute(comision.id, "not-a-uuid")).rejects.toBeInstanceOf(InvalidIdError);
      await expect(quitar.execute("not-a-uuid", randomUUID())).rejects.toBeInstanceOf(InvalidIdError);
    });
  });
});
