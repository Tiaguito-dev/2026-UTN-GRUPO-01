import { config } from "dotenv";
import { resolve } from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.js";

config({
  path: [resolve(process.cwd(), ".env"), resolve(process.cwd(), "../.env")],
  quiet: true,
});

/**
 * Datos de QA para las cinco carreras; el catálogo adicional es ilustrativo (Demo).
 * Sistemas: materias / nivel del plan CARRERA(2).pdf aportado para HU-12.
 * Otras carreras: materias ilustrativas, no planes oficiales.
 * Docentes, cursadas, comisiones, cargos y vigencia son FICTICIOS.
 *
 * Seed ADITIVO e IDEMPOTENTE: no elimina ni sobrescribe filas existentes.
 * Puede añadir asociaciones faltantes a materias y comisiones ya creadas.
 * NOTA: si una materia ya existe con otro año/carrera, no lo corrige.
 * Ejecutar solo en una base local o aislada de QA, nunca directamente en producción.
 */
import { MATERIAS } from "./seed-academic-data.js";

async function seed(): Promise<void> {
  const connectionString = process.env["DATABASE_URL"];
  if (!connectionString) {
    console.error("Defina DATABASE_URL para cargar el contenido de demostración.");
    process.exitCode = 1;
    return;
  }
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  try {
    let materiasCreadas = 0, cursadasCreadas = 0, comisionesCreadas = 0, profesoresCreados = 0;
    // Profesor.nombreCompleto no es único a propósito (puede haber homónimos reales),
    // así que la idempotencia se resuelve buscando por nombre antes de crear.
    const profesorId = async (nombreCompleto: string): Promise<string> => {
      const existente = await prisma.profesor.findFirst({ where: { nombreCompleto, deletedAt: null } });
      if (existente) return existente.id;
      const nuevo = await prisma.profesor.create({ data: { nombreCompleto } });
      profesoresCreados += 1;
      return nuevo.id;
    };

    for (const materiaSeed of MATERIAS) {
      const existente = await prisma.materia.findFirst({ where: { nombre: materiaSeed.nombre, deletedAt: null } });
      const materia = existente ?? await prisma.materia.create({
        data: { nombre: materiaSeed.nombre },
      });
      if (!existente) materiasCreadas += 1;
      await prisma.materiaCarrera.createMany({
        data: materiaSeed.carreras.map((fila) => ({ materiaId: materia.id, ...fila })),
        skipDuplicates: true,
      });

      for (const cursadaSeed of materiaSeed.cursadas) {
        const cursadaExistente = await prisma.cursada.findFirst({
          where: { materiaId: materia.id, anio: cursadaSeed.anio, cuatrimestre: cursadaSeed.cuatrimestre, deletedAt: null },
        });
        const cursada = cursadaExistente ?? await prisma.cursada.create({
          data: { materiaId: materia.id, anio: cursadaSeed.anio, cuatrimestre: cursadaSeed.cuatrimestre },
        });
        if (!cursadaExistente) cursadasCreadas += 1;

        for (const comisionSeed of cursadaSeed.comisiones) {
          const comisionExistente = await prisma.comision.findFirst({
            where: { cursadaId: cursada.id, carrera: comisionSeed.carrera, numero: comisionSeed.numero, deletedAt: null },
          });
          const comision = comisionExistente ?? await prisma.comision.create({
            data: { cursadaId: cursada.id, carrera: comisionSeed.carrera, numero: comisionSeed.numero, activa: comisionSeed.activa ?? true },
          });
          if (!comisionExistente) comisionesCreadas += 1;
          const asignaciones = [];
          for (const [nombreCompleto, cargo] of comisionSeed.profesores) {
            asignaciones.push({ comisionId: comision.id, profesorId: await profesorId(nombreCompleto), cargo });
          }
          await prisma.comisionProfesor.createMany({ data: asignaciones, skipDuplicates: true });
        }
      }
    }
    console.log(`Contenido de demostración listo. Nuevos: ${materiasCreadas} materias, ${profesoresCreados} profesores, ${cursadasCreadas} cursadas, ${comisionesCreadas} comisiones.`);
    console.log("El seed es aditivo: no se eliminaron ni sobrescribieron registros existentes.");
  } catch {
    console.error("No se pudo cargar el contenido de demostración. Revise DATABASE_URL y que las migraciones estén aplicadas.");
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect().catch(() => {
      console.error("No se pudo cerrar la conexión del seed.");
      process.exitCode = 1;
    });
  }
}

await seed();
