import { describe, expect, it } from "vitest";
import { periodoLabel } from "@/lib/format/periodo";
import { cursadaSchema } from "@/services/schemas";

describe("Período anual", () => {
  it("formatea Anual y el año", () => {
    expect(periodoLabel(2026, "ANUAL")).toBe("Anual 2026");
  });
  it("acepta respuesta anual y rechaza un período desconocido", () => {
    const value = { id: "c1", materiaId: "m1", anio: 2026, cuatrimestre: "ANUAL", createdAt: "2026-01-01T00:00:00.000Z", deletedAt: null };
    expect(cursadaSchema.safeParse(value).success).toBe(true);
    expect(cursadaSchema.safeParse({ ...value, cuatrimestre: "OTRO" }).success).toBe(false);
  });
});
