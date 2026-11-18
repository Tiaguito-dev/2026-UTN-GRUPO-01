# Bloque A: returnTo plano (BUG-02) y errores que se limpian al corregir (BUG-03)

Estado: en progreso. Fecha: 2026-10-31.

## Objetivo y contexto
- BUG-02: al navegar Materia → Cursadas → Cursada → Comisiones → Comisión → Editar, cada nivel
  embebe el `returnTo` del anterior y la URL crece sin límite útil (`%25` repetidos; hoy solo la
  contiene `safeAdminReturnTo`, con profundidad 8 y largo 12000). El objetivo es que `returnTo`
  lleve solo el nivel inmediatamente anterior, sin anidar.
- BUG-03: en los formularios del panel, el error de un campo recién desaparece al volver a
  guardar. El objetivo es que el error de un campo se borre apenas el usuario cambia ese campo.
- Origen: `docs/bugs-y-fixes.md` (Bloque A) y el plan
  `.claude/planes/bloque-a-formularios-y-navegacion.md`.

## Alcance
BUG-03:
- `front/src/hooks/useFormSubmission.ts`: expone `handleChange` para el `<form>`, que borra
  `errors[target.name]`.
- Conectarlo en `AltaForm.tsx` (altas de cursada, comisión y profesor), los editores de
  `EditarAcademico.tsx`, `feedback/FeedbackForm.tsx` y `auth/AccountForm.tsx`.
- `admin/MateriaForm.tsx` no usa el hook: recibe el mismo borrado en su `<form onChange>`.

BUG-02:
- Builders de `validations/admin-academic-navigation.ts`, `adminListHref` y `safeAdminReturnTo`
  en `validations/admin.ts`, `AdminTable.tsx`, `AdminAcademicList.tsx`, `AdminAcademicDetail.tsx`,
  `ComisionDetail.tsx`, `useAdminCommissionOrigin.ts`, `EditarAcademico.tsx`,
  `MateriaFormPage.tsx` y `roleDestination` en `lib/navigation.ts`.
- Lectores (`academicListReturnTo`, `cursadaListOrigin`, `cursadaDetailReturnTo`,
  `comisionNavigation`, `profesorDetailBack`, `adminEditReturnTo`, `adminNavigationSection`):
  validan un solo nivel y derivan los ancestros de los IDs del registro cargado.
- `adminReturnTo` (sin callers en `src`) se borra si sus tests no lo protegen por otra razón.

Tests: los specs de `front/tests` que fijan la forma anidada se actualizan sin perder lo que
protegen, y se agregan los casos de los criterios de aceptación.

## Exclusiones
- Bloques B (DATA-01) y C (BUG-01, PEND-01).
- Revalidar en vivo o mostrar errores mientras se escribe.
- Conservar página y filtros de las listas intermedias de Cursadas y Comisiones al volver varios
  niveles (descartado en la decisión de BUG-02).
- Cambios en `components/ui/FormField.tsx` o en los estilos de error.
- Rutas `/home/...` no administrativas que no participan de la cadena.

## Decisiones
- **BUG-02: "origen + nivel anterior"** (elegida por Tiago).
  - `returnTo` es la URL del nivel inmediatamente anterior, con su página y filtros, sin ningún
    `returnTo` adentro.
  - Se conservan dos datos de contexto: los filtros de la lista de Materias (`materiaReturnTo`, un
    solo nivel) y el origen Experiencias o Profesores.
  - Los niveles intermedios del breadcrumb se derivan de `materiaId` y `cursadaId` y abren en
    página 1. Se reutiliza el fallback por IDs que ya tiene `comisionNavigation`.
  - Motivo: la URL queda corta y de largo acotado, y se conserva lo que el usuario más nota, que
    son sus filtros de Materias y el "Volver".
- **Parámetro de origen: `origen`.** El origen Experiencias o Profesores viaja como parámetro
  plano (`origen=experiencias` u `origen=profesores`, junto a la query de esa lista) en lugar de
  leerse de una cadena. Elige la sección del sidebar y el destino de "Volver". Un valor fuera de
  la lista permitida se ignora.
- **La coherencia se valida contra el registro, no contra la URL.** Al aplanar la cadena, un
  `returnTo` que apunte a una lista o detalle de otra materia o cursada se descarta y se usa el
  fallback por IDs. Un `returnTo` externo o con otro `returnTo` adentro (links viejos) degrada al
  fallback sin romper.
- **BUG-03: el fix va en el hook compartido.** `useFormSubmission` borra `errors[name]` en un
  `onChange` a nivel `<form>`; el evento de React burbujea, así que no se toca campo por campo.
  Un solo punto cubre todos los formularios del panel, más Feedback y Cuenta.
- **Al cambiar un campo solo se borra su error; no se revalida en vivo.** Es lo mínimo que pide el
  bug y no cambia cuándo aparecen los errores.

## Restricciones
- Sin dependencias nuevas, sin cambios de backend, endpoints ni permisos.
- No tocar layout global, autenticación ni componentes reutilizables globales fuera de lo listado.
- Sin commit ni push sin instrucción explícita del desarrollador.

## Criterios de aceptación
BUG-03:
- En "Editar materia" o "Nueva materia", guardar con Año vacío muestra el error; elegir
  "Electiva" lo borra junto con `aria-invalid` al instante. Lo mismo para "Nivel de electiva" y
  para el selector múltiple `carreras`.
- En las altas (cursada, comisión, profesor), los editores académicos, Feedback y Cuenta, cambiar
  un campo con error borra solo el error de ese campo; los demás errores siguen visibles.
- El momento en que aparecen los errores no cambia: solo al guardar.

BUG-02:
- En el recorrido completo, ningún href contiene un `returnTo` dentro de otro (no aparece `%25`).
- El link "Editar comisión" mide menos de ~300 caracteres.
- El breadcrumb apunta a materia, cursada y comisiones derivados de los IDs.
- "Volver" lleva al nivel anterior con su página; "Materias" conserva los filtros de
  `materiaReturnTo`.
- Desde Experiencias o Profesores, el sidebar marca esa sección y "Volver" lleva a esa lista.
- Un `returnTo` externo, anidado o de otra entidad se ignora y se usa el fallback.
- No se rompe: login con `returnTo` (`RequireGuest`, `roleDestination`), links de recursos para
  usuarios no admin, Usuarios (filtros y volver) y el alta de comisión desde una cursada.

## Validaciones
- Automáticas desde la raíz: `npm run typecheck -w front`, `npm run lint -w front`,
  `npm run test -w front`, `npm run build -w front`.
- Manual (Tiago, local, cuenta admin): recorrido del plan, sección "Criterio de listo".

## Resultado
Implementado en código. Falta la prueba manual de Tiago (plan, "Criterio de listo").

BUG-03:
- `useFormSubmission` expone `handleChange`, conectado al `<form>` de las altas, los editores
  académicos, Feedback y Cuenta. `MateriaForm` borra `errors[name]` en su propio `<form onChange>`.

BUG-02 (contrato final):
- `returnTo` guarda un solo nivel: `safeAdminReturnTo` rechaza cualquier URL que traiga otro
  `returnTo` adentro. Los links viejos con la cadena anidada degradan al recorrido por IDs.
- Las listas de Cursadas y Comisiones no llevan `returnTo`. Su "Volver" y su breadcrumb salen de
  `materiaId`, `cursadaId` y `materiaReturnTo`.
- `materiaReturnTo` viaja **al lado** de `returnTo`, nunca adentro. `returnToQuery` (al armar un
  link) saca el `returnTo` propio del destino y separa `materiaReturnTo`. `joinedReturnTo` (al
  leer) los vuelve a unir. Así ningún link del recorrido tiene `%25` por anidamiento.
- Una comisión abierta desde Experiencias lleva `origen=experiencias` más
  `experienciasCarrera`, `experienciasMateriaId` y `experienciasPage`. Es la misma convención que
  ya usaban las rutas públicas y `roleDestination`, que deja de agregar un `returnTo` aparte.
  Se sigue aceptando `returnTo=<lista de Experiencias>` de un nivel (links existentes).
- `origen=profesores` no hizo falta: el detalle de profesor ya vuelve a la lista de Profesores con
  un `returnTo` de un nivel, y eso elige la sección del sidebar.
- La coherencia se valida contra el registro cargado: el "Volver" de una comisión o cursada solo
  acepta la lista de su misma materia y cursada. Si no, usa la lista derivada de los IDs.
- Se borraron `adminReturnTo` (sin callers), `cursadaListOrigin`, `cursadaDetailReturnTo` y
  `materiaDetailReturnTo` (solo leían la cadena anidada).

Contexto que se pierde a propósito (un solo nivel):
- Al volver de una edición, el detalle ya no recuerda la página de su lista. Por ejemplo,
  Profesores página 3 → profesor → Editar → Cancelar → "Volver" abre la página 1. Los filtros de
  Materias y el origen Experiencias de una comisión sí se conservan.
- Un profesor abierto desde una comisión y después editado vuelve al profesor. El sidebar marca
  Profesores, porque la comisión ya no viaja en la URL de la edición.

Archivos fuera del alcance listado que se tocaron porque llaman a lectores cuya firma cambió:
`components/home/SidebarNav.tsx` y `components/feedback/ComisionFeedback.tsx` (una línea cada
uno: pasan `params` en lugar de `params.get("returnTo")`).

Validación automática (2026-10-31, desde la raíz): `npm run typecheck -w front`,
`npm run lint -w front`, `npm run test -w front` (74 archivos, 752 pruebas) y
`npm run build -w front` aprobados.
