import { config } from "dotenv";
import { resolve } from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, type Cuatrimestre } from "../generated/prisma/client.js";

config({
  path: [resolve(process.cwd(), ".env"), resolve(process.cwd(), "../.env")],
  quiet: true,
});

/**
 * Contenido de demostración para la jerarquía académica (ver
 * docs/temporal/05-consulta-de-contenido.md). Los nombres de materia siguen el estilo de la
 * carrera, pero LOS PROFESORES SON FICTICIOS: esta plataforma existe para que estudiantes
 * opinen sobre docentes, así que no se cargan personas reales como dato de demo.
 *
 * El seed es aditivo e idempotente: puede correrse más de una vez sin duplicar y nunca borra
 * ni modifica nada preexistente.
 */
interface ComisionSeed { nombre: string; activa?: boolean }
interface CursadaSeed { anio: number; cuatrimestre: Cuatrimestre; profesor: string; comisiones: ComisionSeed[] }
interface MateriaSeed { nombre: string; cursadas: CursadaSeed[] }

const MATERIAS: MateriaSeed[] = [
  {
    nombre: "Análisis Matemático II",
    cursadas: [
      { anio: 2026, cuatrimestre: "PRIMERO", profesor: "Mariana Rivas", comisiones: [{ nombre: "Comisión 1 - Mañana" }, { nombre: "Comisión 2 - Noche" }] },
      { anio: 2025, cuatrimestre: "SEGUNDO", profesor: "Héctor Balcedo", comisiones: [{ nombre: "Comisión 1 - Tarde" }] },
    ],
  },
  {
    nombre: "Algoritmos y Estructuras de Datos",
    cursadas: [
      { anio: 2026, cuatrimestre: "PRIMERO", profesor: "Lucía Ferreyra", comisiones: [{ nombre: "Comisión 1 - Mañana" }, { nombre: "Comisión 2 - Tarde" }] },
      { anio: 2026, cuatrimestre: "SEGUNDO", profesor: "Lucía Ferreyra", comisiones: [{ nombre: "Comisión 1 - Noche" }] },
    ],
  },
  {
    nombre: "Sistemas Operativos",
    cursadas: [
      { anio: 2026, cuatrimestre: "PRIMERO", profesor: "Daniel Ocampo", comisiones: [{ nombre: "Comisión 1 - Noche" }, { nombre: "Comisión 2 - Mañana", activa: false }] },
    ],
  },
];

async function seed(): Promise<void> {
  const connectionString = process.env["DATABASE_URL"];
  if (!connectionString) {
    console.error("Defina DATABASE_URL para cargar el contenido de demostración.");
    process.exitCode = 1;
    return;
  }
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  try {
    let materiasCreadas = 0, cursadasCreadas = 0, comisionesCreadas = 0;
    for (const materiaSeed of MATERIAS) {
      const existente = await prisma.materia.findUnique({ where: { nombre: materiaSeed.nombre } });
      const materia = existente ?? await prisma.materia.create({ data: { nombre: materiaSeed.nombre } });
      if (!existente) materiasCreadas += 1;

      for (const cursadaSeed of materiaSeed.cursadas) {
        // Profesor.nombreCompleto no es único a propósito (puede haber homónimos reales),
        // así que la idempotencia se resuelve buscando por nombre antes de crear.
        const profesorExistente = await prisma.profesor.findFirst({ where: { nombreCompleto: cursadaSeed.profesor, deletedAt: null } });
        const profesor = profesorExistente ?? await prisma.profesor.create({ data: { nombreCompleto: cursadaSeed.profesor } });

        const cursadaExistente = await prisma.cursada.findUnique({
          where: { materiaId_anio_cuatrimestre: { materiaId: materia.id, anio: cursadaSeed.anio, cuatrimestre: cursadaSeed.cuatrimestre } },
        });
        const cursada = cursadaExistente ?? await prisma.cursada.create({
          data: { materiaId: materia.id, profesorId: profesor.id, anio: cursadaSeed.anio, cuatrimestre: cursadaSeed.cuatrimestre },
        });
        if (!cursadaExistente) cursadasCreadas += 1;

        for (const comisionSeed of cursadaSeed.comisiones) {
          const comisionExistente = await prisma.comision.findUnique({
            where: { cursadaId_nombre: { cursadaId: cursada.id, nombre: comisionSeed.nombre } },
          });
          if (!comisionExistente) {
            await prisma.comision.create({ data: { cursadaId: cursada.id, nombre: comisionSeed.nombre, activa: comisionSeed.activa ?? true } });
            comisionesCreadas += 1;
          }
        }
      }
    }
    console.log(`Contenido de demostración listo. Nuevos: ${materiasCreadas} materias, ${cursadasCreadas} cursadas, ${comisionesCreadas} comisiones.`);
    console.log("El seed es aditivo: lo que ya existía quedó intacto.");
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
