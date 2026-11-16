import { createHash } from "node:crypto";

/**
 * Generador PURO de experiencias de demostración: mismo catálogo, mismo resultado. Los ids salen
 * de un hash de (autor, comisión), así que volver a correr el seed choca con las filas ya creadas
 * y no duplica nada.
 */

export const ESTUDIANTES_DEMO = 40;
export const emailEstudianteDemo = (n: number) => `demo-estudiante-${String(n).padStart(2, "0")}@alu.frlp.utn.edu.ar`;

const NOMBRES = ["Lucía", "Mateo", "Valentina", "Benjamín", "Martina", "Joaquín", "Camila", "Tomás", "Sofía", "Thiago",
  "Delfina", "Bautista", "Abril", "Santino", "Catalina", "Franco", "Julieta", "Ignacio", "Milagros", "Facundo"];
const APELLIDOS = ["G.", "R.", "M.", "P.", "L.", "S."];
export const nombreEstudianteDemo = (n: number) => `${NOMBRES[(n - 1) % NOMBRES.length]} ${APELLIDOS[Math.floor((n - 1) / NOMBRES.length) % APELLIDOS.length]} (Demo)`;

// Textos por cantidad de estrellas: con humor, sin agredir a nadie (normas de convivencia).
const TEXTOS: Record<1 | 2 | 3 | 4 | 5, string[]> = {
  5: [
    "Explica con una paciencia infinita. Le pregunté lo mismo tres veces y las tres sonrió.",
    "Las clases se pasan volando. Hasta los lunes a las 8 valen la pena.",
    "Trae ejemplos de la vida real y de repente todo tiene sentido. Lo recomiendo con los ojos cerrados.",
    "Responde los mails en minutos. No sé cuándo duerme, pero gracias.",
    "Los parciales son exactamente lo que se ve en clase. Cero sorpresas, cien por ciento justo.",
    "Me hizo gustar una materia que venía esquivando hace dos años.",
  ],
  4: [
    "Muy buena cursada. Hay que ponerse al día con la práctica, pero el esfuerzo rinde.",
    "Explica bien y tiene buena onda. Los apuntes podrían estar más ordenados.",
    "Exigente pero justo. Si vas a las consultas, aprobás.",
    "Buen ritmo de clase y prácticas útiles. El TP final es largo, arranquen temprano.",
    "Se nota que le gusta lo que enseña. Algunas clases se estiran, pero se aprende.",
  ],
  3: [
    "Cumple. Las clases son correctas, aunque cuesta seguir el hilo sin leer antes.",
    "La teoría está bien, la práctica quedó un poco corta para el parcial.",
    "Ni fu ni fa: se aprueba estudiando por tu cuenta y usando el foro.",
    "Buena predisposición, aunque las clases se hacen largas.",
    "Depende mucho del día. Hay clases excelentes y otras que no tanto.",
  ],
  2: [
    "Los parciales tienen poco que ver con lo que se da en clase. Estudien de los parciales viejos.",
    "Cuesta conseguir respuestas fuera del horario de clase. Armen grupo de estudio sí o sí.",
    "Va muy rápido con los temas difíciles. Recomiendo grabar o tomar buenos apuntes.",
    "La materia es interesante, pero la dinámica de clase no ayuda mucho.",
  ],
  1: [
    "Si sobrevivís a esta cursada, sobrevivís a cualquier cosa. Lleven termo y paciencia.",
    "Las correcciones tardaron un cuatrimestre entero. Paciencia de monje tibetano.",
    "Hay que remarla mucho por cuenta propia. El foro de la comisión fue mi salvación.",
    "Clases difíciles de seguir y criterios de corrección poco claros. Ojalá mejore.",
  ],
};

/** Deterministic 0..1 value for a key; same key, same value on every run. */
function azar(...partes: string[]): number {
  return createHash("sha256").update(partes.join("|")).digest().readUInt32BE(0) / 0x1_0000_0000;
}

/** RFC 4122-shaped id derived from the key: re-running the seed hits the same primary key. */
export function idDeterministico(...partes: string[]): string {
  const h = createHash("sha256").update(partes.join("|")).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-${(8 + (parseInt(h[16]!, 16) % 4)).toString(16)}${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

// Each professor has a "reputation" so the ranking has legends, the middle of the table and
// the feared ones, instead of everyone landing on 3.
const PERFILES = [4.7, 4.3, 3.8, 3.2, 2.5, 1.8];
const perfil = (profesorId: string) => PERFILES[Math.floor(azar("perfil", profesorId) * PERFILES.length)]!;

export interface ComisionSemilla {
  id: string;
  nombre: string;
  materiaId: string;
  materiaNombre: string;
  cursadaId: string;
  anio: number;
  cuatrimestre: "PRIMERO" | "SEGUNDO" | "ANUAL" | null;
  profesores: { id: string; nombreCompleto: string; cargo: "TITULAR" | "ADJUNTO" | "JTP" }[];
}

export interface ExperienciaSemilla {
  id: string;
  autorIndex: number;
  comision: ComisionSemilla;
  profesor: ComisionSemilla["profesores"][number] | null;
  puntuacion: 1 | 2 | 3 | 4 | 5;
  texto: string;
  anonimo: boolean;
  createdAt: Date;
}

/** Between 2 and 6 experiences per commission, each from a different demo student. */
export function generarExperiencias(comisiones: ComisionSemilla[], estudiantes = ESTUDIANTES_DEMO, hasta = new Date("2026-11-15T12:00:00Z")): ExperienciaSemilla[] {
  const experiencias: ExperienciaSemilla[] = [];
  for (const comision of comisiones) {
    const cantidad = 2 + Math.floor(azar("cantidad", comision.id) * 5);
    const inicio = Math.floor(azar("autores", comision.id) * estudiantes);
    for (let k = 0; k < cantidad; k++) {
      const autorIndex = 1 + ((inicio + k * 7) % estudiantes);
      const clave = [String(autorIndex), comision.id];
      const profesor = comision.profesores.length && azar("sobre-docente", ...clave) < 0.85
        ? comision.profesores[Math.floor(azar("docente", ...clave) * comision.profesores.length)]!
        : null;
      const base = profesor ? perfil(profesor.id) : 3.6;
      const puntuacion = Math.min(5, Math.max(1, Math.round(base + (azar("ruido", ...clave) - 0.5) * 2))) as 1 | 2 | 3 | 4 | 5;
      const textos = TEXTOS[puntuacion];
      experiencias.push({
        id: idDeterministico("feedback-demo", ...clave),
        autorIndex,
        comision,
        profesor,
        puntuacion,
        texto: textos[Math.floor(azar("texto", ...clave) * textos.length)]!,
        anonimo: azar("anonimo", ...clave) < 0.3,
        createdAt: new Date(hasta.getTime() - Math.floor(azar("fecha", ...clave) * 120) * 86_400_000),
      });
    }
  }
  return experiencias;
}
