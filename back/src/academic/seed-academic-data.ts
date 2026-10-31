import type { CargoDocente, Carrera, Cuatrimestre } from "../generated/prisma/client.js";

interface ComisionSeed {
  carrera: Carrera;
  numero: number;
  activa?: boolean;
  profesores: [string, CargoDocente][];
}
interface CursadaSeed {
  anio: number;
  cuatrimestre: Cuatrimestre;
  comisiones: ComisionSeed[];
}
interface CarreraSeed {
  carrera: Carrera;
  anioCarrera: "1" | "2" | "3" | "4" | "5" | "ELECTIVA";
  nivelElectiva?: "3" | "4" | "5";
}
interface MateriaSeed {
  nombre: string;
  carreras: CarreraSeed[];
  cursadas: CursadaSeed[];
}

const SISTEMAS: Carrera = "S";
const deSistemas = (
  nombre: string,
  anioCarrera: "1" | "2" | "3" | "4" | "5",
  cursadas: CursadaSeed[] = [],
): MateriaSeed => ({ nombre, carreras: [{ carrera: SISTEMAS, anioCarrera }], cursadas });

const electivaSistemas = (
  nombre: string,
  nivelElectiva: "3" | "4" | "5",
  cursadas: CursadaSeed[] = [],
): MateriaSeed => ({
  nombre,
  carreras: [{ carrera: SISTEMAS, anioCarrera: "ELECTIVA", nivelElectiva }],
  cursadas,
});

/**
 * El esquema permite varios docentes por comisión, cada uno con su propio cargo.
 * Para facilitar QA, los docentes inventados llevan la marca «(Demo)».
 */
const comisionS = (
  numero: number,
  profesores: [string, CargoDocente][],
  activa = true,
): ComisionSeed => ({ carrera: SISTEMAS, numero, profesores, activa });

const cursada = (
  anio: number,
  cuatrimestre: Cuatrimestre,
  ...comisiones: ComisionSeed[]
): CursadaSeed => ({ anio, cuatrimestre, comisiones });

const SISTEMAS_MATERIAS: MateriaSeed[] = [
  // 1.º año — materias del plan de estudios recibido
  deSistemas("Análisis Matemático I", "1", [
    cursada(2026, "PRIMERO", comisionS(11, [["Clara Vega (Demo)", "TITULAR"], ["Tomás Roldán (Demo)", "JTP"]]), comisionS(12, [["Clara Vega (Demo)", "TITULAR"]])),
  ]),
  deSistemas("Álgebra y Geometría Analítica", "1"),
  deSistemas("Física I", "1", [
    cursada(2026, "PRIMERO", comisionS(21, [["Martín Herrera (Demo)", "TITULAR"]])),
  ]),
  deSistemas("Inglés I", "1"),
  deSistemas("Lógica y Estructuras Discretas", "1"),
  deSistemas("Arquitecturas de Computadoras", "1"),
  deSistemas("Sistemas y Procesos de Negocio", "1"),
  {
    nombre: "Algoritmos y Estructuras de Datos",
    carreras: [{ carrera: "S", anioCarrera: "1" }],
    cursadas: [
      cursada(2026, "PRIMERO", comisionS(1, [["Lucía Ferreyra (Demo)", "TITULAR"], ["Pablo Quiroga (Demo)", "ADJUNTO"], ["Sofía Medina (Demo)", "JTP"]]), comisionS(2, [["Lucía Ferreyra (Demo)", "TITULAR"]])),
      cursada(2026, "SEGUNDO", comisionS(1, [["Lucía Ferreyra (Demo)", "TITULAR"], ["Pablo Quiroga (Demo)", "JTP"]])),
    ],
  },

  // 2.º año
  {
    nombre: "Análisis Matemático II",
    carreras: [{ carrera: "S", anioCarrera: "2" }],
    cursadas: [
      cursada(2026, "PRIMERO", comisionS(1, [["Mariana Rivas (Demo)", "TITULAR"], ["Héctor Balcedo (Demo)", "JTP"]])),
      cursada(2025, "SEGUNDO", comisionS(1, [["Héctor Balcedo (Demo)", "TITULAR"]])),
    ],
  },
  deSistemas("Física II", "2"),
  deSistemas("Ingeniería y Sociedad", "2"),
  deSistemas("Inglés II", "2"),
  deSistemas("Sintaxis y Semántica del Lenguaje", "2"),
  deSistemas("Paradigmas de Programación", "2"),
  {
    nombre: "Sistemas Operativos",
    // Corregido según el PDF: pertenece al 2.º año, NO al 3.º.
    carreras: [{ carrera: "S", anioCarrera: "2" }],
    cursadas: [
      cursada(2026, "PRIMERO", comisionS(1, [["Daniel Ocampo", "TITULAR"]]), comisionS(2, [["Daniel Ocampo", "TITULAR"], ["Sofía Medina (Demo)", "JTP"]], false)),
    ],
  },
  deSistemas("Análisis de Sistemas de Información (Integradora)", "2", [
    cursada(2026, "ANUAL", comisionS(21, [["Camila Campos (Demo)", "TITULAR"]])),
  ]),

  // 3.º año
  deSistemas("Probabilidades y Estadística", "3"),
  deSistemas("Economía", "3"),
  deSistemas("Bases de Datos", "3", [
    cursada(2026, "PRIMERO", comisionS(31, [["Clara Vega (Demo)", "TITULAR"], ["Santiago Cruz (Demo)", "JTP"]])),
  ]),
  deSistemas("Desarrollo de Software", "3"),
  deSistemas("Comunicación de Datos", "3"),
  deSistemas("Análisis Numérico", "3"),
  deSistemas("Diseño de Sistemas de Información (Integradora)", "3"),

  // 4.º año
  deSistemas("Legislación", "4"),
  deSistemas("Ingeniería y Calidad de Software", "4"),
  deSistemas("Redes de Datos", "4"),
  deSistemas("Investigación Operativa", "4", [
    cursada(2026, "PRIMERO", comisionS(41, [["Martín Herrera (Demo)", "TITULAR"], ["Camila Campos (Demo)", "ADJUNTO"]])),
    cursada(2025, "SEGUNDO", comisionS(41, [["Martín Herrera (Demo)", "TITULAR"]])),
  ]),
  deSistemas("Simulación", "4"),
  deSistemas("Tecnologías para la Automatización", "4", [
    cursada(2026, "SEGUNDO", comisionS(42, [["Tomás Roldán (Demo)", "TITULAR"]])),
  ]),
  deSistemas("Administración de Sistemas de Información (Integradora)", "4"),

  // 5.º año
  deSistemas("Inteligencia Artificial", "5", [
    cursada(2026, "PRIMERO", comisionS(51, [["Camila Campos (Demo)", "TITULAR"]])),
  ]),
  deSistemas("Ciencia de Datos", "5", [
    cursada(2026, "SEGUNDO", comisionS(51, [["Santiago Cruz (Demo)", "TITULAR"]])),
  ]),
  deSistemas("Sistemas de Gestión", "5"),
  deSistemas("Gestión Gerencial", "5"),
  deSistemas("Seguridad en los Sistemas de Información", "5"),
  deSistemas("Proyecto Final (Integradora)", "5", [
    cursada(2026, "ANUAL", comisionS(51, [["Daniel Ocampo", "TITULAR"]])),
  ]),

  // Electivas: la base usa anioCarrera=ELECTIVA + nivelElectiva=3/4/5
  electivaSistemas("Programación Concurrente", "3"),
  electivaSistemas("Sistemas de Tiempo Real", "3", [
    cursada(2026, "PRIMERO", comisionS(61, [["Lucía Ferreyra (Demo)", "TITULAR"]])),
  ]),
  electivaSistemas("Comunicación Profesional", "3"),
  electivaSistemas("Administración de Base de Datos", "4", [
    cursada(2026, "SEGUNDO", comisionS(61, [["Santiago Cruz (Demo)", "TITULAR"]])),
  ]),
  electivaSistemas("Metodologías Ágiles", "4"),
  electivaSistemas("Ingeniería en Calidad", "5"),
  electivaSistemas("Sistemas en la Industria 4.0", "5"),
];

// Ejemplos ilustrativos para QA: no representan planes oficiales.
const ESPECIALIDADES: Record<Exclude<Carrera, "S">, string[][]> = {
  C: [
    ["Representación Civil", "Introducción a la Ingeniería Civil"],
    ["Estabilidad", "Materiales de Construcción"],
    ["Resistencia de Materiales", "Hidráulica"],
    ["Hormigón Armado", "Geotecnia"],
    ["Construcciones Viales", "Proyecto Civil"],
  ],
  Q: [
    ["Química General", "Introducción a la Ingeniería Química"],
    ["Química Orgánica", "Química Analítica"],
    ["Fisicoquímica", "Termodinámica Química"],
    ["Operaciones Unitarias", "Ingeniería de Reacciones"],
    ["Control de Procesos Químicos", "Proyecto de Planta"],
  ],
  I: [
    ["Representación Industrial", "Introducción a la Ingeniería Industrial"],
    ["Ciencia de los Materiales", "Organización Industrial"],
    ["Costos Industriales", "Procesos Industriales"],
    ["Planificación de la Producción", "Logística"],
    ["Evaluación de Proyectos", "Proyecto Industrial"],
  ],
  M: [
    ["Representación Mecánica", "Introducción a la Ingeniería Mecánica"],
    ["Mecánica Racional", "Materiales Metálicos"],
    ["Termodinámica Mecánica", "Mecánica de Fluidos"],
    ["Elementos de Máquinas", "Tecnología Mecánica"],
    ["Máquinas Térmicas", "Proyecto Mecánico"],
  ],
};

const adicionales: MateriaSeed[] = [];
for (const carrera of ["C", "Q", "I", "M"] as const) {
  for (const [indice, nombres] of ESPECIALIDADES[carrera].entries()) {
    const anioCarrera = String(indice + 1) as CarreraSeed["anioCarrera"];
    // Materias generales y específicas por cada nivel para poblar filtros y páginas.
    for (const nombre of [...nombres, `Taller Integrador ${indice + 1}`, `Formación Complementaria ${indice + 1}`]) {
      adicionales.push({ nombre: `${nombre} (${carrera} Demo)`, carreras: [{ carrera, anioCarrera }], cursadas: [] });
    }
  }
  for (const nivelElectiva of ["3", "4", "5"] as const) {
    adicionales.push({
      nombre: `Seminario Optativo ${nivelElectiva} (${carrera} Demo)`,
      carreras: [{ carrera, anioCarrera: "ELECTIVA", nivelElectiva }], cursadas: [],
    });
  }
}

export const MATERIAS: MateriaSeed[] = [...SISTEMAS_MATERIAS, ...adicionales];
for (const materia of MATERIAS) {
  for (const [anio, cuatrimestre] of [[2025, "ANUAL"], [2026, "PRIMERO"], [2026, "SEGUNDO"]] as const) {
    let periodo = materia.cursadas.find((c) => c.anio === anio && c.cuatrimestre === cuatrimestre);
    if (!periodo) {
      periodo = { anio, cuatrimestre, comisiones: [] };
      materia.cursadas.push(periodo);
    }
    for (const { carrera } of materia.carreras) {
      for (const numero of [1, 2]) {
        if (periodo.comisiones.some((c) => c.carrera === carrera && c.numero === numero)) continue;
        periodo.comisiones.push({
          carrera, numero, activa: anio === 2026,
          profesores: [
            [`Docente ${carrera} ${numero} (Demo)`, "TITULAR"],
            [`Auxiliar ${carrera} ${numero} (Demo)`, "JTP"],
          ],
        });
      }
    }
  }
}
