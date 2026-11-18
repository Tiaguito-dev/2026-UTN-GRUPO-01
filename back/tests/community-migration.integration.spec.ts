import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { Client } from "pg";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const databaseUrl = process.env["TEST_DATABASE_URL"];
const migration = new URL("../prisma/migrations/20261117000000_normas_convivencia/migration.sql", import.meta.url);
const expectedRules = [
  "Compartí experiencias reales y mensajes que sumen.", "Realizá críticas constructivas.",
  "Debatí ideas, no ataques personas.", "Evitá los insultos, la discriminación y el hate gratuito.",
  "Respetá la privacidad de los demás.", "No compartas información falsa deliberadamente.",
  "Ayudá a otros estudiantes a tomar mejores decisiones.",
];

describe.skipIf(!databaseUrl)("HU-C01 migración y carga inicial conservadora", () => {
  let client: Client; let schema: string;
  beforeEach(async () => {
    schema = `normas_test_${randomUUID().replaceAll("-", "")}`;
    client = new Client({ connectionString: databaseUrl });
    await client.connect();
    await client.query(`CREATE SCHEMA "${schema}"; SET search_path TO "${schema}"`);
  });
  afterEach(async () => {
    if (!client) return;
    await client.query("ROLLBACK");
    await client.query("SET search_path TO public");
    await client.query(`DROP SCHEMA "${schema}" CASCADE`);
    await client.end();
  });

  it("crea un único documento con el texto completo, siete normas ordenadas y fechas de base de datos", async () => {
    const before = Date.now();
    await client.query(await readFile(migration, "utf8"));
    const records = await client.query('SELECT * FROM "NormasConvivencia"');
    expect(records.rows).toHaveLength(1);
    const row = records.rows[0]!;
    expect(row.id).toBe("vigentes");
    expect(row.titulo).toBe("Construyamos una comunidad que sume");
    expect(row.introduccion).toContain("Creamos Professors' Butchery para que los estudiantes puedan compartir sus experiencias y ayudarse mutuamente.");
    expect(row.introduccion).toContain("Queremos fomentar las opiniones sinceras y las críticas constructivas, siempre desde el respeto.");
    expect(row.normas).toEqual(expectedRules);
    expect(row.cierre).toContain("Tu experiencia puede hacer la diferencia para otro estudiante.");
    expect(row.cierre).toContain("De estudiantes, para estudiantes.");
    expect(row.cierre).toContain("— El equipo de Professors' Butchery.");
    for (const date of [row.createdAt, row.updatedAt]) {
      expect(date).toBeInstanceOf(Date);
      expect(date.getTime()).toBeGreaterThanOrEqual(before - 1000);
      expect(date.getTime()).toBeLessThanOrEqual(Date.now() + 1000);
    }
  });

  it("repetir la carga inicial no duplica el singleton ni pisa una futura edición administrativa", async () => {
    const sql = await readFile(migration, "utf8");
    await client.query(sql);
    const insert = sql.slice(sql.indexOf("INSERT INTO"));
    expect(insert).toMatch(/ON CONFLICT[\s\S]+DO NOTHING/i);
    await client.query('UPDATE "NormasConvivencia" SET titulo = $1, normas = $2, "updatedAt" = $3 WHERE id = $4',
      ["Título editado por administración", ["Norma nueva primero", "Norma anterior después"], new Date("2026-11-17T10:00:00Z"), "vigentes"]);
    const before = (await client.query('SELECT * FROM "NormasConvivencia"')).rows;
    await client.query(insert);
    await client.query(insert);
    expect((await client.query('SELECT * FROM "NormasConvivencia"')).rows).toEqual(before);
  });

  it("no permite otro singleton ni una lista de normas vacía", async () => {
    await client.query(await readFile(migration, "utf8"));
    await expect(client.query('UPDATE "NormasConvivencia" SET id = $1', ["otro-documento"])).rejects.toMatchObject({ code: "23514" });
    await expect(client.query('UPDATE "NormasConvivencia" SET normas = $1', [[]])).rejects.toMatchObject({ code: "23514" });
  });
});
