// @vitest-environment jsdom
// The guard remains unchanged; only volatile form state survives temporary checks.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { SessionIdleMonitor } from "@/components/auth/SessionIdleMonitor";
import { FeedbackForm } from "@/components/feedback/FeedbackForm";
import { FeedbackDraftProvider } from "@/components/feedback/FeedbackDraftProvider";
import type { AuthContextValue } from "@/components/auth/AuthProvider";
import type { SessionStatus } from "@/types/session";
import { obtenerComision } from "@/services/academic";
import { obtenerFeedbackPropio, obtenerNormasConvivencia, crearFeedback } from "@/services/feedback";

const { auth, router, service } = vi.hoisted(() => ({
  auth: { value: {} as AuthContextValue }, router: { push: vi.fn(), replace: vi.fn() },
  service: { getStatus: vi.fn(), activity: vi.fn(), renew: vi.fn(), expire: vi.fn(), close: vi.fn(), subscribe: vi.fn() },
}));
vi.mock("next/link", () => import("./support/next-link"));
vi.mock("next/navigation", () => ({ useRouter: () => router, usePathname: () => "/home/feedback/nuevo", useSearchParams: () => new URLSearchParams("origen=inicio&comisionId=c1") }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => auth.value }));
vi.mock("@/services/academic", () => ({ obtenerComision: vi.fn() }));
vi.mock("@/services/feedback", () => ({ obtenerFeedbackPropio: vi.fn(), obtenerFeedback: vi.fn(), obtenerNormasConvivencia: vi.fn(), crearFeedback: vi.fn(), actualizarFeedback: vi.fn() }));
vi.mock("@/services/session", () => ({ getSessionService: () => service }));
const onExpire = vi.fn();
const account = { id: "u1", email: "draft-a@alu.frlp.utn.edu.ar", displayName: "Student A", role: "USER" as const };
const currentStatus = (warning = false): SessionStatus => {
  const now = Date.now(); return { serverNow: new Date(now).toISOString(), warningAt: new Date(now + (warning ? -1000 : 1680000)).toISOString(), idleExpiresAt: new Date(now + (warning ? 120000 : 1800000)).toISOString(), absoluteExpiresAt: new Date(now + 86400000).toISOString() };
};
function Surface({ monitor = false, comisionId = "c1", showForm = true }: { monitor?: boolean; comisionId?: string; showForm?: boolean }) {
  return <FeedbackDraftProvider><RequireAuth>{showForm ? <FeedbackForm comisionId={comisionId} /> : <p>Other page</p>}</RequireAuth>{monitor ? <SessionIdleMonitor accountId="u1" onExpire={onExpire} /> : null}</FeedbackDraftProvider>;
}
beforeEach(() => {
  vi.resetAllMocks();
  auth.value = { status: "authenticated", account, error: null, coordinationAvailable: true, checkSession: vi.fn() } as unknown as AuthContextValue;
  vi.mocked(obtenerComision).mockResolvedValue({ id: "c1", cursadaId: "cu1", carrera: "S", numero: 31, nombre: "S-31", activa: true, profesores: [{ id: "p1", nombreCompleto: "Ada", cargo: "TITULAR" }, { id: "p2", nombreCompleto: "Grace", cargo: "ADJUNTO" }], createdAt: "2026-11-01T00:00:00Z", deletedAt: null, cursada: { id: "cu1", anio: 2026, cuatrimestre: "ANUAL", materia: { id: "m1", nombre: "Algebra" } } });
  vi.mocked(obtenerFeedbackPropio).mockResolvedValue(null);
  vi.mocked(obtenerNormasConvivencia).mockResolvedValue({ version: "1", aceptada: true, reglas: ["Respeto."] });
  service.getStatus.mockImplementation(async () => currentStatus()); service.renew.mockImplementation(async () => currentStatus());
  service.activity.mockImplementation(async () => currentStatus()); service.expire.mockResolvedValue(null); service.close.mockResolvedValue(undefined); service.subscribe.mockReturnValue(() => {});
  HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  HTMLDialogElement.prototype.close = function () { this.open = false; };
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
async function draft(monitor = false) {
  const view = render(<Surface monitor={monitor} />); const text = await screen.findByRole("textbox", { name: "Tu experiencia" });
  fireEvent.change(text, { target: { value: "Unsaved private draft" } });
  fireEvent.click(screen.getByRole("radio", { name: "4 estrellas" }));
  fireEvent.click(screen.getByRole("radio", { name: /^Grace/ }));
  fireEvent.click(screen.getByRole("radio", { name: /^De forma an/ }));
  return { view, text: text as HTMLTextAreaElement };
}
describe("Feedback drafts under the current session guard", () => {
  it.each(["checking", "temporary-error"] as const)("restores the draft after %s unmounts FeedbackForm", async status => {
    const { view, text } = await draft();
    auth.value = { ...auth.value, status, error: status === "temporary-error" ? "Network unavailable" : null };
    view.rerender(<Surface />);
    expect(text.isConnected).toBe(false); expect(screen.queryByRole("textbox", { name: "Tu experiencia" })).toBeNull();
    if (status === "temporary-error") expect(screen.getByText("Network unavailable")).toBeTruthy();
    auth.value = { ...auth.value, status: "authenticated", error: null }; view.rerender(<Surface />);
    const restored = await screen.findByRole("textbox", { name: "Tu experiencia" });
    expect((restored as HTMLTextAreaElement).value).toBe("Unsaved private draft"); expect(restored).not.toBe(text);
    expect((screen.getByRole("radio", { name: "4 estrellas" }) as HTMLInputElement).checked).toBe(true);
    expect((screen.getByRole("radio", { name: /^Grace/ }) as HTMLInputElement).checked).toBe(true);
    expect((screen.getByRole("radio", { name: /^De forma an/ }) as HTMLInputElement).checked).toBe(true);
    expect(obtenerNormasConvivencia).toHaveBeenCalledTimes(2);
    expect(crearFeedback).not.toHaveBeenCalled();
  });
  it("removes a draft and preserves the return URL when the session expires", async () => {
    const { view, text } = await draft(); auth.value = { ...auth.value, status: "anonymous", account: null, sessionEndReason: "idle" };
    view.rerender(<Surface />); expect(text.isConnected).toBe(false); expect(screen.queryByRole("textbox")).toBeNull();
    await waitFor(() => expect(router.replace).toHaveBeenCalled());
    const url = new URL(String(router.replace.mock.calls[0][0]), "http://local"); expect(url.pathname).toBe("/login"); expect(url.searchParams.get("notice")).toBe("idle"); expect(url.searchParams.get("returnTo")).toBe("/home/feedback/nuevo?origen=inicio&comisionId=c1");
    expect(crearFeedback).not.toHaveBeenCalled();
  });
  it("does not transfer an old draft to another user after the checking transition", async () => {
    const { view } = await draft(); auth.value = { ...auth.value, status: "checking" }; view.rerender(<Surface />);
    auth.value = { ...auth.value, status: "authenticated", account: { ...account, id: "u2", displayName: "Student B" } }; view.rerender(<Surface />);
    expect((await screen.findByRole("textbox", { name: "Tu experiencia" }) as HTMLTextAreaElement).value).toBe(""); expect(screen.queryByDisplayValue("Unsaved private draft")).toBeNull(); expect(crearFeedback).not.toHaveBeenCalled();
  });
  it("keeps the same form and stars through a warning, renewal network error and explicit retry", async () => {
    const { text } = await draft(true); await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    const notify = service.subscribe.mock.calls[0]![0] as (status: SessionStatus) => void;
    await act(async () => notify(currentStatus(true)));
    const renew = await screen.findByRole("button", { name: /^Renovar sesi/ });
    service.renew.mockRejectedValueOnce(new Error("Renewal network unavailable"));
    fireEvent.click(renew); await screen.findByText("Renewal network unavailable"); expect(text.isConnected).toBe(true); expect(text.value).toBe("Unsaved private draft");
    fireEvent.click(screen.getByRole("button", { name: /^Renovar sesi/ })); await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(service.renew).toHaveBeenCalledTimes(2); expect(text.isConnected).toBe(true); expect(text.value).toBe("Unsaved private draft"); expect((screen.getByRole("radio", { name: "4 estrellas" }) as HTMLInputElement).checked).toBe(true); expect(onExpire).not.toHaveBeenCalled(); expect(crearFeedback).not.toHaveBeenCalled();
  });
  it.each(["logout", "idle"] as const)("purges after definitive %s even if the same user logs in again", async reason => {
    const { view } = await draft(); auth.value = { ...auth.value, status: "anonymous", account: null, sessionEndReason: reason }; view.rerender(<Surface />);
    auth.value = { ...auth.value, status: "authenticated", account, sessionEndReason: null }; view.rerender(<Surface />);
    expect((await screen.findByRole("textbox", { name: "Tu experiencia" }) as HTMLTextAreaElement).value).toBe("");
  });
  it("does not restore another commission after interruption", async () => {
    const { view } = await draft(); const original = await obtenerComision("c1"); vi.mocked(obtenerComision).mockClear();
    auth.value = { ...auth.value, status: "checking" }; view.rerender(<Surface />);
    vi.mocked(obtenerComision).mockResolvedValue({ ...original, id: "c2", numero: 32, nombre: "S-32" });
    auth.value = { ...auth.value, status: "authenticated" }; view.rerender(<Surface comisionId="c2" />);
    expect((await screen.findByRole("textbox", { name: "Tu experiencia" }) as HTMLTextAreaElement).value).toBe("");
  });
  it("revalidates rules and never restores a previous checkbox acceptance", async () => {
    vi.mocked(obtenerNormasConvivencia).mockResolvedValueOnce({ version: "1", aceptada: false, reglas: ["Old rules"] }).mockResolvedValueOnce({ version: "2", aceptada: false, reglas: ["Current rules"] });
    const { view } = await draft(); fireEvent.click(screen.getByRole("checkbox"));
    auth.value = { ...auth.value, status: "temporary-error" }; view.rerender(<Surface />);
    auth.value = { ...auth.value, status: "authenticated" }; view.rerender(<Surface />);
    const text = await screen.findByRole("textbox", { name: "Tu experiencia" }); expect((text as HTMLTextAreaElement).value).toBe("Unsaved private draft");
    const checkbox = screen.getByRole("checkbox") as HTMLInputElement; expect(checkbox.value).toBe("2"); expect(checkbox.checked).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Publicar comentario" })); expect(crearFeedback).not.toHaveBeenCalled(); expect(obtenerNormasConvivencia).toHaveBeenCalledTimes(2);
  });
  it("purges after successful publication without resubmitting on recovery", async () => {
    const { view } = await draft(); vi.mocked(crearFeedback).mockResolvedValue({ id: "posted" } as Awaited<ReturnType<typeof crearFeedback>>);
    fireEvent.click(screen.getByRole("button", { name: "Publicar comentario" })); await waitFor(() => expect(router.push).toHaveBeenCalled());
    auth.value = { ...auth.value, status: "checking" }; view.rerender(<Surface />); auth.value = { ...auth.value, status: "authenticated" }; view.rerender(<Surface />);
    expect((await screen.findByRole("textbox", { name: "Tu experiencia" }) as HTMLTextAreaElement).value).toBe(""); expect(crearFeedback).toHaveBeenCalledTimes(1);
  });
  it("does not restore drafts during ordinary navigation and does not persist to browser storage", async () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem"), getItem = vi.spyOn(Storage.prototype, "getItem"), cookie = vi.spyOn(Document.prototype, "cookie", "set");
    const indexed = { open: vi.fn() }; vi.stubGlobal("indexedDB", indexed);
    const { view } = await draft(); view.rerender(<Surface showForm={false} />); view.rerender(<Surface />);
    expect((await screen.findByRole("textbox", { name: "Tu experiencia" }) as HTMLTextAreaElement).value).toBe("");
    expect(setItem).not.toHaveBeenCalled(); expect(getItem).not.toHaveBeenCalled(); expect(cookie).not.toHaveBeenCalled(); expect(indexed.open).not.toHaveBeenCalled(); vi.unstubAllGlobals();
  });

  it("does not transfer local fields or cached resources when the confirmed account changes directly", async () => {
    const { view } = await draft();
    auth.value = { ...auth.value, account: { ...account, id: "u2", displayName: "Student B" } };
    view.rerender(<Surface />);
    expect((await screen.findByRole("textbox", { name: "Tu experiencia" }) as HTMLTextAreaElement).value).toBe("");
    expect((screen.getByRole("radio", { name: "4 estrellas" }) as HTMLInputElement).checked).toBe(false);
    expect(crearFeedback).not.toHaveBeenCalled();
  });

  it("revalidates the selected professor against the current commission assignments", async () => {
    const { view } = await draft(); const original = await obtenerComision("c1");
    auth.value = { ...auth.value, status: "checking" }; view.rerender(<Surface />);
    vi.mocked(obtenerComision).mockResolvedValue({ ...original, profesores: [original.profesores[0]!] });
    auth.value = { ...auth.value, status: "authenticated" }; view.rerender(<Surface />);
    expect((await screen.findByRole("textbox", { name: "Tu experiencia" }) as HTMLTextAreaElement).value).toBe("Unsaved private draft");
    expect(screen.queryByRole("radio", { name: /^Grace/ })).toBeNull();
    expect((screen.getByRole("radio", { name: /^Ada/ }) as HTMLInputElement).checked).toBe(true);
    vi.mocked(crearFeedback).mockResolvedValue({ id: "posted" } as Awaited<ReturnType<typeof crearFeedback>>);
    fireEvent.click(screen.getByRole("button", { name: "Publicar comentario" }));
    await waitFor(() => expect(crearFeedback).toHaveBeenCalledOnce());
    expect(crearFeedback).toHaveBeenCalledWith("c1", { texto: "Unsaved private draft", anonimo: true, puntuacion: 4 });
  });

});
