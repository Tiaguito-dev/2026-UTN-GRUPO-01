// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { AltaForm, type AltaField } from "@/components/admin/AltaForm";
import { bloqueoDeOpciones, type RecursoDeOpciones } from "@/components/admin/opciones";

vi.mock("next/link", () => import("./support/next-link"));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }), useSearchParams: () => new URLSearchParams() }));

afterEach(cleanup);

const required = (label: string) => (value: string) => (value.trim() ? undefined : `Ingresá ${label}.`);
type Campo = "nombre" | "codigo";
const fields: AltaField<Campo>[] = [
  { name: "nombre", label: "Nombre", validate: required("el nombre") },
  { name: "codigo", label: "Código", hint: "Como figura en el plan.", validate: required("el código") },
];

function setup(onSubmit: (values: Record<Campo, string>) => Promise<string>, blocked?: ReactNode) {
  render(<AltaForm breadcrumb={[{ label: "Alta" }]} heading="Nueva materia" description="Alta de prueba." fields={fields} submitLabel="Crear materia" blocked={blocked} onSubmit={onSubmit} />);
  return { nombre: screen.getByLabelText("Nombre") as HTMLInputElement, codigo: screen.getByLabelText("Código") as HTMLInputElement, submit: screen.getByRole("button", { name: "Crear materia" }) };
}

describe("AltaForm", () => {
  it("muestra el error de cada campo y lleva el foco al primer inválido", async () => {
    const onSubmit = vi.fn();
    const { nombre, codigo, submit } = setup(onSubmit);
    await userEvent.type(nombre, "Álgebra");
    await userEvent.click(submit);
    expect(screen.getByText("Error: Ingresá el código.")).toBeTruthy();
    expect(screen.queryByText("Error: Ingresá el nombre.")).toBeNull();
    expect(codigo.getAttribute("aria-invalid")).toBe("true");
    expect(codigo.getAttribute("aria-describedby")).toBe("codigo-hint codigo-error");
    expect(document.activeElement).toBe(codigo);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("al cambiar un campo con error borra su error y su aria-invalid", async () => {
    const { nombre, codigo, submit } = setup(vi.fn());
    await userEvent.click(submit);
    await userEvent.type(nombre, "Á");
    expect(screen.queryByText("Error: Ingresá el nombre.")).toBeNull();
    expect(nombre.getAttribute("aria-invalid")).toBe("false");
    expect(screen.getByText("Error: Ingresá el código.")).toBeTruthy();
    expect(codigo.getAttribute("aria-invalid")).toBe("true");
  });

  it("bloquea un segundo envío mientras el primero está en curso", async () => {
    const onSubmit = vi.fn(() => new Promise<string>(() => {}));
    const { nombre, codigo, submit } = setup(onSubmit);
    await userEvent.type(nombre, "Álgebra");
    await userEvent.type(codigo, "ALG");
    const form = submit.closest("form")!;
    fireEvent.submit(form);
    fireEvent.submit(form);
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith({ nombre: "Álgebra", codigo: "ALG" });
    expect(await screen.findByRole("button", { name: "Guardando…" })).toHaveProperty("disabled", true);
  });

  it("al confirmar, limpia el formulario y muestra el aviso", async () => {
    const { nombre, codigo, submit } = setup(vi.fn(async () => "Materia creada."));
    await userEvent.type(nombre, "Álgebra");
    await userEvent.type(codigo, "ALG");
    await userEvent.click(submit);
    expect((await screen.findByRole("status")).textContent).toBe("Materia creada.");
    expect(nombre.value).toBe("");
    expect(codigo.value).toBe("");
  });

  it("muestra el error del backend y le da el foco", async () => {
    const { nombre, codigo, submit } = setup(vi.fn(async () => { throw new Error("Ya existe una materia con ese nombre."); }));
    await userEvent.type(nombre, "Álgebra");
    await userEvent.type(codigo, "ALG");
    await userEvent.click(submit);
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe("Ya existe una materia con ese nombre.");
    expect(document.activeElement).toBe(alert);
    expect(nombre.value).toBe("Álgebra");
  });

  it("con blocked muestra el motivo y deshabilita el envío", () => {
    const { submit } = setup(vi.fn(), <p>Cargando materias…</p>);
    expect(screen.getByText("Cargando materias…")).toBeTruthy();
    expect(submit).toHaveProperty("disabled", true);
  });

  // Lo verifica `npm run typecheck`: si `values` volviera a ser `Record<string, string>`, la
  // directiva `@ts-expect-error` quedaría sin uso y el chequeo fallaría.
  it("infiere de `fields` los nombres válidos de `values`", () => {
    const alta = <AltaForm breadcrumb={[]} heading="Alta" description="" submitLabel="Crear"
      fields={[{ name: "nombre", label: "Nombre", validate: () => undefined }]}
      onSubmit={async (values) => {
        const nombre: string = values.nombre;
        // @ts-expect-error `nombr` no es un campo declarado en `fields`.
        return `${nombre} ${values.nombr}`;
      }} />;
    expect(alta).toBeTruthy();
  });
});

describe("bloqueoDeOpciones", () => {
  // TASK-027 decision 4: the resource carries the `AsyncState` of `useAllPages` instead of `items`/`error`.
  const recurso = (overrides: Partial<RecursoDeOpciones>): RecursoDeOpciones => ({ state: { status: "ready", data: ["x"] }, retry: vi.fn(), nombre: "materias", vacio: "Primero creá una materia.", ...overrides });
  const loading = { status: "loading" } as const;
  const listo = (data: unknown[]) => ({ status: "ready", data }) as const;
  const show = (node: ReactNode) => render(<>{node}</>).container.textContent;

  it("prioriza el error sobre la carga y el vacío, con Reintentar", async () => {
    const fallido = recurso({ nombre: "cursadas", state: { status: "error", error: "No pudimos cargar las cursadas.", notFound: false } });
    render(<>{bloqueoDeOpciones([recurso({ state: loading }), recurso({ state: listo([]) }), fallido])}</>);
    expect(screen.getByRole("alert").textContent).toContain("No pudimos cargar las cursadas.");
    await userEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(fallido.retry).toHaveBeenCalledTimes(1);
  });

  it("sin errores, prioriza la carga sobre el vacío", () => {
    expect(show(bloqueoDeOpciones([recurso({ state: listo([]) }), recurso({ nombre: "profesores", state: loading })]))).toBe("Cargando profesores…");
  });

  it("sin errores ni carga, muestra el aviso de vacío", () => {
    expect(show(bloqueoDeOpciones([recurso({}), recurso({ state: listo([]) })]))).toBe("Primero creá una materia.");
  });

  it("con todo cargado devuelve null", () => {
    expect(bloqueoDeOpciones([recurso({}), recurso({ state: listo(["y", "z"]) })])).toBeNull();
  });
});
