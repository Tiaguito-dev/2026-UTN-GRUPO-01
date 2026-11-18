# Ranking de comisiones y profesores

## Alcance y aceptación

Exponer dos rankings de solo lectura, calculados con las puntuaciones (1 a 5) de las experiencias
publicadas:

- `GET /rankings/comisiones`: mejores comisiones, una fila por comisión.
- `GET /rankings/profesores`: mejores profesores, una fila por profesor, con el desglose de su
  valoración en cada comisión donde lo valoraron.

Primera etapa: solo backend. Segunda etapa (aprobada por el desarrollador el 2026-11-14): las
vistas del frontend, ver "Etapa 2" más abajo.

## Fuera de alcance

- Esquema, migraciones o tablas materializadas: el ranking se calcula al consultar.
- Filtros por carrera, año o período. Se agregan cuando el frontend los pida.

## Decisiones

- **Fuente de datos.** Solo `Feedback` con `deletedAt IS NULL` y `puntuacion IS NOT NULL`. Los
  comentarios históricos sin puntuación no cuentan. Se excluyen comisiones, cursadas y materias
  con baja lógica. Las comisiones inactivas sí cuentan: sus experiencias siguen siendo válidas.
- **Comisiones.** Una comisión acumula las puntuaciones de sus experiencias. Como cada estudiante
  publica una sola experiencia por comisión, cada voto es de una persona distinta.
- **Profesores.** Se toman las experiencias que apuntan a ese profesor (`Feedback.profesorId`).
  Primero se agrupan por comisión (el desglose) y después se juntan en un total por profesor. El
  promedio total es ponderado por cantidad de votos (la suma de todas las puntuaciones dividida
  por la cantidad), no un promedio de los promedios por comisión: una comisión con un solo voto no
  pesa lo mismo que una con veinte. Un mismo estudiante que valoró al profesor en dos comisiones
  aporta dos votos, porque son dos cursadas distintas. Los profesores con baja lógica no aparecen;
  sus votos siguen contando para la comisión.
- **Orden.** Promedio exacto descendente; empate por cantidad de votos descendente; después por
  nombre y por id, para que el orden sea estable entre páginas. El promedio que se devuelve se
  redondea a un decimal, igual que la valoración de materias.
- **Mínimo de votos.** Parámetro `minValoraciones` (1 a 100, por defecto 1) para que una comisión
  con un único 5 no encabece el ranking cuando el frontend no lo quiera.
- **Posición.** Cada fila trae `posicion`, global entre páginas (1 es la mejor). Los empates
  exactos reciben posiciones consecutivas según el desempate de orden.
- **Cálculo.** Una consulta SQL agrega por comisión y profesor; el agrupado, el orden y la
  paginación son funciones puras en `reviews/domain/ranking.ts`, probadas sin base de datos.
  Ordenar en memoria alcanza para la cantidad de comisiones de la facultad; si crece, se pasa el
  orden y el `LIMIT` a SQL.
- **Acceso.** Cualquier cuenta con sesión, con los mismos guards que el resto de `ReviewsController`.
  Las respuestas no exponen autores ni ids de usuarios.

## Contrato

Query: `page` (por defecto 1), `pageSize` (1 a 50, por defecto 10), `minValoraciones` (1 a 100,
por defecto 1). Comisiones acepta además `materiaId` y `cursadaId` (la posición se calcula dentro
del filtro); profesores acepta `q` (búsqueda por nombre, sin tildes ni mayúsculas, hasta 150
caracteres). Parámetros desconocidos o inválidos: 400.

- Con `q`, la respuesta incluye a todos los profesores activos que coinciden: primero los del
  ranking (con `posicion`), después los que no llegan al mínimo de votos y los que no tienen votos,
  con `posicion: null` y, sin votos, `valoracion: { promedio: null, cantidad: 0 }`. Sin `q`, solo el
  ranking.
- `GET /rankings/profesores/:id`: la misma fila del profesor (con o sin votos); 404 si no existe o
  tiene baja lógica. Existe porque `GET /profesores/:id` es solo ADMIN.
- `GET /feedback` acepta `profesorId` para listar los comentarios que apuntan a un profesor.

`GET /rankings/comisiones` devuelve `PaginatedResult` de:

```json
{ "posicion": 1,
  "comision": { "id": "…", "nombre": "S-31", "carrera": "S", "activa": true },
  "materia": { "id": "…", "nombre": "Paradigmas de Programación" },
  "cursada": { "id": "…", "anio": 2026, "cuatrimestre": "PRIMERO" },
  "valoracion": { "promedio": 4.5, "cantidad": 12 } }
```

`GET /rankings/profesores` devuelve `PaginatedResult` de:

```json
{ "posicion": 1,
  "profesor": { "id": "…", "nombreCompleto": "Ana Pérez" },
  "valoracion": { "promedio": 4.3, "cantidad": 15 },
  "comisiones": [
    { "comision": { "id": "…", "nombre": "S-31", "carrera": "S", "activa": true },
      "materia": { "id": "…", "nombre": "…" },
      "cursada": { "id": "…", "anio": 2026, "cuatrimestre": "PRIMERO" },
      "cargo": "TITULAR",
      "valoracion": { "promedio": 4.5, "cantidad": 10 } } ] }
```

`cargo` es el cargo actual del profesor en esa comisión, o `null` si ya no está asignado. El
desglose sigue el mismo orden que el ranking.

## Validación

- Unitarias sin PostgreSQL (`tests/ranking.spec.ts`): agrupado, promedio ponderado, redondeo,
  orden y desempates, mínimo de votos, posición entre páginas, validación de query y que la
  consulta excluya bajas lógicas y comentarios sin puntuación.
- Integración HTTP con PostgreSQL aislado (`tests/ranking.integration.spec.ts`), que se saltea sin
  `TEST_DATABASE_URL`.
- `nest build` (no solo `tsc`: el cache incremental puede dar un falso verde), typecheck, lint y
  suite completa del backend.
- Documentar el contrato en `back/OVERVIEW.md` y registrar en `CHANGELOG.md`.

## Implementación

- `back/src/reviews/domain/ranking.ts`: agrupado, promedio ponderado, orden y mínimo de votos.
- `back/src/reviews/application/ranking.service.ts` y `ports/ranking.repository.ts`: validación
  (`validateRankingQuery` en `feedback-input.ts`) y paginación.
- `back/src/reviews/infrastructure/prisma-ranking.repository.ts`: consulta agregada por comisión y
  profesor. Rutas en `reviews.controller.ts`, wiring en `reviews.module.ts`.
- Pruebas: `back/tests/ranking.spec.ts` y `back/tests/ranking.integration.spec.ts`.

## Evidencia

- Prisma client regenerado (el del working copy estaba desactualizado tras el pull).
- `nest build`, typecheck de app y tests, y ESLint de los archivos tocados: aprobados.
- Suite backend: 34 archivos, 814 pruebas aprobadas, 13 archivos de integración salteados.
- Pendiente: `ranking.integration.spec.ts` no se ejecutó porque no hay `TEST_DATABASE_URL` ni Docker
  activo en esta máquina. Correrlo con PostgreSQL aislado antes de cerrar la tarea.

## Etapa 2: vistas del frontend

Diseño en el canvas *Style Guide 2026-UTN-GRUPO-01*, página "Ranking". Decisiones:

- **Profesores** (`/home/profesores`, reemplaza "Próximamente"): buscador por nombre en la URL
  (`?q=`), ranking paginado con puesto, cargos y estrellas, y enlace al perfil.
- **Perfil** (`/home/profesores/[profesorId]`): resumen (promedio, cantidad, puesto), lista "Por
  comisión" sin números de puesto (para no confundirlos con el ranking global) y los comentarios
  con `ExperienceCard`, filtrados por `profesorId`.
- **Ranking global de comisiones** (`/home/materias/ranking`): dentro de Materias, sin tocar el
  menú lateral (zona sensible). Se llega desde el botón "Ranking de comisiones" del encabezado de
  Materias. Filtro de mínimo de valoraciones con `FilterChips` (`?min=1|3|5`).
- **Detalle de materia y de cursada**: cada tarjeta de comisión muestra sus estrellas y la mejor de
  la cursada lleva el distintivo "Mejor valorada", solo si hay al menos dos comisiones valoradas.
  Si el ranking falla, las tarjetas se muestran igual, sin estrellas.
- **Reutilización**: `PageHeader`, `PaginatedListView`, `Pagination`, `FilterChips`, `Badge`,
  `ExperienceCard`, `ValoracionMateria` (ya recibe `{promedio, cantidad}`, se usa tal cual) y la
  superficie de filas de Materias. Nuevos: `ui/SearchForm` (extraído del buscador de Materias, que
  ahora lo usa) y `ranking/RankingList` (filas con puesto).
- **Sin tema oscuro**: la app es solo clara (`color-scheme: light` en tokens).

### Evidencia etapa 2

- Backend: 12 unitarias de ranking y 4 de integración HTTP/PostgreSQL. Suite completa contra
  PostgreSQL aislado (base `utn_ranking_test` y mailpit del compose dev): 45 archivos, 1070 pruebas
  aprobadas. `nest build`, typecheck y lint aprobados. Se actualizó intencionalmente
  `feedback-input.spec.ts`: `profesorId` pasó a ser un filtro válido.
- Frontend: 10 pruebas nuevas (`ranking-views.spec.tsx`); suite completa 79 archivos, 850 pruebas
  aprobadas. Typecheck y lint aprobados.
- Navegador (dev local con datos de demostración): Profesores, búsqueda, perfil, Materias,
  ranking de comisiones y cursada con "Mejor valorada" renderizados a 1280 px; las mismas seis
  vistas a 375 px sin desborde horizontal.
- `next build` aprobado (rutas nuevas: `/home/profesores`, `/home/profesores/[profesorId]`,
  `/home/materias/ranking`).
- Pendiente: simulación de usuario y auditoría UX/UI de governance; revisión del desarrollador.

## Etapa 3: el ADMIN ve los rankings (2026-11-16)

- Pedido del desarrollador: el admin ve lo mismo que el alumno. Como `roleDestination` mantiene al
  ADMIN dentro de `/home/admin` (decisión del equipo), las mismas vistas se montan en
  `/home/admin/ranking`, `/home/admin/ranking/profesores/[id]` y `/home/admin/ranking/comisiones`
  con la prop `admin`; los enlaces a comisiones y comentarios van a los detalles administrativos.
- Menú de administración: ítem "Ranking" (ícono Trophy). Profesores agrega el acceso "Ranking de
  comisiones" en el encabezado, para ambos roles.
- Corrección: `roleDestination("ADMIN", "/home/materias/ranking")` iba a
  `/home/admin/materias/ranking` (tomaba "ranking" como `materiaId`); ahora va al ranking admin.
- Las tarjetas de comisión del detalle administrativo de materia y cursada no muestran estrellas:
  son pantallas de gestión del equipo con otro diseño.
- Evidencia: front 989 pruebas, typecheck, lint y `next build` aprobados. Sin revisión en navegador
  (Docker no disponible en esta sesión).

## Etapa 4: seed de experiencias de demostración (2026-11-16)

- `back/src/reviews/seed-feedback.ts` (+ generador puro `seed-feedback-data.ts`), script
  `feedback:seed`. Crea 40 estudiantes demo con `passwordHash` inválido (no pueden iniciar sesión),
  2 a 6 experiencias por comisión con estrellas, su `FeedbackHistorial` de creación y la
  `ValoracionMateria` de cada estudiante y materia (la de su experiencia más reciente).
- Cada profesor recibe una "reputación" determinista (de 1,8 a 4,7) más ruido, para que el ranking
  tenga extremos. Textos con humor pero dentro de las normas de convivencia.
- Idempotente: ids derivados de un hash de (autor, comisión) y `skipDuplicates`; la segunda
  corrida local creó 0 filas. Cobertura local: 0 materias y 0 comisiones sin valoraciones.
- No corre solo al desplegar: Render ejecuta solo `db:deploy` (migraciones) y los workflows de
  GitHub solo verifican. Se corre a mano, como `academic:seed` (`infra/DESPLIEGUE-CLOUD.md`).
- Datos locales: se borraron los 523 comentarios de demo cargados a mano por SQL en la etapa 2 y se
  reemplazaron por el seed.
