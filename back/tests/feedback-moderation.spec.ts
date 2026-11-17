import { describe, expect, it } from "vitest";
import { transitionFeedbackModeration, type FeedbackModerationCommand, type FeedbackModerationRecord } from "../src/reviews/domain/feedback-moderation.js";

const owner = { id: "author", role: "USER" as const };
const admin = { id: "moderator", role: "ADMIN" as const };
const stranger = { id: "stranger", role: "USER" as const };
function record(changes: Partial<FeedbackModerationRecord> = {}): FeedbackModerationRecord {
  return { autorId: owner.id, deletedAt: null, estadoModeracion: "PENDIENTE", versionModeracion: 1,
    requiereRevisionHumana: false, motivoRechazo: null, ocultoAutor: false, ocultoAdministracion: false,
    ocultoReportes: false, ...changes };
}
function command(accion: FeedbackModerationCommand["accion"], motivo?: string): FeedbackModerationCommand {
  return { accion, versionEsperada: 1, ...(accion === "APROBACION" ? { motivo: motivo ?? "Revisión completada" } : motivo === undefined ? {} : { motivo }) };
}

describe("T1: transiciones independientes de moderación", () => {
  it("aprueba pendiente ajeno sin borrar causas activas ni antecedente humano", () => {
    const original = record({ ocultoAutor: true, ocultoAdministracion: true, ocultoReportes: true, requiereRevisionHumana: true, motivoRechazo: "Anterior" });
    const result = transitionFeedbackModeration(original, admin, command("APROBACION"));
    expect(result.changed).toBe(true);
    expect(result.state).toMatchObject({ estadoModeracion: "APROBADO", versionModeracion: 2,
      ocultoAutor: true, ocultoAdministracion: true, ocultoReportes: true, requiereRevisionHumana: true });
    expect(original.estadoModeracion).toBe("PENDIENTE");
    expect(original.versionModeracion).toBe(1);
  });

  it.each([owner, stranger])("no concede moderación al USER $id", actor => {
    expect(() => transitionFeedbackModeration(record(), actor, command("APROBACION"))).toThrowError(expect.objectContaining({ httpStatus: 403 }));
    expect(() => transitionFeedbackModeration(record(), actor, command("RECHAZO", "Infracción"))).toThrowError(expect.objectContaining({ httpStatus: 403 }));
  });

  it("un ADMIN tampoco puede aprobar su propia experiencia", () => {
    expect(() => transitionFeedbackModeration(record({ autorId: admin.id }), admin, command("APROBACION"))).toThrowError(expect.objectContaining({ httpStatus: 403 }));
  });

  it.each([undefined, "", " \n "])("aprobar también exige justificación administrativa: %j", motivo => {
    expect(() => transitionFeedbackModeration(record(), admin, { accion: "APROBACION", versionEsperada: 1, ...(motivo === undefined ? {} : { motivo }) })).toThrowError(expect.objectContaining({ httpStatus: 400 }));
  });

  it.each(["PENDIENTE", "APROBADO"] as const)("rechaza %s con motivo normalizado y conserva causas", estadoModeracion => {
    const result = transitionFeedbackModeration(record({ estadoModeracion, ocultoAutor: true, ocultoReportes: true }), admin, command("RECHAZO", "  Contiene datos personales.  "));
    expect(result).toMatchObject({ changed: true, motivo: "Contiene datos personales.", state: {
      estadoModeracion: "RECHAZADO", versionModeracion: 2, motivoRechazo: "Contiene datos personales.", requiereRevisionHumana: true,
      ocultoAutor: true, ocultoReportes: true,
    } });
  });

  it.each([undefined, "", " \n ", "x".repeat(1001), "datos\u0000personales"])("rechazar exige motivo seguro: %j", motivo => {
    expect(() => transitionFeedbackModeration(record(), admin, command("RECHAZO", motivo))).toThrowError(expect.objectContaining({ httpStatus: 400 }));
  });

  it("el autor oculta aprobado conservando aprobación y las otras causas", () => {
    const result = transitionFeedbackModeration(record({ estadoModeracion: "APROBADO", ocultoAdministracion: true, ocultoReportes: true }), owner, command("OCULTAMIENTO_AUTOR"));
    expect(result.state).toMatchObject({ estadoModeracion: "APROBADO", ocultoAutor: true, ocultoAdministracion: true, ocultoReportes: true, versionModeracion: 2 });
  });

  it.each([stranger, admin])("ocultamiento voluntario exige autoría incluso para $role", actor => {
    expect(() => transitionFeedbackModeration(record({ estadoModeracion: "APROBADO" }), actor, command("OCULTAMIENTO_AUTOR"))).toThrowError(expect.objectContaining({ httpStatus: 403 }));
  });

  it.each(["PENDIENTE", "RECHAZADO"] as const)("el autor no oculta ni restaura %s como publicado", estadoModeracion => {
    expect(() => transitionFeedbackModeration(record({ estadoModeracion }), owner, command("OCULTAMIENTO_AUTOR"))).toThrowError(expect.objectContaining({ httpStatus: 409 }));
    expect(() => transitionFeedbackModeration(record({ estadoModeracion, ocultoAutor: true }), owner, command("RESTITUCION_AUTOR"))).toThrowError(expect.objectContaining({ httpStatus: 409 }));
  });

  it("restitución voluntaria no levanta ocultamientos administrativos o preventivos", () => {
    for (const cause of ["ocultoAdministracion", "ocultoReportes"] as const) {
      const original = record({ estadoModeracion: "APROBADO", ocultoAutor: true, [cause]: true });
      expect(() => transitionFeedbackModeration(original, owner, command("RESTITUCION_AUTOR"))).toThrowError(expect.objectContaining({ httpStatus: 409 }));
      expect(original[cause]).toBe(true);
    }
    expect(transitionFeedbackModeration(record({ estadoModeracion: "APROBADO", ocultoAutor: true }), owner, command("RESTITUCION_AUTOR")).state.ocultoAutor).toBe(false);
  });

  it("ADMIN oculta y levanta solo su causa, con justificación", () => {
    const hidden = transitionFeedbackModeration(record({ estadoModeracion: "APROBADO", ocultoAutor: true, ocultoReportes: true }), admin, command("OCULTAMIENTO_ADMIN", "Revisión preventiva"));
    expect(hidden.state).toMatchObject({ estadoModeracion: "APROBADO", ocultoAdministracion: true, ocultoAutor: true, ocultoReportes: true });
    const restored = transitionFeedbackModeration({ ...record(), ...hidden.state }, admin, { ...command("RESTITUCION_ADMIN", "Revisión completada"), versionEsperada: 2 });
    expect(restored.state).toMatchObject({ estadoModeracion: "APROBADO", ocultoAdministracion: false, ocultoAutor: true, ocultoReportes: true, versionModeracion: 3 });
  });

  it.each(["OCULTAMIENTO_ADMIN", "RESTITUCION_ADMIN"] as const)("%s exige motivo y ADMIN", accion => {
    const original = record({ estadoModeracion: "APROBADO", ocultoAdministracion: true });
    expect(() => transitionFeedbackModeration(original, admin, command(accion))).toThrowError(expect.objectContaining({ httpStatus: 400 }));
    expect(() => transitionFeedbackModeration(original, owner, command(accion, "Motivo"))).toThrowError(expect.objectContaining({ httpStatus: 403 }));
  });

  it("reenvío exige autor y texto corregido; mantiene revisión humana y causas", () => {
    const rejected = record({ estadoModeracion: "RECHAZADO", requiereRevisionHumana: true, motivoRechazo: "Ataque personal", ocultoAdministracion: true });
    expect(() => transitionFeedbackModeration(rejected, owner, command("SOLICITUD_REVISION"))).toThrowError(expect.objectContaining({ httpStatus: 409 }));
    expect(() => transitionFeedbackModeration(rejected, stranger, command("SOLICITUD_REVISION"), true)).toThrowError(expect.objectContaining({ httpStatus: 403 }));
    const result = transitionFeedbackModeration(rejected, owner, command("SOLICITUD_REVISION"), true);
    expect(result.state).toMatchObject({ estadoModeracion: "PENDIENTE", requiereRevisionHumana: true, ocultoAdministracion: true, versionModeracion: 2 });
  });

  it("rechazado no se aprueba directamente sin solicitar revisión", () => {
    expect(() => transitionFeedbackModeration(record({ estadoModeracion: "RECHAZADO" }), admin, command("APROBACION"))).toThrowError(expect.objectContaining({ httpStatus: 409 }));
  });

  it("versión obsoleta rechaza incluso un reintento sin cambios", () => {
    const original = record({ estadoModeracion: "APROBADO", ocultoAutor: true, versionModeracion: 2 });
    expect(() => transitionFeedbackModeration(original, owner, command("OCULTAMIENTO_AUTOR"))).toThrowError(expect.objectContaining({ httpStatus: 409 }));
  });

  it("causa ya activa autorizada es no-op y no incrementa versión", () => {
    const original = record({ estadoModeracion: "APROBADO", ocultoAutor: true });
    expect(transitionFeedbackModeration(original, owner, command("OCULTAMIENTO_AUTOR"))).toMatchObject({ changed: false, state: { versionModeracion: 1, ocultoAutor: true } });
  });

  it("no permite decisiones sobre una baja lógica", () => {
    expect(() => transitionFeedbackModeration(record({ deletedAt: new Date() }), admin, command("APROBACION"))).toThrowError(expect.objectContaining({ httpStatus: 404 }));
  });

  it.each([0, -1, 1.5, Number.NaN])("rechaza versión esperada inválida %s", versionEsperada => {
    expect(() => transitionFeedbackModeration(record(), admin, { ...command("APROBACION"), versionEsperada })).toThrowError(expect.objectContaining({ httpStatus: 400 }));
  });

  it("no desborda el entero de PostgreSQL al persistir otra decisión", () => {
    expect(() => transitionFeedbackModeration(record({ versionModeracion: 2_147_483_647 }), admin, { ...command("APROBACION"), versionEsperada: 2_147_483_647 })).toThrowError(expect.objectContaining({ httpStatus: 409 }));
  });
});
