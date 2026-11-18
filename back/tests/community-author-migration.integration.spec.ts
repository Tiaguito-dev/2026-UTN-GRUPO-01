import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { Client } from "pg";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const databaseUrl = process.env["TEST_DATABASE_URL"];
const initialMigration = new URL("../prisma/migrations/20261117000000_normas_convivencia/migration.sql", import.meta.url);
const migration = new URL("../prisma/migrations/20261118000000_normas_responsable/migration.sql", import.meta.url);

describe.skipIf(!databaseUrl)("HU-C04 migración de responsable sin inventar historial", () => {
  let client: Client; let schema: string;
  beforeEach(async () => {
    schema = `normas_author_${randomUUID().replaceAll("-", "")}`;
    client = new Client({ connectionString: databaseUrl }); await client.connect();
    await client.query(`CREATE SCHEMA "${schema}"; SET search_path TO "${schema}"`);
    await client.query('CREATE TABLE "User" (id UUID PRIMARY KEY); CREATE TABLE "AceptacionNormas" ("usuarioId" UUID NOT NULL, version TEXT NOT NULL, "aceptadaEn" TIMESTAMPTZ NOT NULL)');
    await client.query(await readFile(initialMigration, "utf8"));
  });
  afterEach(async () => {
    if (!client) return;
    await client.query("ROLLBACK"); await client.query("SET search_path TO public");
    await client.query(`DROP SCHEMA "${schema}" CASCADE`); await client.end();
  });
  it("preserva documento, orden y fechas editados y deja el responsable sin atribuir", async () => {
    await client.query('UPDATE "NormasConvivencia" SET titulo=$1, normas=$2, "updatedAt"=$3', ["Título ya editado", ["Norma B", "Norma A"], new Date("2026-01-01T00:00:00Z")]);
    const before = (await client.query('SELECT * FROM "NormasConvivencia"')).rows[0]!;
    await client.query(await readFile(migration, "utf8"));
    expect((await client.query('SELECT * FROM "NormasConvivencia"')).rows).toEqual([{ ...before, actualizadoPorId: null }]);
  });
  it("no modifica ni completa aceptaciones históricas", async () => {
    await client.query('INSERT INTO "AceptacionNormas" VALUES ($1,$2,$3)', [randomUUID(), "normas-historicas", new Date("2025-01-01T00:00:00Z")]);
    const before = (await client.query('SELECT * FROM "AceptacionNormas"')).rows;
    await client.query(await readFile(migration, "utf8"));
    expect((await client.query('SELECT * FROM "AceptacionNormas"')).rows).toEqual(before);
  });
  it("la relación nullable acepta un responsable existente y evita borrarlo mientras haya trazabilidad", async () => {
    await client.query(await readFile(migration, "utf8"));
    const actor = randomUUID();
    await expect(client.query('UPDATE "NormasConvivencia" SET "actualizadoPorId"=$1', [actor])).rejects.toMatchObject({ code: "23503" });
    await client.query('INSERT INTO "User" VALUES ($1)', [actor]);
    await client.query('UPDATE "NormasConvivencia" SET "actualizadoPorId"=$1', [actor]);
    await expect(client.query('DELETE FROM "User" WHERE id=$1', [actor])).rejects.toMatchObject({ code: "23503" });
    await client.query('UPDATE "NormasConvivencia" SET "actualizadoPorId"=NULL');
    expect((await client.query('DELETE FROM "User" WHERE id=$1', [actor])).rowCount).toBe(1);
  });
});
