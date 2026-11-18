// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MisExperiencias } from "@/components/feedback/MisExperiencias";
import { listarFeedbackPropios, ocultarFeedback, restaurarFeedback } from "@/services/feedback";
import { HttpError } from "@/services/http";
import type { FeedbackOwn } from "@/types/feedback";

vi.mock("next/link", () => import("./support/next-link"));
vi.mock("@/hooks/useIsAdmin", () => ({ useIsAdmin: () => false }));
vi.mock("@/hooks/useUrlPagination", () => ({ useUrlPagination: () => ({ page: 1, setPage: vi.fn() }) }));
vi.mock("@/services/feedback", () => ({ listarFeedbackPropios: vi.fn(), ocultarFeedback: vi.fn(), restaurarFeedback: vi.fn() }));

const item: FeedbackOwn = {
  id: "f1", texto: "Texto propio", puntuacion: 4, anonimo: true, autor: null, propio: true, profesor: null,
  contexto: { comisionId: "c1", nombre: "S-1", materiaId: "m1", materiaNombre: "Materia", cursadaId: "cu1", anio: 2026, cuatrimestre: null },
  createdAt: "2026-11-17", updatedAt: "2026-11-17", estadoModeracion: "APROBADO", versionModeracion: 7,
  requiereRevisionHumana: false, motivoRechazo: null, ocultoAutor: false, ocultoAdministracion: false, ocultoReportes: false,
};
const result = (feedback: FeedbackOwn) => ({ items: [feedback], page: 1, pageSize: 9, total: 1 });
const confirm = () => within(screen.getByRole("dialog")).getByRole("button", { name: /^Confirmar/ });

beforeEach(() => {
  vi.resetAllMocks();
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute("open"); };
  vi.mocked(listarFeedbackPropios).mockResolvedValue(result(item));
});
afterEach(cleanup);

describe("Mis experiencias: visibilidad y acciones directas", () => {
  it.each(Array.from({ length: 8 }, (_, mask) => mask))("comunica todas las causas simultáneas sin afirmar publicación: %s", async mask => {
    vi.mocked(listarFeedbackPropios).mockResolvedValue(result({ ...item, ocultoAutor: Boolean(mask & 1), ocultoAdministracion: Boolean(mask & 2), ocultoReportes: Boolean(mask & 4) }));
    render(<MisExperiencias />);
    const card = await screen.findByRole("article");
    expect(within(card).queryByText("Visible para la comunidad") !== null).toBe(mask === 0);
    expect(within(card).queryByText("Oculta por tu decisión") !== null).toBe(Boolean(mask & 1));
    expect(within(card).queryByText("Oculta preventivamente por reportes") !== null).toBe(Boolean(mask & 4));
    if (mask & 2) expect(card.textContent).toMatch(/administraci[oó]n|administrativa/);
    if (mask & 4) expect(within(card).getByText("Pendiente de revisión administrativa")).toBeTruthy();
    expect(within(card).queryByRole("button", { name: "Mostrar experiencia" }) !== null).toBe(Boolean(mask & 1));
    if (!(mask & 1) && mask) expect(within(card).queryByRole("button", { name: "Mostrar experiencia" })).toBeNull();
    expect(within(card).getByRole("link", { name: "Ver mi experiencia" }).getAttribute("href")).toBe("/home/feedback/f1?origen=experiencias&experienciasSeccion=propias");
    expect(within(card).getByRole("link", { name: /Ver comisión/ })).toBeTruthy();
    expect(card.textContent).not.toMatch(/denunciantes|reportantes/);
  });

  it("oculta con versión y actualiza el listado sin navegar", async () => {
    const hidden = { ...item, ocultoAutor: true, versionModeracion: 8 };
    vi.mocked(ocultarFeedback).mockResolvedValue(hidden);
    render(<MisExperiencias />);
    await userEvent.click(await screen.findByRole("button", { name: "Ocultar experiencia" }));
    expect(ocultarFeedback).not.toHaveBeenCalled();
    vi.mocked(listarFeedbackPropios).mockResolvedValue(result(hidden));
    await userEvent.click(confirm());
    await waitFor(() => expect(ocultarFeedback).toHaveBeenCalledExactlyOnceWith("f1", 7));
    expect(await screen.findByText("Oculta por tu decisión")).toBeTruthy();
    expect(await screen.findByRole("button", { name: "Mostrar experiencia" })).toBeTruthy();
    expect(listarFeedbackPropios).toHaveBeenCalledTimes(2);
    expect(restaurarFeedback).not.toHaveBeenCalled();
  });

  it.each([false, true])("restaura desde la tarjeta y conserva otras restricciones: %s", async restricted => {
    vi.mocked(listarFeedbackPropios).mockResolvedValue(result({ ...item, ocultoAutor: true, ocultoReportes: restricted, ocultoAdministracion: restricted }));
    const restored = { ...item, ocultoReportes: restricted, ocultoAdministracion: restricted, versionModeracion: 8 };
    vi.mocked(restaurarFeedback).mockResolvedValue(restored);
    render(<MisExperiencias />);
    await userEvent.click(await screen.findByRole("button", { name: "Mostrar experiencia" }));
    expect(restaurarFeedback).not.toHaveBeenCalled();
    vi.mocked(listarFeedbackPropios).mockResolvedValue(result(restored));
    await userEvent.click(confirm());
    await waitFor(() => expect(restaurarFeedback).toHaveBeenCalledExactlyOnceWith("f1", 7));
    await waitFor(() => expect(screen.queryByText("Oculta por tu decisión")).toBeNull());
    if (restricted) {
      expect(await screen.findByText("Oculta preventivamente por reportes")).toBeTruthy();
      expect(screen.queryByText("Visible para la comunidad")).toBeNull();
      expect(document.body.textContent).toMatch(/permanece oculta|seguirá oculta/);
    } else expect(await screen.findByText("Visible para la comunidad")).toBeTruthy();
  });

  it("cancelar devuelve el foco y no cambia la experiencia", async () => {
    render(<MisExperiencias />);
    const trigger = await screen.findByRole("button", { name: "Ocultar experiencia" });
    await userEvent.click(trigger);
    await userEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Cancelar" }));
    expect(document.activeElement).toBe(trigger);
    expect(ocultarFeedback).not.toHaveBeenCalled();
    expect(screen.getByText("Visible para la comunidad")).toBeTruthy();
  });

  it("evita doble envío y comunica la carga", async () => {
    let resolve!: (value: Awaited<ReturnType<typeof ocultarFeedback>>) => void;
    vi.mocked(ocultarFeedback).mockReturnValue(new Promise(done => { resolve = done; }));
    render(<MisExperiencias />);
    await userEvent.click(await screen.findByRole("button", { name: "Ocultar experiencia" }));
    const submit = confirm();
    fireEvent.click(submit); fireEvent.click(submit);
    expect(ocultarFeedback).toHaveBeenCalledExactlyOnceWith("f1", 7);
    expect(submit.hasAttribute("disabled")).toBe(true);
    expect(screen.getByRole("dialog").textContent).toMatch(/Procesando|Ocultando/);
    await act(async () => resolve({ ...item, ocultoAutor: true, versionModeracion: 8 }));
  });

  it.each([401, 403, 404, 409, 500])("error %s es seguro y no comunica éxito", async status => {
    vi.mocked(ocultarFeedback).mockRejectedValue(new HttpError(status, '{"token":"PRIVATE_TOKEN","stack":"PrismaError"}'));
    render(<MisExperiencias />);
    await userEvent.click(await screen.findByRole("button", { name: "Ocultar experiencia" }));
    await userEvent.click(confirm());
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toMatch(/nuevamente|Volvé|Revisá|Iniciá/);
    expect(document.body.textContent).not.toMatch(/PRIVATE_TOKEN|PrismaError|[{}]/);
    if (status === 409) await waitFor(() => expect(listarFeedbackPropios).toHaveBeenCalledTimes(2));
    expect(screen.queryByText("Oculta por tu decisión")).toBeNull();
  });

  it("permite reintentar después de un error transitorio", async () => {
    vi.mocked(ocultarFeedback).mockRejectedValueOnce(new HttpError(500, "Servicio no disponible")).mockResolvedValue({ ...item, ocultoAutor: true, versionModeracion: 8 });
    render(<MisExperiencias />);
    await userEvent.click(await screen.findByRole("button", { name: "Ocultar experiencia" }));
    await userEvent.click(confirm());
    await screen.findByRole("alert");
    if (!screen.queryByRole("dialog")) await userEvent.click(screen.getByRole("button", { name: "Ocultar experiencia" }));
    vi.mocked(listarFeedbackPropios).mockResolvedValue(result({ ...item, ocultoAutor: true, versionModeracion: 8 }));
    await userEvent.click(confirm());
    expect(await screen.findByText("Oculta por tu decisión")).toBeTruthy();
    expect(ocultarFeedback).toHaveBeenCalledTimes(2);
  });

  it.each([{ propio: false }, { estadoModeracion: "PENDIENTE" as const }, { estadoModeracion: "RECHAZADO" as const }])("no ofrece mutaciones para un contrato no elegible: %o", async extra => {
    vi.mocked(listarFeedbackPropios).mockResolvedValue(result({ ...item, ...extra }));
    render(<MisExperiencias />);
    await screen.findByRole("article");
    expect(screen.queryByRole("button", { name: "Ocultar experiencia" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Mostrar experiencia" })).toBeNull();
  });
});
