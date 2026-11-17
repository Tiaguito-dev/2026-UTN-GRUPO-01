import { describe, expect, it } from "vitest";
import { isFeedbackVisible } from "../src/reviews/domain/feedback-visibility.js";

const cases = (["PENDIENTE", "APROBADO", "RECHAZADO"] as const).flatMap(estadoModeracion =>
  [null, new Date("2026-11-17T00:00:00Z")].flatMap(deletedAt =>
    [false, true].flatMap(ocultoAutor => [false, true].flatMap(ocultoAdministracion =>
      [false, true].map(ocultoReportes => ({ estadoModeracion, deletedAt, ocultoAutor, ocultoAdministracion, ocultoReportes }))))));

describe("T2: política pública de experiencias", () => {
  it.each(cases)("evalúa estado y todas las causas: %j", row => {
    const expected = row.estadoModeracion === "APROBADO" && row.deletedAt === null &&
      !row.ocultoAutor && !row.ocultoAdministracion && !row.ocultoReportes;
    expect(isFeedbackVisible(row)).toBe(expected);
  });
});
