import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync(new URL("../src/styles/tokens.css", import.meta.url), "utf8");
function declarations(selector: RegExp): Record<string, string> {
  const block = selector.exec(css)?.[1];
  if (!block) throw new Error(`Falta el ámbito de tokens ${selector}`);
  return Object.fromEntries([...block.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map(match => [match[1]!, match[2]!.trim()]));
}
const student = declarations(/:root\s*\{([^}]+)\}/);
const admin = { ...student, ...declarations(/\[data-role-theme="admin"\]\s*\{([^}]+)\}/) };
function color(tokens: Record<string, string>, name: string, depth = 0): string {
  if (depth > 10) throw new Error(`Alias circular ${name}`);
  const value = tokens[name];
  if (!value) throw new Error(`Token requerido ausente: ${name}`);
  const alias = /^var\((--[\w-]+)\)$/.exec(value);
  return alias ? color(tokens, alias[1]!, depth + 1) : value;
}
function luminance(hex: string): number {
  if (!/^#[\da-f]{6}$/i.test(hex)) throw new Error(`Color no soportado por esta prueba: ${hex}`);
  const values = [1, 3, 5].map(offset => parseInt(hex.slice(offset, offset + 2), 16) / 255)
    .map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
  return .2126 * values[0]! + .7152 * values[1]! + .0722 * values[2]!;
}
function contrast(tokens: Record<string, string>, foreground: string, background: string): number {
  const [first, second] = [luminance(color(tokens, foreground)), luminance(color(tokens, background))].sort((a, b) => b - a);
  return (first! + .05) / (second! + .05);
}

describe("Contraste de los tokens reales de la identidad administrativa", () => {
  it.each([
    ["--header-foreground", "--header-background"],
    ["--sidebar-text", "--sidebar-background"],
    ["--sidebar-muted", "--sidebar-background"],
    ["--sidebar-active-text", "--sidebar-active-background"],
    ["--sidebar-hover-text", "--sidebar-hover-background"],
    ["--surface", "--primary"],
  ])("texto %s sobre %s cumple WCAG AA para texto normal", (foreground, background) => {
    expect(contrast(admin, foreground, background)).toBeGreaterThanOrEqual(4.5);
  });

  it.each([
    ["--header-focus", "--header-background"],
    ["--sidebar-focus", "--sidebar-background"],
    ["--sidebar-focus", "--sidebar-active-background"],
  ])("el foco %s se distingue de %s", (foreground, background) => {
    expect(contrast(admin, foreground, background)).toBeGreaterThanOrEqual(3);
  });

  it("conserva los colores del estudiante y los estados semánticos en ambos temas", () => {
    expect(color(student, "--primary")).toBe("#990f13");
    expect(color(student, "--background")).toBe("#fcf3eb");
    expect(color(admin, "--primary")).not.toBe(color(student, "--primary"));
    for (const token of ["--background", "--surface", "--error", "--success", "--warning"]) expect(color(admin, token)).toBe(color(student, token));
  });
});
