import type { CursadaDetalle, Materia } from "@/services/academic";

/** Contratos de los padres que resuelven los listados administrativos antes de cargar filas. */
export function materiaFixture(id = "m1"): Materia {
  return { id, nombre: "Materia seleccionada", modalidad: "PRIMERO", carreras: [{ carrera: "S", anioCarrera: "1", nivelElectiva: null }], createdAt: "2026-01-01T00:00:00.000Z", deletedAt: null };
}

export function cursadaDetalleFixture(id = "c1", materiaId = "m1"): CursadaDetalle {
  const materia = materiaFixture(materiaId);
  return { id, anio: 2026, cuatrimestre: "PRIMERO", materia: { id: materia.id, nombre: materia.nombre, modalidad: materia.modalidad } };
}
