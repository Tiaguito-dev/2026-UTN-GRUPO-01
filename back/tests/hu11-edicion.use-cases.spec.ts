import { randomUUID } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { ActualizarProfesor } from "../src/academic/application/actualizar-profesor.js";
import { ObtenerProfesor } from "../src/academic/application/obtener-profesor.js";
import { ActualizarCursada } from "../src/academic/application/actualizar-cursada.js";
import { ActualizarComision } from "../src/academic/application/actualizar-comision.js";
import { fixture } from "./academic-fixture.js";
import { validateCrearCursadaInput } from "../src/academic/application/crear-cursada-input.js";

describe("HU11 edición con el modelo actual", () => {
  it("acepta crear y editar el período ANUAL sin reinterpretar los cuatrimestres", async () => {
    const f = fixture();
    const materia = f.addMateria("Anual");
    expect(validateCrearCursadaInput({ materiaId: materia.id, anio: 2026, cuatrimestre: "ANUAL" })).toMatchObject({ cuatrimestre: "ANUAL" });
    const cursada = f.addCursada(materia.id);
    const update = vi.fn(async () => cursada);
    await new ActualizarCursada(f.materiaRepository, { ...f.cursadaRepository, update }).execute(cursada.id, { cuatrimestre: "ANUAL" });
    expect(update).toHaveBeenCalledWith(cursada.id, { cuatrimestre: "ANUAL" });
  });
  it("consulta un profesor existente y rechaza uno ausente", async () => {
    const f = fixture();
    const p = f.addProfesor("Ada Lovelace");
    const caso = new ObtenerProfesor(f.profesorRepository);
    expect(await caso.execute(p.id)).toMatchObject({ id: p.id, nombreCompleto: p.nombreCompleto });
    await expect(caso.execute(randomUUID())).rejects.toThrow();
  });

  it("edita únicamente el nombre recortado del profesor", async () => {
    const f = fixture();
    const p = f.addProfesor("Ada");
    const update = vi.fn(async () => ({ ...p, nombreCompleto: "Ada Lovelace" }));
    const caso = new ActualizarProfesor({ ...f.profesorRepository, update });
    expect(await caso.execute(p.id, { nombreCompleto: " Ada Lovelace " })).toMatchObject({ nombreCompleto: "Ada Lovelace" });
    expect(update).toHaveBeenCalledWith(p.id, { nombreCompleto: "Ada Lovelace" });
  });

  it.each([{}, { nombreCompleto: " " }, { nombreCompleto: "Ada", role: "ADMIN" }])("rechaza PATCH de profesor inválido %j", async (body) => {
    const f = fixture();
    const update = vi.fn();
    await expect(new ActualizarProfesor({ ...f.profesorRepository, update }).execute(f.addProfesor("Ada").id, body)).rejects.toThrow();
    expect(update).not.toHaveBeenCalled();
  });

  it("edita el período sin requerir profesor y conserva la identidad", async () => {
    const f = fixture();
    const m = f.addMateria("Álgebra");
    const c = f.addCursada(m.id);
    const update = vi.fn(async () => ({ ...c, cuatrimestre: "SEGUNDO" as const }));
    await new ActualizarCursada(f.materiaRepository, { ...f.cursadaRepository, update }).execute(c.id, { cuatrimestre: "SEGUNDO" });
    expect(update).toHaveBeenCalledWith(c.id, { cuatrimestre: "SEGUNDO" });
  });

  it.each([{}, { profesorId: randomUUID() }, { anio: 1 }, { activa: false }])("rechaza PATCH de cursada inválido %j", async (body) => {
    const f = fixture();
    const update = vi.fn();
    const c = f.addCursada(f.addMateria("Álgebra").id);
    await expect(new ActualizarCursada(f.materiaRepository, { ...f.cursadaRepository, update }).execute(c.id, body)).rejects.toThrow();
    expect(update).not.toHaveBeenCalled();
  });

  it("renumera la comisión sin cambiar la cursada", async () => {
    const f = fixture();
    const c = f.addComision(f.addCursada(f.addMateria("Álgebra").id).id);
    const update = vi.fn(async () => ({ ...c, numero: 31, nombre: "S-31" }));
    const result = await new ActualizarComision(f.cursadaRepository, { ...f.comisionRepository, update }, f.materiaRepository).execute(c.id, { numero: 31 });
    expect(result).toMatchObject({ id: c.id, cursadaId: c.cursadaId, numero: 31 });
    expect(update).toHaveBeenCalledWith(c.id, { numero: 31 });
  });

  it.each([{}, { nombre: "S-31" }, { activa: false }, { cursadaId: randomUUID() }, { numero: 0 }])("rechaza PATCH de comisión inválido %j", async (body) => {
    const f = fixture();
    const update = vi.fn();
    const c = f.addComision(f.addCursada(f.addMateria("Álgebra").id).id);
    await expect(new ActualizarComision(f.cursadaRepository, { ...f.comisionRepository, update }, f.materiaRepository).execute(c.id, body)).rejects.toThrow();
    expect(update).not.toHaveBeenCalled();
  });
});
