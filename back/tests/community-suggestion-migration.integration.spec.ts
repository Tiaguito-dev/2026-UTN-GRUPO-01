import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { Client } from "pg";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const databaseUrl = process.env["TEST_DATABASE_URL"];
const migration = new URL("../prisma/migrations/20261118010000_sugerencias/migration.sql", import.meta.url);
describe.skipIf(!databaseUrl)("HU-C02 migración de sugerencias privadas", () => {
  let client: Client; let schema: string;
  beforeEach(async () => {
    schema = `suggestion_${randomUUID().replaceAll("-", "")}`; client = new Client({ connectionString: databaseUrl }); await client.connect();
    await client.query(`CREATE SCHEMA "${schema}"; SET search_path TO "${schema}"`);
    await client.query('CREATE TABLE "User" (id UUID PRIMARY KEY); CREATE TABLE "NormasConvivencia" (id TEXT PRIMARY KEY, titulo TEXT); CREATE TABLE "AceptacionNormas" (version TEXT); INSERT INTO "NormasConvivencia" VALUES (\'vigentes\',\'Texto previamente editado\'); INSERT INTO "AceptacionNormas" VALUES (\'histórica\')');
  });
  afterEach(async () => {
    if (!client) return; await client.query("ROLLBACK"); await client.query("SET search_path TO public");
    await client.query(`DROP SCHEMA "${schema}" CASCADE`); await client.end();
  });
  it("no crea sugerencias ficticias ni cambia normas o aceptaciones previas", async () => {
    await client.query(await readFile(migration, "utf8"));
    expect((await client.query('SELECT * FROM "Sugerencia"')).rows).toEqual([]);
    expect((await client.query('SELECT * FROM "NormasConvivencia"')).rows).toEqual([{ id: "vigentes", titulo: "Texto previamente editado" }]);
    expect((await client.query('SELECT * FROM "AceptacionNormas"')).rows).toEqual([{ version: "histórica" }]);
  });
  it("persiste autor, categoría, contenido y fecha real, con unicidad por usuario y solicitud", async () => {
    await client.query(await readFile(migration, "utf8"));
    const user = randomUUID(); const other = randomUUID(); const key = randomUUID(); const id = randomUUID();
    await client.query('INSERT INTO "User" VALUES ($1),($2)', [user, other]); const start = Date.now();
    const sql = 'INSERT INTO "Sugerencia" (id,"usuarioId","solicitudId",categoria,contenido) VALUES ($1,$2,$3,$4,$5) RETURNING *';
    const row = (await client.query(sql, [id, user, key, "MEJORA_PLATAFORMA", "Una mejora privada."])).rows[0]!;
    expect(row).toMatchObject({ id, usuarioId: user, solicitudId: key, categoria: "MEJORA_PLATAFORMA", contenido: "Una mejora privada." });
    expect(row.createdAt.getTime()).toBeGreaterThanOrEqual(start - 1000); expect(row.createdAt.getTime()).toBeLessThanOrEqual(Date.now() + 1000);
    await expect(client.query(sql, [randomUUID(), user, key, "OTROS", "Duplicada"])).rejects.toMatchObject({ code: "23505" });
    await client.query(sql, [randomUUID(), other, key, "OTROS", "Otra cuenta, misma clave"]);
    await client.query(sql, [randomUUID(), user, randomUUID(), "OTROS", "Otra operación legítima"]);
    expect((await client.query('SELECT count(*)::int AS cantidad FROM "Sugerencia"')).rows).toEqual([{ cantidad: 3 }]);
  });
  it("conserva vínculo al autor y limita contenido y categoría en PostgreSQL", async () => {
    await client.query(await readFile(migration, "utf8")); const user = randomUUID();
    await client.query('INSERT INTO "User" VALUES ($1)', [user]);
    const sql = 'INSERT INTO "Sugerencia" (id,"usuarioId","solicitudId",categoria,contenido) VALUES ($1,$2,$3,$4,$5)';
    await client.query(sql, [randomUUID(), user, randomUUID(), "REPORTAR_ERROR", "x".repeat(5000)]);
    await expect(client.query(sql, [randomUUID(), user, randomUUID(), "OTROS", "x".repeat(5001)])).rejects.toMatchObject({ code: "22001" });
    await expect(client.query(sql, [randomUUID(), user, randomUUID(), "INVALIDA", "Texto"])).rejects.toMatchObject({ code: "22P02" });
    await expect(client.query('DELETE FROM "User" WHERE id=$1', [user])).rejects.toMatchObject({ code: "23503" });
  });
});
