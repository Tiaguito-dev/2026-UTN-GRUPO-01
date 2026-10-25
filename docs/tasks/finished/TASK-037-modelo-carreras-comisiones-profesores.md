# TASK-037: Modelo de carreras, comisiones y profesores por comisión

Estado: Completada. Implementación de todas las etapas (TASK-039 a TASK-046) finalizada el 2026-10-25.
Depende de TASK-014 (jerarquía académica) y TASK-019 (alta del catálogo académico).
Fecha: 2026-10-25

## 1. Contexto y objetivo

Las pantallas de materias, cursadas, comisiones y administración se rediseñaron en el canvas
[Style Guide 2026-UTN-GRUPO-01](https://claude.ai/code/artifact/03813bcf-cf74-4f04-9a27-1d75610bcb6a),
página "Page 2". Los datos de los artboards son de ejemplo; lo que vale es la estructura.

Los rediseños requieren un modelo que hoy no existe:

- [schema.prisma](../../../back/prisma/schema.prisma): `Cursada` tiene un único `profesorId` obligatorio
  y `@@unique([materiaId, anio, cuatrimestre])`. `Comision` tiene `cursadaId`, `nombre` (texto libre,
  único por cursada) y `activa`. `Materia` tiene un solo `anioCarrera` y ninguna carrera.
- No existe ninguna enumeración de carreras en el repositorio.
- `GET /materias/:materiaId/historial` lo ve cualquier usuario con sesión y devuelve solo `actorId`.
- No existe `GET /comisiones/:id`.

Objetivo: dejar cerrados el modelo de datos, la estrategia de migración y los contratos front-back
antes de implementar. Esta tarea no modifica código; cada PR de la sección 6 se implementa como una
tarea propia.

## 2. Decisiones confirmadas por el desarrollador

1. Las comisiones se nombran carrera + número, por ejemplo `S-31`. La letra es la carrera y el número
   lo ingresa el usuario.
2. Carreras (lista fija, sin ABM): S = Sistemas, C = Civil, Q = Química, I = Industrial, M = Mecánica.
3. Profesor–comisión es N:M. Una comisión suele tener de 1 a 3 profesores y un profesor puede estar en
   varias comisiones.
4. Cada profesor tiene un cargo por comisión: Titular, Adjunto o JTP.
5. No hay responsable a nivel cursada: los profesores van solo por comisión.
6. Una materia puede tener, en el mismo cuatrimestre, comisiones de distintas carreras (materias comunes).
7. El listado de materias permite filtrar primero por carrera.

## 3. Decisiones D1–D5

Todas cerradas el 2026-10-25: el desarrollador aceptó la recomendación de cada una. Se conservan las
alternativas como registro.

### D1. Materia ↔ carrera — elegida A

- **A) Tabla `MateriaCarrera(materiaId, carrera, anioCarrera, nivelElectiva)`**, PK `(materiaId, carrera)`.
  El año queda por plan. Costo: mover `anioCarrera`, `nivelElectiva` y su CHECK fuera de `Materia`,
  reescribir filtro y orden del listado.
- B) `Materia.carreras Carrera[]` y un solo `anioCarrera`. Barata; incorrecta si el año difiere entre planes.
- C) Derivar las carreras de las comisiones. Sin cambios de esquema; una materia sin cursadas queda sin
  carrera y el filtro por carrera deja de funcionar.

Notas de cierre:
- El modal corregido (ModalNuevaMateria y su versión móvil) tiene casillas de carrera y **un solo**
  "Año de la carrera". El front envía el mismo `anioCarrera`/`nivelElectiva` para cada carrera marcada;
  la API igual recibe una fila por carrera. Límite conocido: una materia común con años distintos según
  el plan necesita un editor por carrera en "Editar materia" (fuera de alcance).
- Las materias existentes no tienen carrera: se completan con `S` por defecto y un admin las revisa.

### D2. Experiencias de alumnos — elegida A

- **A) Por comisión.** Es lo más preciso, porque los profesores varían por comisión, y permite agregar
  hacia cursada o profesor. Mantiene la sección "Experiencias de esta comisión" de ComisionDetalle.
- B) Por cursada. Más simple; ComisionDetalle pierde esa sección.
- C) Por profesor. Transversal; requiere una página de profesor que el canvas no tiene.

El modelo de experiencias queda fuera de esta tarea; la sección se muestra como "Próximamente".

### D3. Historial de materia — elegida A

- **A) Solo ADMIN (`@Roles("ADMIN")`) e incluir `actor: { id, displayName }`** con `include` en la misma
  consulta. El rediseño de MateriaDetalle ya no muestra el historial en la vista pública.
- B) Visible para todos con `displayName`. Expone nombres de administradores a cualquier usuario.
- C) Solo ADMIN, mantener `actorId` y resolver nombres desde un listado de usuarios. Pedido extra o N+1.

Orden: primero el front deja de pedir el historial a usuarios no admin; después el back agrega `@Roles`.
Es un par de PRs independiente de la sección 6.

### D4. `Cursada.profesorId` y `@@unique` de cursada — elegidas A y A

- `profesorId`: **A) eliminarlo**; los profesores se derivan de las comisiones. Es la única opción
  coherente con la decisión confirmada 5. B) Dejarlo opcional como legado: columna muerta.
- `@@unique`: **A) mantener `(materiaId, anio, cuatrimestre)`**: una cursada por materia y período, y las
  carreras viven en las comisiones (CursadaDetalle muestra comisiones S y Q en una misma cursada).
  B) Agregar `carrera` a `Cursada` y al unique: contradice el canvas. C) Quitar el unique: permite
  períodos duplicados.

### D5. Conversión de nombres de comisión existentes — resuelta por los datos

Alternativas evaluadas: A) relleno heurístico (número desde los dígitos del nombre, carrera de la
materia o `S`) con reporte; B) mapeo explícito revisado por el desarrollador; C) baja y recreación.

Cierre: el desarrollador ya borró todas las comisiones en Neon. No hay nombres para convertir ni
asignaciones para copiar desde `Cursada.profesorId`; esos valores se descartan sin copia (coherente con
la decisión confirmada 5). El PR1 vuelve a comprobar `SELECT count(*) FROM "Comision"` = 0 antes de
aplicar la migración.

El seed [seed-academic.ts](../../../back/src/academic/seed-academic.ts) crea hoy comisiones con el formato
viejo ("Comisión 1 - Mañana"). Se pasa al formato nuevo en el PR2, **antes** de volver a correr
`npm run academic:seed` en Neon.

## 4. Modelo de datos

```
enum Carrera { S C Q I M }
enum CargoDocente { TITULAR ADJUNTO JTP }

Materia 1──N MateriaCarrera(carrera, anioCarrera, nivelElectiva?)   PK (materiaId, carrera)
Materia 1──N Cursada(anio, cuatrimestre)                            UNIQUE (materiaId, anio, cuatrimestre)
Cursada 1──N Comision(carrera, numero, activa)                      UNIQUE (cursadaId, carrera, numero)
Comision N──M Profesor vía ComisionProfesor(cargo, createdAt)       PK (comisionId, profesorId)
Materia 1──N MateriaHistorial N──1 User (actor)
(futuro, D2) Comision 1──N Experiencia
```

Invariantes, validadas en los casos de uso con el catálogo de errores existente:
- `Comision.carrera` pertenece a las carreras de su materia; si no, 400 `InvalidAcademicInputError`.
- Quitar una carrera de una materia que tiene comisiones de esa carrera: 409.
- `numero` es entero entre 1 y 999.
- `nombre` se deriva como `${carrera}-${numero}`; no se guarda.
- El CHECK de `nivelElectiva` (hoy en `Materia`) pasa a `MateriaCarrera`.

No se valida, a propósito: cantidad de profesores por comisión (1 a 3 es lo habitual, no un límite) ni
un único Titular por comisión.

Las etiquetas de carrera viven en una sola constante del front, `CARRERAS`, en `front/src/types/`
(S → "Ingeniería en Sistemas", etc.).

## 5. Contratos

### 5.1 Esquemas Zod de respuesta (`front/src/services/schemas.ts`)

Forma final, después del PR5. Los campos legados se mantienen hasta el PR5. Como los esquemas usan
`z.object` no estricto, un back con campos de más no rompe a un front más viejo.

```ts
const carrera = z.enum(["S", "C", "Q", "I", "M"]);
const cargo = z.enum(["TITULAR", "ADJUNTO", "JTP"]);
const anioCarrera = z.enum(["1", "2", "3", "4", "5", "ELECTIVA"]);

const materiaCarreraSchema = z.object({
  carrera,
  anioCarrera,
  nivelElectiva: z.enum(["3", "4", "5"]).nullable(),
});

export const materiaSchema = z.object({
  id: z.string(),
  nombre: z.string(),
  carreras: z.array(materiaCarreraSchema),
  createdAt: z.string(),
  deletedAt: z.string().nullable(),
}); // anioCarrera y nivelElectiva se quitan en el PR5

export const cursadaResumenSchema = z.object({
  id: z.string(),
  anio: z.number(),
  cuatrimestre,
  comisiones: z.number(), // comisiones activas
  profesores: z.number(), // profesores distintos en comisiones activas
  carreras: z.array(carrera), // carreras de las comisiones activas
}); // `profesor` se quita en el PR5

export const cursadaDetalleSchema = z.object({
  id: z.string(),
  anio: z.number(),
  cuatrimestre,
  materia: z.object({ id: z.string(), nombre: z.string() }),
}); // `profesor` se quita en el PR5

const profesorAsignadoSchema = z.object({
  id: z.string(),
  nombreCompleto: z.string(),
  cargo,
});

export const comisionSchema = z.object({
  id: z.string(),
  cursadaId: z.string(),
  carrera,
  numero: z.number(),
  nombre: z.string(), // derivado: "S-31"
  activa: z.boolean(),
  profesores: z.array(profesorAsignadoSchema),
  createdAt: z.string(),
  deletedAt: z.string().nullable(),
});

export const comisionDetalleSchema = comisionSchema.extend({
  cursada: z.object({
    id: z.string(),
    anio: z.number(),
    cuatrimestre,
    materia: z.object({ id: z.string(), nombre: z.string() }),
  }),
});

export const materiaHistorialSchema = z.object({
  id: z.string(),
  materiaId: z.string(),
  createdAt: z.string(),
  actor: z.object({ id: z.string(), displayName: z.string() }),
  cambios: z.array(z.object({
    // las entradas viejas conservan "anioCarrera" y "nivelElectiva"
    campo: z.enum(["nombre", "anioCarrera", "nivelElectiva", "carreras"]),
    anterior: z.string().nullable(), // "carreras" se serializa como "S:2,Q:1"
    nuevo: z.string().nullable(),
  })),
}); // actorId se quita en el PR5
```

### 5.2 Endpoints (`back/src/academic/academic.controller.ts`)

Las entradas se validan con `z.strictObject` en `application/`, como hoy.

| Método y ruta | Rol | Entrada | Respuesta | Errores |
|---|---|---|---|---|
| `GET /materias?carrera=&anioCarrera=&nivelElectiva=&q=&page=&pageSize=` | sesión | `anioCarrera` y `nivelElectiva` solo son válidos junto con `carrera` | paginado de `materia` | 400 |
| `POST /materias` | ADMIN | `{ nombre, carreras: [{ carrera, anioCarrera, nivelElectiva? }] }`, mínimo 1, carrera sin repetir | `materia` | 400, 409 |
| `PATCH /materias/:materiaId` | ADMIN | mismos campos, parcial; `carreras` reemplaza todas | `materia` | 400, 404, 409 |
| `GET /materias/:materiaId/cursadas` | sesión | `page`, `pageSize` | paginado de `cursadaResumen` | 404 |
| `GET /materias/:materiaId/historial` | ADMIN (D3) | `page`, `pageSize` | paginado de `materiaHistorial` | 404 |
| `GET /cursadas/:cursadaId` | sesión | — | `cursadaDetalle` | 404 |
| `POST /cursadas` | ADMIN | `{ materiaId, anio, cuatrimestre }` | `cursada` | 400, 404, 409 |
| `GET /cursadas/:cursadaId/comisiones` | sesión | `page`, `pageSize` | paginado de `comision` | 404 |
| `POST /comisiones` | ADMIN | `{ cursadaId, carrera, numero }` | `comision` | 400, 404, 409 |
| `GET /comisiones/:comisionId` | sesión | — | `comisionDetalle` | 404 |
| `PUT /comisiones/:comisionId/profesores/:profesorId` | ADMIN | `{ cargo }`; asigna o cambia el cargo, idempotente | `profesorAsignado` | 400, 404 |
| `DELETE /comisiones/:comisionId/profesores/:profesorId` | ADMIN | — | 204 | 404 |

Errores nuevos en `application/errors.ts`: `ComisionNotFoundError` (404) y `ProfesorNoAsignadoError` (404).

Sin carrera elegida ("Todas"), el listado de materias se ordena por nombre y sin grupos por año.

Las comisiones de una cursada se filtran por carrera en el front: la pantalla pide `pageSize=100` y
filtra del lado del cliente. Si alguna cursada llega a superar las 100 comisiones, se agrega `?carrera=`
a ese endpoint.

## 6. Migración expand-contract

Cada PR se despliega solo. El orden de despliegue es el de
[DESPLIEGUE-CLOUD.md](../../../infra/DESPLIEGUE-CLOUD.md): `npm run db:deploy` contra Neon, después
Render (back) y al final Vercel (front). `db:deploy` aplica solo las migraciones nuevas.

1. **PR1, ampliar el esquema.** Comprobar que no hay comisiones en Neon. Agregar los enums `Carrera` y
   `CargoDocente`, las tablas `MateriaCarrera` y `ComisionProfesor`, `Comision.carrera` y
   `Comision.numero` opcionales, y `Cursada.profesorId` opcional. El código compila con los tipos
   opcionales y el comportamiento no cambia.
2. **PR2, doble escritura y relleno.** Relleno SQL de `MateriaCarrera` desde `Materia.anioCarrera` y
   `nivelElectiva`, con carrera `S`. No hay relleno de comisiones (la tabla está vacía).
   `POST /materias` y `PATCH` aceptan `carreras[]` y siguen completando el `anioCarrera` legado con el
   primer plan. `POST /comisiones` acepta `carrera` y `numero` y sigue escribiendo `nombre`. Se agregan
   `PUT` y `DELETE` de profesores por comisión. En `POST /cursadas`, `profesorId` pasa a ser opcional:
   se guarda si llega y no se lee. El seed pasa al formato nuevo.
3. **PR3, lecturas nuevas en el back (solo agrega).** Las respuestas suman los campos nuevos y mantienen
   los legados. Se agregan el filtro `?carrera=` y `GET /comisiones/:comisionId`.
4. **PR4, el front usa el contrato nuevo.** Esquemas Zod nuevos y pantallas según la sección 7. El front
   deja de leer los campos legados.
5. **PR5, contraer.** `Comision.carrera` y `numero` pasan a obligatorios (solo si no hay nulos), se crea el
   unique nuevo y se eliminan `Comision.nombre`, `Cursada.profesorId`, `Materia.anioCarrera`,
   `Materia.nivelElectiva`, sus índices y su CHECK. Se quitan los campos legados de respuestas y entradas.

El par de PRs de D3 (historial) es independiente de estos cinco.

## 7. Artboard → contrato

| Artboard (Page 2) | Contratos |
|---|---|
| Materias · listado con vista de admin | `GET /materias` con `?carrera=`; las etiquetas "Común a las 5 carreras" / "Solo Sistemas" se derivan de `carreras` |
| Materias · modal Nueva materia (escritorio y móvil) | `POST /materias`; carreras marcadas × un año compartido; "Elegí al menos una carrera" ↔ `carreras` mínimo 1; 409 ↔ nombre duplicado |
| Detalle de materia · rediseño | `GET /materias/:materiaId`, `GET /materias/:materiaId/cursadas` (cantidades y letras de carrera) |
| Cursada · comisiones (rediseño) | `GET /cursadas/:cursadaId`, `GET /cursadas/:cursadaId/comisiones` (profesores con cargo, filtro por carrera) |
| Comisión · detalle (rediseño) | `GET /comisiones/:comisionId`; `PUT`/`DELETE` de profesores; `GET /profesores` para elegir; `GET /cursadas/:cursadaId/comisiones` para "Otras comisiones"; experiencias según D2 |
| Administración · escritorio y móvil | sin contrato nuevo; `POST /cursadas` sin `profesorId` |
| Detalle de materia · hoy (reproducción) | solo referencia; el historial queda para ADMIN (D3) |

## 8. Fuera de alcance

- Implementación; cada PR de la sección 6 se define en su propia tarea.
- Modelo de experiencias.
- Edición y baja de comisiones.
- ABM de carreras.
- Editor de año por carrera en "Editar materia".
- Límite de profesores por comisión.
- Paquete de esquemas compartido entre front y back.
- CI del backend.

## 9. Criterios de aceptación

- D1–D5 registradas como cerradas, con fecha, en la sección 3.
- El modelo (sección 4), los contratos (sección 5), la migración (sección 6) y el mapeo de artboards
  (sección 7) reflejan las opciones elegidas.
- Cada PR de la sección 6 tiene su propia tarea antes de implementarse (gate de tarea).
- Se respeta AGENTS.md: sin dependencias nuevas y sin tocar áreas sensibles.

## 10. Validación

Tarea solo de documentación: lectura estructural del archivo y comprobación de que los enlaces al
canvas y a los archivos del repositorio resuelven.
