// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PaginatedListView } from "@/components/ui/PaginatedListView";
import { HttpError } from "@/services/http";

afterEach(cleanup);

const pageOf = (items: string[], total = items.length) => ({ items, total, page: 1, pageSize: 10 });

function setup(fetchPage: (page: number) => Promise<ReturnType<typeof pageOf>>, extra: { notFoundAction?: React.ReactNode } = {}) {
  const onPageChange = vi.fn();
  render(<PaginatedListView resetKey="r" page={1} onPageChange={onPageChange} fetchPage={fetchPage} loadingMessage="Cargando ítems…" empty={<p>No hay ítems.</p>} {...extra}>
    {(result) => <>
      <p>{result.total} en total</p>
      <ul>{result.items.map((item) => <li key={item}>{item}</li>)}</ul>
    </>}
  </PaginatedListView>);
  return { onPageChange };
}

describe("PaginatedListView", () => {
  it("muestra la carga mientras espera", () => {
    setup(() => new Promise(() => {}));
    expect(screen.getByRole("status").textContent).toBe("Cargando ítems…");
  });

  it("muestra los ítems, el resumen que arma children y la paginación", async () => {
    const { onPageChange } = setup(async () => pageOf(["a", "b"], 25));
    expect(await screen.findByText("a")).toBeTruthy();
    expect(screen.getByText("25 en total")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Página siguiente" }));
    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it("muestra el estado vacío", async () => {
    setup(async () => pageOf([]));
    expect(await screen.findByText("No hay ítems.")).toBeTruthy();
    expect(screen.queryByRole("navigation")).toBeNull();
  });

  it("ante un error muestra el mensaje y Reintentar vuelve a pedir", async () => {
    const fetchPage = vi.fn().mockRejectedValueOnce(new Error("Servicio no disponible")).mockResolvedValue(pageOf(["a"]));
    setup(fetchPage, { notFoundAction: <a href="/volver">Volver</a> });
    expect((await screen.findByRole("alert")).textContent).toContain("Servicio no disponible");
    expect(screen.queryByRole("link", { name: "Volver" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(await screen.findByText("a")).toBeTruthy();
    expect(fetchPage).toHaveBeenCalledTimes(2);
  });

  it("ante un 404, notFoundAction reemplaza a Reintentar", async () => {
    setup(() => Promise.reject(new HttpError(404, "No encontramos esta cursada.")), { notFoundAction: <a href="/volver">Volver</a> });
    expect((await screen.findByRole("alert")).textContent).toContain("No encontramos esta cursada.");
    expect(screen.getByRole("link", { name: "Volver" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Reintentar" })).toBeNull();
  });
});
