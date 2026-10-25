// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { AdminPanel } from "@/components/admin/AdminPanel";
import { regionOf } from "./support/region";

vi.mock("next/link", () => import("./support/next-link"));

afterEach(cleanup);

const href = (scope: HTMLElement, name: RegExp) => within(scope).getByRole("link", { name }).getAttribute("href");

describe("AdminPanel (TASK-043)", () => {
  it("Oferta académica: tarjetas Materias, Cursadas, Comisiones y Profesores con alta y listado", () => {
    render(<AdminPanel />);
    const oferta = regionOf(screen.getByRole("heading", { level: 2, name: "Oferta académica" }));
    expect(within(oferta).getAllByRole("heading", { level: 3 }).map((h) => h.textContent)).toEqual(["Materias", "Cursadas", "Comisiones", "Profesores"]);

    // Decision 3: no global listing of cursadas or comisiones, "Ver todas" goes to the hierarchy entry.
    const cards = [
      { title: "Materias", nueva: /^Nueva/, nuevaHref: "/home/admin/materias/nueva", ver: /^Ver todas/, verHref: "/home/materias" },
      { title: "Cursadas", nueva: /^Nueva/, nuevaHref: "/home/admin/cursadas/nueva", ver: /^Ver todas/, verHref: "/home/materias" },
      { title: "Comisiones", nueva: /^Nueva/, nuevaHref: "/home/admin/comisiones/nueva", ver: /^Ver todas/, verHref: "/home/materias" },
      { title: "Profesores", nueva: /^Nuevo/, nuevaHref: "/home/admin/profesores/nuevo", ver: /^Ver todos/, verHref: "/home/admin/profesores" },
    ];
    for (const card of cards) {
      const scope = regionOf(within(oferta).getByRole("heading", { level: 3, name: card.title }));
      expect(href(scope, card.nueva), card.title).toBe(card.nuevaHref);
      expect(href(scope, card.ver), card.title).toBe(card.verHref);
    }
  });

  it("Cuentas y moderación: Usuarios registrados con Ver todos, sin Revisar reportes (fuera de alcance)", () => {
    render(<AdminPanel />);
    const cuentas = regionOf(screen.getByRole("heading", { level: 2, name: "Cuentas y moderación" }));
    const usuarios = regionOf(within(cuentas).getByRole("heading", { level: 3, name: "Usuarios registrados" }));
    expect(href(usuarios, /^Ver todos/)).toBe("/home/admin/usuarios");
    expect(screen.queryByText(/Revisar reportes/)).toBeNull();
  });
});
