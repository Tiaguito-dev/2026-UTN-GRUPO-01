import { afterEach, describe, expect, it, vi } from "vitest";
import { verifyEmail, resendVerification } from "../src/services/email-verification";
import { HttpError } from "../src/services/http";
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
function setup(response: Response) { vi.stubEnv("NEXT_PUBLIC_API_URL", "http://localhost:3301"); vi.stubEnv("NEXT_PUBLIC_ALLOW_LOCAL_HTTP", "true"); const fetch = vi.fn().mockResolvedValue(response); vi.stubGlobal("fetch", fetch); return fetch; }
describe("verification client contract", () => {
  it("posts token with CSRF and no-store, supports empty success", async () => { const fetch = setup(new Response(null, { status: 204 })); await verifyEmail("opaque-token"); expect(fetch).toHaveBeenCalledWith("http://localhost:3301/auth/verify-email", expect.objectContaining({ method: "POST", cache: "no-store", credentials: "include", body: JSON.stringify({ token: "opaque-token" }) })); expect(fetch.mock.calls[0]![1].headers).toMatchObject({ "X-CSRF-Protection": "1" }); });
  it("normalizes resend email and returns generic message", async () => { const fetch = setup(new Response(JSON.stringify({ message: "Solicitud recibida" }), { status: 202 })); expect(await resendVerification(" PERSON@ALU.FRLP.UTN.EDU.AR ")).toBe("Solicitud recibida"); expect(fetch.mock.calls[0]![1].body).toBe(JSON.stringify({ email: "person@alu.frlp.utn.edu.ar" })); });
  it("preserves verification error instead of presenting success", async () => { setup(new Response(JSON.stringify({ message: "Enlace vencido" }), { status: 400 })); await expect(verifyEmail("expired")).rejects.toBeInstanceOf(HttpError); });
});
