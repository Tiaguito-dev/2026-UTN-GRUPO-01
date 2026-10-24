# TASK-031: Contratos front/back del módulo académico (detalle por id y respuestas validadas)

Estado: Pendiente. Decisiones 1 a 4 confirmadas por el desarrollador el 2026-10-21. Depende de
TASK-027.
Fecha: 2026-10-21

## 1. Contexto y objetivo

El front y el back del módulo académico comparten un contrato que nadie verifica. Inventario
sobre `desarrollo` (`253c650`):

- **El nombre de la materia y el período viajan por la URL.** `?nombre=`, `?anio=` y
  `?cuatrimestre=` se arrastran por el drill-down (`MateriasList.tsx:32`, `CursadasList.tsx:37`,
  `ComisionesList.tsx:26`). Alimentan el título del documento, el `h1` y el breadcrumb
  (`app/home/materias/[materiaId]/page.tsx:7-15` y
  `.../cursadas/[cursadaId]/page.tsx:13-30`) sin pasar por el backend. Un enlace con el nombre
  viejo o editado a mano muestra una materia equivocada sobre datos reales, y sin el parámetro el
  título cae a "Materia" o "Período". React escapa el texto, así que no hay XSS. El problema
  aparece cuando haya reseñas por materia: el usuario puede atribuirlas a la materia que dice la
  URL.
- **Causa: no hay endpoints de detalle.** `back/src/academic/academic.controller.ts:35-55` expone
  solo `GET materias`, `GET materias/:id/cursadas`, `GET cursadas/:id/comisiones` y
  `GET profesores`. Los repositorios ya tienen `findById` (`application/ports/*.repository.ts`), y
  `MateriaNotFoundError` y `CursadaNotFoundError` ya existen en `application/errors.ts`.
- **Respuestas sin validar.** El front valida la forma de la cuenta en runtime
  (`publicAccount()`, `services/auth.ts:7-12`), pero los listados académicos y de usuarios
  confían en un cast: `return body as T` (`services/http.ts:45`). Un cambio de contrato se ve como
  una pantalla rota (`result.items` indefinido) en vez de como un error claro.
  `.ux-governance/patrones.json` ya registra un bug de forma de respuesta.
- **La misma regla escrita dos veces en el front, y otra en el back.** El chequeo de caracteres de
  control está con regex en `front/src/validations/auth.ts:1` y con un bucle de puntos de código en
  `front/src/validations/academic.ts:3-9`. El back usa el bucle (`academic-text.ts:5-11`). Los
  límites (150 materia y profesor, 100 comisión, años 2000 a año actual + 1) se copiaron a mano del
  back (`crear-*-input.ts`) al front (`validations/academic.ts`, altas).

Objetivo: que lo que la pantalla muestra como nombre de materia y período salga siempre del
backend, que una respuesta con forma inesperada se convierta en un error explícito, y que una
regla de validación tenga una sola implementación por lado y un test que detecte si los dos
lados divergen.

Es la Etapa 5 del plan de refactorización del frontend, y la única que toca el backend. Se apoya
en `PaginatedListView` y `PageHeader` de TASK-027.

## 2. Alcance

### 2.1 Backend (`back/`)

- **`GET /materias/:materiaId`.** Caso de uso `ObtenerMateria` en `application/`, que reusa
  `validateId` y `MateriaNotFoundError`. Exige sesión, igual que el listado. Devuelve la misma
  forma que cada ítem de `GET /materias`.
- **`GET /cursadas/:cursadaId`.** Caso de uso `ObtenerCursada`, que reusa `validateId` y
  `CursadaNotFoundError`. Devuelve
  `{ id, anio, cuatrimestre, profesor, materia: { id, nombre } }`: el resumen que hoy arma
  `ListarCursadasPorMateria` más la materia, que es lo que necesita la pantalla de comisiones
  (decisión 1).
- Los dos respetan `docs/standards/soft-delete.md` igual que los listados: un registro dado de
  baja responde 404.
- Registrar los casos de uso en `academic.module.ts`. Tests en `academic.use-cases.spec.ts`
  (id inválido → 400, inexistente → 404, dado de baja → 404, OK) y en
  `academic.integration.spec.ts` (sin sesión → 401, con sesión → 200 y forma exacta).

### 2.2 Frontend: detalle desde el backend

- `services/academic.ts`: `obtenerMateria(id)` y `obtenerCursada(id)`.
- `CursadasList` y `ComisionesList` piden el detalle además del listado. Mientras carga, el título
  y el breadcrumb muestran un marcador neutro ("Cargando…"). Si el detalle da 404, se muestra el
  mismo estado `notFound` que ya existe.
- **Se borran `?nombre`, `?anio` y `?cuatrimestre`** de los enlaces y de las páginas (decisión 2).
  Los `generateMetadata` pasan a un título fijo ("Materia" o "Comisiones"), y el título del
  documento se actualiza en el cliente cuando llega el detalle.
- Se borra `parseCuatrimestre` de `cursadas/[cursadaId]/page.tsx`.

### 2.3 Frontend: respuestas validadas

- Dependencia nueva en `front/`: `zod`, en la misma versión mayor que el back (`^4`).
- `services/schemas.ts`: un esquema por respuesta (`Materia`, `Profesor`, `CursadaResumen`,
  `CursadaDetalle`, `Comision`, `UsuarioRegistrado`) y `paginatedSchema(item)`.
- `protectedGet` y `protectedPost` reciben el esquema y validan antes de devolver. Si falla,
  lanzan `HttpError(502, "El servidor devolvió datos con un formato inesperado. Intentá
  nuevamente.")`, que es el mismo tratamiento que ya tiene `publicAccount`.
- `publicAccount` se reescribe sobre un esquema Zod sin cambiar su comportamiento. Lo cubren los
  tests de contrato de `auth-client.spec.ts`.

### 2.4 Frontend: una regla, una implementación

- `validations/text.ts` con `hasControlCharacters`, el mismo algoritmo de punto de código del
  back. Lo usan `validations/auth.ts` y `validations/academic.ts`. Se borra la regex `CONTROLS`.
- `validations/academic.ts` exporta los límites como constantes (`MAX_NOMBRE_MATERIA = 150`,
  `MAX_NOMBRE_PROFESOR = 150`, `MAX_NOMBRE_COMISION = 100`, `ANIO_MINIMO`). Las altas dejan de
  escribir los números a mano.
- **Test de paridad** `front/tests/validation-parity.spec.ts` (decisión 3). Importa
  `nombreSchema`, `ANIO_MINIMO` y `anioMaximo` del back por ruta relativa y corre la misma tabla de
  casos contra las dos implementaciones: vacío, solo espacios, en el límite, uno más, emoji en el
  límite (puntos de código), C0, DEL, C1 y año fuera de rango. Falla si un lado acepta lo que el
  otro rechaza.

### 2.5 Documentación

- `docs/standards/validacion-con-zod.md`: agregar la sección "Frontend". Cuenta que las
  respuestas se validan con Zod en `services/schemas.ts`, que los formularios siguen con
  funciones propias y que el test de paridad mantiene los dos lados alineados.
- `front/OVERVIEW.md`: sacar la mención a los parámetros de nombre en la URL, si la hay, y
  documentar la validación de respuestas.

## 3. Fuera de alcance

- **Un paquete compartido de esquemas** (`packages/contracts`) consumido por los dos lados. Exige
  un paso de build propio y cambiar `front/Dockerfile`, el build de Render y el de Vercel
  (decisión 3). Se registra en la sección 6 como posible tarea posterior.
- Migrar la validación de `auth` del back a Zod. El estándar la declara deuda registrada en
  Trello, no retroactiva.
- Validar los formularios del front con Zod. Siguen con funciones que devuelven el mensaje en
  español, y el test de paridad cubre las reglas.
- `GET /profesores/:id` y cualquier pantalla de Profesores.
- Cambios en `auth`, `users` o la paginación del back.
- Sincronizar el despliegue (TASK-021). Esta tarea agrega endpoints; desplegarlos sigue el flujo
  habitual.

## 4. Decisiones de diseño

1. **Dos endpoints de detalle, y `GET /cursadas/:id` incluye la materia.** La pantalla
   de comisiones necesita el nombre de la materia y el período en una sola respuesta. Si el
   detalle de cursada no trae la materia, la pantalla tiene que pedir dos detalles en cadena. La
   alternativa de agregar la materia dentro de la respuesta de `GET materias/:id/cursadas` no
   alcanza: la pantalla de comisiones no pasa por ese listado si se abre desde un enlace.
2. **Se borran los parámetros de la URL; no quedan como adelanto mientras carga.**
   Mostrar `?nombre` hasta que llegue el dato real reintroduce el problema durante unos
   milisegundos, y obliga a mantener dos caminos. La URL queda con solo ids, y el título muestra
   "Cargando…" lo que tarda una petición más.
3. **Zod en el front para respuestas, y test de paridad para reglas compartidas; sin paquete
   compartido por ahora.** El paquete compartido es la solución definitiva, pero toca
   tres pipelines de build y dos Dockerfiles, que son área sensible y están en plena
   sincronización (TASK-021). El test de paridad da hoy la garantía que importa, que es detectar
   cuando los dos lados divergen, sin tocar infraestructura. Si el test se vuelve difícil de
   mantener, es la señal para hacer el paquete.
4. **Una respuesta inválida es un 502 con mensaje en español, no una excepción de Zod
  .** Mantiene la regla del estándar ("nunca deja pasar el error nativo de Zod hacia
   afuera"). Además, las pantallas ya muestran `HttpError` con "Reintentar", así que no hace falta
   un estado nuevo.
5. **TDD del lado del back.** Como pide `.agents/OVERVIEW.md`, los tests de los dos casos de uso se
   escriben antes que la implementación.

## 5. Criterios de aceptación

- `GET /materias/:id` y `GET /cursadas/:id` responden según la sección 2.1: 200, 400, 401 y 404
  cubiertos por tests de integración.
- `npm run test --workspace=back` y `npm run typecheck --workspace=back` pasan.
- `grep -rn 'nombre=\|searchParams' front/src/app/home/materias` no devuelve resultados.
- Abrir a mano `/home/materias/<id>?nombre=Cualquier%20cosa` muestra el nombre real de la
  materia.
- `grep -rn 'as T' front/src/services/http.ts` no devuelve resultados, o lo que quede lleva un
  comentario que explique por qué esa respuesta no tiene esquema.
- Un test de servicio confirma que una respuesta de listado sin `items` termina en
  `HttpError(502)` con el mensaje en español.
- `validation-parity.spec.ts` pasa, y falla si se cambia a propósito un límite de un solo lado.
- `grep -rn 'CONTROLS' front/src` no devuelve resultados.
- Los tests de `auth-client.spec.ts`, incluidos los de contrato, pasan sin cambios.
- `npm run lint`, `typecheck`, `test` y `build` del workspace `front` pasan, y el spec visual de
  TASK-023 pasa. El breadcrumb puede mostrar "Cargando…" en la captura si no se espera al detalle:
  el spec tiene que esperar el `h1` definitivo.

## 6. Validación

Pendiente de ejecución.

### Pruebas manuales para el desarrollador

- Recorrer Materias, una materia y una cursada. Los títulos y el breadcrumb muestran los nombres
  reales, y la URL ya no tiene `?nombre`.
- Pegar en el navegador una URL de cursada copiada de otra pestaña: la pantalla de comisiones
  muestra materia y período correctos sin haber pasado por los listados.
- Abrir una materia con un id inexistente: aparece el estado de "no encontrada" con el enlace de
  vuelta.
- Dar de baja una materia desde la base (o con el seed) y abrir su URL: 404.
- Las cuatro altas siguen aceptando y rechazando los mismos valores que antes.

### Posible tarea posterior

- Paquete `packages/contracts` con los esquemas Zod compartidos, consumido por back y front.
  Requiere build propio y cambios en `front/Dockerfile`, el build de Render y el de Vercel.

## 7. Riesgos

1. **Importar código del back desde un test del front.** El back usa `NodeNext` con imports
   terminados en `.js`, y el front resuelve con `bundler`. Vitest suele resolver `.js` a `.ts`,
   pero hay que confirmarlo al escribir el test. Si no lo resuelve, se agrega un alias solo en
   `tests/vitest.config.mjs`, sin tocar los `tsconfig` de producción.
2. **El test de paridad no puede depender de la fecha.** `anioMaximo()` depende del año actual, así
   que el test fija la fecha (`vi.setSystemTime`) en los dos lados.
3. **Una petición más por pantalla.** Cursadas y Comisiones pasan a hacer dos peticiones, detalle y
   listado, que van en paralelo. Es aceptable para el volumen actual. Si molesta, el detalle se
   puede incluir en la respuesta del listado más adelante.
