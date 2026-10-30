// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { BackLink } from "@/components/ui/BackLink";

afterEach(cleanup);

describe("BackLink", () => {
  it("nombre accesible 'Volver a <destino>', href correcto y clase back-link", () => {
    render(<BackLink href="/home/materias" label="Materias" />);

    const link = screen.getByRole("link", { name: "Volver a Materias" });
    expect(link).toBeTruthy();
    expect(link.getAttribute("href")).toBe("/home/materias");
    expect(link.className).toContain("back-link");

    const svg = link.querySelector("svg");
    expect(svg).toBeTruthy();
    expect(svg?.getAttribute("aria-hidden")).toBe("true");
  });
});
