import { describe, expect, it } from "vitest";
import { HttpError } from "@/services/http";
import { mensajeErrorModeracion } from "@/validations/feedback-moderation";

describe("mensajes seguros de experiencias y reportes", () => {
  const unsafe = '{"email":"privado@example.test","token":"SESSION_SECRET","stack":"PrismaClientError at repository.ts:45"}';
  it.each([0, 400, 401, 403, 404, 409, 422, 429, 500, 502])("no expone cuerpo interno HTTP %s", status => {
    const message = mensajeErrorModeracion(new HttpError(status, unsafe));
    expect(message).not.toMatch(/email|privado@|token|SESSION_SECRET|stack|Prisma|repository|[{}]/);
    expect(message.length).toBeGreaterThan(20);
  });
  it("no expone errores inesperados", () => {
    expect(mensajeErrorModeracion(new Error(unsafe))).not.toContain("SESSION_SECRET");
  });
  it.each([
    ["Corrija el contenido rechazado antes de solicitar una nueva revisión.", "corrección real"],
    ["Ya reportó esta versión con otros datos. Consulte el reporte existente.", "otros datos"],
    ["El reporte ya fue cerrado. Actualice la información.", "ya fue cerrado"],
    ["Resuelva los reportes abiertos antes de restituir la visibilidad preventiva.", "menos de tres"],
  ])("traduce conflicto de negocio conocido: %s", (server, expected) => {
    expect(mensajeErrorModeracion(new HttpError(409, server))).toContain(expected);
    expect(mensajeErrorModeracion(new HttpError(409, `${server} ${unsafe}`))).not.toContain("SESSION_SECRET");
  });
});
