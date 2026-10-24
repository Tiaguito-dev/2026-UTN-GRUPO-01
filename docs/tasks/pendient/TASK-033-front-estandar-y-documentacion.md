# TASK-033: Estándares de frontend, agente de front con el conocimiento del repo y lint como error

Estado: Pendiente. Decisiones 1 a 4 confirmadas por el desarrollador el 2026-10-21. Depende de
TASK-023, TASK-024, TASK-025, TASK-026, TASK-027, TASK-028 y TASK-029.
Fecha: 2026-10-21

## 1. Contexto y objetivo

Las tareas 023 a 029 cambian cómo se escribe el frontend: tokens, capas CSS, primitivas de
`components/ui/`, patrones de pantalla, contratos validados con Zod, reglas de encabezado y
shell compartido. Cada una deja una nota en `front/OVERVIEW.md`, pero no hay un lugar que diga
qué reglas son obligatorias ni un agente que sepa mantener el front sin repetir la auditoría.
Situación sobre `desarrollo` (`253c650`):

| Documento | Problema |
|---|---|
| `front/OVERVIEW.md` | Describe `SystemHome` y secciones "en la misma pantalla", que ya no existen (hay rutas por sección). "Contratos iniciales" no lista `/home/materias/**` ni `/home/admin/**`. Termina con "No hay lint configurado". Mezcla descripción de flujos con reglas. |
| `.agents/front.md` | Solo define rol, alcance y workflow. Dice "los estándares de frontend específicos del stack se agregan ahí una vez que se elija la tecnología" y "no hay lint configurado todavía". No menciona `front/OVERVIEW.md` ni cómo detectar problemas o planificar tareas. |
| `.agents/test.md` | "un estándar de testing dedicado se agrega ahí una vez que se elijan el stack y los frameworks de test". TASK-023 los elige. |
| `docs/standards/` | Seis estándares, todos del back o transversales (`paginacion.md`, `soft-delete.md`, …). Ninguno de frontend. |

Además, TASK-023 deja ESLint con las reglas en `warn` (salvo `rules-of-hooks`) para no frenar
las etapas siguientes. Al terminar la Etapa 6 ya no hay motivo para tolerar advertencias.

Objetivo, con tres documentos y un papel claro para cada uno (decisión 1):

- **`docs/standards/`**: las reglas obligatorias del front, un archivo por tema, igual que los
  estándares del back.
- **`front/OVERVIEW.md`**: la descripción del front tal como es hoy (rutas, flujos, estructura).
- **`.agents/front.md`**: el conocimiento para mantener el repo y escribir tareas nuevas sin
  otra auditoría. Su descripción nombra `front/OVERVIEW.md` como el documento que describe el
  front y lo hace responsable de mantenerlo al día.

Es la Etapa 7, la última del plan de refactorización. Cubre los hallazgos DOC-001 y DOC-002 de
la auditoría.

## 2. Alcance

1. **Estándares en `docs/standards/`** (decisión 2). Solo reglas que un PR puede cumplir o
   violar, con el porqué de cada una. Cuatro archivos:
   - `frontend-estilos.md`: orden de capas `@layer`, un archivo por área en `src/styles/`,
     "los selectores de elemento solo llevan tipografía y reset", tabla de tokens (espacio,
     radio, texto, peso, sombra, layout, z-index) y prohibición de valores sueltos que tengan
     token. Reemplaza las notas que dejan TASK-024 y TASK-025 en `front/OVERVIEW.md`.
   - `frontend-componentes.md`: qué va en `components/ui/` (sin dominio) y qué en
     `components/<dominio>/`; tabla de primitivas (`Card`, `Notice`, `EmptyState`, `Badge`,
     `FormField`, `Breadcrumb`, `Pagination`, `PageHeader`, `AsyncState`,
     `PaginatedListView`) con cuándo usarla y cuándo no; `lib/format/` y `lib/messages.ts` como
     única fuente de formatos y textos repetidos; convención de nombres (decisión 3).
   - `frontend-pantallas.md`: los tres patrones (listado paginado con `useUrlPagination` +
     `PaginatedListView` + `Suspense`, detalle con endpoint de detalle + `AsyncState`, alta con
     `useFormSubmission` + `AltaForm`), cada uno con un esqueleto de código corto; regla de
     encabezado de TASK-029 (breadcrumb solo con padre, eyebrow solo en Inicio y Próximamente,
     sin "volver" duplicado); `AppShell`, `RequireAuth`, `RequireRole`; accesibilidad
     (landmarks, un `h1`, foco al montar, `aria-busy`, texto mínimo `.75rem`, axe sin
     `serious` ni `critical`); todo servicio valida su respuesta con `services/schemas.ts`
     (remite a `validacion-con-zod.md`); y el **checklist de pantalla nueva**, de 10 a 12
     puntos que el revisor de un PR puede tildar. Mueve aquí la sección "Cómo armar una
     pantalla" que crean TASK-027 y TASK-029.
   - `frontend-tests.md`: qué se testea con Vitest en entorno `node`, qué con jsdom y Testing
     Library, cuándo agregar una captura de Playwright, cómo regenerar la línea base (solo en
     Linux, como fija TASK-023) y el uso de axe.
2. **`.agents/front.md`** (decisión 4). Se reescribe con este contenido:
   - *Rol*: implementa y mantiene `front/`. Nombra `front/OVERVIEW.md` como la descripción del
     front y dice que el agente lo actualiza en cada tarea que cambie rutas, flujos o estructura.
   - *Mapa del front*: una tabla corta de dónde vive cada cosa (`app/`, `components/ui/`,
     `components/<dominio>/`, `hooks/`, `services/`, `lib/`, `validations/`, `styles/`,
     `tests/`), con enlace a `front/OVERVIEW.md` para el detalle.
   - *Estándares que aplica*: lista de los cuatro de 2.1 más `validacion-con-zod.md`,
     `paginacion.md`, `soft-delete.md` y `git-workflow.md`.
   - *Cómo revisar el estado del front*: los comandos que reemplazan a una auditoría manual
     (`lint`, `typecheck`, `test`, spec visual y de axe), qué mira cada uno y qué hacer cuando
     algo falla. Más tres búsquedas de deriva que ningún comando cubre (valores sueltos que
     tienen token, `<button>` o tarjetas armadas a mano en vez de la primitiva, pantallas sin
     `PageHeader`).
   - *Cómo escribir una tarea nueva del front*: qué tiene que traer según el "Gate de tarea" de
     `.agents/OVERVIEW.md`, el checklist de pantalla nueva como criterio de aceptación, qué
     áreas son sensibles según `AGENTS.md` y cuándo una tarea tiene que actualizar un estándar.
   - *Qué mantiene*: `front/OVERVIEW.md` en cada tarea; los estándares de frontend solo cuando
     una tarea los cambia de forma explícita; nunca un estándar del back.
   - *Pendientes conocidos*: los temas que dejaron abiertos las etapas, cada uno con su tarea
     de origen, para que no se pierdan sin repetir la auditoría:
     normalización de valores fuera de escala (TASK-024), CSS Modules para componentes nuevos
     (TASK-025), `router.push` frente a `router.replace` en la paginación (TASK-027) y paquete
     `packages/contracts` (TASK-028).
   - Se conservan *Fuera de alcance*, *Inputs requeridos*, *Workflow* y *Skills*, sin la frase
     "(no hay lint configurado todavía)".
3. **`front/OVERVIEW.md`** queda descriptivo.
   - Corregir el bloque de `SystemHome` según las rutas reales de `/home/**`.
   - Completar "Contratos iniciales" con `/home/materias/**`, `/home/admin/**`,
     `/home/profesores`, `/home/experiencias` y `/home/comunidad`.
   - Quitar "No hay lint configurado" y toda regla que pasó a `docs/standards/`, dejando un
     enlace a cada estándar.
   - Sin cambios en las secciones de cuenta, sesiones, recuperación y contenedor, salvo
     enlaces rotos.
4. **Otros documentos.** `.agents/test.md`: reemplazar la frase de "se agrega cuando se elijan"
   por el enlace a `frontend-tests.md`. `AGENTS.md`: agregar los cuatro estándares donde lista
   los estándares, si los lista.
5. **ESLint de `warn` a `error`.**
   - Todas las reglas activas en `front/eslint.config.mjs` pasan a `error`.
     `reportUnusedDisableDirectives` también.
   - El script de CI pasa a `eslint . --max-warnings 0`.
   - Se corrigen las violaciones que queden. Una excepción solo se acepta con
     `// eslint-disable-next-line <regla> -- <motivo>` en la línea, y se lista en la sección 6.
6. **Ejercicio de verificación**: listado de profesores para administración en
   `/home/admin/profesores`, armado siguiendo solo los estándares y `.agents/front.md`. Consume
   el `GET /profesores` que ya existe (`back/src/academic/academic.controller.ts:50`, rol ADMIN)
   y el `listarProfesores` de `services/academic.ts`. Se agrega al `AdminPanel` junto a
   "Nuevo profesor". Hoy un admin carga profesores pero no tiene dónde verlos.
7. **`CHANGELOG.md`**: una entrada que cierre el plan de refactorización (Etapas 0 a 7), con
   enlace a cada tarea. Se escribe al cerrar, como pide `AGENTS.md`.

## 3. Fuera de alcance

- Cambios de comportamiento o de estilo en pantallas existentes. Si el ejercicio de 2.6
  encuentra un defecto en otra pantalla, se anota y va en otra tarea.
- La sección de profesores para estudiantes (`/home/profesores`), que sigue en Próximamente:
  depende de reseñas, que no existen.
- Estándares o agente del back.
- Stylelint u otras herramientas nuevas. Nada en `package.json` cambia salvo el script de lint.
- Storybook o un catálogo visual de primitivas.
- Resolver los pendientes conocidos de 2.2. Solo se registran.

## 4. Decisiones de diseño

1. **Tres documentos con un papel cada uno.** Las reglas en `docs/standards/`, la descripción
   en `front/OVERVIEW.md` y el conocimiento de mantenimiento en `.agents/front.md`. Es lo que
   pidió el desarrollador el 2026-10-21. Así una regla se cambia en un solo lugar, la
   descripción no envejece con reglas mezcladas, y el agente sabe dónde mirar sin leer el
   historial. Alternativa descartada: todo en `front/OVERVIEW.md`, que hoy ya mezcla reglas con
   descripción y quedó desactualizado justamente por eso.
2. **Un estándar por tema, con prefijo `frontend-`.** Sigue el estilo de `docs/standards/`, donde
   cada archivo cubre un tema (`paginacion.md`, `soft-delete.md`). Cuatro archivos chicos se
   enlazan desde un PR o una tarea con precisión. El prefijo los agrupa al listar la carpeta.
   Alternativa descartada: un único `frontend.md`, que mezclaría estilos, componentes y tests en
   un documento largo.
3. **Nombres: dominio en español, genéricos en inglés.** Lo que nombra algo del negocio va en
   español (`MateriasList`, `AltaForm`, `useMaterias`, `.academic-panel`). Lo que no sabe nada
   del negocio va en inglés (`Card`, `Notice`, `PageHeader`, `useUrlPagination`, `.button`).
   Es la convención que ya siguen TASK-026 y TASK-027. Documentación, mensajes de interfaz y
   commits siguen en español (`docs/standards/git-workflow.md`). Alternativa descartada: todo
   en inglés, que obliga a traducir términos como "cursada" o "comisión" sin equivalente claro.
4. **El agente reemplaza la auditoría con comandos y búsquedas, no con un procedimiento
   manual.** Lo que la auditoría detectó a mano ahora lo detectan `lint`, el spec visual y axe
   de TASK-023, y tres búsquedas de deriva que el agente sabe correr. Con eso puede proponer
   tareas nuevas sobre el estado real. Alternativa descartada: copiar la metodología de la
   auditoría al agente, que la repetiría entera cada vez.

## 5. Criterios de aceptación

- Existen `frontend-estilos.md`, `frontend-componentes.md`, `frontend-pantallas.md` y
  `frontend-tests.md` en `docs/standards/`, con las secciones de 2.1 y el checklist en
  `frontend-pantallas.md`. Contienen reglas, no descripción de pantallas.
- `.agents/front.md` tiene las secciones de 2.2. Su rol nombra `front/OVERVIEW.md` y dice que
  el agente lo mantiene.
- `front/OVERVIEW.md` no menciona `SystemHome` ni "No hay lint configurado", lista todas las
  rutas de `front/src/app/` y enlaza a los estándares en vez de repetirlos.
  `grep -rn "una vez que se elij" .agents/front.md .agents/test.md` no devuelve resultados.
- Cada enlace relativo de los archivos tocados resuelve a un archivo existente.
- `front/eslint.config.mjs` no tiene reglas en `warn`. `npm run lint --workspace=front` termina
  con 0 errores y 0 advertencias, y el workflow de CI usa `--max-warnings 0`.
- Todo `eslint-disable` del front tiene motivo después de `--` y figura en la sección 6.
- `/home/admin/profesores` lista profesores paginados, con estados de carga, vacío y error, y
  bloquea a quien no es ADMIN igual que las demás pantallas de `/home/admin/**`. Cumple el
  checklist de pantalla nueva, tildado en la descripción del PR.
- La sección 6 registra qué tuvo que preguntar o mirar quien armó la pantalla y qué se cambió
  en los estándares o en el agente por eso.
- `npm run lint`, `typecheck`, `test` y `build` del workspace `front` pasan, y el spec visual
  y de axe de TASK-023 pasa con la captura nueva de Profesores en la línea base.
- `CHANGELOG.md` tiene la entrada de cierre del plan.

## 6. Validación

Pendiente de ejecución.

### Pruebas manuales para el desarrollador

- Leer los cuatro estándares: ¿alcanzan para armar una pantalla sin abrir otra?
- Leer `.agents/front.md` como si fuera la primera vez: ¿dice dónde está cada cosa, cómo saber
  qué anda mal y cómo escribir una tarea?
- Entrar como ADMIN a Administración y abrir el listado de profesores: paginar, recargar en la
  página 2, cargar un profesor nuevo desde "Nuevo profesor" y verlo en la lista.
- Entrar con una cuenta sin rol ADMIN y abrir `/home/admin/profesores` a mano: no tiene que
  mostrar datos.
- Recorrer Materias, Cursadas, Comisiones y una alta: nada cambió.

### Excepciones de lint (completar al implementar)

### Hallazgos del ejercicio (completar al implementar)

## 7. Riesgos

1. **Los estándares describen código que todavía no existe.** Esta tarea se escribe contra lo
   que dejen TASK-023 a TASK-029. Si alguna se implementó distinto de lo planeado (otro nombre
   de prop, otra carpeta), el estándar sigue al código, no a la tarea. Antes de escribir,
   revisar la sección 6 de cada tarea terminada.
2. **Pasar a `error` destapa violaciones de golpe.** Si el primer `npm run lint` con `error`
   tiene muchas, se corrigen en un commit propio por regla. Si alguna exige un cambio de
   comportamiento, se excluye con motivo y se anota como tarea aparte.
3. **El ejercicio sin una persona nueva.** Lo ideal es que lo haga alguien del grupo que no
   participó de las etapas 0 a 6. Si no se puede, lo arma un agente en sesión limpia con acceso
   solo a los estándares, `.agents/front.md` y `services/`. Es una prueba más débil, y se dice
   así en la sección 6.
4. **Duplicación con TASK-027 y TASK-029.** Las dos piden escribir "Cómo armar una pantalla" en
   `front/OVERVIEW.md`. Esta tarea mueve ese contenido a `frontend-pantallas.md` y deja un
   enlace. No se reescribe desde cero.
5. **El agente y los estándares se contradicen con el tiempo.** Para evitarlo, `.agents/front.md`
   no repite reglas: enlaza al estándar de cada una.
