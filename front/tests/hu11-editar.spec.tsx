// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EditarProfesor, EditarCursada, EditarComision } from "@/components/admin/EditarAcademico";
import { obtenerProfesor, actualizarProfesor, actualizarCursada, actualizarComision } from "@/services/admin-academic";
import { obtenerCursada, obtenerComision, listarMaterias } from "@/services/academic";
import { adminFormHref } from "@/validations/admin";
import { administrativeDetailHref, comisionDetailHref } from "@/validations/admin-academic-navigation";

const { router, state } = vi.hoisted(() => ({ router: { push: vi.fn() }, state: { search: "" } }));
vi.mock("next/link", () => import("./support/next-link"));
vi.mock("next/navigation", () => ({ useRouter: () => router, useSearchParams: () => new URLSearchParams(state.search) }));
// TASK-057: docentes se cubre con sesión ADMIN en su suite; esta suite conserva el formulario básico.
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ account: { role: "USER" } }) }));
vi.mock("@/services/admin-academic", () => ({ obtenerProfesor: vi.fn(), actualizarProfesor: vi.fn(), actualizarCursada: vi.fn(), actualizarComision: vi.fn() }));
vi.mock("@/services/academic", () => ({ obtenerCursada: vi.fn(), obtenerComision: vi.fn(), listarMaterias: vi.fn() }));
vi.mock("@/hooks/useMateria", () => ({ useMateria: () => ({ materia: { id: "m1", carreras: [{ carrera: "S" }, { carrera: "Q" }] }, error: "", retry: vi.fn() }) }));
const date = "2026-01-01T00:00:00.000Z";
const profesor = { id: "p1", nombreCompleto: "Ada Lovelace", createdAt: date, deletedAt: null };
const materia = { id: "m1", nombre: "Álgebra", carreras: [], createdAt: date, deletedAt: null };
const cursada = { id: "c1", materia: { id: "m1", nombre: "Álgebra" }, anio: 2026, cuatrimestre: "PRIMERO" as const, comisiones: 1, profesores: 1, carreras: ["S" as const] };
const comision = { id: "co1", cursadaId: "c1", nombre: "S-31", carrera: "S" as const, numero: 31, activa: true, profesores: [], createdAt: date, deletedAt: null, cursada: { id: "c1", anio: 2026, cuatrimestre: "PRIMERO" as const, materia: { id: "m1", nombre: "Álgebra" } } };
beforeEach(() => {
  vi.clearAllMocks(); state.search = "";
  vi.mocked(obtenerProfesor).mockResolvedValue(profesor);
  vi.mocked(obtenerCursada).mockResolvedValue(cursada);
  vi.mocked(obtenerComision).mockResolvedValue(comision);
  vi.mocked(listarMaterias).mockResolvedValue({ items: [materia, { ...materia, id: "m2", nombre: "Análisis" }], total: 2, page: 1, pageSize: 100 });
});
afterEach(cleanup);

describe("HU11 formularios de edición", () => {
  it.each(["profesores", "cursadas", "comisiones"] as const)("cancelar %s vuelve al mismo detalle y guardar no lo anida", async (section) => {
    const source = section === "profesores" ? "/home/admin/profesores?q=Ada&page=3" : section === "cursadas" ? "/home/admin/cursadas?materiaId=m1&page=3" : "/home/admin/experiencias?carrera=S&materiaId=m1&page=3";
    const id = section === "profesores" ? "p1" : section === "cursadas" ? "c1" : "co1";
    // BUG-02: la edición guarda un solo nivel (el detalle); solo el origen Experiencias viaja plano en él.
    const editHref = adminFormHref(`/home/admin/${section}/${id}/editar`, administrativeDetailHref(section, id, source));
    const detailHref = section === "comisiones" ? comisionDetailHref(id, source) : `/home/admin/${section}/${id}`;
    state.search = editHref.split("?")[1]!;
    render(section === "profesores" ? <EditarProfesor profesorId={id} /> : section === "cursadas" ? <EditarCursada cursadaId={id} /> : <EditarComision comisionId={id} />);
    const field = await screen.findByLabelText(section === "profesores" ? "Nombre completo" : section === "cursadas" ? "Año" : "Número de comisión") as HTMLInputElement;
    await waitFor(() => expect(field.value).toBe(section === "profesores" ? "Ada Lovelace" : section === "cursadas" ? "2026" : "31"));
    expect(screen.getByRole("link", { name: "Cancelar" }).getAttribute("href")).toBe(detailHref);
    expect(screen.getByRole("link", { name: /Volver a/ }).getAttribute("href")).toBe(detailHref);
    await userEvent.clear(field);
    await userEvent.type(field, section === "profesores" ? "Ada Byron" : section === "cursadas" ? "2027" : "32");
    await userEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
    await waitFor(() => expect(router.push).toHaveBeenCalledOnce());
    const target = new URL(String(router.push.mock.calls[0][0]), "https://local.test");
    expect(target.searchParams.has("successMessage")).toBe(true);
    target.searchParams.delete("successMessage");
    expect(`${target.pathname}${target.search}`).toBe(detailHref);
  });

  it("un link viejo con returnTo anidado vuelve al detalle sin romper", async () => {
    state.search = new URLSearchParams({ returnTo: `/home/admin/profesores/p1?${new URLSearchParams({ returnTo: "/home/admin/profesores?page=3" })}` }).toString();
    render(<EditarProfesor profesorId="p1" />);
    expect(await screen.findByLabelText("Nombre completo")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Cancelar" }).getAttribute("href")).toBe("/home/admin/profesores/p1");
  });

  it("edita el Período de cursada a Anual con PATCH parcial", async () => {
    render(<EditarCursada cursadaId="c1" />);
    const periodo = await screen.findByLabelText("Período");
    await userEvent.selectOptions(periodo, "ANUAL");
    await userEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
    await waitFor(() => expect(actualizarCursada).toHaveBeenCalledWith("c1", { cuatrimestre: "ANUAL" }));
  });
  it("precarga profesor, PATCH solo del nombre y vuelve al detalle con origen y éxito", async () => {
    state.search = new URLSearchParams({ returnTo: "/home/admin/profesores?page=3" }).toString();
    render(<EditarProfesor profesorId="p1" />);
    const input = await screen.findByLabelText("Nombre completo") as HTMLInputElement;
    await waitFor(() => expect(input.value).toBe("Ada Lovelace"));
    await userEvent.clear(input); await userEvent.type(input, "Alan Turing");
    await userEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
    await waitFor(() => expect(actualizarProfesor).toHaveBeenCalledWith("p1", { nombreCompleto: "Alan Turing" }));
    const target = new URL(router.push.mock.calls[0][0], "http://local");
    // TASK-070: convención de edición: detalle + éxito, conservando el listado para Volver.
    expect(target.pathname).toBe("/home/admin/profesores/p1");
    expect(target.searchParams.get("returnTo")).toBe("/home/admin/profesores?page=3");
    expect(target.searchParams.get("successMessage")).toBe("Profesor actualizado correctamente.");
  });
  it("sin cambios no envía PATCH y conserva el formulario", async () => {
    render(<EditarProfesor profesorId="p1" />);
    await screen.findByLabelText("Nombre completo");
    await userEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
    expect(await screen.findByText("No hay cambios para guardar.")).toBeTruthy();
    expect(actualizarProfesor).not.toHaveBeenCalled();
    expect(router.push).not.toHaveBeenCalled();
  });
  it("un error conserva el texto ingresado y permite reintentar", async () => {
    vi.mocked(actualizarProfesor).mockRejectedValueOnce(new Error("No disponible")).mockResolvedValue(profesor);
    render(<EditarProfesor profesorId="p1" />);
    const input = await screen.findByLabelText("Nombre completo") as HTMLInputElement;
    // Esperar la precarga evita escribir mientras el efecto inicial completa el formulario.
    await waitFor(() => expect(input.value).toBe("Ada Lovelace"));
    await userEvent.clear(input); await userEvent.type(input, "Alan");
    await userEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
    expect((await screen.findByRole("alert")).textContent).toContain("No disponible");
    expect(input.value).toBe("Alan");
    await userEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
    await waitFor(() => expect(actualizarProfesor).toHaveBeenCalledTimes(2));
  });
  it("deshabilita el envío mientras guarda para impedir duplicados", async () => {
    vi.mocked(actualizarProfesor).mockReturnValue(new Promise(() => {}));
    render(<EditarProfesor profesorId="p1" />);
    const input = await screen.findByLabelText("Nombre completo");
    await userEvent.type(input, " editada");
    await userEvent.dblClick(screen.getByRole("button", { name: "Guardar cambios" }));
    expect((screen.getByRole("button", { name: "Guardando…" }) as HTMLButtonElement).disabled).toBe(true);
    expect(actualizarProfesor).toHaveBeenCalledTimes(1);
  });
  it("cursada sin profesor, edita solo materia y retorna al destino en página uno", async () => {
    state.search = new URLSearchParams({ returnTo: "/home/admin/cursadas?materiaId=m1&page=3" }).toString();
    render(<EditarCursada cursadaId="c1" />);
    const input = await screen.findByLabelText("Año") as HTMLInputElement;
    await waitFor(() => expect(input.value).toBe("2026"));
    expect(screen.queryByLabelText(/Profesor/)).toBeNull();
    await userEvent.selectOptions(screen.getByLabelText("Materia"), "m2");
    await userEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
    await waitFor(() => expect(actualizarCursada).toHaveBeenCalledWith("c1", { materiaId: "m2" }));
    const target = new URL(router.push.mock.calls[0][0], "http://local");
    expect(target.pathname).toBe("/home/admin/cursadas/c1");
    // El traslado reconstruye el contexto de la materia destino y reinicia su listado.
    const destinationList = new URL(target.searchParams.get("returnTo")!, "http://local");
    expect(destinationList.pathname).toBe("/home/admin/cursadas");
    expect(Object.fromEntries(destinationList.searchParams)).toEqual({ materiaId: "m2" });
    expect(target.searchParams.get("materiaReturnTo")).toBe("/home/admin/materias");
    expect(target.searchParams.get("successMessage")).toBe("Cursada actualizada correctamente.");
  });
  it("comisión edita número sin controles de activa ni traslado", async () => {
    state.search = new URLSearchParams({ returnTo: "/home/admin/comisiones?materiaId=m1&cursadaId=c1&carrera=S&page=2" }).toString();
    render(<EditarComision comisionId="co1" />);
    const input = await screen.findByLabelText("Número de comisión") as HTMLInputElement;
    await waitFor(() => expect(input.value).toBe("31"));
    expect(screen.queryByLabelText(/Activa|Cursada/)).toBeNull();
    await userEvent.clear(input); await userEvent.type(input, "32");
    await userEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
    await waitFor(() => expect(actualizarComision).toHaveBeenCalledWith("co1", { numero: 32 }));
    const target = new URL(router.push.mock.calls[0][0], "http://local");
    expect(target.pathname).toBe("/home/admin/comisiones/co1");
    expect(target.searchParams.get("returnTo")).toBe("/home/admin/comisiones?materiaId=m1&cursadaId=c1&carrera=S&page=2");
    expect(target.searchParams.get("successMessage")).toBe("Comisión actualizada correctamente.");
  });
  it("rechaza el returnTo externo también al cancelar", async () => {
    state.search = new URLSearchParams({ returnTo: "https://evil.test" }).toString();
    render(<EditarProfesor profesorId="p1" />);
    // TASK-admin-navigation-context: sin origen válido, cancelar regresa al detalle real.
    expect((await screen.findByRole("link", { name: "Cancelar" })).getAttribute("href")).toBe("/home/admin/profesores/p1");
  });
});
