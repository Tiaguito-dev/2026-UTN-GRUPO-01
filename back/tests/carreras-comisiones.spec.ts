// Administrative mutations now forward an optional actor for transactional audit.
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { validateCrearMateriaInput } from "../src/academic/application/crear-materia-input.js";
import { validateActualizarMateriaInput } from "../src/academic/application/materia-input.js";
import { validateCrearComisionInput } from "../src/academic/application/crear-comision-input.js";
import { validateCrearCursadaInput } from "../src/academic/application/crear-cursada-input.js";
import { serializarCarreras } from "../src/academic/domain/materia.js";
import {
  CAMPOS_NO_PERMITIDOS,
  CarreraConComisionesError,
  ComisionAlreadyExistsError,
  InvalidAcademicInputError,
} from "../src/academic/application/errors.js";
import { fixture } from "./academic-fixture.js";

// TASK-040: doble escritura de carreras y comisiones con carrera y número. Profesores por comisión: profesores-comision.spec.ts.

describe("validateCrearMateriaInput: forma con carreras", () => {
  it("acepta carreras y completa el nivel nulo de las que no son electivas", () => {
    const input = { modalidad: "ANUAL", nombre: " Análisis II ", carreras: [{ carrera: "S", anioCarrera: "2" }, { carrera: "Q", anioCarrera: "ELECTIVA", nivelElectiva: "4" }] };
    expect(validateCrearMateriaInput(input)).toMatchObject({ modalidad: "ANUAL", nombre: "Análisis II",
      carreras: [{ carrera: "S", anioCarrera: "2", nivelElectiva: null }, { carrera: "Q", anioCarrera: "ELECTIVA", nivelElectiva: "4" }] });
  });

  it.each(["S", "C", "Q", "I", "M"])("acepta la carrera %s", (carrera) => {
    expect(validateCrearMateriaInput({ modalidad: "ANUAL", nombre: "Materia", carreras: [{ carrera, anioCarrera: "1" }] })).toMatchObject({ carreras: [{ carrera }] });
  });

  // resolveNivelElectiva por fila: igual que la forma legada, el nivel se descarta si el año no es Electiva.
  it("descarta el nivel de una fila que no es Electiva", () => {
    expect(validateCrearMateriaInput({ modalidad: "ANUAL", nombre: "Materia", carreras: [{ carrera: "S", anioCarrera: "2", nivelElectiva: "3" }] }))
      .toMatchObject({ carreras: [{ carrera: "S", anioCarrera: "2", nivelElectiva: null }] });
  });

  it.each([
    ["ambas formas a la vez", { modalidad: "ANUAL", nombre: "Materia", anioCarrera: "1", carreras: [{ carrera: "S", anioCarrera: "1" }] }],
    ["ambas formas con solo el nivel legado", { modalidad: "ANUAL", nombre: "Materia", nivelElectiva: "3", carreras: [{ carrera: "S", anioCarrera: "1" }] }],
    ["carreras vacío", { modalidad: "ANUAL", nombre: "Materia", carreras: [] }],
    ["carrera repetida", { modalidad: "ANUAL", nombre: "Materia", carreras: [{ carrera: "S", anioCarrera: "1" }, { carrera: "S", anioCarrera: "2" }] }],
    ["Electiva sin nivel", { modalidad: "ANUAL", nombre: "Materia", carreras: [{ carrera: "S", anioCarrera: "ELECTIVA" }] }],
    ["carrera desconocida", { modalidad: "ANUAL", nombre: "Materia", carreras: [{ carrera: "X", anioCarrera: "1" }] }],
    ["carrera en minúscula", { modalidad: "ANUAL", nombre: "Materia", carreras: [{ carrera: "s", anioCarrera: "1" }] }],
    ["año inválido en una fila", { modalidad: "ANUAL", nombre: "Materia", carreras: [{ carrera: "S", anioCarrera: "6" }] }],
    ["fila sin año", { modalidad: "ANUAL", nombre: "Materia", carreras: [{ carrera: "S" }] }],
    ["carreras que no es arreglo", { modalidad: "ANUAL", nombre: "Materia", carreras: { carrera: "S", anioCarrera: "1" } }],
    ["fila con claves de más", { modalidad: "ANUAL", nombre: "Materia", carreras: [{ carrera: "S", anioCarrera: "1", plan: "2023" }] }],
    ["sin nombre", { carreras: [{ carrera: "S", anioCarrera: "1" }] }],
  ])("rechaza %s", (_caso, input) => {
    expect(() => validateCrearMateriaInput(input)).toThrow(InvalidAcademicInputError);
  });

  it("rechaza claves de más junto a carreras", () => {
    expect(() => validateCrearMateriaInput({ modalidad: "ANUAL", nombre: "Materia", carreras: [{ carrera: "S", anioCarrera: "1" }], id: randomUUID() }))
      .toThrow(CAMPOS_NO_PERMITIDOS);
  });
});

describe("validateActualizarMateriaInput: forma con carreras", () => {
  it("acepta carreras sin nombre", () => {
    expect(validateActualizarMateriaInput({ carreras: [{ carrera: "M", anioCarrera: "3" }] }))
      .toMatchObject({ carreras: [{ carrera: "M", anioCarrera: "3", nivelElectiva: null }] });
  });

  it.each([
    ["carreras con anioCarrera", { carreras: [{ carrera: "S", anioCarrera: "1" }], anioCarrera: "1" }],
    ["carreras con nivelElectiva", { carreras: [{ carrera: "S", anioCarrera: "ELECTIVA", nivelElectiva: "3" }], nivelElectiva: "3" }],
    ["carreras vacío", { carreras: [] }],
    ["carrera repetida", { carreras: [{ carrera: "Q", anioCarrera: "1" }, { carrera: "Q", anioCarrera: "1" }] }],
    ["Electiva sin nivel", { carreras: [{ carrera: "S", anioCarrera: "ELECTIVA" }] }],
    ["carreras nulo", { carreras: null }],
  ])("rechaza %s", (_caso, input) => {
    expect(() => validateActualizarMateriaInput(input)).toThrow(InvalidAcademicInputError);
  });

  it("rechaza claves de más junto a carreras", () => {
    expect(() => validateActualizarMateriaInput({ carreras: [{ carrera: "S", anioCarrera: "1" }], activa: true })).toThrow(CAMPOS_NO_PERMITIDOS);
  });
});

describe("validateCrearComisionInput: forma con carrera y número", () => {
  const cursadaId = randomUUID();

  it.each([1, 999])("acepta el número %i, límite exacto del rango", (numero) => {
    expect(validateCrearComisionInput({ cursadaId, carrera: "S", numero })).toMatchObject({ cursadaId, carrera: "S", numero });
  });

  it("la forma legada con nombre se rechaza con CAMPOS_NO_PERMITIDOS", () => {
    expect(() => validateCrearComisionInput({ cursadaId, nombre: "Comisión 1" })).toThrow(CAMPOS_NO_PERMITIDOS);
  });

  it.each([
    ["número 0", { cursadaId, carrera: "S", numero: 0 }],
    ["número 1000", { cursadaId, carrera: "S", numero: 1000 }],
    ["número no entero", { cursadaId, carrera: "S", numero: 1.5 }],
    ["número como string", { cursadaId, carrera: "S", numero: "1" }],
    ["número negativo", { cursadaId, carrera: "S", numero: -1 }],
    ["carrera sin número", { cursadaId, carrera: "S" }],
    ["carrera desconocida", { cursadaId, carrera: "X", numero: 1 }],
    ["ambas formas a la vez", { cursadaId, nombre: "S-1", carrera: "S", numero: 1 }],
    ["nombre con carrera", { cursadaId, nombre: "S-1", carrera: "S" }],
    ["cursadaId inválido", { cursadaId: "not-a-uuid", carrera: "S", numero: 1 }],
  ])("rechaza %s", (_caso, input) => {
    expect(() => validateCrearComisionInput(input)).toThrow(InvalidAcademicInputError);
  });

  it("rechaza claves de más junto a carrera y número", () => {
    expect(() => validateCrearComisionInput({ cursadaId, carrera: "S", numero: 1, activa: false })).toThrow(CAMPOS_NO_PERMITIDOS);
  });
});

describe("validateCrearCursadaInput: sin profesor", () => {
  it("acepta una cursada sin profesorId", () => {
    const datos = { materiaId: randomUUID(), anio: 2026, cuatrimestre: "PRIMERO" as const };
    expect(validateCrearCursadaInput(datos)).toEqual(datos);
  });

  it("si llega profesorId se rechaza con CAMPOS_NO_PERMITIDOS", () => {
    expect(() => validateCrearCursadaInput({ materiaId: randomUUID(), profesorId: randomUUID(), anio: 2026, cuatrimestre: "PRIMERO" }))
      .toThrow(CAMPOS_NO_PERMITIDOS);
  });
});

describe("serializarCarreras (historial)", () => {
  it("ordena por el enum S, C, Q, I, M y agrega el nivel solo si existe", () => {
    expect(serializarCarreras([
      { carrera: "M", anioCarrera: "1", nivelElectiva: null },
      { carrera: "Q", anioCarrera: "ELECTIVA", nivelElectiva: "4" },
      { carrera: "S", anioCarrera: "2", nivelElectiva: null },
      { carrera: "C", anioCarrera: "3", nivelElectiva: null },
      { carrera: "I", anioCarrera: "5", nivelElectiva: null },
    ])).toBe("S:2,C:3,Q:ELECTIVA:4,I:5,M:1");
  });

  it("serializa el ejemplo de la tarea", () => {
    expect(serializarCarreras([{ carrera: "Q", anioCarrera: "ELECTIVA", nivelElectiva: "4" }, { carrera: "S", anioCarrera: "2", nivelElectiva: null }]))
      .toBe("S:2,Q:ELECTIVA:4");
  });
});

describe("CrearMateria con carreras", () => {
  it("delega las carreras al puerto", async () => {
    const { crearMateria, materiaRepository } = fixture();
    const carreras = [{ carrera: "S", anioCarrera: "2", nivelElectiva: null }, { carrera: "Q", anioCarrera: "ELECTIVA", nivelElectiva: "4" }];
    await crearMateria.execute({ modalidad: "ANUAL", nombre: "Análisis II", carreras });
    expect(materiaRepository.create).toHaveBeenCalledWith(expect.objectContaining({ modalidad: "ANUAL", nombre: "Análisis II", carreras }), undefined);
  });

  it("la forma legada se rechaza con 400 CAMPOS_NO_PERMITIDOS", async () => {
    const { crearMateria, materiaRepository } = fixture();
    await expect(crearMateria.execute({ modalidad: "ANUAL", nombre: "Electiva", anioCarrera: "ELECTIVA", nivelElectiva: "5" }))
      .rejects.toThrow(CAMPOS_NO_PERMITIDOS);
    expect(materiaRepository.create).not.toHaveBeenCalled();
  });

  it("input con ambas formas se rechaza con CAMPOS_NO_PERMITIDOS", async () => {
    const { crearMateria, materiaRepository } = fixture();
    await expect(crearMateria.execute({ modalidad: "ANUAL", nombre: "Materia", anioCarrera: "1", carreras: [{ carrera: "S", anioCarrera: "1" }] }))
      .rejects.toThrow(CAMPOS_NO_PERMITIDOS);
    expect(materiaRepository.create).not.toHaveBeenCalled();
  });
});

describe("ActualizarMateria con carreras", () => {
  it("delega las carreras nuevas con el actor", async () => {
    const f = fixture();
    const materia = f.addMateria("Análisis II", "2");
    const actor = randomUUID();
    const carreras = [{ carrera: "S", anioCarrera: "2", nivelElectiva: null }, { carrera: "Q", anioCarrera: "ELECTIVA", nivelElectiva: "4" }];
    await f.actualizarMateria.execute(materia.id, { carreras }, actor);
    expect(f.materiaRepository.update).toHaveBeenCalledWith(materia.id, expect.objectContaining({ carreras }), actor);
  });

  it("una materia heredada sin año se clasifica con carreras", async () => {
    const f = fixture();
    const materia = f.addMateria("Heredada");
    await expect(f.actualizarMateria.execute(materia.id, { carreras: [{ carrera: "C", anioCarrera: "1" }] }, randomUUID())).resolves.toBeTruthy();
    expect(f.materiaRepository.update).toHaveBeenCalled();
  });

  it("quitar una carrera con comisiones vigentes tira CarreraConComisionesError (409) sin actualizar", async () => {
    const f = fixture();
    const materia = f.addMateria("Análisis II", "2");
    f.setCarreras(materia.id, [{ carrera: "S", anioCarrera: "2", nivelElectiva: null }, { carrera: "Q", anioCarrera: "2", nivelElectiva: null }]);
    f.addComision(f.addCursada(materia.id).id, "Q", 1);
    const promesa = f.actualizarMateria.execute(materia.id, { carreras: [{ carrera: "S", anioCarrera: "2" }] }, randomUUID());
    await expect(promesa).rejects.toBeInstanceOf(CarreraConComisionesError);
    await expect(promesa).rejects.toMatchObject({ httpStatus: 409, message: "No se puede quitar una carrera que tiene comisiones." });
    expect(f.comisionRepository.existsByMateriaAndCarrera).toHaveBeenCalledWith(materia.id, "Q");
    expect(f.materiaRepository.update).not.toHaveBeenCalled();
  });

  it("permite quitar una carrera cuyas comisiones están dadas de baja", async () => {
    const f = fixture();
    const materia = f.addMateria("Análisis II", "2");
    f.setCarreras(materia.id, [{ carrera: "S", anioCarrera: "2", nivelElectiva: null }, { carrera: "Q", anioCarrera: "2", nivelElectiva: null }]);
    f.addComision(f.addCursada(materia.id).id, "Q", 1).deletedAt = new Date();
    await f.actualizarMateria.execute(materia.id, { carreras: [{ carrera: "S", anioCarrera: "2" }] }, randomUUID());
    expect(f.materiaRepository.update).toHaveBeenCalled();
  });

  it("las comisiones de una carrera que se mantiene no bloquean la edición", async () => {
    const f = fixture();
    const materia = f.addMateria("Análisis II", "2");
    f.addComision(f.addCursada(materia.id).id, "S", 1);
    await f.actualizarMateria.execute(materia.id, { carreras: [{ carrera: "S", anioCarrera: "3" }, { carrera: "M", anioCarrera: "2" }] }, randomUUID());
    expect(f.materiaRepository.update).toHaveBeenCalled();
  });

  it("el PATCH legado con anioCarrera se rechaza con 400 CAMPOS_NO_PERMITIDOS", async () => {
    const f = fixture();
    const materia = f.addMateria("Materia");
    await expect(f.actualizarMateria.execute(materia.id, { anioCarrera: "2" }, randomUUID()))
      .rejects.toThrow(CAMPOS_NO_PERMITIDOS);
  });

  it("input con ambas formas no consulta ni actualiza", async () => {
    const f = fixture();
    const materia = f.addMateria("Materia");
    await expect(f.actualizarMateria.execute(materia.id, { anioCarrera: "1", carreras: [{ carrera: "S", anioCarrera: "1" }] }, randomUUID()))
      .rejects.toThrow(CAMPOS_NO_PERMITIDOS);
    expect(f.materiaRepository.update).not.toHaveBeenCalled();
  });
});

describe("CrearComision con carrera y número", () => {
  function conCursada() {
    const f = fixture();
    const materia = f.addMateria("Análisis II");
    f.setCarreras(materia.id, [{ carrera: "S", anioCarrera: "2", nivelElectiva: null }, { carrera: "Q", anioCarrera: "2", nivelElectiva: null }]);
    const cursada = f.addCursada(materia.id);
    return { ...f, materia, cursada };
  }

  // La carrera puede omitirse únicamente cuando se resuelve sin ambigüedad desde la materia.
  it("asigna desde persistencia la única carrera sin exigir un campo oculto", async () => {
    const f = conCursada();
    f.setCarreras(f.materia.id, [{ carrera: "Q", anioCarrera: "2", nivelElectiva: null }]);
    await expect(f.crearComision.execute({ cursadaId: f.cursada.id, numero: 7 })).resolves.toMatchObject({ carrera: "Q", numero: 7 });
    expect(f.comisionRepository.create).toHaveBeenCalledWith({ cursadaId: f.cursada.id, carrera: "Q", numero: 7 }, undefined);
  });

  it("exige elegir una carrera si hay varias y no escribe sin selección", async () => {
    const f = conCursada();
    await expect(f.crearComision.execute({ cursadaId: f.cursada.id, numero: 7 })).rejects.toThrow("Elegí una carrera de la materia");
    expect(f.comisionRepository.create).not.toHaveBeenCalled();
  });

  it("rechaza una carrera manipulada incluso si la materia tiene una sola", async () => {
    const f = conCursada();
    f.setCarreras(f.materia.id, [{ carrera: "Q", anioCarrera: "2", nivelElectiva: null }]);
    await expect(f.crearComision.execute({ cursadaId: f.cursada.id, carrera: "S", numero: 7 })).rejects.toThrow("La carrera no corresponde");
    expect(f.comisionRepository.create).not.toHaveBeenCalled();
  });

  it.each([undefined, "S"])("explica corregir la materia sin carreras (carrera enviada: %s)", async (carrera) => {
    const f = conCursada();
    f.setCarreras(f.materia.id, []);
    await expect(f.crearComision.execute({ cursadaId: f.cursada.id, carrera, numero: 7 })).rejects.toThrow("La materia no tiene carreras asociadas. Asociá al menos una carrera a la materia antes de crear una comisión.");
    expect(f.comisionRepository.create).not.toHaveBeenCalled();
  });

  it("arma el nombre como carrera-número y delega carrera y número al puerto", async () => {
    const { crearComision, comisionRepository, cursada } = conCursada();
    const comision = await crearComision.execute({ cursadaId: cursada.id, carrera: "Q", numero: 7 });
    expect(comision).toMatchObject({ cursadaId: cursada.id, nombre: "Q-7" });
    expect(comisionRepository.create).toHaveBeenCalledWith({ cursadaId: cursada.id, carrera: "Q", numero: 7 }, undefined);
  });

  it("carrera que no está entre las de la materia tira InvalidAcademicInputError (400)", async () => {
    const { crearComision, comisionRepository, materiaRepository, materia, cursada } = conCursada();
    const promesa = crearComision.execute({ cursadaId: cursada.id, carrera: "M", numero: 1 });
    await expect(promesa).rejects.toBeInstanceOf(InvalidAcademicInputError);
    expect(materiaRepository.findCarreras).toHaveBeenCalledWith(materia.id);
    expect(comisionRepository.create).not.toHaveBeenCalled();
  });

  it("misma carrera y número en la cursada tira ComisionAlreadyExistsError (409)", async () => {
    const { crearComision, comisionRepository, addComision, cursada } = conCursada();
    addComision(cursada.id, "S", 1);
    await expect(crearComision.execute({ cursadaId: cursada.id, carrera: "S", numero: 1 })).rejects.toBeInstanceOf(ComisionAlreadyExistsError);
    expect(comisionRepository.create).not.toHaveBeenCalled();
  });

  it("cursada inexistente tira CursadaNotFoundError antes de mirar las carreras", async () => {
    const { crearComision, materiaRepository } = conCursada();
    await expect(crearComision.execute({ cursadaId: randomUUID(), carrera: "S", numero: 1 })).rejects.toMatchObject({ name: "CursadaNotFoundError" });
    expect(materiaRepository.findCarreras).not.toHaveBeenCalled();
  });

  it("la forma legada con nombre libre se rechaza con 400 CAMPOS_NO_PERMITIDOS", async () => {
    const { crearComision, cursada } = conCursada();
    await expect(crearComision.execute({ cursadaId: cursada.id, nombre: "Comisión 1 - Mañana" }))
      .rejects.toThrow(CAMPOS_NO_PERMITIDOS);
  });
});

describe("CrearCursada sin profesor", () => {
  it("crea la cursada sin consultar profesores", async () => {
    const { crearCursada, cursadaRepository, profesorRepository, addMateria } = fixture();
    const materia = addMateria("Álgebra");
    const datos = { materiaId: materia.id, anio: 2026, cuatrimestre: "PRIMERO" as const };
    await expect(crearCursada.execute(datos)).resolves.toMatchObject(datos);
    expect(profesorRepository.findById).not.toHaveBeenCalled();
    expect(cursadaRepository.create).toHaveBeenCalledWith(datos, undefined);
  });

  it("con profesorId se rechaza con 400 CAMPOS_NO_PERMITIDOS", async () => {
    const { crearCursada, cursadaRepository, addMateria } = fixture();
    const materia = addMateria("Álgebra");
    await expect(crearCursada.execute({ materiaId: materia.id, profesorId: randomUUID(), anio: 2026, cuatrimestre: "PRIMERO" }))
      .rejects.toThrow(CAMPOS_NO_PERMITIDOS);
    expect(cursadaRepository.create).not.toHaveBeenCalled();
  });
});
