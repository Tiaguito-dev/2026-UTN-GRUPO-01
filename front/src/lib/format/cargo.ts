import type { CargoDocente } from "@/services/academic";
import type { BadgeTone } from "@/components/ui/Badge";

export const CARGO_LABEL: Record<CargoDocente, string> = {
  TITULAR: "Titular",
  ADJUNTO: "Adjunto",
  JTP: "JTP",
};

export const CARGO_TONE: Record<CargoDocente, Extract<BadgeTone, "solid" | "soft" | "outline">> = {
  TITULAR: "solid",
  ADJUNTO: "soft",
  JTP: "outline",
};

export function cargoLabel(cargo: CargoDocente): string {
  return CARGO_LABEL[cargo] ?? cargo;
}
