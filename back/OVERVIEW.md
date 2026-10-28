# Backend

## Modalidad de materia y cursadas por año (TASK-062)

Este es el contrato vigente para materias/cursadas; reemplaza las descripciones históricas
de TASK-024/040/041/044 en las secciones inferiores.

- `Materia.modalidad` es `ANUAL`, `PRIMERO` o `SEGUNDO`; los dos últimos representan dictado
  cuatrimestral. Es independiente de carrera, año de carrera y condición de electiva.
  Lecturas existentes pueden devolver `null` si no existe evidencia suficiente para deducirla.
- `POST /materias` exige `{nombre, modalidad, carreras:[{carrera,anioCarrera,nivelElectiva?}]}`.
  `PATCH /materias/:id` admite `{nombre?,modalidad?,carreras?}`; si recibe modalidad debe
  ser una de las tres opciones. Se registran únicamente diferencias reales, con
  `campo:"modalidad"` en el historial y valores anteriores/nuevos (incluido null anterior).
- `POST /cursadas` exige únicamente `{materiaId,anio}`. Una materia tiene una cursada por
  año calendario, protegida por índice único también bajo concurrencia. Cuatrimestre y otros
  campos ajenos se rechazan con 400. Un duplicado anual devuelve 409.
- Las altas y lecturas de cursada omiten `cuatrimestre`: alta `{id,materiaId,anio,createdAt,
  deletedAt}`, resumen `{id,anio,comisiones,profesores,carreras}`, detalle añade
  `materia:{id,nombre,modalidad}`. El detalle de comisión contiene
  `cursada:{id,anio,materia:{id,nombre,modalidad}}`. La lista de cursadas ordena año descendente
  e id, conserva paginación y cuenta equipos docentes/comisiones según las reglas actuales.
- El campo antiguo `Cursada.cuatrimestre` se conserva nullable solo como legado interno; no se
  propaga mediante filas Prisma crudas ni se usa en nuevas altas, unicidad o etiquetas.
- El snapshot de Feedback agrega `contexto.modalidad`; nuevas publicaciones capturan el
  valor vigente de Materia en la consulta MVCC de contexto. El cuatrimestre histórico se
  conserva nullable por compatibilidad: ANUAL o modalidad desconocida usan null. Editar la
  materia o su modalidad no cambia comentarios previamente publicados.

Aplicar `20261103000000_modalidad_materia_cursada_anual` antes de iniciar el backend nuevo.
La migración es transaccional, no elimina filas ni reemplaza IDs, y bloquea/aborta ante
cursadas duplicadas por materia/año (incluidas bajas) para no fusionar comisiones o comentarios
sin revisión. Solo deduce modalidad de materias con cuatrimestres legados completamente
consistentes; materias sin cursadas o con evidencia contradictoria quedan null. Feedback se
completa desde su propio cuatrimestre guardado, nunca desde la configuración actual.
El seed de demostración usa modalidad explícita y cursadas solo por año, sin modificar
contenido existente. Sin dependencias ni variables de entorno nuevas.

## Feedback textual por comisión (TASK-057)

El módulo `reviews` permite publicar experiencias de una comisión y, opcionalmente, de uno
de sus docentes. No incorpora búsqueda de docentes, puntuaciones, reportes, moderación ni
controles nuevos del estado académico. No acredita inscripción: verifica la sesión y el correo
mediante los guards existentes. ADMIN y USER tienen las mismas reglas de publicación.

### Contratos

Todos los endpoints requieren sesión y responden con `Cache-Control: no-store`. Las escrituras
conservan Origin/CSRF del transporte existente. La autoría se obtiene exclusivamente de la sesión.

| Método y ruta | Contrato |
|---|---|
| `GET /feedback?page=1&pageSize=9` (TASK-061) | Lista transversal autenticada de comentarios vigentes, más recientes primero (`createdAt DESC, id DESC`). |
| `GET /comisiones/:id/feedback?page=1&pageSize=9` | Lista los comentarios vigentes más recientes, con desempate por id. |
| `GET /comisiones/:id/feedback/propio` | Devuelve el comentario vigente del usuario o `null`. |
| `POST /comisiones/:id/feedback` | `{texto, anonimo, profesorId?}`; responde 201 con el comentario. |
| `GET /feedback/:id` | Detalle vigente exclusivo del autor (403 para otras cuentas, incluido ADMIN), sin email ni identificador del autor. |
| `PATCH /feedback/:id` | Solo autor; `{texto?, anonimo?}`. No permite cambiar comisión ni docente. |
| `DELETE /feedback/:id` | Solo autor; baja lógica y revisión en transacción, responde 204. |
| `GET /feedback/:id/historial?page=1&pageSize=3` | Solo autor, incluso tras eliminación; creación, edición y eliminación. |

Listados: `{items,total,page,pageSize}`; máximo nueve comentarios por página y tres revisiones.
Comentario: `{id,texto,anonimo,autor:{displayName}|null,propio,profesor,contexto,createdAt,updatedAt}`.
`profesor` es `null` o `{id,nombreCompleto,cargo}`. `contexto` contiene `comisionId`, `nombre`
de comisión, `materiaId`, `materiaNombre`, `cursadaId`, `anio`, `modalidad` y el
`cuatrimestre` histórico nullable.
Revisión: `{id,accion,texto,anonimo,createdAt}`, con acción CREACION, EDICION o ELIMINACION.
Las fechas se serializan como ISO. El anonimato oculta la identidad incluso al propio autor
en la proyección pública; `propio` habilita sus acciones sin exponer identificadores.
El historial es privado del autor: un ADMIN ajeno tampoco accede a él.

La consulta general de Experiencias (TASK-061) reutiliza los mismos comentarios, proyección
pública y paginación: nueve por defecto y máximo nueve. Devuelve `{items,total,page,pageSize}`,
excluye publicaciones eliminadas y conserva los datos académicos/docentes copiados al publicar,
incluidos períodos anteriores y comisiones inactivas. No reconstruye el contexto desde las
asignaciones actuales. El anonimato continúa ocultando al autor y `propio` se calcula para la
sesión que consulta; no se incluyen `autorId`, email ni historial. No crea otra clase de contenido
ni habilita el detalle privado de comentarios ajenos. Sin sesión responde 401; paginación
inválida o filtros no contemplados responden 400. No requiere migraciones ni nuevas variables.
El método `listGeneral` recorre controller, service y puerto del módulo existente y delega en
la misma consulta transaccional/proyección que `listComision`; los permisos del detalle y las
escrituras permanecen independientes de esta lectura transversal.

### Reglas, persistencia e historial

Texto plano: trim de bordes, 1–3000 puntos de código Unicode; rechaza controles C0/C1 salvo
tabulación y saltos de línea LF/CR. Los cuerpos son estrictos y no aceptan `autorId`.
Un usuario tiene como máximo un comentario vigente por comisión, también bajo anonimato o
para docentes distintos. Puede eliminarlo y publicar otro; la baja conserva la trazabilidad.
La comisión debe estar activa y ella, su cursada y su materia sin baja lógica para publicar
o editar. Retirar y consultar comentarios históricos sigue permitido tras una baja académica.

Sin docentes, la referencia es general. Con uno, se lo asocia automáticamente. Con varios,
se acepta uno asignado o una referencia general. Un docente ajeno se rechaza con 400.
El contexto y el docente/cargo se copian en el alta: una reasignación o cambio de nombre posterior
no reatribuye comentarios anteriores. Editar texto o anonimato conserva esas instantáneas.

`FeedbackService` valida las entradas antes de llamar al puerto `FeedbackRepository`;
`application/feedback-policy.ts` concentra las reglas de autoría, vigencia y selección docente.
`PrismaFeedbackRepository` ejecuta los bloqueos y las transacciones. Alta, edición y baja
bloquean la fila de comisión; el alta obtiene contexto y asignaciones en una única consulta SQL
con una instantánea MVCC consistente. Las escrituras posteriores no reconstruyen el pasado.
El índice parcial UNIQUE `(autorId,comisionId) WHERE deletedAt IS NULL` protege también altas
concurrentes. Los cambios y su revisión se guardan en una transacción; sin diferencias no se
escribe ni genera revisión. Las relaciones de autor, comisión y docente usan borrado restringido.

Errores: 400 datos/campos/paginación inválidos, 401 sin sesión, 403 autoría insuficiente,
404 comentario/comisión inexistente, 409 publicación duplicada o comisión inactiva.
El controlador nunca devuelve filas Prisma ni credenciales de identidad interna.

Aplicar `20261102000000_feedback_comisiones` con el flujo habitual `db:deploy` antes de iniciar
el código nuevo. Es aditiva, utiliza `DATABASE_URL` y no requiere dependencias ni variables
nuevas; conserva Docker, PostgreSQL y el contrato de despliegue existente.

## Catálogo de materias: filtros independientes y orden alfabético (TASK-060)

Contrato vigente de `GET /materias`; prevalece sobre las descripciones de listado históricas
de TASK-024, TASK-025, TASK-041 y TASK-044 que aparecen más abajo. No cambia autenticación,
permisos, escrituras, detalle ni el historial de materias.

- `carrera` y `anioCarrera` son filtros opcionales e independientes. Por ejemplo,
  `?anioCarrera=2` encuentra materias de segundo año de cualquier carrera; `?carrera=Q`
  encuentra materias de Química de cualquier año. Juntos deben coincidir sobre la misma
  asociación `MateriaCarrera`, evitando mezclar el año de una carrera con otra carrera.
- `nivelElectiva` sigue requiriendo `anioCarrera=ELECTIVA`, con o sin carrera. Filtros fuera
  del catálogo, parámetros repetidos y nivel sin Electiva continúan devolviendo 400.
- `q` busca una subcadena literal del nombre sin distinguir mayúsculas ni diacríticos:
  `algebra` encuentra `Álgebra`, y ambas direcciones con tildes funcionan. `%`, `_` y barra
  inversa son caracteres literales, nunca comodines aportados por el usuario. Se conserva
  el límite de 150 puntos de código, trim y rechazo de controles.
- La respuesta conserva `{items,total,page,pageSize}` y todas las asociaciones `carreras`
  de cada materia, aunque solo una asociación haya coincidido con los filtros. Cada materia
  cuenta una vez en `total` y en el corte de página. El frontend puede mostrarla en varios
  grupos sin duplicarla en el conteo del backend.
- El orden se calcula antes de paginar sobre el nombre en minúsculas sin diacríticos, con
  nombre original e id como desempates. No se ordena por año ni nivel. Página predeterminada
  de nueve materias; se mantiene el máximo de 100 para opciones administrativas existentes.

El adaptador usa SQL parametrizado con `EXISTS` sobre una única asociación y la misma
condición de filtro para IDs de página y conteo. Solo esos IDs se hidratan con Prisma;
no se descarga el catálogo completo. Las consultas comparten una transacción de lectura
`RepeatableRead` para conservar el mismo estado al contar, cortar e hidratar las asociaciones.
Se preserva el orden de los IDs de la consulta incluso si la hidratación devuelve otro orden.

La búsqueda y el orden usan PostgreSQL UTF-8 `normalize(..., NFD)`, `translate` para eliminar
marcas combinadas U+0300–U+036F y `lower`; el término utiliza la misma normalización antes
de escapar los metacaracteres. Incluye tildes, diéresis y la tilde de ñ. No altera nombres
guardados ni necesita extensiones `unaccent`, migraciones, dependencias o variables nuevas.
Continúa usando el PostgreSQL existente en Docker y producción.

## Materias: clasificación, filtros e historial (TASK-024)

Casos de contrato, permisos, consulta PostgreSQL e historial verificados:
[matriz de trazabilidad TASK-024](../docs/tasks/finished/TASK-024-filtros-materias-anio-carrera.md#trazabilidad-de-casos-probados).

`Materia.anioCarrera` admite las cadenas `1`, `2`, `3`, `4`, `5`, `ELECTIVA`.
La migración `20261022000000_materia_anio_carrera` conserva `null` para datos heredados
sin clasificación; el administrador debe asignar un valor válido al editarlos. No se
confunde esta clasificación con `Cursada.anio`, que representa el año calendario.
El seed de demostración conserva materias sin clasificación hasta que un administrador
indique su año según el plan de estudios; no infiere valores a partir del nombre.

Contrato HTTP (siempre requiere sesión; escrituras solo ADMIN):

- `GET /materias?anioCarrera=2&page=1&pageSize=9`: filtro opcional por clasificación;
  página por defecto 1, tamaño por defecto 9 y máximo 100 para cargar opciones administrativas.
  El listado de estudiantes solicita páginas de nueve. Orden fijo por año, nombre e id
  antes de paginar; Electiva sigue al quinto año y los valores heredados nulos van al final.
- `GET /materias/:materiaId`: detalle activo con `id`, `nombre`, `anioCarrera`,
  `nivelElectiva`, `createdAt`, `deletedAt`.
- `POST /materias`: cuerpo estricto `{nombre, anioCarrera, nivelElectiva?}`; nombre
  normalizado de 1 a 150 caracteres, año obligatorio y nivel obligatorio para electivas.
  Retorna la materia creada.
- `PATCH /materias/:materiaId`: cuerpo estricto con diferencias de `nombre` y/o
  `anioCarrera` y/o `nivelElectiva`. Rechaza clasificación nula y años fuera de catálogo. Retorna el detalle
  actualizado; los valores idénticos no generan escritura ni historial.
- `GET /materias/:materiaId/historial?page=1&pageSize=3`: exclusivo para rol ADMIN (`@Roles("ADMIN")`,
  403 para otros roles); tamaño por defecto y máximo 3, más reciente primero con desempate por id.
  Cada elemento contiene `id`, `materiaId`, `actorId`, `actor: { id, displayName }`, `createdAt` y
  `cambios: [{campo, anterior, nuevo}]`; `campo` es `nombre`, `anioCarrera`, `nivelElectiva` o `carreras`.
  Los valores anterior y nuevo admiten null. No se publican correos ni otros datos sensibles del actor.

Ambos listados retornan `{items,total,page,pageSize}`. Validación inválida devuelve 400,
sesión ausente 401, rol insuficiente 403, materia inexistente/inactiva 404 y nombre
duplicado 409, con mensaje seguro. Las escrituras conservan protección Origin/CSRF.

Los casos de uso `ListarMaterias`, `ObtenerMateria`, `CrearMateria`, `ActualizarMateria`
y `ListarHistorialMateria` dependen del puerto `MateriaRepository`; Zod valida entradas
y el adaptador Prisma filtra en PostgreSQL. La edición bloquea la fila y registra cambios
y actor en una única transacción para mantener valores anteriores correctos ante concurrencia.
La tabla `MateriaHistorial` referencia materia y usuario con borrado restringido; los índices
cubren listado e historial y una restricción SQL limita las clasificaciones admitidas.
Aplicar migraciones con `npm run db:deploy --workspace=back` antes de iniciar el backend;
Docker y Compose utilizan el mismo esquema y la misma variable `DATABASE_URL`.

### Búsqueda y niveles de electivas (TASK-025)

Casos y resultados verificados en la
[matriz de trazabilidad TASK-025](../docs/tasks/finished/TASK-025-busqueda-materias-niveles-electivas.md#matriz-de-trazabilidad-de-casos-probados).

`GET /materias` acepta además `q` y `nivelElectiva`. La búsqueda recorta espacios de
borde, admite hasta 150 caracteres Unicode, rechaza controles y considera texto vacío
como búsqueda ausente. Busca una subcadena del nombre sin distinguir mayúsculas, con
`%`, `_` y barra inversa literales; no interpreta comodines del usuario. Se combina con
`anioCarrera` y `nivelElectiva` antes de paginar y contar. Arrays/parámetros repetidos
no son válidos. Nivel solo admite las cadenas `3`, `4` y `5` junto con
`anioCarrera=ELECTIVA`; usarlo para otro año devuelve 400.

El orden es año de carrera, nivel de electiva, nombre e id; los niveles desconocidos
se colocan después del quinto nivel y las materias sin año después de Electivas.
Una obligatoria siempre guarda `nivelElectiva:null`, de modo que su orden por nombre
se conserva. El detalle y los elementos del listado incluyen el campo nullable.

`POST /materias` y `PATCH /materias/:materiaId` admiten `nivelElectiva` (`3`, `4`, `5`
o null). Si la materia efectiva es electiva, exige nivel válido: en una edición puede
reutilizar el existente si se omite el campo; una electiva heredada sin nivel debe
completarlo incluso al cambiar solo su nombre. Un null explícito no borra el nivel de
una electiva. Para obligatorias, un nivel válido recibido se normaliza a null; al
cambiar de electiva a obligatoria se limpia aunque el cliente omita ese campo y se
registra `nuevo:null` en el historial. Los valores fuera de catálogo siempre son 400.
El backend recalcula esta regla después de bloquear la fila para evitar inconsistencias
en ediciones simultáneas, y solo audita diferencias reales.

La migración aditiva `20261022010000_materia_nivel_electiva` agrega columna nullable,
restricción de catálogo y consistencia con Electiva, e índice de listado con nivel.
Los registros existentes conservan null sin inferir el plan de estudios. No requiere
nuevas variables ni dependencias y utiliza el proceso habitual de migración en Docker.

### Carreras, comisiones nuevas y profesores por comisión (TASK-040)

Doble escritura: la API escribe el modelo nuevo y sigue aceptando las formas legadas, que se
retiran en TASK-044. Enviar las dos formas a la vez es 400.

- Materia: `{nombre, carreras: [{carrera, anioCarrera, nivelElectiva?}]}` (mínimo 1, sin carrera
  repetida) o la legada `{nombre, anioCarrera, nivelElectiva?}`, que se guarda como carrera `S`.
  Con `carreras`, las columnas legadas toman la primera fila tal como llega.
- Comisión: `{cursadaId, carrera, numero}` (número 1-999, carrera de la materia; nombre
  `S-1`) o la legada `{cursadaId, nombre}` con `carrera`/`numero` null.
- Cursada: `profesorId` opcional.
- `PUT /comisiones/:comisionId/profesores/:profesorId {cargo}` (upsert, devuelve
  `{id, nombreCompleto, cargo}`) y `DELETE` (204), ambos ADMIN. 404: `ComisionNotFoundError`,
  `ProfesorNotFoundError`, `ProfesorNoAsignadoError`.
- Historial: un `PATCH` con `carreras` registra un solo cambio `campo: "carreras"` serializado
  como `S:2,Q:ELECTIVA:4` (orden S, C, Q, I, M; nivel solo si existe), con `serializarCarreras`.
- Quitar una carrera con comisiones no borradas es 409 `CarreraConComisionesError`. El chequeo
  corre fuera del lock de la materia: una comisión creada en simultáneo puede pasar.
- La migración `20261027000000_materia_carrera_backfill` crea la fila `S` de cada materia con año.

### Lecturas con carreras y comisiones (TASK-041)

Las respuestas suman campos sin quitar ninguno. Los legados (`anioCarrera`/`nivelElectiva` de
materia, `profesor` del resumen de cursada, `nombre` de comisión) se retiran en TASK-044.

- Materia: toda respuesta suma `carreras: [{carrera, anioCarrera, nivelElectiva}]` (orden S, C, Q, I, M).
- `GET /materias?carrera=Q`: parte de `MateriaCarrera`; año, nivel y `q` filtran sobre esa fila y se
  ordena por año, nivel (nulos al final), nombre e id. Sin `carrera`, filtros y orden legados.
  Materias sin fila de carrera no aparecen con ningún `?carrera=`.
- Resumen de cursada (`GET /materias/:id/cursadas`, `GET /cursadas/:id`): suma `comisiones` y
  `profesores` (cantidades sobre comisiones activas y no borradas; profesores distintos y no
  borrados) y `carreras` (letras de esas comisiones, sin nulos, por enum).
- Comisión (listado y alta): suma `carrera`, `numero` (null en legadas) y
  `profesores: [{id, nombreCompleto, cargo}]` por cargo y nombre. El listado ordena por carrera,
  número (nulos al final) y nombre, e incluye inactivas.
- `GET /comisiones/:comisionId` (sesión): comisión + `cursada {id, anio, cuatrimestre, materia {id, nombre}}`.
  404 `ComisionNotFoundError` si la comisión, su cursada o su materia están borradas; las inactivas se devuelven.

### Contracción del modelo legado (TASK-044)

Cierre de la migración expand-contract de carreras y comisiones:

- **Modelo y Base de Datos**:
  - `Comision`: `carrera` y `numero` obligatorios (`NOT NULL`, check `numero BETWEEN 1 AND 999`), índice único `[cursadaId, carrera, numero]`. Columna `nombre` eliminada; el nombre se deriva dinámicamente como `${carrera}-${numero}`.
  - `Cursada`: columna `profesorId` y su clave foránea/índice eliminados. El resumen y detalle no consultan `ProfesorRepository` (sin N+1).
  - `Materia`: columnas `anioCarrera` y `nivelElectiva` y sus checks e índices eliminados.
  - Migración `20261101000000_contraer_modelo_legado`.
- **Contratos HTTP y Validación**:
  - `POST /materias`: exige `{ nombre, carreras: [...] }`. `anioCarrera` y `nivelElectiva` en el body devuelven 400 `CAMPOS_NO_PERMITIDOS`.
  - `PATCH /materias/:id`: solo `{ nombre?, carreras? }`. Campos legados devuelven 400 `CAMPOS_NO_PERMITIDOS`.
  - `POST /cursadas`: exige `{ materiaId, anio, cuatrimestre }`. `profesorId` devuelve 400 `CAMPOS_NO_PERMITIDOS`.
  - `POST /comisiones`: exige `{ cursadaId, carrera, numero }`. `nombre` devuelve 400 `CAMPOS_NO_PERMITIDOS`.
  - `GET /materias`: sin filtro de `carrera`, ordena por `nombre ASC, id ASC`. Enviar `anioCarrera` o `nivelElectiva` sin `carrera` devuelve 400.
  - `GET /materias/:id/historial`: omite `actorId` en la respuesta (conserva `actor: { id, displayName }`), y mantiene `anioCarrera` y `nivelElectiva` en el enum `campo` para auditoría histórica.
- **Despliegue (orden invertido)**:
  - Al eliminar columnas de la base de datos, el código nuevo (que ya no las referencia) debe desplegarse en Render ANTES de correr `db:deploy` en Neon, para evitar caídas por columnas faltantes mientras la versión anterior esté atendiendo tráfico.

## Contenedor

`back/Dockerfile` construye desde la raíz con Node 22.22.3 y npm workspaces.
El target `runtime` usa usuario `node`, dependencias productivas y readiness `/health/ready`
con comprobación de PostgreSQL; `/health` comprueba únicamente el proceso.
El target `migration` contiene Prisma CLI y ejecuta `db:deploy` como job separado.
NestJS habilita shutdown hooks para desconectar Prisma durante el apagado.
La excepción SMTP sin TLS exige desarrollo y host explícito en
`SMTP_LOCAL_PLAINTEXT_HOSTS`; Compose autoriza solamente `mailpit`.
Configuración, secretos, red y comandos: [infra/OVERVIEW.md](../infra/OVERVIEW.md).

API HTTP escrita en TypeScript con NestJS. PostgreSQL es la base de datos relacional y Prisma
ORM concentra el esquema, las migraciones y el acceso tipado a datos.

## Estado actual

Desde TASK-022, el registro público de estudiantes queda pendiente hasta verificar el correo.
`User.emailVerifiedAt = null` impide login, acceso autenticado y refresh; también aplica a
estudiantes existentes. Los administradores provisionados explícitamente conservan acceso.
`POST /auth/register` entrega el enlace por SMTP sin crear sesión; ante fallo de entrega
responde 503 y conserva la cuenta pendiente. `POST /auth/verify-email` recibe `{ token }`
y confirma con 204; `POST /auth/resend-verification` recibe `{ email }` y responde 202 genérico.
Los tokens se persisten como SHA-256, vencen en 24 horas y se consumen atómicamente. Repetir
una confirmación ya completada devuelve 204 sin nuevas mutaciones. La recuperación de contraseña
no verifica el correo. Aplicar la migración `20261020000000_email_verification` antes de iniciar.
El enlace usa `/verify-email` sobre el origen de `AUTH_PASSWORD_RESET_URL`.
Detalle y evidencia: [TASK-022](../docs/tasks/finished/TASK-022-verificacion-correo-institucional.md).

Las etapas 1–4 están implementadas y el frontend consume sus contratos: registro, login,
cuenta, refresh con rotación, logout, recuperación y cambio de contraseña. Los roles son
`ADMIN` y `USER`; todavía no hay funcionalidades académicas. Las secciones por etapa
describen la evolución; prevalecen los contratos actuales: contraseñas nuevas de 8–128
caracteres, access de 15 minutos y sesión absoluta de 7 días.

Para levantar el proyecto, seguir el [README raíz](../README.md) y la
[guía de infraestructura](../infra/OVERVIEW.md). Compose utiliza el `.env` privado de la
raíz; no necesita archivos de entorno en `back/` y `front/`. Desarrollo funciona en
`http://localhost:8080`, sin certificados locales. Producción requiere HTTPS.

## Estructura

- `src/`: módulos, controllers y services de NestJS.
- `src/infrastructure/prisma/`: módulo global de acceso a datos.
- `prisma/schema.prisma`: contrato de datos; los modelos se agregan con cada módulo funcional.
- `prisma/migrations/`: migraciones versionadas generadas por Prisma.
- `tests/`: pruebas automatizadas del backend.

## Contratos iniciales

- `GET /health`: responde `{ "status": "ok", "service": "back" }` cuando la API está activa.
- `DATABASE_URL`: conexión PostgreSQL utilizada por Prisma.
- `BACKEND_PORT`: puerto HTTP opcional; el valor predeterminado es `3001`.

## Comandos

- `npm run dev:back`: inicia NestJS en desarrollo desde la raíz.
- `npm run build --workspace=back`: genera Prisma Client y compila el backend.
- `npm test --workspace=back`: ejecuta las pruebas con Vitest.
- `npm run lint --workspace=back`: ejecuta ESLint (`eslint . --max-warnings 0`), mismo criterio
  de severidad que `front` (toda regla activa es error).
- `npm run db:generate`: regenera Prisma Client.
- `npm run db:migrate`: crea y aplica una migración de desarrollo.
- `npm run db:studio`: abre Prisma Studio.
- `npm run academic:seed --workspace=back`: carga el contenido académico de demostración
  (3 materias con sus cursadas y comisiones; profesores ficticios a propósito). Requiere
  `DATABASE_URL` y migraciones aplicadas, y `npm run build --workspace=back` previo porque es un
  comando compilado, igual que `auth:provision-admin`. Es aditivo e idempotente: puede correrse
  más de una vez y nunca borra ni modifica datos existentes. Detalle y decisiones:
  [docs/temporal/05-consulta-de-contenido.md](../docs/temporal/05-consulta-de-contenido.md).

## Autenticación de Profesor Butchery: etapa 1

Esta etapa implementa cuentas locales con
roles ADMIN y USER. La investigación institucional TASK-004 queda separada de este contrato.

### Responsabilidades

- `src/users/domain/`: cuenta, proyección pública, normalización y puerto UserRepository.
- `src/users/infrastructure/`: Prisma y traducción del conflicto UNIQUE a error de dominio.
- `src/auth/application/`: RegisterUser y ProvisionAdmin, sin imports de NestJS ni Prisma.
- `src/auth/domain/`: validación estricta, errores y puerto PasswordHasher.
- `src/auth/infrastructure/`: adaptador Argon2id.
- Providers NestJS conectan los puertos; el controlador solo traduce HTTP y delega.

User contiene UUID, email, displayName, passwordHash, role y createdAt. El índice UNIQUE de email
protege también las altas concurrentes. No hay actualizaciones, borrados, relaciones ni endpoints
de historial en esta etapa; createdAt registra el alta. No se agregan estructuras para etapas futuras.

### Validaciones y hash

Email ASCII local@dominio, máximo 254 caracteres (parte local hasta 64): trim y lowercase.
Se conservan puntos y alias `+`. Todas las búsquedas y creaciones del adaptador usan esa política.
Nombre visible: trim, 1–100 puntos de código Unicode, sin controles.
Contraseña: 8–128 puntos de código Unicode, sin trim, normalización ni reglas de composición.
El mínimo de 8 se aplica al registro, provisión administrativa, restablecimiento y cambio de
contraseña. Es una decisión explícita de TASK-011; las cuentas existentes conservan sus hashes.
Los espacios se preservan. Argon2id versión 19, memoria 19456 KiB, 2 iteraciones, paralelismo 1,
hash de 32 bytes y sal aleatoria por hash; almacenamiento PHC con parámetros y sal.
Referencias: [node-argon2](https://github.com/ranisalt/node-argon2) y
[OWASP](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html).

### Contrato HTTP

`POST /auth/register`, Content-Type: application/json. A partir de etapa 2 exige Origin permitido
y X-CSRF-Protection:1 (ver transporte/CSRF abajo). Solo acepta email, displayName y password;
role y cualquier otro campo reciben 400, aunque role sea USER.

```json
{
  "email": " Usuario@Example.org ",
  "displayName": "Usuario de ejemplo",
  "password": "una frase larga de ejemplo"
}
```

HTTP 201 (UUID y fecha ilustrativos):

```json
{
  "id": "bc6ab8ca-dd20-46c9-a031-d7c7b347468d",
  "email": "usuario@example.org",
  "displayName": "Usuario de ejemplo",
  "role": "USER",
  "createdAt": "2026-10-08T12:00:00.000Z"
}
```

400: datos inválidos/campos no permitidos. 409: email registrado. Se conserva el formato NestJS:
`{ "statusCode": 409, "error": "Conflict", "message": "..." }`. Los errores no incluyen
credenciales, entradas inválidas ni detalles del ORM. Fallos inesperados usan un mensaje 500 seguro.
El filtro de registro sanitiza errores de parseo previos al controlador para que JSON malformado
no refleje fragmentos sensibles; conserva los mensajes de validación del dominio.
Sin passwordHash, password, token ni cookie de sesión. El registro público fija USER; no hay
endpoint ADMIN. La etapa 2 agrega autenticación y guards de permisos descritos más abajo.

### Migración y comandos

Desde la raíz con Node.js 22.22.3, npm 10 y DATABASE_URL configurada:

```sh
npm ci
npm run db:deploy --workspace=back
npm run build --workspace=back
npm run start --workspace=back
```

Migración `20261008000000_auth_users`: crea tabla User, enum UserRole e índice único sin eliminar
datos. db:deploy aplica migraciones versionadas; db:migrate sigue reservado a desarrollo.
Se conserva Docker Compose/PostgreSQL y conexión cloud por DATABASE_URL. Argon2 ofrece binarios
Windows/Linux/Alpine; instalar dependencias en destino, sin copiar node_modules entre plataformas.

### Provisión administrativa

Configurar DATABASE_URL, ADMIN_EMAIL, ADMIN_DISPLAY_NAME y ADMIN_PASSWORD desde el gestor de
secretos del entorno o `.env` local ignorado. `.env.example` solo lista nombres vacíos. No guardar
credenciales reales en archivos versionados ni pasarlas como argumentos del comando.

```sh
npm run build --workspace=back
npm run auth:provision-admin --workspace=back
```

Con el stack Docker ya iniciado, crear un archivo privado `.env.admin` en la raíz con
`ADMIN_EMAIL`, `ADMIN_DISPLAY_NAME` y `ADMIN_PASSWORD` (valores propios, no versionados).
El Compose utilizado debe disponer de `--env-from-file` en `docker compose run --help`;
esa opción fue comprobada en la instalación del proyecto. Ejecutar desde la raíz:

```sh
docker compose -f docker-compose.dev.yml run --rm --no-deps --env-from-file .env.admin backend node dist/auth/provision-admin.js
```

`run` crea un contenedor temporal; `--rm` lo retira al terminar y `--no-deps` usa el PostgreSQL
ya iniciado sin levantar otro stack. El archivo aporta solo las credenciales administrativas;
la conexión interna a PostgreSQL proviene de Compose. En versiones sin esa opción, exportar
las tres variables mediante configuración privada del proceso y usar `-e ADMIN_EMAIL
-e ADMIN_DISPLAY_NAME -e ADMIN_PASSWORD` en su lugar, sin poner sus valores en los argumentos.

El comando es explícito y no se ejecuta en el inicio HTTP. Crea ADMIN si el email está libre;
un ADMIN existente produce no-op sin reemplazar nombre/contraseña. USER existente aborta con
mensaje claro y salida no cero. Tras una carrera de inserción vuelve a consultar y verificar rol.
No imprime email, contraseña, hash ni excepciones de infraestructura.

### Verificación y pendientes

```sh
npm run build --workspace=back
npm run typecheck --workspace=back
npm test --workspace=back
```

Integración exige TEST_DATABASE_URL hacia una base exclusivamente de pruebas; aplicar db:deploy
con DATABASE_URL apuntando a esa base antes de ejecutar. Usa HTTP en puerto efímero, Prisma y
Argon2 reales y limpia solo cuentas creadas por el suite. Sin variable, integración se omite.
Evidencia: [TASK-005](../docs/tasks/finished/TASK-005-auth-etapa-1.md).

La etapa 2 implementa login, JWT, sesiones y autorización según la sección siguiente.

## Autenticación: etapa 2

Se conservan registro, usuarios, Argon2id,
provisión ADMIN, PostgreSQL, Prisma y Vitest. El frontend se integró posteriormente;
su estado actual está documentado en [front/OVERVIEW.md](../front/OVERVIEW.md).

### Responsabilidades y sesión

- `auth/application/login.ts`: Login verifica credenciales y devuelve cuenta pública/credencial
  a presentación, sin HTTP, cookies ni ORM. Un email desconocido también verifica un hash Argon2id
  señuelo aleatorio con los mismos parámetros, generado al iniciar los providers.
- `auth/application/authenticate-request.ts`: verifica JWT por puerto, sesión por puerto y usuario
  por puerto; construye exclusivamente id/email/displayName/role con rol vigente en persistencia.
- `auth/domain/session.repository.ts`: create/findValidById específicos, sin CRUD genérico.
- `auth/domain/access-token.ts`: issue/verify; `infrastructure/jose-access-token.ts` usa jose.
- `infrastructure/prisma-session.repository.ts`: adaptador Session con FK a User.
- `presentation/`: cookie, autenticación, decorador Roles, autorización y protección HTTP.
- `auth.config.ts`: configuración validada al inicio HTTP; `auth.module.ts`: composición DI.
- `admin-provision.module.ts`: composición CLI separada, sin necesitar configuración JWT/CORS.

Session contiene UUID, userId, createdAt, expiresAt y revokedAt opcional; relación a User con
borrado restringido e índice userId/createdAt. Migración aditiva `20261008010000_auth_sessions`:
crea tabla, FK e índice sin eliminar usuarios ni modificar hashes. Aplicar con
`npm run db:deploy --workspace=back` antes del build/inicio.

El caso de uso prepara Session, firma y luego persiste; solo retorna credenciales si la escritura
termina. Fallo de firma no deja fila; fallo de persistencia no entrega tokens. Desde etapa 3 se
persisten sesión y refresh inicial en una misma transacción; la sesión vence en un plazo absoluto
independiente de exp del access token (ver etapa 3). Sin credenciales válidas no se crea sesión.

### Configuración obligatoria y JWT

| Variable | Regla |
|---|---|
| AUTH_JWT_SECRET | Aleatorio base64url canónico sin padding, al menos 32 bytes; sin valor de respaldo |
| AUTH_JWT_ISSUER | Emisor requerido, sin controles |
| AUTH_JWT_AUDIENCE | Audiencia requerida, sin controles |
| AUTH_ACCESS_TTL_SECONDS | Entero 60–3600; inicial 900 (15 minutos) |
| AUTH_SESSION_TTL_SECONDS | Entero 60–2592000 y >= access TTL; inicial 604800 (7 días), absoluto |
| AUTH_PUBLIC_URL | Origen público exacto de API, HTTPS en producción, sin path ni slash final |
| AUTH_ALLOWED_ORIGINS | Lista de orígenes exactos separada por comas; sin wildcard, null, paths ni credenciales |
| AUTH_ALLOW_LOCAL_HTTP | true exclusivamente con NODE_ENV=development, API/orígenes HTTP loopback; inicial false si se omite |
| AUTH_COOKIE_SAME_SITE | none/lax/strict; inicial none para HTTPS y lax para local; none exige Secure |
| AUTH_LOGIN_MAX_ATTEMPTS | Entero 1–1000; inicial 10 |
| AUTH_LOGIN_WINDOW_SECONDS | Entero 1–86400; inicial 900 |
| AUTH_REFRESH_MAX_ATTEMPTS | Entero 1–1000; inicial 30 |
| AUTH_REFRESH_WINDOW_SECONDS | Entero 1–86400; inicial 900 |
| AUTH_TRUSTED_PROXIES | Opcional, IP/CIDR exactos de proxies controlados, sin /0 ni trust=true |
| AUTH_TRUSTED_PROXY_HOPS | Opcional y excluyente con la anterior, entero 1–10; para plataformas administradas (Render) cuya IP de edge no es declarable |

DATABASE_URL sigue siendo necesaria. Configuración incompleta/incorrecta impide que el servidor
escuche. Obtener secretos del gestor privado del entorno; `.env.example` no contiene claves.
Para generar un secreto local y capturarlo en configuración sin imprimirlo, PowerShell:

```powershell
$env:AUTH_JWT_SECRET = node -e "process.stdout.write(require('node:crypto').randomBytes(32).toString('base64url'))"
```

El código fija HS256 y typ JWT; emite sub (UUID User), sessionId (UUID), iat, exp, iss y aud.
Valida firma, algoritmo, tipo, vencimiento, emisor, audiencia, UUID, fechas enteras, duración e iat
no futuro. Rechaza claims/headers inesperados, aud como array y tokens malformados. No contiene
role: su autoridad es User actual en DB. El JWT no se almacena en la base ni se registra en logs.
La duración JWT debe ser positiva y no superar access TTL; puede ser más corta cuando la sesión
está por vencer. Reducir access TTL rechaza tokens más largos; mantener configuración consistente.

### Cookies, CSRF, CORS y despliegue

`configureAuthHttp(app, config)` se instala antes de app.init/listen en main.ts y en tests HTTP:
incluye no-store, HTTPS, CSRF, CORS y límite de intentos. Todo /auth, incluidos errores de parser,
guard y middleware, responde Cache-Control:no-store. Errores mantienen formato NestJS seguro.

Cookie access host-only, Path=/, HttpOnly, Expires/Max-Age consistentes con exp. En HTTPS su nombre es
`__Host-butchery_access` y siempre tiene Secure; en local explícito `butchery_access` sin Secure.
No hay Domain ni credencial en JSON, Authorization Bearer o localStorage. Guard solo acepta la
cookie configurada y rechaza múltiples cookies con ese nombre.
Etapa 3 incorpora además cookie refresh host-only con Path=/auth (ver abajo).

La topología Vercel/Render usa sitios distintos: requiere HTTPS y SameSite=None, ambos orígenes
exactos configurados. Si hay terminación TLS en proxy, configurar únicamente sus IP/CIDR reales;
por defecto se ignoran X-Forwarded-For/Proto. HTTP solo se acepta en desarrollo explícito,
desde una conexión loopback o desde el socket de un proxy configurado como confiable.
Compose dev publica ese proxy únicamente en loopback; la configuración de API y orígenes
HTTP exige también localhost/loopback. Se usa la función de confianza compilada de Express
sobre la dirección del socket, nunca Host ni una IP reenviada por el cliente. Producción
rechaza AUTH_ALLOW_LOCAL_HTTP=true al arrancar y conserva HTTPS obligatorio.
Algunos navegadores bloquean cookies de terceros aun con SameSite=None. La solución de despliegue
es un origen/sitio común mediante proxy o dominios comunes, manteniendo las protecciones; esta
entrega no configura infraestructura cloud ni desactiva políticas de navegador.

CSRF para todos los métodos inseguros (incluido login/registro): Origin debe coincidir exactamente
con la allowlist y X-CSRF-Protection debe ser `1`. Sin Origin, null o cabecera incorrecta: 403.
Login/registro requieren application/json (sin formulario simple). El header fuerza preflight;
CORS permite solo los orígenes definidos, credentials:true y headers Content-Type/X-CSRF-Protection.
El navegador debe usar fetch con credentials:'include'. CLI envía los mismos headers. No hay
endpoint CSRF adicional porque se usa validación de origen más cabecera personalizada.
Referencia: [OWASP CSRF](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html).

El límite usa express-rate-limit por IP (IPv6 normalizada por biblioteca), cuenta todos los intentos
de POST /auth/login, incluidos éxitos, y retorna 429 con Retry-After. El store inicial vive en memoria
por proceso y reinicia con él. No es un límite global entre réplicas: antes de escalar debe conectarse
un store compartido compatible o aplicarse el límite en el gateway. Detrás de proxy solo se usa la
cadena reenviada tras configurar proxies controlados explícitos; sin proxy se usa la IP de conexión.
El proxy controlado debe reemplazar/normalizar las cabeceras de IP y protocolo del cliente antes
de reenviar; no configurar trust por número de saltos ni aceptar cabeceras a través de rutas no controladas.

### Contratos y autorización

`POST /auth/login` solo acepta email/password. Email mantiene trim/lowercase y validación de alta;
password admite 1–128 puntos Unicode sin trim/normalización al verificar cuentas existentes;
la política 8–128 se aplica al crear o reemplazar una contraseña.

```json
{ "email": "usuario@example.org", "password": "una frase larga de ejemplo" }
```

200 devuelve cuenta pública (id, email, displayName, role, createdAt) y Set-Cookie exclusivo.
400 datos/formato inválidos o campos no permitidos. 401 email inexistente o contraseña incorrecta,
mismo mensaje: `Email o contraseña incorrectos.`. 403 transporte/CSRF rechazado. 429 límite de
intentos. Fallos inesperados: 500 seguro, sin detalle de persistencia ni stack.

`GET /auth/me` exige AuthenticationGuard y devuelve únicamente:

```json
{ "id": "bc6ab8ca-dd20-46c9-a031-d7c7b347468d", "email": "usuario@example.org", "displayName": "Usuario", "role": "USER" }
```

401 si token/sesión inválidos, vencidos, revocados, ausentes o sesión pertenece a otro usuario.
El guard usa AuthenticateRequest y no consulta Prisma directamente. Exige exp no posterior a
Session.expiresAt e iat no anterior a Session.createdAt. Para operaciones reales declarar `@Roles('ADMIN')` junto a
`@UseGuards(AuthenticationGuard, RolesGuard)`: autenticación faltante 401, rol insuficiente 403.
La autorización se verifica con controlador exclusivo de tests; no hay endpoint admin ficticio.

### Prueba con cookies conservadas

Ejemplo PowerShell contra Compose de desarrollo, una vez levantado el stack y aplicadas
las migraciones por su servicio `migration`. Crear `butchery-login.json` en la carpeta temporal
con los datos de una cuenta local de prueba (nunca credenciales reales versionadas).

```powershell
curl.exe --cookie-jar "$env:TEMP\butchery-auth.cookies" --header "Origin: http://localhost:8080" --header "X-CSRF-Protection: 1" --header "Content-Type: application/json" --data-binary "@$env:TEMP\butchery-login.json" http://localhost:8080/auth/login
curl.exe --cookie "$env:TEMP\butchery-auth.cookies" http://localhost:8080/auth/me
```

El archivo de cookies contiene una credencial: mantenerlo privado, fuera del repositorio y borrarlo
al terminar junto con el JSON local. En producción reemplazar URL/Origin por valores HTTPS exactos.
Para pruebas automatizadas: db:deploy en base aislada TEST_DATABASE_URL, build, typecheck y test.
Evidencia en [TASK-006](../docs/tasks/finished/TASK-006-auth-etapa-2.md).

La etapa 3 agrega renovación y logout según la sección siguiente.

## Autenticación: etapa 3

Se reutilizan todos los mecanismos de etapas
anteriores, sin cambiar ORM ni incorporar dependencias. Login entrega access y refresh en cookies;
la respuesta JSON conserva únicamente la cuenta pública. El frontend se integró después;
no existe una operación de logout global.

### Plazos y migración

Access JWT: inicial 900 segundos; Session: límite absoluto inicial 604800 segundos, configurable
por AUTH_SESSION_TTL_SECONDS. Renovar no modifica Session.expiresAt. El nuevo access vence en
min(ahora + access TTL, límite absoluto); refresh vence en el límite absoluto. Un access vencido
siempre recibe 401 aunque la sesión pueda renovarse. Al vencer la sesión completa hay que hacer login.

Migración `20261008020000_auth_refresh_credentials`, posterior a las de User/Session:

```sh
npm run db:deploy --workspace=back
npm run build --workspace=back
```

Es aditiva: crea RefreshCredential con UUID, sessionId FK, tokenHash único, createdAt/expiresAt,
consumedAt e invalidatedAt opcionales, e índice por sesión. No actualiza, extiende ni reactiva
sesiones anteriores. Esas sesiones mantienen el access hasta su vencimiento y no tienen refresh;
requieren un nuevo login para usar renovación. No se asigna refresh retrospectivamente.

### Puertos, hash y atomicidad

- RefreshTokenService: generar/digerir token opaco. Adaptador crypto de Node genera 32 bytes
  aleatorios (256 bits), los codifica base64url y calcula SHA-256 hex para búsqueda/verificación.
- RefreshCredentialRepository: createSession/findByHash/rotate/revokeSession del agregado,
  sin CRUD genérico ni transacciones Prisma expuestas a los casos de uso.
- Login firma/genera primero y persiste sesión+refresh inicial en una transacción. Fallos de
  emisión o inserción no dejan una sesión utilizable parcialmente creada.
- RefreshSession usa rotate: el adaptador localiza hash y bloquea Session con FOR UPDATE,
  revalida estado y fechas, lee el usuario público en la misma conexión y llama a una preparación de dominio para verificar usuario/generar/
  firmar, consume el viejo y persiste el reemplazo en la misma transacción. Solo se entregan
  valores originales después del commit. Firma/inserción fallidas hacen rollback.
- Logout usa el mismo bloqueo de Session antes de revocar e invalidar credenciales activas.

Prisma encapsula transacciones ReadCommitted y SQL parametrizado. Los locks PostgreSQL coordinan
distintos procesos; no son locks en memoria. No hay dos reemplazos válidos del mismo token ni
una renovación que reactive una sesión revocada. Los registros consumidos se conservan al menos
hasta vencer la sesión; no se implementa ningún proceso de limpieza automática.
La base no contiene tokens originales ni access JWT, solo hashes de refresh. Los casos de uso
no contienen cookies/HTTP y los guards siguen consultando sesión y rol vigente, sin caché.

### Cookies y limpieza

| Credencial | Local explícito | HTTPS | Path | Vencimiento |
|---|---|---|---|---|
| Access | butchery_access | __Host-butchery_access | / | exp del JWT |
| Refresh | butchery_refresh | __Secure-butchery_refresh | /auth | límite absoluto de Session |

Ambas son HttpOnly, host-only (Domain omitido intencionalmente), Secure en HTTPS y SameSite
configurado como etapa 2. Path=/auth permite enviar refresh tanto a refresh como a logout.
El prefijo __Secure permite ese path; __Host exige Path=/ y se conserva para access.
Limpieza: mismos nombres/paths/host/security/SameSite, valor vacío, Max-Age=0 y Expires epoch.
Cookies duplicadas con el mismo nombre se consideran ambiguas y no identifican una credencial.
No hay tokens en JSON, URLs o logs. Los errores y respuestas /auth conservan no-store.

### Contratos nuevos

`POST /auth/refresh`, sin body requerido, usa exclusivamente cookie refresh. No necesita access
válido. Mantiene Origin permitido, X-CSRF-Protection:1, HTTPS (HTTP local explícito en
desarrollo) y CORS con credenciales.

- 200: cuenta pública (id, email, displayName, role, createdAt) y ambas cookies nuevas.
- 401: refresh ausente/desconocido/vencido/consumido, usuario inexistente o sesión revocada/vencida;
  limpia ambas cookies. El token desconocido no revoca ninguna sesión.
- 403: protección CSRF/transporte rechazada, sin omitirla por falta de access.
- 429: límite de refresh por IP, AUTH_REFRESH_MAX_ATTEMPTS/AUTH_REFRESH_WINDOW_SECONDS (30/900).
- 500: falla técnica segura, sin borrar automáticamente cookies válidas; rollback preserva el refresh
  anterior cuando la operación no se confirmó.

`POST /auth/logout`, sin body requerido, responde 204 sin JSON y limpia ambas cookies. Identifica
una única sesión por access verificado y asociado a ella, o por refresh reconocido si el access
no identifica sesión. Refresh consumido/vencido también puede identificar la sesión para cerrarla.
Un access vencido no se interpreta sin firma: se rechaza por el verificador normal y se usa refresh.
Sin credenciales reconocibles o con sesión ya cerrada es no-op 204. Falla técnica es 500 seguro.
CSRF sigue obligatorio incluso en logout repetido/sin credenciales. No hay cierre de todos los dispositivos.
Tras revocación confirmada, /auth/me rechaza el siguiente uso del access, aun no vencido.

### Reutilización y clientes concurrentes

Si se presenta un refresh consumido de una sesión activa, se revoca esa sesión y se invalidan
todas sus credenciales activas. No hay tolerancias ni ventana de reutilización. Dos requests
concurrentes del mismo token pueden producir 200 y 401, pero la segunda revoca también el
reemplazo que recibió la primera. El access emitido por la primera deja de autorizar el siguiente uso.
El frontend actual coordina la renovación entre peticiones y pestañas con Web Locks y
revisiones sin secretos. Comprueba `/auth/me` después de adquirir el bloqueo y no repite
a ciegas un refresh cuya respuesta se perdió. Ver
[coordinación del cliente](../front/OVERVIEW.md#cliente-http-y-coordinación-de-sesiones).

Se mantiene el límite por proceso y las reglas de IP/proxy de etapa 2. Antes de usar múltiples
réplicas requiere store compartido o gateway para límites; la atomicidad de sesiones ya es en DB.

### Ejemplo completo con cookie jar

PowerShell local, cuenta de prueba en JSON temporal fuera del repositorio, nunca secretos reales.
Los comandos usan el origen público de Compose dev: `http://localhost:8080`.
Login necesita ese JSON; refresh/logout no. Al ejecutar Nest/Next fuera de Docker,
adaptar ambas URLs y la allowlist de orígenes a los puertos configurados.

```powershell
$cookieJar = Join-Path $env:TEMP 'butchery-auth.cookies'
$loginJson = Join-Path $env:TEMP 'butchery-login.json'
curl.exe --cookie-jar "$cookieJar" --header "Origin: http://localhost:8080" --header "X-CSRF-Protection: 1" --header "Content-Type: application/json" --data-binary "@$loginJson" http://localhost:8080/auth/login
curl.exe --cookie "$cookieJar" http://localhost:8080/auth/me
curl.exe --request POST --cookie "$cookieJar" --cookie-jar "$cookieJar" --header "Origin: http://localhost:8080" --header "X-CSRF-Protection: 1" http://localhost:8080/auth/refresh
curl.exe --cookie "$cookieJar" http://localhost:8080/auth/me
curl.exe --request POST --cookie "$cookieJar" --cookie-jar "$cookieJar" --header "Origin: http://localhost:8080" --header "X-CSRF-Protection: 1" http://localhost:8080/auth/logout
curl.exe --cookie "$cookieJar" http://localhost:8080/auth/me
```

El último /me debe devolver 401. Reemplazar Origin/API por valores HTTPS exactos en producción.
Mantener privados y eliminar cookie jar/JSON temporal al terminar; no mostrar ni versionar tokens.

### Verificación y pendientes

Build, typecheck y test conservan sus comandos. Integración requiere TEST_DATABASE_URL aislada
y las tres migraciones aplicadas; las suites limpian únicamente credenciales/sesiones/cuentas
propias. Resultados: [TASK-007](../docs/tasks/finished/TASK-007-auth-etapa-3.md).
Sin limpieza automática de credenciales, listado de dispositivos, logout global ni
gestión académica. La recuperación y el cambio se agregaron en la etapa 4 siguiente.

## Autenticación: etapa 4

RequestPasswordReset, ResetPassword y ChangePassword reutilizan Argon2id, la política de
contraseña de registro (8–128 caracteres Unicode, sin trim ni normalización), normalización
de email y el generador criptográfico de 32 bytes/SHA-256. No se inicia sesión automáticamente.
La API rechaza campos adicionales; change obtiene el usuario exclusivamente del contexto del guard.

### Migración y atomicidad

Aplicar `npm run db:deploy --workspace=back` con DATABASE_URL configurada. La migración
`20261008030000_password_reset_credentials` agrega PasswordResetCredential: id, userId FK,
tokenHash único, createdAt, expiresAt, consumedAt, invalidatedAt y deliveredAt. No elimina
datos ni cambia vencimientos de sesiones existentes. Registros consumidos permanecen;
no se incorpora limpieza automática. `npm run build` regenera Prisma y compila el monorepo.

Solo se almacena el hash del token, nunca el original ni el enlace. Cada nueva solicitud
invalida las credenciales anteriores del usuario. deliveredAt=null significa pendiente de
entrega y no autoriza un reset: se activa solamente después del envío confirmado. Un envío
fallido invalida únicamente su propia credencial; si la base falla al invalidar, el estado
pendiente sigue impidiendo su uso. Un envío tardío no reactiva una credencial invalidada.

Reset y change actualizan el hash, invalidan recuperación y revocan todas las sesiones y
refresh pendientes en una transacción. Se bloquea User y después sus Session ordenadas por id;
refresh/logout conservan el bloqueo por Session sin adquirir User. Login compara bajo User lock
el hash previamente verificado antes de crear sesión y refresh. Change realiza esa misma
comparación optimista: dos peticiones que verificaron la contraseña anterior no pueden
sobrescribirse. Reset relee el token bajo lock y no puede sobrescribir un cambio que lo invalidó.
El hashing y SMTP transcurren fuera de las transacciones. El guard consulta persistencia en
cada validación: ningún JWT/refresh emitido antes del cambio conserva acceso después de revocar.

### Configuración y email

El backend necesita AUTH_PASSWORD_RESET_URL y configuración SMTP válida al arrancar, incluso
si no se solicita recuperación. El comando de provisión ADMIN conserva su composición aislada.

| Variable | Valor inicial / condición |
|---|---|
| AUTH_PASSWORD_RESET_URL | URL completa de `/reset-password`; origen en AUTH_ALLOWED_ORIGINS; sin query, fragmento ni credenciales |
| AUTH_PASSWORD_RESET_TTL_SECONDS | 1800; rango 60–86400 |
| AUTH_PASSWORD_RESET_MIN_RESPONSE_MS | 2000; al menos SMTP_TIMEOUT_MS + 250 |
| SMTP_HOST / SMTP_PORT / SMTP_FROM | Obligatorios, sin servidor de respaldo |
| SMTP_SECURE | Obligatorio; true = TLS implícito, false = STARTTLS requerido |
| SMTP_USERNAME / SMTP_PASSWORD | Par privado requerido fuera de SMTP local explícito |
| SMTP_ALLOW_LOCAL_PLAINTEXT | false salvo desarrollo explícito con host autorizado y SMTP_SECURE=false |
| SMTP_LOCAL_PLAINTEXT_HOSTS | Allowlist exacta; Compose dev autoriza `mailpit` |
| SMTP_TIMEOUT_MS | 1500; deadline total y timeouts de conexión/SMTP |
| AUTH_FORGOT_PASSWORD_MAX_ATTEMPTS / AUTH_FORGOT_PASSWORD_WINDOW_SECONDS | 5 / 900 |
| AUTH_RESET_PASSWORD_MAX_ATTEMPTS / AUTH_RESET_PASSWORD_WINDOW_SECONDS | 10 / 900 |
| AUTH_CHANGE_PASSWORD_MAX_ATTEMPTS / AUTH_CHANGE_PASSWORD_WINDOW_SECONDS | 10 / 900 |

HTTPS es obligatorio para la página configurada, excepto HTTP local ya autorizado mediante
AUTH_ALLOW_LOCAL_HTTP en desarrollo. El host HTTP de una petición nunca determina el enlace.
PasswordResetEmail es un puerto; SmtpPasswordResetEmail usa Nodemailer con validación TLS,
sin logger/debug, sin acceso a archivos/URLs y con envío acotado. El mensaje contiene enlace,
fecha de vencimiento, uso único e indicación de ignorarlo si no se solicitó. No se mantienen
transacciones mientras se envía. No hay cola ni reintentos distribuidos. Un proveedor puede
aceptar un mensaje al alcanzar el deadline; si no se confirmó la entrega, el enlace no se activa.
Referencia del adaptador: [Nodemailer SMTP](https://nodemailer.com/smtp).

forgot-password genera/digiere también para emails desconocidos y espera un piso temporal
común. Un fallo de consulta, persistencia o envío mantiene el mismo 202 y solo registra un
código fijo, sin email, token, enlace ni excepción. El piso reduce diferencias evidentes del
camino sin SMTP; no garantiza tiempo constante: saturación de DB, espera de locks, red y
planificación pueden superar el piso. Monitorizar latencia y ajustar timeout/piso conjuntamente.
Los límites por IP, proxy confiable explícito y store por proceso conservan las condiciones H2/H3;
para varias réplicas se necesita store compartido o límite en gateway.

### Contratos HTTP

Todos conservan CSRF (Origin exacto permitido + X-CSRF-Protection: 1), CORS con credenciales,
HTTPS (HTTP local explícito en desarrollo) y Cache-Control: no-store. No agregan tokens
a respuestas JSON.

| Endpoint | Entrada JSON | Éxito | Otros estados |
|---|---|---|---|
| POST /auth/forgot-password | email | 202 con mensaje uniforme | 400 entrada, 403 CSRF, 429 límite |
| POST /auth/reset-password | token, newPassword | 204 sin cuerpo, ambas cookies limpias | 400 entrada/token, 403 CSRF, 429 límite, 500 técnico |
| POST /auth/change-password | currentPassword, newPassword | 204 sin cuerpo, ambas cookies limpias | 400 entrada/actual incorrecta/igual/conflicto, 401 autenticación, 403 CSRF, 429 límite, 500 técnico |

Mensaje 202: `Si existe una cuenta asociada al email, recibirás instrucciones para recuperar tu contraseña.`
La respuesta JSON contiene únicamente `message` con ese texto.
Token desconocido, malformado, vencido, consumido, invalidado o pendiente de entrega producen
el mismo error de token no válido. Contraseña inválida no consume el token. Los fallos técnicos
de reset/change se informan como 500 seguro y hacen rollback, sin limpiar cookies automáticamente.
Después del éxito es obligatorio iniciar sesión con la nueva contraseña; no hay logout global
como operación separada de esta revocación obligatoria por cambio de contraseña.

### Recorrido local reproducible

Preparar el `.env` privado de la raíz como indica el README, sin sobrescribir uno existente.
Compose configura API, frontend y recuperación con `http://localhost:8080`; el backend usa
SMTP `mailpit:1025` dentro de Docker. Para incluir el buzón local:

```powershell
docker compose -f docker-compose.dev.yml --profile mail up --build -d
```

Abrir la aplicación en `http://localhost:8080` y Mailpit en `http://localhost:8025`.
El perfil `mail` crea el buzón al levantar el stack; no realiza entrega a destinatarios
externos. Desarrollo no requiere certificados. No combinar los archivos Compose de
desarrollo y producción: son stacks independientes.

Con una cuenta local de prueba registrada, crear JSON temporales fuera del repositorio. Ejemplo
forgot JSON: `{"email":"cuenta-prueba@example.test"}`. Conservar cookies usando el jar de H3:

```powershell
$cookieJar = Join-Path $env:TEMP 'butchery-auth.cookies'
$forgotJson = Join-Path $env:TEMP 'butchery-forgot.json'
$resetJson = Join-Path $env:TEMP 'butchery-reset.json'
$changeJson = Join-Path $env:TEMP 'butchery-change.json'
curl.exe --cookie "$cookieJar" --cookie-jar "$cookieJar" --header "Origin: http://localhost:8080" --header "X-CSRF-Protection: 1" --header "Content-Type: application/json" --data-binary "@$forgotJson" http://localhost:8080/auth/forgot-password
# Abrir Mailpit, buscar el destinatario de prueba y copiar el token del enlace del mensaje.
# Crear resetJson privado: {"token":"<token-del-buzon>","newPassword":"<nueva-clave-de-prueba-8-a-128-caracteres>"}
curl.exe --cookie "$cookieJar" --cookie-jar "$cookieJar" --header "Origin: http://localhost:8080" --header "X-CSRF-Protection: 1" --header "Content-Type: application/json" --data-binary "@$resetJson" http://localhost:8080/auth/reset-password
# Iniciar sesión otra vez usando el comando login de H3 y la nueva contraseña.
curl.exe --cookie "$cookieJar" http://localhost:8080/auth/me
# Crear changeJson privado: {"currentPassword":"<clave-actual-de-prueba>","newPassword":"<otra-clave-de-prueba-8-a-128-caracteres>"}
curl.exe --cookie "$cookieJar" --cookie-jar "$cookieJar" --header "Origin: http://localhost:8080" --header "X-CSRF-Protection: 1" --header "Content-Type: application/json" --data-binary "@$changeJson" http://localhost:8080/auth/change-password
curl.exe --cookie "$cookieJar" http://localhost:8080/auth/me
```

La última consulta devuelve 401. Para el recorrido habitual, abrir el enlace del mensaje
en Mailpit y completar `/reset-password`: no es necesario copiar el token a un JSON.
Los comandos anteriores permiten comprobar directamente la API. No mostrar enlaces,
tokens o claves en terminal/logs; borrar los JSON y el jar privados al finalizar.

### Correo en Render Free (TASK-028)

Render Free bloquea conexiones SMTP 25/465/587. Configurar `EMAIL_PROVIDER=brevo`,
`BREVO_API_KEY` privada, `EMAIL_FROM` verificado y `EMAIL_FROM_NAME=Profesor Butchery`.
El adaptador usa `https://api.brevo.com/v3/smtp/email` para verificación y recuperación;
no requiere credenciales SMTP ni una dependencia adicional. No intercambiar clave API y SMTP.
`SMTP_TIMEOUT_MS` limita también la solicitud HTTPS; conservar la respuesta mínima
`AUTH_PASSWORD_RESET_MIN_RESPONSE_MS` al menos 250 ms mayor (8000/8500 recomendado).
La URL de recuperación y el origen frontend deben ser HTTPS públicos para que el enlace
de verificación apunte al sitio desplegado. Fallos de envío no cambian la cuenta a verificada.
`EMAIL_PROVIDER=smtp` (predeterminado) conserva SMTP/Mailpit y su validación existente.
No hay fallback silencioso entre proveedores. Ver `infra/DESPLIEGUE-CLOUD.md`.

### Integración frontend y verificación

La pantalla `/reset-password` ya está implementada: conserva el token únicamente en memoria,
lo retira de la URL con reemplazo del historial, evita recursos de terceros y aplica
`Referrer-Policy: no-referrer`. Recargar puede exigir abrir nuevamente el enlace del buzón.
Tras reset/change, el cliente descarta la cuenta, comunica la revocación a otras pestañas
y pide login; no intenta renovar la sesión revocada.

Integración requiere TEST_DATABASE_URL aislada y cuatro migraciones; SMTP real se verifica con
TEST_MAILPIT_API_URL y el buzón local de pruebas. Resultados y limitaciones de controles:
[TASK-008](../docs/tasks/finished/TASK-008-auth-etapa-4.md).

Para ejecutar todas las pruebas, usar una base exclusiva vacía y un buzón local:

```powershell
# Crear TEST_DATABASE_URL mediante configuración privada, sin apuntar a producción.
$env:DATABASE_URL = $env:TEST_DATABASE_URL
npm run db:deploy --workspace=back
# Con Mailpit del perfil mail de Compose:
$env:TEST_MAILPIT_API_URL = 'http://127.0.0.1:8025'
$env:TEST_SMTP_PORT = '1025'
npm run typecheck --workspace=back
npm test
npm run build
```

Sin TEST_DATABASE_URL se omiten suites de persistencia; sin TEST_MAILPIT_API_URL se omite la
prueba SMTP real. No considerar esa ejecución equivalente a la validación completa. Las suites
borran únicamente sus propias cuentas y credenciales; el buzón es exclusivamente de pruebas.

Evidencia histórica de validación por etapa (conteos de tests, versiones de Node, fechas de
aceptación) en [CHANGELOG.md](../CHANGELOG.md) y en cada `TASK-NNN` bajo
[docs/tasks/finished/](../docs/tasks/finished/). Lint: `npm run lint --workspace=back`,
configuración en [eslint.config.mjs](./eslint.config.mjs). CI propio en
[.github/workflows/back.yml](../.github/workflows/back.yml), con check de deriva de
migraciones (`prisma migrate diff`) además de typecheck/lint/test/build.
El job `backend-ci` se ejecuta en cada PR hacia `desarrollo` o `main`, sin filtros
por archivos ni ejecución adicional al hacer push tras el merge. PostgreSQL 17,
la base shadow y Mailpit se preparan en el runner para las pruebas de integración.
DoD, protección de ramas y evidencia de aceptación en
[CONTRIBUTING.md](../CONTRIBUTING.md#integración-continua-y-definition-of-done).


## HU-11: edicion administrativa del modelo vigente (TASK-055)

El campo API/DB `cuatrimestre` conserva su nombre y admite `PRIMERO`, `SEGUNDO` y
`ANUAL`. La migración aditiva `20261102000000_cursadas_anuales` amplía el enum sin
reinterpretar datos. Crear y editar admiten Anual; la unicidad sigue siendo por
materia/año/período, permitiendo coexistencia de anual y cuatrimestrales.

GET `/profesores/:id` y PATCH de profesores, cursadas y comisiones requieren ADMIN.
PATCH es parcial, estricto y no vacio: profesor acepta `nombreCompleto`; cursada
`materiaId`, `anio`, `cuatrimestre`; comision `carrera`, `numero` (entero 1 a 999).
No acepta profesor en cursada, nombre libre, activa ni cambio de cursada en comision.
Las respuestas PATCH mantienen las entidades actuales, con nombre derivado y docentes
en comision. GET de cursada/comision conserva su proyeccion enriquecida y permisos.

Mover cursada conserva ids, comisiones y asignaciones docentes; la materia destino debe
ofrecer todas las carreras de sus comisiones no borradas, incluso inactivas. La edicion
no agrega auditoria, bajas ni migraciones. Entradas/incompatibilidad dan 400,
ausentes 404 y duplicados 409; siguen vigentes sesion, roles y proteccion CSRF.

La escritura bloquea Cursada antes de Materia (SHARE, ids ordenados si son dos) y
luego Comision al editarla. Crear comision tambien valida bajo esos bloqueos.
ActualizarMateria revalida carreras con comisiones bajo su bloqueo UPDATE existente,
sin bloquear Cursada. Las restricciones SQL respaldan unicidad y las escrituras
parciales no reemplazan campos omitidos. Listados conservan paginacion; profesores y
cursadas agregan id como desempate estable.
