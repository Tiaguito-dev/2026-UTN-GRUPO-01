import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { Client } from "pg";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const databaseUrl = process.env["TEST_DATABASE_URL"];
const migration = new URL("../prisma/migrations/20261117000000_feedback_moderacion/migration.sql", import.meta.url);

// Only a throwaway schema is changed, never the application's tables or migration ledger.
describe.skipIf(!databaseUrl)("T1: migración de moderación sobre datos históricos", () => {
  let client: Client;
  let schema: string;
  beforeEach(async () => {
    schema = `moderation_migration_${randomUUID().replaceAll("-", "")}`;
    client = new Client({ connectionString: databaseUrl });
    await client.connect();
    await client.query(`CREATE SCHEMA "${schema}"; SET search_path TO "${schema}"`);
    await client.query(`
      CREATE TYPE "FeedbackAccion" AS ENUM ('CREACION','EDICION','ELIMINACION');
      CREATE TABLE "Feedback" (
        id uuid PRIMARY KEY, "autorId" uuid NOT NULL, "comisionId" uuid NOT NULL,
        texto text NOT NULL, anonimo boolean NOT NULL, puntuacion integer,
        "createdAt" timestamptz NOT NULL DEFAULT now(), "deletedAt" timestamptz
      );
      CREATE TABLE "FeedbackHistorial" (
        id uuid PRIMARY KEY, "feedbackId" uuid NOT NULL REFERENCES "Feedback"(id),
        accion "FeedbackAccion" NOT NULL, texto text NOT NULL, anonimo boolean NOT NULL,
        puntuacion integer, "createdAt" timestamptz NOT NULL DEFAULT now()
      );
    `);
  });
  afterEach(async () => {
    if (!client) return;
    await client.query("ROLLBACK");
    await client.query("SET search_path TO public");
    await client.query(`DROP SCHEMA "${schema}" CASCADE`);
    await client.end();
  });
  async function insert(texto: string, deleted = false) {
    const id = randomUUID();
    await client.query('INSERT INTO "Feedback" (id,"autorId","comisionId",texto,anonimo,puntuacion,"deletedAt") VALUES ($1,$2,$3,$4,true,4,$5)', [id, randomUUID(), randomUUID(), texto, deleted ? new Date("2026-11-01T00:00:00Z") : null]);
    return id;
  }

  it("conserva contenido, identidad, anonimato, estrellas y bajas sin inventar decisiones", async () => {
    const active = await insert("Experiencia histórica");
    const deleted = await insert("Experiencia retirada", true);
    await client.query('INSERT INTO "FeedbackHistorial" (id,"feedbackId",accion,texto,anonimo,puntuacion) VALUES ($1,$2,\'CREACION\',\'Experiencia histórica\',true,4)', [randomUUID(), active]);
    const before = (await client.query('SELECT * FROM "Feedback" ORDER BY id')).rows as Record<string, unknown>[];
    await client.query(await readFile(migration, "utf8"));
    const after = (await client.query('SELECT * FROM "Feedback" ORDER BY id')).rows as Record<string, unknown>[];
    for (const row of before) {
      expect(after.find(item => item["id"] === row["id"])).toMatchObject({ ...row,
        estadoModeracion: "APROBADO", versionModeracion: 1, requiereRevisionHumana: false,
        motivoRechazo: null, ocultoAutor: false, ocultoAdministracion: false, ocultoReportes: false });
    }
    expect(after.find(row => row["id"] === deleted)?.["deletedAt"]).toEqual(new Date("2026-11-01T00:00:00Z"));
    expect((await client.query('SELECT accion,"estadoModeracion","versionModeracion","motivoModeracion" FROM "FeedbackHistorial"')).rows).toEqual([
      { accion: "CREACION", estadoModeracion: null, versionModeracion: null, motivoModeracion: null },
    ]);
  });

  it("nuevos registros quedan pendientes y snapshots legados admiten metadatos nulos", async () => {
    await client.query(await readFile(migration, "utf8"));
    const id = await insert("Nueva experiencia");
    expect((await client.query('SELECT "estadoModeracion","versionModeracion","ocultoAutor","ocultoAdministracion","ocultoReportes" FROM "Feedback" WHERE id=$1', [id])).rows).toEqual([
      { estadoModeracion: "PENDIENTE", versionModeracion: 1, ocultoAutor: false, ocultoAdministracion: false, ocultoReportes: false },
    ]);
    await client.query('INSERT INTO "FeedbackHistorial" (id,"feedbackId",accion,texto,anonimo) VALUES ($1,$2,\'CREACION\',\'Nueva experiencia\',false)', [randomUUID(), id]);
    expect((await client.query('SELECT "versionModeracion" FROM "FeedbackHistorial"')).rows).toEqual([{ versionModeracion: null }]);
  });

  it("la base rechaza versiones inválidas y rechazos sin motivo o trazabilidad humana", async () => {
    await client.query(await readFile(migration, "utf8"));
    const id = await insert("Validación persistida");
    await expect(client.query('UPDATE "Feedback" SET "versionModeracion"=0 WHERE id=$1', [id])).rejects.toMatchObject({ code: "23514" });
    await expect(client.query('UPDATE "Feedback" SET "estadoModeracion"=\'RECHAZADO\' WHERE id=$1', [id])).rejects.toMatchObject({ code: "23514" });
    await expect(client.query('UPDATE "Feedback" SET "estadoModeracion"=\'RECHAZADO\',"motivoRechazo"=\'Motivo\' WHERE id=$1', [id])).rejects.toMatchObject({ code: "23514" });
    for (const reason of ["", "   ", " sin normalizar ", "control\tno permitido"]) {
      await expect(client.query('UPDATE "Feedback" SET "estadoModeracion"=\'RECHAZADO\',"requiereRevisionHumana"=true,"motivoRechazo"=$2 WHERE id=$1', [id, reason])).rejects.toMatchObject({ code: "23514" });
    }
    await client.query('UPDATE "Feedback" SET "estadoModeracion"=\'RECHAZADO\',"requiereRevisionHumana"=true,"motivoRechazo"=\'Motivo válido\' WHERE id=$1', [id]);
    expect((await client.query('SELECT "estadoModeracion" FROM "Feedback" WHERE id=$1', [id])).rows[0]).toEqual({ estadoModeracion: "RECHAZADO" });
  });

  it("preserva causas independientes y admite las nuevas acciones históricas", async () => {
    await client.query(await readFile(migration, "utf8"));
    const id = await insert("Causas coexistentes");
    await client.query('UPDATE "Feedback" SET "ocultoAutor"=true,"ocultoAdministracion"=true,"ocultoReportes"=true WHERE id=$1', [id]);
    await client.query('UPDATE "Feedback" SET "ocultoAdministracion"=false WHERE id=$1', [id]);
    expect((await client.query('SELECT "ocultoAutor","ocultoAdministracion","ocultoReportes" FROM "Feedback" WHERE id=$1', [id])).rows).toEqual([
      { ocultoAutor: true, ocultoAdministracion: false, ocultoReportes: true },
    ]);
    for (const accion of ["APROBACION", "RECHAZO", "OCULTAMIENTO_AUTOR", "RESTITUCION_AUTOR", "OCULTAMIENTO_ADMIN", "RESTITUCION_ADMIN", "SOLICITUD_REVISION"]) {
      await client.query('INSERT INTO "FeedbackHistorial" (id,"feedbackId",accion,texto,anonimo) VALUES ($1,$2,$3,\'Snapshot\',true)', [randomUUID(), id, accion]);
    }
    expect(Number((await client.query('SELECT count(*) FROM "FeedbackHistorial"')).rows[0]?.["count"])).toBe(7);
  });
});
