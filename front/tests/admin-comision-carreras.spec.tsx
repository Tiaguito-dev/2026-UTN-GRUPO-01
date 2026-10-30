// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AltaComision } from "@/components/admin/AltaComision";
import { EditarComision, EditarCursada } from "@/components/admin/EditarAcademico";
import { crearComision, listarMaterias, listarCursadasPorMateria, obtenerCursada, obtenerComision } from "@/services/academic";
import { actualizarComision, actualizarCursada } from "@/services/admin-academic";

// Los recorridos completos de selección/envío necesitan margen con los workspaces en paralelo.
vi.setConfig({ testTimeout: 15000 });

const { router, state } = vi.hoisted(() => ({ router: { push: vi.fn(), refresh: vi.fn() }, state: { carreras: ["S"] } }));
vi.mock("next/link", () => import("./support/next-link"));
vi.mock("next/navigation", () => ({ useRouter: () => router, useSearchParams: () => new URLSearchParams() }));
// HU11: esta suite aísla carrera/número; docentes y permisos ADMIN tienen cobertura propia.
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ account: { role: "USER" } }) }));
vi.mock("@/services/academic", () => ({ crearComision: vi.fn(), listarMaterias: vi.fn(), listarCursadasPorMateria: vi.fn(), obtenerCursada: vi.fn(), obtenerComision: vi.fn() }));
vi.mock("@/services/admin-academic", () => ({ actualizarComision: vi.fn(), actualizarCursada: vi.fn(), obtenerProfesor: vi.fn(), actualizarProfesor: vi.fn() }));
vi.mock("@/hooks/useMateria", () => ({ useMateria: () => ({ materia: { carreras: state.carreras.map((carrera) => ({ carrera })) }, error: "", retry: vi.fn() }) }));
const date = "2026-01-01T00:00:00.000Z";
const materias = [
  { id: "m1", nombre: "Álgebra", carreras: [{ carrera: "S" as const, anioCarrera: "1" as const, nivelElectiva: null }], createdAt: date, deletedAt: null },
  { id: "m2", nombre: "Física", carreras: [{ carrera: "Q" as const, anioCarrera: "1" as const, nivelElectiva: null }, { carrera: "S" as const, anioCarrera: "1" as const, nivelElectiva: null }], createdAt: date, deletedAt: null },
  { id: "m3", nombre: "Sin carreras", carreras: [], createdAt: date, deletedAt: null },
];
const comision = { id: "co1", cursadaId: "c1", nombre: "S-31", carrera: "S" as const, numero: 31, activa: true, profesores: [], createdAt: date, deletedAt: null, cursada: { id: "c1", anio: 2026, cuatrimestre: "PRIMERO" as const, materia: { id: "m1", nombre: "Álgebra" } } };
beforeEach(() => {
  vi.clearAllMocks(); state.carreras = ["S"];
  vi.mocked(listarMaterias).mockResolvedValue({ items: materias, page: 1, pageSize: 100, total: 3 });
  vi.mocked(listarCursadasPorMateria).mockImplementation(async (materiaId) => ({ items: [{ id: `c-${materiaId}`, anio: 2026, cuatrimestre: "PRIMERO", comisiones: 0, profesores: 0, carreras: [] }], page: 1, pageSize: 100, total: 1 }));
  vi.mocked(crearComision).mockResolvedValue(comision);
  vi.mocked(obtenerComision).mockResolvedValue(comision);
  vi.mocked(obtenerCursada).mockResolvedValue({ id: "c1", anio: 2026, cuatrimestre: "PRIMERO", materia: { id: "m1", nombre: "Álgebra" } });
});
afterEach(cleanup);
async function elegirMateria(id: string) {
  await waitFor(() => expect(screen.getByRole("option", { name: "Álgebra" })).toBeTruthy());
  await userEvent.selectOptions(screen.getByLabelText("Materia"), id);
  await waitFor(() => expect(screen.getByRole("option", { name: /2026/ })).toBeTruthy());
  await userEvent.selectOptions(screen.getByLabelText("Cursada"), `c-${id}`);
}
it("asigna la única carrera como contexto de lectura y envía su valor", async () => {
  render(<AltaComision />); await elegirMateria("m1");
  expect(screen.queryByRole("combobox", { name: "Carrera" })).toBeNull();
  expect(screen.getByText(/Ingeniería en Sistemas/)).toBeTruthy();
  await userEvent.type(screen.getByLabelText("Número de comisión"), "31");
  await userEvent.click(screen.getByRole("button", { name: "Crear comisión" }));
  await waitFor(() => expect(crearComision).toHaveBeenCalledWith({ cursadaId: "c-m1", carrera: "S", numero: 31 }));
});
it("ofrece solo carreras de la materia y descarta la selección al cambiarla", async () => {
  render(<AltaComision />); await elegirMateria("m2");
  const carrera = screen.getByRole("combobox", { name: "Carrera" }) as HTMLSelectElement;
  expect(Array.from(carrera.options).map((option) => option.value)).toEqual(["", "Q", "S"]);
  await userEvent.selectOptions(carrera, "Q");
  await elegirMateria("m1");
  await elegirMateria("m2");
  expect((screen.getByRole("combobox", { name: "Carrera" }) as HTMLSelectElement).value).toBe("");
});
it("valida una carrera oculta manipulada antes de enviar el alta", async () => {
  render(<AltaComision />); await elegirMateria("m1");
  const hidden = document.querySelector<HTMLInputElement>('input[name="carrera"]');
  expect(hidden).toBeTruthy();
  hidden!.value = "Q";
  fireEvent.change(screen.getByLabelText("Número de comisión"), { target: { value: "31" } });
  // La carrera se obtiene de la materia, incluso si un cliente altera el control.
  hidden!.value = "Q";
  fireEvent.submit(screen.getByRole("button", { name: "Crear comisión" }).closest("form")!);
  expect(await screen.findByText(/Elegí una carrera de la materia seleccionada/)).toBeTruthy();
  expect(crearComision).not.toHaveBeenCalled();
});
it("bloquea el alta sin carreras e indica corregir la materia", async () => {
  render(<AltaComision />); await elegirMateria("m3");
  expect(screen.getByText(/asociar.*carrera.*materia/i)).toBeTruthy();
  expect((screen.getByRole("button", { name: "Crear comisión" }) as HTMLButtonElement).disabled).toBe(true);
  expect(crearComision).not.toHaveBeenCalled();
});
it("conserva los campos tras un error y permite un reintento", async () => {
  vi.mocked(crearComision).mockRejectedValueOnce(new Error("Intentá nuevamente"));
  render(<AltaComision />); await elegirMateria("m1");
  const numero = screen.getByLabelText("Número de comisión") as HTMLInputElement;
  await userEvent.type(numero, "31");
  await userEvent.click(screen.getByRole("button", { name: "Crear comisión" }));
  expect(await screen.findByText("Intentá nuevamente")).toBeTruthy();
  expect(numero.value).toBe("31"); expect(router.push).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole("button", { name: "Crear comisión" }));
  await waitFor(() => expect(crearComision).toHaveBeenCalledTimes(2));
});
it("edición de comisión con una carrera no solicita elegir y sin cambios no actualiza", async () => {
  render(<EditarComision comisionId="co1" />);
  await screen.findByLabelText("Número de comisión");
  expect(screen.queryByRole("combobox", { name: "Carrera" })).toBeNull();
  await userEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
  expect(await screen.findByText("No hay cambios para guardar.")).toBeTruthy();
  expect(actualizarComision).not.toHaveBeenCalled();
});
it("edición de período sin cambios no actualiza", async () => {
  render(<EditarCursada cursadaId="c1" />);
  await screen.findByLabelText("Año");
  await userEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
  expect(await screen.findByText("No hay cambios para guardar.")).toBeTruthy();
  expect(actualizarCursada).not.toHaveBeenCalled();
});
it("edición sin carreras explica la corrección y no permite guardar", async () => {
  state.carreras = [];
  render(<EditarComision comisionId="co1" />);
  expect(await screen.findByText(/asociar.*carrera.*materia/i)).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Guardar cambios" })).toBeNull();
  expect(actualizarComision).not.toHaveBeenCalled();
});
it("distingue las cursadas del mismo año por su período", async () => {
  vi.mocked(listarCursadasPorMateria).mockResolvedValue({
    items: [
      { id: "primero", anio: 2026, cuatrimestre: "PRIMERO", comisiones: 0, profesores: 0, carreras: [] },
      { id: "segundo", anio: 2026, cuatrimestre: "SEGUNDO", comisiones: 0, profesores: 0, carreras: [] },
    ], page: 1, pageSize: 100, total: 2,
  });
  render(<AltaComision />);
  await waitFor(() => expect(screen.getByRole("option", { name: "Álgebra" })).toBeTruthy());
  await userEvent.selectOptions(screen.getByLabelText("Materia"), "m1");
  const primero = await screen.findByRole("option", { name: "1er cuatrimestre 2026" });
  const segundo = screen.getByRole("option", { name: "2do cuatrimestre 2026" });
  expect(primero.getAttribute("value")).toBe("primero");
  expect(segundo.getAttribute("value")).toBe("segundo");
});
