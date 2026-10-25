# TASK-041: Lecturas nuevas: carreras, resumen de cursada y detalle de comisión (PR3 de TASK-037)

Estado: Terminada. Plan acordado con el desarrollador el 2026-10-25.
Depende de TASK-040 (doble escritura desplegada).
Fecha: 2026-10-25

## Objetivo

Las respuestas del back suman los campos nuevos de TASK-037 §5.1 sin quitar ninguno. Se agregan el
filtro `?carrera=` al listado de materias y `GET /comisiones/:comisionId`. El front actual no nota
nada; TASK-042 ya puede consumir el contrato nuevo.

## Contexto verificado (2026-10-25)

- `prisma-materia.repository.ts` L12-31: `findAll` filtra por `anioCarrera`, `nivelElectiva` y `q`
  (escapando `\ % _`) y ordena por `anioCarrera` y `nivelElectiva` (nulos al final), `nombre`, `id`.
  `toMateria` (L104-106) castea las columnas.
- `materia-input.ts` `validateMateriaFilter`: `z.object` no estricto; rechaza nivel sin `ELECTIVA`.
- `listar-cursadas-por-materia.ts`: devuelve `CursadaConProfesor {id, anio, cuatrimestre, profesor}`
  con un `findById` por cursada (N+1). `obtener-cursada.ts` reutiliza `resumirCursada`; una cursada
  con la materia borrada da 404.
- `prisma-comision.repository.ts`: `findByCursadaId` ordena por `nombre` y devuelve las filas crudas.
- El enum de Postgres ordena por orden de declaración: `orderBy carrera asc` da S, C, Q, I, M;
  `cargo asc` da TITULAR, ADJUNTO, JTP.
- Prisma permite `orderBy` por un campo de una relación a uno (`materia: { nombre: "asc" }`), no por
  una relación a muchos.

## Decisiones

- **Materia**: toda respuesta suma `carreras: [{carrera, anioCarrera, nivelElectiva}]` ordenadas
  por el enum. Se mantienen `anioCarrera` y `nivelElectiva`.
- **Listado**:
  - Con `carrera`: la consulta parte de `MateriaCarrera`, filtra por `carrera`, `anioCarrera?`,
    `nivelElectiva?`, materia no borrada y `q`, y ordena por `anioCarrera`, `nivelElectiva`
    (nulos al final), `materia.nombre`, `materiaId`.
  - Sin `carrera`: el comportamiento es idéntico al de hoy, con filtros y orden legados, para que el
    front actual no cambie.
  - El orden "sin carrera → por nombre" y la regla "año/nivel solo con carrera" entran en TASK-044.
- **Resumen de cursada**: suma `comisiones` (activas y no borradas), `profesores` (distintos en esas
  comisiones) y `carreras` (las de esas comisiones, sin nulos, ordenadas por el enum). Se calcula
  con un `include` en la misma consulta paginada. Se mantiene `profesor` (y su N+1) hasta TASK-044.
- **Comisión** (listado y alta): suma `carrera`, `numero` y `profesores: [{id, nombreCompleto, cargo}]`,
  ordenados por cargo y después por nombre. `nombre` sigue siendo el guardado, que en las nuevas ya
  es `S-31`. El listado ordena por `carrera`, `numero` (nulos al final) y `nombre`.
- **`GET /comisiones/:comisionId`** (sesión): comisión + `cursada {id, anio, cuatrimestre, materia {id, nombre}}`.
  Devuelve 404 `ComisionNotFoundError` si la comisión, su cursada o su materia están borradas
  (mismo criterio que `ObtenerCursada`). Se incluyen las comisiones inactivas: el detalle muestra la marca.
- Todos los campos nuevos de comisión pueden ser null mientras existan comisiones legadas.

## Alcance

- `back/src/academic/domain/materia.ts`: `Materia.carreras: MateriaCarrera[]`.
- `back/src/academic/domain/cursada.ts`: tipo del resumen con `comisiones`, `profesores`, `carreras`.
- `back/src/academic/domain/comision.ts`: `Comision` con `carrera`, `numero`, `profesores`; `ComisionDetalle`.
- `back/src/academic/application/materia-input.ts`: `carrera` opcional en `validateMateriaFilter`.
- `back/src/academic/application/ports/*.ts`: firmas que cambian; `ComisionRepository.findDetalleById`.
- `back/src/academic/application/listar-cursadas-por-materia.ts`, `obtener-cursada.ts`: nuevo resumen.
- `back/src/academic/application/obtener-comision.ts` (nuevo).
- `back/src/academic/infrastructure/prisma-materia.repository.ts`, `prisma-cursada.repository.ts`,
  `prisma-comision.repository.ts`: `include` y mapeo explícito a dominio.
- `back/src/academic/academic.controller.ts`: `@Get("comisiones/:comisionId")`.
- `back/src/academic/academic.module.ts`: cableado de `ObtenerComision`.
- Tests (agente `test`): fixture, `academic.use-cases.spec.ts`, `materias-filtros.spec.ts`,
  `academic.integration.spec.ts`.

## Fuera de alcance

- Front (TASK-042).
- Quitar campos legados, el N+1 de `profesor` o el orden legado (TASK-044).
- `?carrera=` en `GET /cursadas/:id/comisiones` (TASK-037: solo si alguna cursada supera 100 comisiones).
- Historial (TASK-045/046).

## Pasos

1. Test: casos que fallan primero:
   - Filtro con `carrera` (incluye materias comunes, respeta año/nivel/q, orden por año).
   - Sin `carrera` el resultado es igual al de antes.
   - Resumen de cursada con comisiones inactivas o borradas excluidas y profesores repetidos contados una vez.
   - Comisión con profesores ordenados por cargo.
   - `ObtenerComision` con sus tres 404.
2. Back: dominio y puertos.
3. Back: repositorios (mapeo explícito; las filas crudas dejan de salir tal cual).
4. Back: casos de uso, controlador, módulo.
5. Test: integración HTTP de `GET /comisiones/:id`, `GET /materias?carrera=Q` y respuestas con campos legados intactos.
6. Verificación completa.

## Criterio de "listo"

Automático (PowerShell, desde la raíz):

```powershell
docker run -d --name utn-test-db -e POSTGRES_PASSWORD=test -e POSTGRES_DB=utn_test -p 127.0.0.1:55450:5432 postgres:17-alpine
$env:TEST_DATABASE_URL = "postgresql://postgres:test@127.0.0.1:55450/utn_test"
$env:DATABASE_URL = $env:TEST_DATABASE_URL
npm run db:deploy --workspace=back
npm run typecheck --workspace=back
npm run test --workspace=back
npm run build --workspace=back
npm run test --workspace=front
```

- Las suites de integración no se saltean.
- `npm run test --workspace=front` pasa sin tocar el front (las respuestas solo agregan campos).
- Al terminar: `docker rm -f utn-test-db`.

Manual (Tiago):
- Con el seed de TASK-040 en local: `GET /materias?carrera=Q` trae Análisis Matemático II y no AED.
- `GET /materias/:id/cursadas` muestra cantidades y letras de carrera.
- `GET /comisiones/:id` trae la cursada y la materia.
- Que no se rompa: el front actual (listado con chips de año, detalle, cursadas, comisiones) se ve igual.

## Skills para la implementación

- `ponytail`.
- Agentes `back` y `test`. Estándares: `docs/standards/paginacion.md`, `soft-delete.md`, `arquitectura-de-capas.md`.

## Riesgos y preguntas abiertas

- Materias sin fila en `MateriaCarrera` (las que tenían `anioCarrera` null) no aparecen con
  ningún `?carrera=`. Es esperado; TASK-044 las cuenta antes de contraer.
- El `include` de profesores por comisión agranda la respuesta del listado de comisiones (máximo
  100 comisiones por página, de 1 a 3 profesores cada una): aceptable.

## Al cerrar

- `back/OVERVIEW.md`: contratos nuevos y qué campos son legados.
- `CHANGELOG.md`; mover a `finished/`.

## Resultado

Implementado el 2026-10-25 (sin commitear). Decisiones de implementación:

- `comisiones` y `profesores` del resumen son cantidades; `carreras` es un array de letras.
- Profesores borrados no aparecen en `Comision.profesores` ni cuentan en el resumen (`soft-delete.md`);
  `profesorId` desempata el orden entre homónimos.
- `CursadaRepository.findById` devuelve el resumen (sin método nuevo); `findByCursadaIdAndNombre`
  devuelve la comisión completa.
- `carrera=""` o repetida es 400; el mensaje del filtro menciona la carrera.
- El listado de comisiones sigue incluyendo inactivas; solo el resumen las excluye.

Evidencia (Docker `utn-test-db`, 2026-10-25):

- `db:deploy`: migraciones aplicadas. `build` back: ok.
- `test` back: 552 pasan, 54 fallan, todas en `auth*.integration` por el 503 de Mailpit ya
  registrado en TASK-040. Suites académicas (8 archivos): 299/299.
- `test` front: 230/230, sin tocar el front.
- Pendiente: la verificación manual de Tiago.
