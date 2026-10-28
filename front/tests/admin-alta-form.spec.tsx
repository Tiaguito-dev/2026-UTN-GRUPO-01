// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AltaForm, AltaFormFields, type AltaField } from "@/components/admin/AltaForm";

vi.mock("next/link", () => import("./support/next-link"));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }), useSearchParams: () => new URLSearchParams() }));

afterEach(cleanup);

type Campo = "nombre";
const fields: AltaField<Campo>[] = [
  { name: "nombre", label: "Nombre", validate: (v) => (v.trim() ? undefined : "Ingresá el nombre.") },
];

describe("AltaForm y AltaFormFields", () => {
  it("sin onSuccess resetea y muestra el aviso de éxito", async () => {
    const onSubmit = vi.fn(async () => "Profesor creado.");
    render(
      <AltaForm
        breadcrumb={[{ label: "Alta" }]}
        heading="Nuevo profesor"
        description="Descripción."
        fields={fields}
        submitLabel="Crear profesor"
        onSubmit={onSubmit}
      />
    );

    const input = screen.getByLabelText("Nombre") as HTMLInputElement;
    await userEvent.type(input, "Alan Turing");
    await userEvent.click(screen.getByRole("button", { name: "Crear profesor" }));

    expect(await screen.findByRole("status")).toHaveProperty("textContent", "Profesor creado.");
    expect(input.value).toBe("");
    expect(onSubmit).toHaveBeenCalledWith({ nombre: "Alan Turing" });
  });

  it("con onSuccess lo llama con el mensaje y resetea", async () => {
    const onSubmit = vi.fn(async () => "Profesor creado.");
    const onSuccess = vi.fn();
    render(
      <AltaForm
        breadcrumb={[{ label: "Alta" }]}
        heading="Nuevo profesor"
        description="Descripción."
        fields={fields}
        submitLabel="Crear profesor"
        onSubmit={onSubmit}
        onSuccess={onSuccess}
      />
    );

    const input = screen.getByLabelText("Nombre") as HTMLInputElement;
    await userEvent.type(input, "Alan Turing");
    await userEvent.click(screen.getByRole("button", { name: "Crear profesor" }));

    expect(onSubmit).toHaveBeenCalledWith({ nombre: "Alan Turing" });
    expect(onSuccess).toHaveBeenCalledWith("Profesor creado.");
    expect(screen.queryByRole("status")).toBeNull();
    expect(input.value).toBe("");
  });

  it("AltaFormFields renderiza sin h1 ni PageHeader", () => {
    render(
      <AltaFormFields
        fields={fields}
        submitLabel="Crear profesor"
        onSubmit={vi.fn()}
      />
    );
    expect(screen.queryByRole("heading", { level: 1 })).toBeNull();
  });
});
