import { config } from "dotenv";
import { resolve } from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, type CargoDocente, type Carrera, type ModalidadMateria } from "../generated/prisma/client.js";

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
interface ComisionSeed { carrera: Carrera; numero: number; activa?: boolean; profesores: [string, CargoDocente][] }
interface CursadaSeed { anio: number; comisiones: ComisionSeed[] }
interface MateriaSeed { nombre: string; modalidad: ModalidadMateria; carreras: { carrera: Carrera; anioCarrera: string }[]; cursadas: CursadaSeed[] }

const TODAS: Carrera[] = ["S", "C", "Q", "I", "M"];

const MATERIAS: MateriaSeed[] = [
  {
    nombre: "Análisis Matemático II",
    modalidad: "PRIMERO",
    carreras: TODAS.map((carrera) => ({ carrera, anioCarrera: "2" })),
    cursadas: [
      { anio: 2026, comisiones: [
        { carrera: "S", numero: 1, profesores: [["Mariana Rivas", "TITULAR"], ["Héctor Balcedo", "JTP"]] },
        { carrera: "Q", numero: 1, profesores: [["Mariana Rivas", "TITULAR"]] },
      ] },
      { anio: 2025, comisiones: [
        { carrera: "S", numero: 1, profesores: [["Héctor Balcedo", "TITULAR"]] },
      ] },
    ],
  },
  {
    nombre: "Algoritmos y Estructuras de Datos",
    modalidad: "ANUAL",
    carreras: [{ carrera: "S", anioCarrera: "1" }],
    cursadas: [
      { anio: 2026, comisiones: [
        { carrera: "S", numero: 1, profesores: [["Lucía Ferreyra", "TITULAR"], ["Pablo Quiroga", "ADJUNTO"], ["Sofía Medina", "JTP"]] },
        { carrera: "S", numero: 2, profesores: [["Lucía Ferreyra", "TITULAR"]] },
      ] },
    ],
  },
  {
    nombre: "Sistemas Operativos",
    modalidad: "SEGUNDO",
    carreras: [{ carrera: "S", anioCarrera: "3" }],
    cursadas: [
      { anio: 2026, comisiones: [
        { carrera: "S", numero: 1, profesores: [["Daniel Ocampo", "TITULAR"]] },
        { carrera: "S", numero: 2, activa: false, profesores: [["Daniel Ocampo", "TITULAR"], ["Sofía Medina", "JTP"]] },
      ] },
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
    // Profesor.nombreCompleto no es único a propósito (puede haber homónimos reales),
    // así que la idempotencia se resuelve buscando por nombre antes de crear.
    const profesorId = async (nombreCompleto: string): Promise<string> =>
      (await prisma.profesor.findFirst({ where: { nombreCompleto, deletedAt: null } })
        ?? await prisma.profesor.create({ data: { nombreCompleto } })).id;

    for (const materiaSeed of MATERIAS) {
      const existente = await prisma.materia.findUnique({ where: { nombre: materiaSeed.nombre } });
      const materia = existente ?? await prisma.materia.create({
        data: { nombre: materiaSeed.nombre, modalidad: materiaSeed.modalidad },
      });
      if (!existente) materiasCreadas += 1;
      await prisma.materiaCarrera.createMany({
        data: materiaSeed.carreras.map((fila) => ({ materiaId: materia.id, ...fila })),
        skipDuplicates: true,
      });

      for (const cursadaSeed of materiaSeed.cursadas) {
        const cursadaExistente = await prisma.cursada.findUnique({
          where: { materiaId_anio: { materiaId: materia.id, anio: cursadaSeed.anio } },
        });
        const cursada = cursadaExistente ?? await prisma.cursada.create({
          data: { materiaId: materia.id, anio: cursadaSeed.anio },
        });
        if (!cursadaExistente) cursadasCreadas += 1;

        for (const comisionSeed of cursadaSeed.comisiones) {
          const comisionExistente = await prisma.comision.findUnique({
            where: { cursadaId_carrera_numero: { cursadaId: cursada.id, carrera: comisionSeed.carrera, numero: comisionSeed.numero } },
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
