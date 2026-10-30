# Historial de Cambios

## [Sin publicar]

### Contexto de navegación administrativa

- Experiencias → comisión conserva filtros, página, breadcrumb contextual y sección activa.
- Los accesos académicos conservan su jerarquía y los enlaces directos reconstruyen los padres reales. Retornos internos validados, sin mensajes transitorios ni cadenas ilimitadas.
- Auditoría de comentarios, profesores del equipo y edición conservan sus destinos de origen; guardar/cancelar desde detalle no anida copias del mismo detalle.
- Sin cambios de diseño, permisos ni backend. 709 pruebas frontend, tipos, lint, build y 16 comprobaciones HTTP aprobados; frontend del stack actualizado. Recorridos en navegador a cargo del desarrollador; evidencia en `docs/tasks/finished/TASK-admin-navigation-context.md`.

### Actores de auditoría en todos los módulos administrativos

- Resolución uniforme de nombres en materias, cursadas, comisiones y experiencias, conservando usuarios/profesores. Incluye el actor de la última modificación de MateriaHistorial fuera de la página visible.
- Comisiones y experiencias consumen los nombres autorizados en su auditoría e historial, sin mostrar referencias de actor como identificadores técnicos ni inventar atribuciones ausentes.
- Validación completa: 895 pruebas backend con integraciones y 640 frontend aprobadas, tipos/lint/builds correctos y migraciones sin diferencias. Stack regenerado y saludable con 16 comprobaciones HTTP aprobadas. Commits reservados al usuario.

### Actores de auditoría de Profesores

- El detalle administrativo ahora resuelve los nombres de creación, modificación, baja e historial mediante consulta agrupada autorizada, como usuarios. Conserva las ausencias reales sin inventar atribuciones.
- Verificada la escritura transaccional de acciones y actor de sesión: 101 pruebas backend y 17 frontend aprobadas; alta/edición/baja comprobadas en PostgreSQL con reversión completa. Sin cambios de permisos ni eventos históricos.
- Stack local reconstruido y reiniciado, servicios saludables y 16 comprobaciones HTTP aprobadas. Los registros legados sin auditoría conservan las ausencias reales.

### Presentación del detalle administrativo de Profesores

- Encabezado y acciones coherentes con materias y cursadas; ficha compacta de nombre, iniciales reales y estado explícito, adaptable a móvil y nombres largos.
- Reutiliza auditoría e historial compartidos con actores sin identificadores técnicos. Volver conserva búsqueda y página del listado de profesores, con alternativa segura ante origen inválido.
- Conserva permisos, confirmación/cancelación y restricciones de baja sin modificar asignaciones ni backend. Validación automática en la tarea; revisión visual a cargo del desarrollador.

### Presentación del detalle administrativo de Cursadas

- Encabezado con período real, contexto de materia y acciones existentes; tarjeta semántica y acceso directo a comisiones con contexto de regreso.
- Reutiliza los estilos de materias y la auditoría/historial compartidos de usuarios, con períodos legibles y actores sin identificadores técnicos. Confirmación concisa de baja con etiqueta cursada.
- Pruebas de regresión de períodos, estados, permisos, navegación, teclado, bajas e historial; sin navegador ni commit. Evidencia en `docs/tasks/finished/TASK-cursada-detail-presentation.md`.

### Mensajes de confirmación de baja académica

- Los modales identifican el registro por su nombre, sin mostrar el ID. Mensajes breves sobre inactividad, conservación de datos e historial y asociaciones vigentes que bloquean la baja según cada entidad.
- Sin cambios a permisos, operaciones, confirmaciones ni restricciones del backend.

### Presentación del detalle administrativo de Materias

- Encabezado contextual y acciones existentes de edición/baja, información académica semántica y asociaciones completas de carrera, año y nivel de electiva.
- Auditoría e historial reutilizan la presentación de usuarios, con etiquetas de baja académica, valores legibles y actores sin identificadores internos.
- Regresiones automáticas y disponibilidad del stack local documentadas en la tarea; revisión de navegador a cargo del desarrollador, sin capturas ni commit.

### Integración de desarrollo y compatibilidad de pruebas

- Se incorpora la gestión docente de TASK-057 conservando la navegación contextual administrativa y el guardado inmediato de asignaciones, cargos y desvinculaciones.
- Pruebas de listados, detalle y edición adaptadas a las relaciones materia/cursada y al retorno jerárquico actual, conservando cobertura de filtros y paginación.
- Validación automática documentada en la tarea de integración; validación en navegador a cargo del desarrollador, sin capturas.

### Navegación contextual administrativa académica

- Breadcrumbs de Materias, Cursadas y Comisiones reconstruyen la jerarquía con nombres y relaciones reales; los niveles anteriores apuntan a sus vistas administrativas.
- `Volver`, edición, guardar y cancelar conservan el listado y contexto de origen. Los retornos se validan por ruta, entidad y relación; el listado global de cursadas sigue disponible.
- Las rutas administrativas anidadas mantienen Materias activa en el menú lateral. Pruebas focalizadas, TypeScript y lint; revisión de navegador a cargo del desarrollador.

### Detalle exclusivo de usuarios y marca superior

- Tarjeta de cuenta con iniciales, nombre público, estado, acción superior y nota de propia cuenta basada en sesión; conserva confirmaciones y restricciones reales.
- Auditoría de usuarios con iconografía, distribución responsive y nombres de actores resueltos por backend mediante consulta agrupada exclusiva de este detalle; sin IDs visibles.
- Historial accesible cerrado con diferencias Campo/Antes/Después y retorno al listado con filtros y página. Marca BookOpen compartida con enlace según rol.
- Se preserva la presentación actual de detalles académicos. Prueba de navegador a cargo del desarrollador; sin commits.

### Presentación del detalle de usuario y auditoría administrativa

- Resumen compacto de nombre público y estado, campos con jerarquía tipográfica y acciones de acceso responsive; se conservan filtros, confirmaciones y permisos.
- Auditoría compartida exclusiva de administración, sin ID visible, con bloques de creación, modificación y baja, fechas legibles y horas secundarias.
- Historial desplegable cerrado inicialmente con contador real y paginación de tres eventos; sin inferir estado ni inventar actores ante datos ausentes.
- Paleta actual mediante tokens existentes. Sin cambios de endpoints ni commits. Prueba de navegador a cargo del desarrollador.

### Docentes en edición administrativa de comisiones (TASK-057)

- Integración con el detalle actualizado de desarrollo, conservando experiencias,
  navegación administrativa, bajas y actualización del equipo y su auditoría.
- Se elimina el acceso superior duplicado a asignar, se separa la tarjeta de los botones
  de guardado y se pliega el formulario tras asignar correctamente, con opción de reabrirlo.
- Gestión de docentes desde Editar comisión, reutilizada con el detalle académico:
  asignación múltiple, cambio de cargo y desvinculación sin eliminar profesores.
- Confirmación del servidor antes de actualizar, prevención de duplicados y doble envío,
  catálogo paginado completo, mensajes de éxito/error y reintentos; acceso solo ADMIN.
- Se reutilizan endpoints y relaciones existentes, sin migraciones ni cambios de autenticación.

### Formularios de comisiones y retorno de altas administrativas

- Carrera única de la materia asignada automáticamente como contexto de lectura; selección restringida cuando hay varias y bloqueo explicativo cuando no hay carreras. Backend resuelve y valida la asociación desde persistencia.
- Altas de materias, profesores, períodos y comisiones regresan a su listado o sección administrativa de origen únicamente tras éxito, con confirmación y actualización de datos. Las asignaciones docentes actualizan equipo, opciones e historial en la misma sección.
- Se preservan filtros y campos ante errores, se avisa si el alta queda fuera de la selección y se ofrece limpiar filtros explícitamente. Ediciones sin diferencias no envían actualizaciones; edición de materia vuelve al detalle conservando el origen.
- Se agregan pruebas de regresión de carreras, navegación, errores/reintentos, filtros y asignaciones. Sin commits; ver evidencia en la tarea.

### Bajas administrativas académicas

- Acciones Trash2 y confirmaciones de baja lógica en listados y detalles de materias, profesores, comisiones y períodos. Se identifica el registro y se explican dependencias y conservación de relaciones, experiencias e historial.
- Listados recalculan resultados y ajustan automáticamente la página cuando desaparece su última fila; el detalle conserva estado y auditoría tras una baja o un bloqueo.
- Auditoría de bajas exitosas y bloqueadas con resultado, actor, fecha y motivo; los bloqueos no se presentan como modificaciones del registro. Materia conserva su contrato histórico sin duplicar eventos.
- Se distingue quitar una asignación de dar de baja al profesor y se impide desvincular asignaciones de una comisión dada de baja ante solicitudes concurrentes. Sin cascadas, borrado definitivo ni migraciones nuevas.

### Corrección del detalle administrativo detrás del proxy

- Nginx dev y TLS reenvían `/admin/`, `/users/` y `/profesores/` al backend. Los detalles, historial y operaciones individuales dejan de caer en el frontend con 404 HTML.
- Se agrega `scripts/check-admin-proxy.mjs` para verificar el enrutamiento real y conservar las páginas administrativas en frontend. Se comprobaron los seis detalles en navegador autenticado y sus permisos pasando por el stack local.

### Gestión del acceso de usuarios

- Confirmaciones de desactivación y reactivación identifican nombre y email; acciones Lucide accesibles en listado y detalle, estado y resultados filtrados actualizados tras operar.
- El detalle vuelve a los eventos más recientes tras cambiar el estado. Se explicita que reactivar requiere iniciar sesión nuevamente y conserva las revocaciones anteriores.
- Verificada protección backend de cuentas inactivas, sesiones existentes, permisos y administradores concurrentes; comentarios anónimos y snapshots permanecen intactos. Nuevos eventos de reactivación usan REACTIVACION.
- Migración aditiva del CHECK de historial para admitir eventos de comentarios y evitar el error 500 detectado durante las pruebas. Documentación de contratos y pruebas ampliadas. Sin commits.

### Detalle administrativo y trazabilidad

- Accesos Eye a detalles administrativos de usuarios y comentarios; Experiencias conserva filtros y página al regresar.
- Auditoría compartida para materias, profesores, usuarios, comentarios, comisiones y períodos, con historial paginado y datos ausentes explícitos.
- Lecturas protegidas por ADMIN y selección segura; futuras altas y relaciones académicas y eventos de comentarios registran actor dentro de la transacción existente.
- Sin reconstrucción de eventos históricos ni cambios en el detalle privado del autor.

### Administración remota, estados y bajas lógicas (TASK-070)

- Profesores y Usuarios filtran y paginan en PostgreSQL; los resultados y selectores
  administrativos dejan de descargar catálogos completos. Las tablas mantienen nueve filas,
  total filtrado y contexto en URL. Materias busca por nombre y los períodos se eligen por páginas.
- Usuarios incorpora estado, activación/reactivación confirmada e historial. Desactivar
  revoca sesiones y credenciales pendientes; login, refresh y acceso rechazan cuentas inactivas.
  Se impiden autodesactivación y pérdida concurrente de administradores activos.
- Materias, Profesores, Cursadas y Comisiones permiten baja lógica confirmada, protegida por
  ADMIN y bloqueada por relaciones vigentes. Se conservan comentarios, snapshots e identidad
  histórica. Índices únicos parciales permiten reutilizar claves de registros dados de baja.
- Historial administrativo registra ediciones reales y bajas con actor y fecha, con páginas
  de tres eventos. Edición regresa al detalle con éxito y retorno contextual al listado.
- Migración aditiva de estado e historial; pruebas con PostgreSQL/Mailpit temporales y
  recorridos funcionales sin capturas. Experiencias conserva sus tarjetas. Sin commits.

### Tablas administrativas coherentes (TASK-069)

- Materias, Profesores, Usuarios, Cursadas y Comisiones comparten tabla de ancho completo,
  filas compactas, filtros y alta en una barra, y scroll contenido en móvil. Experiencias
  mantiene sus tarjetas y filtros sin cambios.
- Acciones reales Eye/Pencil con nombre accesible, tooltip por foco/hover y cierre con Escape.
  Altas con Plus y texto explícito. No se agregan eliminación, gestión de cuentas ni roles.
- Filtros antes de paginar nueve filas, total filtrado y retorno contextual en URL. Materias
  filtra en backend; los catálogos sin búsqueda remota reutilizan la carga completa acotada
  existente (hasta 2000 registros; error en vez de resultados parciales).
- Usuarios permite buscar nombre/email y filtrar rol. Estado y activación quedan pendientes
  porque el contrato actual no los expone. Sin dependencias ni cambios de endpoints.

### Recorrido administrativo por rol (TASK-068)

- Inicio de sesión, marca y menú resuelven el panel administrativo para ADMIN. Perfil y
  cierre de sesión se conservan, con menú estudiantil intacto para USER y guard administrativo.
- Detalles administrativos de materia, profesor, cursada y comisión reutilizan consultas y
  edición existentes. Los listados y relaciones permanecen en administración y conservan origen.
- Experiencias administrativa reutiliza filtros y paginación sin invitar a publicar ni abrir
  gestión privada del comentario. Anonimato y autorizaciones del backend se conservan.
- Breadcrumb compartido comienza en Administración; traducción central de rutas evita montar
  contenido estudiantil para ADMIN. Sin dependencias, migraciones ni operaciones backend nuevas.

### Integración de desarrollo y comentarios (TASK-067)

- Se integran los listados y editores administrativos del equipo hasta 1be4682, conservando
  su contrato de cursadas por materia/año/período, incluidos períodos Anual, Primero y Segundo.
- Se conservan los ajustes de breadcrumbs, materias/comisiones, filtros de Experiencias y
  administración del comentario propio. Los períodos del mismo año mantienen sus IDs y
  experiencias; los nuevos snapshots usan el período real de la cursada.
- Se compatibiliza la migración de modalidad aún no publicada y se agrega corrección para
  instalaciones de la variante anual anterior, sin fusionar filas ni inventar períodos nulos.
- Regresión de frontend/backend y PostgreSQL efímero, sin modificar la base local. Cambios
  del equipo, propios y de integración identificados en TASK-067 para aceptación manual.

### Administración del comentario propio (TASK-066)

- Detalle privado Tu comentario con breadcrumb compartido y regreso contextual con filtros.
  Una tarjeta reúne materia enlazada, carrera/comisión/período, destinatario, texto completo
  y acciones Editar/Eliminar con Lucide. Identidad pública y fechas útiles en el pie.
- Se retira la tarjeta visible de auditoría sin modificar registros ni permisos. Historial
  real cerrado inicialmente, con consulta al abrir y paginación existente de tres versiones.
- Texto adaptable, acciones que se distribuyen en móvil y tokens actuales. Confirmación,
  cancelación, reintento de eliminación y navegación de edición conservados. Sin cambios
  de backend, dependencias nuevas ni migraciones; aceptación visual pendiente.

### Experiencias: filtros y lectura (TASK-065)

- Filtros combinados de carrera y materia antes de paginar. La carrera corresponde a la
  comisión real del comentario; las materias compartidas no mezclan experiencias de otras
  carreras. Total y página mantienen el mismo snapshot y el orden reciente estable.
- Selector de materia con búsqueda remota, debounce y opciones paginadas, también sin
  carrera. Al cambiar carrera conserva solo una materia compatible y reinicia la página.
- Filtros y página en URL y regreso desde comisión o administración del comentario.
  Tarjetas compartidas con materia enlazada, carrera formal, texto legible y acciones
  secundarias; anonimato y permisos privados conservados.
- Sin dependencias ni migraciones nuevas. Verificación técnica sin navegador; aceptación
  visual pendiente y servicios locales apagados.

### Identificación académica y selección de comisiones (TASK-064)

- Denominaciones formales centralizadas, incluida Ingeniería en Sistemas de Información.
  Materias compartidas se identifican como Básica según sus asociaciones completas; año y
  nivel corresponden a la carrera elegida o indican cuándo dependen de la carrera.
- Filtros de carrera asociada y año de cursada juntos, con selección conservada en URL.
  Carrera única fija; materias compartidas sin selección no cargan todas las comisiones.
- Consulta de comisiones filtrada por carrera antes de paginar y contar en backend. Nueve
  por página, estado vacío estable y sin cambio automático a otra combinación.
- Tarjetas completas como enlaces, código unido, carrera formal y docentes/cargos reales;
  grilla responsive de ancho suficiente y sin alturas mínimas artificiales.

### Breadcrumbs compartidos (TASK-063)

- Recorrido y Volver centralizados en Breadcrumb/PageHeader: superficie blanca, borde,
  selección y foco con tokens del proyecto, separadores Lucide y ajuste de nombres largos.
- Se eliminan variantes locales del formulario; las páginas con breadcrumbs conservan
  una presentación única, también en móvil. Sin agregar recorridos a páginas raíz.
- Comentarios muestran materia y comisión reales y conservan filtros/páginas al administrar,
  editar y regresar. Desde Experiencias se conserva la página del listado de origen.
- Regreso interno conocido con alternativa coherente, enlaces nativos y un solo aria-current.

### Modalidad de materia y refinamiento del formulario (TASK-062)

- Modalidad Anual o Cuatrimestral (primero/segundo) en materia, incluidas electivas, con
  validación e historial. Cursada identifica únicamente materia y año. Migración conserva
  IDs, datos de períodos previos y snapshots de comentarios; se detiene ante duplicados.
- Regresan las tarjetas compactas de comisiones; selectores con apariencia del sistema
  y breadcrumb de comisión consistente con el componente compartido.
- Formulario de experiencias con destinatario antes del texto, radios o selector según
  cantidad de opciones, identidad pública con nombre o anonimato, contador Unicode y
  confirmación al cancelar cambios. Texto y selecciones se conservan ante errores.
- Pruebas focalizadas y migración verificadas en PostgreSQL efímero. Revisión visual
  manual pendiente; sin nuevas dependencias ni commits.

### Comisiones directas y experiencias generales (TASK-061, revisión visual pendiente)

- Desde una materia se accede directamente a las comisiones; la cursada es un filtro de
  período, inicialmente el más reciente. Regreso conserva período, página y contexto del
  catálogo. Las rutas anteriores y la gestión administrativa continúan disponibles.
- Equipo docente debajo de Experiencias en una sola columna.
- Experiencias muestra los mismos comentarios de todas las comisiones, con materia,
  comisión y período. Lectura paginada de nueve, anonimato preservado y acceso al detalle
  privado únicamente del autor. Sin nuevas migraciones ni dependencias.

### Catálogo de Materias e iconos de navegación (TASK-060, revisión manual pendiente)

- Filtros compactos de carrera, año y nombre combinables, incluso año sin carrera;
  búsqueda sin distinguir mayúsculas ni tildes y limpieza de filtros.
- Listas agrupadas por año y electivas con nivel, metadatos relevantes y enlaces nativos.
  Paginación de nueve materias únicas; una materia compartida figura en sus grupos sin
  inflar el total. Filtros sobre una misma asociación antes de paginar en PostgreSQL.
- `lucide-react` incorporado por pedido del usuario para menú compartido, búsqueda y
  chevrons, conservando permisos, rutas y navegación accesible.
- Pruebas enfocadas de filtros, asociaciones, paginación, estados y menú; sin migraciones
  ni nuevos endpoints. Revisión visual manual a cargo del desarrollador.

### Detalle de comisión y título de pestaña (TASK-059, revisión manual pendiente)

- Materia como título, contexto académico real, período con calendario, breadcrumbs locales
  simples y selector de comisiones del mismo período. Equipo docente en lateral compacto.
- Experiencias con total real y tarjetas legibles; ayuda secundaria y una sola acción para
  administrar el comentario propio. Detalle restringido al autor también en backend.
- Título de navegador fijo Profesor Butchery, conservando títulos visibles de las páginas.
- Sin nuevas dependencias, endpoints ni cambios al layout o navegación lateral.

### Presentación de Experiencias de comisión (TASK-058, revisión manual pendiente)

- Encabezado con acción principal, aviso informativo del límite con icono y comentarios
  presentados en tarjetas con texto destacado y metadatos secundarios.
- Navegación mediante botones dentro de Experiencias. El detalle individual y sus
  formularios conservan su presentación para un ajuste posterior.

### Comentarios por comisión (TASK-057, alta, edición y baja aceptadas manualmente)

- Publicación textual inmediata por comisión, referencia a uno de sus docentes o a la
  comisión en general y opción de anonimato. Un comentario vigente por usuario y comisión.
- Edición propia con diferencias reales, eliminación lógica confirmada y republicación;
  historial privado de tres eventos por página y comentarios paginados de nueve.
- Contexto docente y académico conservado al publicar; permisos, validación y protección
  de duplicados concurrentes en backend. Migración aditiva y rutas del proxy actualizadas.
- Sin búsqueda por docente, moderación, administración de estado ni dependencias nuevas.
  Validación automatizada del flujo principal; pruebas manuales a cargo del desarrollador.
### Administración académica HU-11 (TASK-055)

- Corrección del bloqueo de CI en configuración de correo: comprobación equivalente de
  caracteres de control compatible con ESLint, con cobertura de regresión del proveedor.
- Integración de PR29 conservando los checks CI y ambos aportes de documentación; la
  validación numérica de correo sustituye la excepción de lint incorporada en esa PR.
- Cursadas anuales en alta, edición y navegación, mediante ampliación aditiva del enum de
  período; selector múltiple de carreras en formularios de materia en lugar de checkbox.
- Tablas paginadas de materias, profesores, cursadas, comisiones y usuarios, conservando
  la portada administrativa actual; usuarios permanece como consulta.
- Edición administrativa de profesores, cursadas y comisiones sobre el modelo vigente,
  con validación estricta y preservación de docentes, cargos y relaciones.
- Bloqueo de movimientos de cursada y cambios de carrera incompatibles, también ante
  operaciones simultáneas; sin bajas, cambios de activa, roles ni auditoría nueva.
- Altas reutilizadas y retorno seguro a filtros/página del listado. Implementación
  verificada con datos locales aislados y aprobada por el desarrollador.

### Instalación de dependencias del check frontend (TASK-056)

- Se restaura `npm ci` raíz: las pruebas de contrato del frontend importan filtros
  del backend y necesitan NestJS. La instalación aislada falló en typecheck remoto.
- Hasta tres intentos de instalación con cinco segundos entre fallos para tolerar
  cortes transitorios de descarga de Prisma, conservando el fallo del job si se
  agotan los intentos. No se omiten scripts ni verificaciones.
- Evidencia local y limitaciones en la tarea; ejecución y aceptación en PR pendientes.

### CI para cada PR a desarrollo y main (TASK-002, aceptación remota pendiente)

- Los workflows existentes ejecutan ambos módulos en cada PR, incluidos cambios
  de documentación, con checks únicos `backend-ci` y `frontend-ci`.
- Se retiran los triggers push para evitar repetir las verificaciones tras el merge;
  se conservan lint, typecheck, tests, builds y servicios de integración backend.
- DoD y guía del equipo actualizados con el procedimiento de checks obligatorios
  y comprobación del bloqueo, diferida hasta un fallo durante el desarrollo por
  decisión del desarrollador. Protección de ramas y aceptación en PR real pendientes.
- Validación local: lint, typecheck y builds de ambos módulos en verde, 651 tests
  backend sin omitidos y 281 frontend aprobados, 11 migraciones aplicadas y sin deriva.

### Validación de lint en ambos workspaces (TASK-055)

- Validación inicial mediante excepción puntual de `no-control-regex` en la configuración
  de correo. HU-11 la sustituye por comparación numérica equivalente, sin excepción de lint.
- Lint de backend y frontend sin errores ni advertencias; 13 pruebas de
  configuración del proveedor de correo aprobadas en el entorno local disponible.

### Correo por Brevo HTTPS (TASK-028)

- Selección de proveedor SMTP o Brevo para verificación institucional y recuperación de
  contraseña; SMTP permanece como opción predeterminada compatible con Mailpit.
- Adaptadores HTTPS sin dependencias nuevas, con deadline y errores sin secretos.
- Blueprint de Render Free y guía de configuración para API de Brevo, evitando los puertos
  SMTP bloqueados. Cambio verificado localmente; despliegue productivo pendiente.
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
