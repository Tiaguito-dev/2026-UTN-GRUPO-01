import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { Client } from "pg";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const databaseUrl = process.env["TEST_DATABASE_URL"];
const migration = new URL("../prisma/migrations/20261103000000_modalidad_materia_cursada_anual/migration.sql", import.meta.url);
const compatibility = new URL("../prisma/migrations/20261104000000_compatibilidad_periodos_cursada/migration.sql", import.meta.url);

// Schema-local legacy fixtures exercise the real SQL without rewriting application test data.
describe.skipIf(!databaseUrl)("Migración de modalidad sin pérdida de datos", () => {
  let client: Client;
  let schema: string;
  beforeEach(async () => {
    schema = `modalidad_test_${randomUUID().replaceAll("-", "")}`;
    client = new Client({ connectionString: databaseUrl });
    await client.connect();
    await client.query(`CREATE SCHEMA "${schema}"; SET search_path TO "${schema}"`);
    await client.query(`
      CREATE TYPE "Cuatrimestre" AS ENUM ('PRIMERO', 'SEGUNDO', 'ANUAL');
      CREATE TABLE "Materia" (id text PRIMARY KEY);
      CREATE TABLE "Cursada" (id text PRIMARY KEY, "materiaId" text NOT NULL, anio int NOT NULL, cuatrimestre "Cuatrimestre" NOT NULL, "deletedAt" timestamptz);
      CREATE UNIQUE INDEX "Cursada_materiaId_anio_cuatrimestre_key" ON "Cursada" ("materiaId", anio, cuatrimestre);
      CREATE TABLE "Feedback" (id text PRIMARY KEY, texto text NOT NULL, cuatrimestre "Cuatrimestre" NOT NULL);
    `);
  });
  afterEach(async () => {
    if (client) {
      await client.query("ROLLBACK");
      await client.query("SET search_path TO public");
      await client.query(`DROP SCHEMA "${schema}" CASCADE`);
      await client.end();
    }
  });
  it("conserva IDs y texto, infiere solo materias consistentes y usa el snapshot propio del comentario", async () => {
    await client.query(`
      INSERT INTO "Materia" VALUES ('consistent'), ('conflict'), ('unknown');
      INSERT INTO "Cursada" VALUES ('c1','consistent',2025,'PRIMERO',NULL),('c2','consistent',2026,'PRIMERO',NULL),('c3','conflict',2025,'PRIMERO',NULL),('c4','conflict',2026,'SEGUNDO',NULL);
      INSERT INTO "Feedback" VALUES ('f1','Texto preservado','SEGUNDO');
    `);
    await client.query(await readFile(migration, "utf8"));
    expect((await client.query('SELECT id, modalidad FROM "Materia" ORDER BY id')).rows).toEqual([
      { id: "conflict", modalidad: null }, { id: "consistent", modalidad: "PRIMERO" }, { id: "unknown", modalidad: null },
    ]);
    expect((await client.query('SELECT id, texto, cuatrimestre, modalidad FROM "Feedback"')).rows).toEqual([{ id: "f1", texto: "Texto preservado", cuatrimestre: "SEGUNDO", modalidad: "SEGUNDO" }]);
    expect((await client.query('SELECT id FROM "Cursada" ORDER BY id')).rows.map(row => row.id)).toEqual(["c1", "c2", "c3", "c4"]);
    await client.query(`INSERT INTO "Cursada" VALUES ('other-period','consistent',2026,'SEGUNDO',NULL)`);
    await expect(client.query(`INSERT INTO "Cursada" VALUES ('duplicate','consistent',2026,'SEGUNDO',NULL)`)).rejects.toMatchObject({ code: "23505" });
    await client.query(`INSERT INTO "Cursada" VALUES ('annual','unknown',2026,NULL,NULL)`);
  });
  it("conserva períodos diferentes del mismo año, incluso con una baja, sin fusionar filas", async () => {
    await client.query(`INSERT INTO "Materia" VALUES ('m1'); INSERT INTO "Cursada" VALUES ('a','m1',2026,'PRIMERO',NULL),('b','m1',2026,'SEGUNDO',now());`);
    await client.query(await readFile(migration, "utf8"));
    await client.query(await readFile(compatibility, "utf8"));
    expect((await client.query('SELECT id FROM "Cursada" ORDER BY id')).rows).toEqual([{ id: "a" }, { id: "b" }]);
    expect((await client.query('SELECT modalidad FROM "Materia" WHERE id=\'m1\'')).rows).toEqual([{ modalidad: null }]);
  });
  it("corrige la unicidad anual de una instalación anterior sin inventar períodos legados", async () => {
    await client.query(`INSERT INTO "Materia" VALUES ('m1')`);
    await client.query(await readFile(migration, "utf8"));
    await client.query(`DROP INDEX "Cursada_materiaId_anio_cuatrimestre_key";
      CREATE UNIQUE INDEX "Cursada_materiaId_anio_key" ON "Cursada" ("materiaId", anio);
      INSERT INTO "Cursada" VALUES ('legacy','m1',2026,NULL,NULL);`);
    await client.query(await readFile(compatibility, "utf8"));
    await client.query(`INSERT INTO "Cursada" VALUES ('period','m1',2026,'SEGUNDO',NULL)`);
    expect((await client.query('SELECT id, cuatrimestre FROM "Cursada" ORDER BY id')).rows).toEqual([
      { id: "legacy", cuatrimestre: null }, { id: "period", cuatrimestre: "SEGUNDO" },
    ]);
  });
});
