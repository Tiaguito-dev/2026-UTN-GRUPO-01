import { describe, expect, it } from "vitest";
import { CARGO_LABEL, CARGO_TONE, cargoLabel } from "@/lib/format/cargo";

describe("cargo formatting (TASK-053)", () => {
  it("asigna la etiqueta y el tono adecuado para cada cargo docente", () => {
    expect(CARGO_LABEL.TITULAR).toBe("Titular");
    expect(CARGO_TONE.TITULAR).toBe("solid");
    expect(cargoLabel("TITULAR")).toBe("Titular");

    expect(CARGO_LABEL.ADJUNTO).toBe("Adjunto");
    expect(CARGO_TONE.ADJUNTO).toBe("soft");
    expect(cargoLabel("ADJUNTO")).toBe("Adjunto");

    expect(CARGO_LABEL.JTP).toBe("JTP");
    expect(CARGO_TONE.JTP).toBe("outline");
    expect(cargoLabel("JTP")).toBe("JTP");
  });
});
