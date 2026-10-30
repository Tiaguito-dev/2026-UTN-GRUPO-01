// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import { AdminRecordDetail } from "@/components/admin/AdminRecordDetail";
import { obtenerDetalleAdministrativo, type AdminRecord } from "@/services/admin-detail";

const nav = vi.hoisted(() => ({ query: "" }));
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(nav.query) }));
vi.mock("next/link", () => import("./support/next-link"));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ account: { id: "admin", role: "ADMIN" } }) }));
vi.mock("@/services/admin-detail", () => ({ obtenerDetalleAdministrativo: vi.fn() }));
const date = "2026-01-01T00:00:00.000Z";
const detail: AdminRecord = {
  registro: { id: "f1", texto: "Experiencia publicada", comisionId: "co1", comisionNombre: "S-31", materiaId: "m1", materiaNombre: "Álgebra", autor: { displayName: "Ana" } },
  auditoria: { id: "f1", createdAt: date, createdBy: null, updatedAt: null, updatedBy: null, deletedAt: null, deletedBy: null },
  historial: { items: [], total: 0, page: 1, pageSize: 3 },
};
const commission = { id: "co1", cursadaId: "cu1", carrera: "S", numero: 31, nombre: "S-31", activa: true, profesores: [], createdAt: date, deletedAt: null, cursada: { id: "cu1", anio: 2026, cuatrimestre: "PRIMERO", materia: { id: "m1", nombre: "Álgebra" } } };
beforeEach(() => {
  vi.clearAllMocks(); nav.query = "";
  vi.mocked(obtenerDetalleAdministrativo).mockImplementation(async (kind) => kind === "comisiones" ? { ...detail, registro: { ...commission } } : detail);
});
afterEach(cleanup);

describe("retorno del detalle administrativo de comentario", () => {
  it("breadcrumb y Volver recuperan exactamente el listado de Experiencias", async () => {
    const returnTo = "/home/admin/experiencias?carrera=S&materiaId=m1&page=4";
    nav.query = new URLSearchParams({ returnTo }).toString();
    render(<AdminRecordDetail kind="feedback" id="f1" />);
    await screen.findByText("Experiencia publicada");
    const breadcrumb = within(screen.getByRole("navigation", { name: "Ubicación actual" }));
    expect(breadcrumb.getByRole("link", { name: "Experiencias" }).getAttribute("href")).toBe(returnTo);
    expect(screen.getByRole("link", { name: /Volver a/ }).getAttribute("href")).toBe(returnTo);
  });

  it.each(["https://externo.test", "/home/admin/usuarios?page=3", "/home/admin/experiencias/f2", "/home/admin/experiencias?page=0"])("rechaza origen incompatible %s", async (returnTo) => {
    nav.query = new URLSearchParams({ returnTo }).toString();
    render(<AdminRecordDetail kind="feedback" id="f1" />);
    await screen.findByText("Experiencia publicada");
    expect(screen.getByRole("link", { name: /Volver a/ }).getAttribute("href")).toBe("/home/admin/experiencias");
  });

  it.each([
    ["/home/admin/experiencias?carrera=S&materiaId=m1&page=4", "Experiencias"],
    ["/home/admin/comisiones?materiaId=m1&cursadaId=cu1&carrera=S&page=3", "Materias"],
  ])("desde una comisión con contexto %s conserva la página de comentarios y el padre", async (origin, section) => {
    const returnTo = `/home/admin/comisiones/co1?${new URLSearchParams({ returnTo: origin, page: "2" })}`;
    nav.query = new URLSearchParams({ returnTo }).toString();
    render(<AdminRecordDetail kind="feedback" id="f1" />);
    await screen.findByText("Experiencia publicada");
    const breadcrumb = within(screen.getByRole("navigation", { name: "Ubicación actual" }));
    const source = await breadcrumb.findByRole("link", { name: "Comisión S-31" });
    expect(source.getAttribute("href")).toBe(returnTo);
    expect(breadcrumb.getByRole("link", { name: section })).toBeTruthy();
    expect(screen.getByRole("link", { name: /Volver a/ }).getAttribute("href")).toBe(returnTo);
    expect(screen.getByRole("link", { name: "Ver comisión" }).getAttribute("href")).toBe(returnTo);
    expect(breadcrumb.getByText("Detalle de comentario").getAttribute("aria-current")).toBe("page");
  });

  it("si la comisión de origen ya no existe vuelve a Experiencias sin mantener un enlace roto", async () => {
    const returnTo = `/home/admin/comisiones/co1?${new URLSearchParams({ returnTo: "/home/admin/experiencias?page=3" })}`;
    nav.query = new URLSearchParams({ returnTo }).toString();
    vi.mocked(obtenerDetalleAdministrativo).mockImplementation(async (kind) => {
      if (kind === "comisiones") throw new Error("No encontrada");
      return detail;
    });
    render(<AdminRecordDetail kind="feedback" id="f1" />);
    await screen.findByText("Experiencia publicada");
    const breadcrumb = within(screen.getByRole("navigation", { name: "Ubicación actual" }));
    await waitFor(() => expect(screen.getByRole("link", { name: /Volver a/ }).getAttribute("href")).toBe("/home/admin/experiencias"));
    expect(breadcrumb.queryByRole("link", { name: "Comisión S-31" })).toBeNull();
    expect(screen.getByRole("link", { name: /Volver a/ }).getAttribute("href")).toBe("/home/admin/experiencias");
  });

  it("no adopta como padre una comisión distinta de la del comentario", async () => {
    const returnTo = `/home/admin/comisiones/otra?${new URLSearchParams({ returnTo: "/home/admin/experiencias?page=3" })}`;
    nav.query = new URLSearchParams({ returnTo }).toString();
    vi.mocked(obtenerDetalleAdministrativo).mockImplementation(async (kind) => kind === "comisiones" ? { ...detail, registro: { ...commission, id: "otra", nombre: "S-99", numero: 99 } } : detail);
    render(<AdminRecordDetail kind="feedback" id="f1" />);
    await screen.findByText("Experiencia publicada");
    const breadcrumb = within(screen.getByRole("navigation", { name: "Ubicación actual" }));
    expect(breadcrumb.queryByRole("link", { name: "Comisión S-99" })).toBeNull();
    expect(screen.getByRole("link", { name: /Volver a/ }).getAttribute("href")).toBe("/home/admin/experiencias");
  });
});
