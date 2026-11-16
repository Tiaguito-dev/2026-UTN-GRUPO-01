import { config } from "dotenv";
import { resolve } from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.js";
import { ESTUDIANTES_DEMO, emailEstudianteDemo, generarExperiencias, idDeterministico, nombreEstudianteDemo, type ComisionSemilla } from "./seed-feedback-data.js";

config({
  path: [resolve(process.cwd(), ".env"), resolve(process.cwd(), "../.env")],
  quiet: true,
});

/**
 * Experiencias de demostración para TODAS las comisiones activas o no: estudiantes demo (no
 * pueden iniciar sesión), comentarios con estrellas, su historial de creación y la valoración de
 * cada materia (un voto por estudiante y materia, el de su comentario más reciente).
 *
 * Seed ADITIVO e IDEMPOTENTE: ids deterministas + skipDuplicates; no elimina ni sobrescribe.
 * Correr después de `academic:seed` y con las migraciones aplicadas. Contenido FICTICIO: no
 * correrlo en una base con experiencias reales si no se quiere mezclar datos de demostración.
 */
async function seed(): Promise<void> {
  const connectionString = process.env["DATABASE_URL"];
  if (!connectionString) {
    console.error("Defina DATABASE_URL para cargar las experiencias de demostración.");
    process.exitCode = 1;
    return;
  }
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  try {
    const usuarios = await prisma.user.createMany({
      data: Array.from({ length: ESTUDIANTES_DEMO }, (_, i) => ({
        email: emailEstudianteDemo(i + 1), displayName: nombreEstudianteDemo(i + 1),
        // Sin hash válido: estas cuentas existen solo como autoras, nadie puede iniciar sesión con ellas.
        passwordHash: "demo-sin-acceso", emailVerifiedAt: new Date("2026-03-01T00:00:00Z"),
      })),
      skipDuplicates: true,
    });
    const autores = new Map((await prisma.user.findMany({
      where: { email: { in: Array.from({ length: ESTUDIANTES_DEMO }, (_, i) => emailEstudianteDemo(i + 1)) } },
      select: { id: true, email: true },
    })).map((u) => [u.email, u.id]));

    const filas = await prisma.comision.findMany({
      where: { deletedAt: null, cursada: { deletedAt: null, materia: { deletedAt: null } } },
      include: { cursada: { include: { materia: true } }, profesores: { include: { profesor: true } } },
      orderBy: { id: "asc" },
    });
    const comisiones: ComisionSemilla[] = filas.map((c) => ({
      id: c.id, nombre: `${c.carrera}-${c.numero}`, materiaId: c.cursada.materia.id, materiaNombre: c.cursada.materia.nombre,
      cursadaId: c.cursada.id, anio: c.cursada.anio, cuatrimestre: c.cursada.cuatrimestre,
      profesores: c.profesores.filter((p) => !p.profesor.deletedAt).map((p) => ({ id: p.profesorId, nombreCompleto: p.profesor.nombreCompleto, cargo: p.cargo })),
    }));
    const experiencias = generarExperiencias(comisiones).map((e) => ({ ...e, autorId: autores.get(emailEstudianteDemo(e.autorIndex))! }));

    let comentarios = 0;
    for (let i = 0; i < experiencias.length; i += 500) {
      const lote = experiencias.slice(i, i + 500);
      // ON CONFLICT DO NOTHING también cubre el índice único parcial (autor, comisión vigente).
      const creados = await prisma.feedback.createMany({
        data: lote.map((e) => ({
          id: e.id, autorId: e.autorId, comisionId: e.comision.id, profesorId: e.profesor?.id ?? null, texto: e.texto, puntuacion: e.puntuacion,
          anonimo: e.anonimo, comisionNombre: e.comision.nombre, materiaId: e.comision.materiaId, materiaNombre: e.comision.materiaNombre,
          cursadaId: e.comision.cursadaId, anio: e.comision.anio, cuatrimestre: e.comision.cuatrimestre,
          profesorNombre: e.profesor?.nombreCompleto ?? null, profesorCargo: e.profesor?.cargo ?? null, createdAt: e.createdAt, updatedAt: e.createdAt,
        })),
        skipDuplicates: true,
      });
      comentarios += creados.count;
      const existentes = new Set((await prisma.feedback.findMany({ where: { id: { in: lote.map((e) => e.id) } }, select: { id: true } })).map((f) => f.id));
      await prisma.feedbackHistorial.createMany({
        data: lote.filter((e) => existentes.has(e.id)).map((e) => ({
          id: idDeterministico("historial-demo", e.id), feedbackId: e.id, accion: "CREACION" as const,
          texto: e.texto, puntuacion: e.puntuacion, anonimo: e.anonimo, createdAt: e.createdAt,
        })),
        skipDuplicates: true,
      });
    }

    // One vote per student and subject: the most recent of their experiences in that subject.
    const votos = new Map<string, { usuarioId: string; materiaId: string; puntuacion: number; createdAt: Date }>();
    for (const e of experiencias) {
      const clave = `${e.autorId}|${e.comision.materiaId}`;
      const previo = votos.get(clave);
      if (!previo || previo.createdAt < e.createdAt) votos.set(clave, { usuarioId: e.autorId, materiaId: e.comision.materiaId, puntuacion: e.puntuacion, createdAt: e.createdAt });
    }
    const valoraciones = await prisma.valoracionMateria.createMany({ data: [...votos.values()], skipDuplicates: true });

    console.log(`Experiencias de demostración listas. Nuevos: ${usuarios.count} estudiantes, ${comentarios} comentarios, ${valoraciones.count} valoraciones de materias.`);
    console.log("El seed es aditivo: no se eliminaron ni sobrescribieron registros existentes.");
  } catch {
    console.error("No se pudieron cargar las experiencias de demostración. Revise DATABASE_URL, que las migraciones estén aplicadas y que haya corrido academic:seed.");
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect().catch(() => {
      console.error("No se pudo cerrar la conexión del seed.");
      process.exitCode = 1;
    });
  }
}

await seed();
