import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { Client } from "pg";
import { describe, expect, it } from "vitest";

const databaseUrl = process.env["TEST_DATABASE_URL"];
describe.skipIf(!databaseUrl)("HU-C03 migración sobre sugerencias existentes", () => {
  it("agrega defaults sin alterar contenido, autor, fecha ni clave única", async () => {
    const client = new Client({ connectionString: databaseUrl }); await client.connect();
    const schema = `inbox_${randomUUID().replaceAll("-", "")}`; const user = randomUUID(); const id = randomUUID(); const key = randomUUID();
    try {
      await client.query(`CREATE SCHEMA "${schema}"; SET search_path TO "${schema}"; CREATE TABLE "User" (id UUID PRIMARY KEY)`);
      await client.query(await readFile(new URL("../prisma/migrations/20261118010000_sugerencias/migration.sql", import.meta.url), "utf8"));
      await client.query('INSERT INTO "User" VALUES ($1)', [user]);
      await client.query('INSERT INTO "Sugerencia" (id,"usuarioId","solicitudId",categoria,contenido,"createdAt") VALUES ($1,$2,$3,$4,$5,$6)', [id, user, key, "OTROS", "Contenido anterior", "2026-11-01T10:00:00Z"]);
      await client.query(await readFile(new URL("../prisma/migrations/20261118020000_administrar_sugerencias/migration.sql", import.meta.url), "utf8"));
      expect((await client.query('SELECT * FROM "Sugerencia"')).rows).toEqual([{ id, usuarioId: user, solicitudId: key, categoria: "OTROS", contenido: "Contenido anterior", createdAt: new Date("2026-11-01T10:00:00Z"), meGusta: false, deletedAt: null }]);
      await expect(client.query('INSERT INTO "Sugerencia" (id,"usuarioId","solicitudId",categoria,contenido) VALUES ($1,$2,$3,$4,$5)', [randomUUID(), user, key, "OTROS", "Duplicada"])).rejects.toMatchObject({ code: "23505" });
    } finally { await client.query("SET search_path TO public"); await client.query(`DROP SCHEMA "${schema}" CASCADE`); await client.end(); }
  });
});
