# Historial de Cambios

## [Sin publicar]

### Filas de lista clickeables con flecha (TASK-052)

- Nueva primitiva `RowLink` en `components/ui/RowLink.tsx` y hoja de estilos `list.css` para filas que actúan como un único enlace accesible con chevron SVG decorativo (`aria-hidden`) y soporte para `detail`, `trailing` y estado actual (`current`) ([TASK-052](docs/tasks/finished/TASK-052-front-filas-de-lista-clickeables.md)).
- Migración de `MateriasList`, `CursadasList` y `ComisionDetail` (otras comisiones y listado de profesores) a `ul.row-list` y `RowLink`.
- Limpieza de estilos residuales `.academic-rows` y `.academic-row` en `academic.css`.
- Actualización del inventario de primitivas en `docs/standards/frontend-componentes.md` y ajuste de máscara en `visual.browser.spec.mjs`.

### Chips de filtro reutilizables (TASK-051)

- Nueva primitiva `FilterChips` en `components/ui/FilterChips.tsx` para grupos de opciones de selección única con botones y `aria-pressed`, accesible vía teclado y lector de pantalla con etiqueta visible u oculta ([TASK-051](docs/tasks/finished/TASK-051-front-chips-de-filtro.md)).
- Hoja de estilos `chip.css` bajo la capa `components` utilizando tokens oficiales (`--border`, `--surface`, `--muted`, `--primary`, `--radius-pill`, `--space-2`, `--space-4`, `--text-sm`) e importada en `globals.css`.
- Migración de los filtros de año y nivel de electiva en `MateriasList.tsx` y filtro por carrera en `ComisionesList.tsx` a `FilterChips`.
- Eliminación de `.chip` y `.chips` de `MateriasList.module.css` y `ComisionesList.module.css`.
- Actualización de inventario en `docs/standards/frontend-componentes.md` y suite de pruebas unitarias en `ui-filter-chips.spec.tsx`.

### Tonos de etiqueta para cargos docentes (TASK-053)

- Extensión de la primitiva `Badge` con los tonos genéricos `solid`, `soft` y `outline` ([TASK-053](docs/tasks/finished/TASK-053-front-tonos-de-etiqueta-cargo.md)).
- Clases correspondientes en `badge.css` utilizando la escala oficial de tokens de color, bordes y tipografía.
- Módulo `lib/format/cargo.ts` con mapeo de cargos (`TITULAR → solid`, `ADJUNTO → soft`, `JTP → outline`) y etiquetas legibles (`CARGO_LABEL`), conservando `Badge` agnóstico al dominio.
- Actualización de documentación en `docs/standards/frontend-componentes.md` y cobertura con pruebas unitarias (`cargo.spec.ts`, `ui-badge.spec.tsx`).

### Navegación de detalle: "Volver" y breadcrumb rediseñado (TASK-050)

- Rediseño de la primitiva `Breadcrumb` con borde, niveles de 38px, separador SVG chevron accesible (`aria-hidden`) y resaltado del nivel actual con fondo `--soft-blue` y peso semibold ([TASK-050](docs/tasks/finished/TASK-050-front-navegacion-de-detalle.md)).
- Nueva primitiva `BackLink` con `aria-label` descriptivo del destino (`"Volver a <destino>"`) y estilo con objetivo táctil de 48px, fondo `--surface` y borde `--border`.
- Soporte para la prop `back` en `PageHeader`, renderizando `BackLink` y `Breadcrumb` en una barra responsive (`.page-nav`) antes del encabezado.
- Adopción en `MateriaDetail`, `CursadasList`, `ComisionesList` y `ComisionDetail`, retirando enlaces "Volver" redundantes al pie.
- Actualización de estándares en `docs/standards/frontend-pantallas.md` y `docs/standards/frontend-componentes.md`.

### Contracción del modelo legado de carreras y comisiones (TASK-044)

- Cierre de la migración expand-contract de carreras y comisiones ([TASK-044](docs/tasks/finished/TASK-044-contraer-modelo-legado.md)).
- Eliminación de columnas legadas `Comision.nombre`, `Cursada.profesorId`, `Materia.anioCarrera` y `Materia.nivelElectiva` y sus restricciones e índices asociados en la migración `20261101000000_contraer_modelo_legado`.
- `Comision`: `carrera` y `numero` obligatorios con restricción única `[cursadaId, carrera, numero]`. `nombre` se deriva dinámicamente como `${carrera}-${numero}`.
- Contratos de API estrictos: rechazo con 400 (`CAMPOS_NO_PERMITIDOS`) de cualquier campo legado no reconocido (`nombre` en comisión, `profesorId` en cursada, `anioCarrera`/`nivelElectiva` en altas/ediciones de materia).
- Eliminación de `ProfesorRepository` y llamadas legadas del listado y detalle de cursada (sin N+1).
- Búsqueda de materias sin filtro de carrera ordenada por `nombre ASC, id ASC`; filtros por año/nivel sin carrera devuelven 400.
- Retiro de `actorId` en la respuesta de `GET /materias/:id/historial`, conservando `actor: { id, displayName }`.

### Historial de materia solo para ADMIN y con nombre del actor (TASK-046)

- El endpoint `GET /materias/:materiaId/historial` exige rol `ADMIN` vía `@Roles("ADMIN")` y devuelve cada entrada con `actor: { id, displayName }` ([TASK-046](docs/tasks/finished/TASK-046-historial-admin-con-actor.md)).
- En el frontend, el detalle de materia y los esquemas de respuesta leen y presentan el nombre público del actor (`Usuario: {entry.actor.displayName}`) en la línea de tiempo.

### Historial de materia restringido a administradores en el frontend (TASK-045)

- El detalle de materia deja de solicitar y renderizar la sección de historial (`MateriaHistory`) a usuarios no administradores ([TASK-045](docs/tasks/finished/TASK-045-front-historial-solo-admin.md)).
- Cobertura de tests unitarios verificando que usuarios comunes no realizan petición al endpoint ni visualizan el historial, mientras que ADMIN sí.

### Rediseño de materias, cursadas, comisiones y administración (TASK-043)

- Alta de materias en modal desde `/home/materias` (`ui/Dialog` + `MateriaForm`), con recarga del listado sin navegar ([TASK-043](docs/tasks/finished/TASK-043-front-rediseno-academico.md)).
- Detalle de materia, cursada y comisión con la estructura del canvas "Page 2": Volver, insignias, cursadas por año, historial como línea de tiempo y datos de la comisión solo para ADMIN.
- Enlaces "Nueva cursada" y "Nueva comisión" con la materia o la cursada precargada por query; `ui/FormField` acepta `defaultValue`.
- Panel de administración con "Oferta académica" y "Cuentas y moderación", responsive.
- Hook `useIsAdmin` (absorbe TASK-049).

### Separación de MateriaForm y AltaForm de su página (TASK-048)

- `MateriaForm` y `AltaFormFields` operan como cuerpos puros de formulario con callback `onSuccess` y `onCancel` opcional, sin importar `PageHeader` ni `next/navigation` ([TASK-048](docs/tasks/finished/TASK-048-front-formularios-separados-de-pagina.md)).
- Envoltorio `MateriaFormPage` para las páginas actuales de alta y edición, conservando el encabezado, contenedor de tarjeta y navegación con mensaje de éxito.
- `AltaForm` mantiene compatibilidad con las pantallas del panel administrativo integrando `AltaFormFields`.
- Cobertura de tests unitarios específicos (`admin-materia-form.spec.tsx`, `admin-materia-form-page.spec.tsx`, `admin-alta-form.spec.tsx`).

### Recarga desde afuera en PaginatedListView / usePaginatedFetch (TASK-047)

- Soporte para `refreshKey?: number` opcional en `usePaginatedFetch` y `PaginatedListView` ([TASK-047](docs/tasks/finished/TASK-047-front-recarga-listado-paginado.md)).
- Permite refrescar la misma página sin desmontar componentes ni perder el foco tras altas o ediciones en modal.
- Documentación del patrón en `docs/standards/frontend-pantallas.md`.

### Frontend adaptado a carreras, comisiones y asignación de profesores (TASK-042)

- Listado `/home/materias` con selector de carrera (Todas + 5 carreras), chips de año y electivas condicionales y agrupación por año por carrera ([TASK-042](docs/tasks/finished/TASK-042-front-contrato-carreras-comisiones.md)).
- Alta y edición de materias (`MateriaForm`) con selección múltiple de carreras y validación de año por carrera.
- Cursadas actualizadas para mostrar cantidades (`X comisiones · Y profesores · S, C`) sin referencia a profesor responsable.
- Comisiones con filtro por chips de carrera en la cursada, visualización de profesores con su cargo docente.
- Pantalla nueva de detalle de comisión (`/home/materias/[materiaId]/cursadas/[cursadaId]/comisiones/[comisionId]`) con asignación, modificación de cargo y desasignación de profesores (solo ADMIN), enlace a otras comisiones y placeholder de experiencias.
- Formulario de alta de comisiones con carrera filtrada por materia y número de comisión (1-999) con preview del código identificador.
- Tipos, esquemas Zod (`academic.ts`, `schemas.ts`, `materias.ts`) y soporte para métodos `PUT` y `DELETE` en `http.ts`.


### Lecturas de carreras, resumen de cursada y detalle de comisión (TASK-041)

- Materias con `carreras[]` en toda respuesta y filtro `?carrera=` en el listado
  ([TASK-041](docs/tasks/finished/TASK-041-lecturas-carreras-comisiones.md)).
- Resumen de cursada con cantidades de comisiones y profesores y letras de carrera.
- Comisiones con `carrera`, `numero` y profesores ordenados por cargo.
- `GET /comisiones/:comisionId` con cursada y materia; campos legados intactos.

### Doble escritura de carreras, comisiones y profesores (TASK-040)

- Materias con `carreras[]` y relleno de la carrera `S` para las existentes con año
  ([TASK-040](docs/tasks/finished/TASK-040-doble-escritura-carreras-profesores.md)).
- Comisiones con carrera y número; formas legadas vigentes hasta TASK-044.
- Asignación y baja de profesores por comisión (`PUT`/`DELETE`, solo ADMIN).
- Cursada sin profesor obligatorio; historial `"carreras"`; 409 al quitar una carrera con comisiones.
- Seed en el formato nuevo, idempotente.

### Normalización de tokens de color, layout, radios y tipografía secundaria (TASK-035)

- Nuevos tokens `--primary-rgb` y `--content-max-app` en `tokens.css`; la sombra de los chips activos y `.system-content` dejan de usar literales ([TASK-035](docs/tasks/in-progress/TASK-035-front-normalizacion-tokens.md)).
- Radios de `.55rem`, `.65rem`, `.7rem`, `.8rem` y `1.1rem` unificados en `--radius-sm`, `--radius-md` y `--radius-lg`.
- Textos de ayuda, errores, `dt`, avisos y chips pasan de `.85rem` a `--text-sm`.

### Tokens de diseño en MateriasList (TASK-034)

- Reemplazo de literales coincidentes con la escala por variables `var(...)` en `MateriasList.module.css` ([TASK-034](docs/tasks/finished/TASK-034-front-tokens-materias-list.md)).
- Valores de radio (`--radius-xl`, `--radius-pill`, `--radius-lg`), peso (`--weight-heavy`, `--weight-semibold`), texto (`--text-md`) y espaciado (`--space-1` a `--space-6`) alineados con `tokens.css`.
- Valores computados idénticos, sin diferencias visuales en `/home/materias`.

### Cierre del plan de refactorización del frontend (TASK-023 y TASK-027 a TASK-033)

- Etapa 0, red de seguridad: ESLint, CI, tests de interacción y spec visual con axe
  ([TASK-023](docs/tasks/finished/TASK-023-front-red-de-seguridad-calidad.md)).
- Etapa 1, tokens de diseño de espacio, radio, texto, peso, sombra, layout y capas
  ([TASK-027](docs/tasks/finished/TASK-027-front-tokens-de-diseno.md)).
- Etapa 2, cascada CSS con `@layer` y un archivo por área
  ([TASK-028](docs/tasks/finished/TASK-028-front-cascada-css-controlada.md)).
- Etapa 3, primitivas compartidas de `components/ui/`
  ([TASK-029](docs/tasks/finished/TASK-029-front-primitivas-de-ui.md)).
- Etapa 4, patrones de listado, detalle y alta
  ([TASK-030](docs/tasks/finished/TASK-030-front-patrones-de-pantalla.md)).
- Etapa 5, endpoints de detalle y respuestas validadas con Zod
  ([TASK-031](docs/tasks/finished/TASK-031-contratos-front-back-academico.md)).
- Etapa 6, encabezados, shell compartido y accesibilidad sin violaciones axe graves
  ([TASK-032](docs/tasks/finished/TASK-032-front-consistencia-y-accesibilidad.md)).
- Etapa 7, estándares `frontend-*.md`, agente de front, ESLint en error y listado de profesores
  para administración en `/home/admin/profesores`
  ([TASK-033](docs/tasks/pendient/TASK-033-front-estandar-y-documentacion.md)).

### Presentación de filtros de materias (TASK-026)

- Etapa aprobada por el usuario el 2026-10-22; pruebas frontend completas aprobadas.
- Buscador y filtros agrupados en un panel con estilos locales al módulo.
- Chips para seleccionar año o Electivas, con chips de nivel 3, 4 y 5 al elegir Electivas.
- Selección visible y accesible por teclado, controles adaptados a pantallas pequeñas.
- Conservados búsqueda, contexto de navegación y paginación sin cambios al backend.

### Buscador de materias y niveles de electivas (TASK-025)

- Cambios de materias (TASK-024 y TASK-025) validados manualmente por el usuario el 2026-10-22.
- Búsqueda parcial por nombre combinable con año y nivel, aplicada antes de paginar.
- Selector de nivel 3, 4 o 5 al filtrar Electivas; texto, año, nivel y página se conservan
  al navegar al detalle y regresar.
- Nivel obligatorio para crear o editar electivas, visible en sus datos y trazado en
  historial. Al convertir una electiva en obligatoria se limpia su nivel.
- Casos probados y resultados documentados en la
  [matriz TASK-025](docs/tasks/finished/TASK-025-busqueda-materias-niveles-electivas.md#matriz-de-trazabilidad-de-casos-probados).

### Filtros de materias por año de carrera (TASK-024)

- Consulta de materias filtrada y ordenada por año de carrera y nombre, con páginas de
  hasta 9 elementos y conservación del filtro al regresar desde el detalle.
- Clasificación obligatoria de nuevas materias: primero a quinto año o Electiva;
  las materias heredadas permanecen sin clasificación hasta su actualización administrativa.
- Alta y edición administrativa con validación, auditoría e historial de cambios de
  campos paginado de a 3 elementos. Controles funcionales sin rediseño general de la UI.
- Matriz de trazabilidad de criterios, pruebas y recorrido en navegador en
  [TASK-024](docs/tasks/finished/TASK-024-filtros-materias-anio-carrera.md#trazabilidad-de-casos-probados).

### Verificación institucional (TASK-022)

- Registro de estudiantes pendiente hasta confirmar su correo `@alu.frlp.utn.edu.ar`.
- Enlaces SMTP de verificación con vencimiento de 24 horas, confirmación y reenvío.
- Bloqueo de login, sesiones y refresh de estudiantes sin verificar; ADMIN provisionados
  explícitamente conservan acceso.
- Pantallas de confirmación y reenvío, y protección de tokens y cabeceras de privacidad.
- Validación automatizada y manual aprobada, incluido el envío SMTP real desde el entorno local.

### Validado

- El desarrollador confirmó el 2026-10-09 los cambios de autenticación, Docker y UX de
  TASK-005 a TASK-013; las tareas se cerraron en `finished/`.
- Guía del equipo actualizada con arranque local, configuración privada y el flujo de
  una única PR de `feature/auth` hacia `desarrollo` protegido.

### Agregado

- Red de seguridad de calidad del front: ESLint (Next `core-web-vitals`, `react-hooks`,
  `jsx-a11y`, en advertencias), workflow de CI de verificación, tests de caracterización de
  interacción con jsdom y Testing Library, y spec de línea base visual con axe. (TASK-023)
- Panel de administración del catálogo académico: alta de materias, profesores, cursadas y
  comisiones y listado de cuentas registradas, bajo `/home/admin` y visible solo para cuentas
  ADMIN. (TASK-020)
- Separación de entrada pública y navegación autenticada: landing sin icono de cuenta,
  `/home` protegido con menú lateral y estados vacíos informativos de próximos módulos.
  (TASK-013)
- Menú de cuenta por icono con Mi perfil, Cambiar contraseña y Cerrar sesión; perfil con
  tarjeta de datos separada de las acciones. (TASK-012)
- Landing de Profesor Butchery con propósito, CTA y carrusel 3D accesible de
  funcionalidades futuras. (TASK-011)
- Política de contraseña unificada (8–128 caracteres) en frontend/backend y paso a HTTP
  local en desarrollo, preservando HTTPS en producción. (TASK-011)
- Instructivo Docker aclarado por entorno, con recorrido de navegador y recuperación vía
  Mailpit comprobados.
- Stack Docker completo: Compose separados para desarrollo y producción, builds por
  etapas, migraciones Prisma como job y Nginx no-root. (TASK-010)
- Endurecimiento de contenedores: healthchecks, usuarios no-root, límites de recursos y
  filesystems de solo lectura. Mailpit y TLS local exclusivos de desarrollo. (TASK-010)
- Etapa 4 de autenticación: recuperación y cambio de contraseña por SMTP, con tokens de
  un solo uso y revocación de sesiones al cambiar. (TASK-008)
- Etapa 3: refresh opaco con rotación atómica y logout; reutilización de un token
  revoca la sesión. (TASK-007)
- Etapa 2: login, sesión persistida, roles ADMIN/USER y protección CSRF/CORS. (TASK-006)
- Etapa 1: registro público con rol USER fijo, hash Argon2id y provisión de ADMIN
  explícita e idempotente. (TASK-005)
- Monorepo inicial con NestJS, Next.js, Prisma y PostgreSQL; flujo y tareas documentados
  en `AGENTS.md`.

### Seguridad

- Prisma usa el adapter JavaScript `pg` sin motor binario nativo.
- `deepmerge-ts` se fija en 8.0.2 mediante `overrides`.
