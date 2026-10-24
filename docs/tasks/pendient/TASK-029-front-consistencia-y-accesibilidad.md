# TASK-029: Consistencia y accesibilidad de las pantallas internas

Estado: Pendiente. Decisiones 1 a 4 propuestas, a confirmar por el desarrollador antes de mover
la tarea a `in-progress/`. Depende de TASK-023, TASK-026 y TASK-027.
Fecha: 2026-10-21

## 1. Contexto y objetivo

Las etapas anteriores dejaron las piezas compartidas (`PageHeader`, `Notice`, `Card`,
`EmptyState`) sin cambiar el aspecto ni el comportamiento. Esta etapa decide **cómo debe verse y
comportarse** una pantalla interna y la aplica a todas. Inventario sobre `desarrollo`
(`253c650`), más lo que las tareas anteriores dejaron para acá:

- **Acceso denegado sin título principal y fuera del shell.** `RequireAuth.tsx:25` renderiza
  `<section><h2>Acceso no permitido</h2>…<Link href="/account">Volver a mi cuenta</Link>`. Le
  faltan el `h1`, el foco al título, el panel y el estado visual, y el enlace saca al usuario de
  `/home`. Los estados `temporary-error` de `RequireAuth.tsx:19-24` y `RequireGuest.tsx:21`
  tampoco tienen `h1` ni panel, y usan `role="alert"` sin `.notice`. TASK-026 los dejó afuera
  porque adoptar `Notice` o `Card` cambia su aspecto.
- **Aviso duplicado en Administración.** `app/home/layout.tsx:9` y `app/home/admin/layout.tsx:8`
  montan `RequireAuth`, y cada uno muestra `COORDINATION_NOTICE` si el navegador no tiene Web Locks
  (`RequireAuth.tsx:26`). En `/home/admin/**` el aviso aparece dos veces.
- **Landmark con nombre equivocado.** `SiteHeader.tsx:31` llama "Navegación principal" a un
  `<nav>` que solo contiene el botón de cuenta. La navegación real es el sidebar:
  `aside "Secciones del sistema" > nav "Funcionalidades"` (`SidebarNav.tsx:20-22`). Además,
  `SiteHeader.tsx:39` repite `status === "authenticated"`, que ya está garantizado por la
  línea 31.
- **Encabezados sin regla.**
  - El eyebrow aparece solo en Inicio y Próximamente.
  - `AdminPanel` no tiene breadcrumb, pero sus cinco pantallas hijas sí.
  - Materias tiene un breadcrumb de un solo ítem, que no lleva a ningún lado.
  - Las altas muestran "volver" dos veces: en el breadcrumb y en un enlace al pie
    (`AltaForm.tsx:87, 114`).

  TASK-027 unificó la estructura, pero dejó cada pantalla con lo que tenía (su decisión 2).
- **Perfil fuera del shell.** `/account` y `/account/change-password` no tienen sidebar y usan el
  layout centrado de auth. Al entrar al perfil desde el menú de cuenta, el usuario pierde la
  navegación. `front/OVERVIEW.md` lo describe pero no explica por qué.
- **Texto de menos de 12px.** `.feature-category` mide `.68rem` (≈10.9px) en mayúsculas
  (`globals.css:154`).
- **Sin chequeo de accesibilidad todavía.** TASK-023 agrega axe al e2e y registra las violaciones
  que encuentre, sin corregirlas. Esta tarea las corrige.

Objetivo: que todas las pantallas internas sigan la misma regla de encabezado y navegación, que
los estados de error y de permiso sean pantallas completas dentro del shell, y que axe no reporte
violaciones `serious` ni `critical`.

Es la Etapa 6 del plan de refactorización del frontend. Esta tarea **sí cambia el aspecto y el
comportamiento**, a propósito, en los puntos de la sección 2.

> Toca autenticación (los guards), layout global y el router de `/account`, que `AGENTS.md` lista
> como áreas sensibles. Esta tarea es la autorización explícita para hacerlo, dentro del alcance
> de la sección 2.

## 2. Alcance

### 2.1 Regla de encabezado (decisión 2)

| Elemento | Regla |
|---|---|
| `h1` | Siempre, vía `PageHeader`, con foco al montar. |
| Breadcrumb | Solo si la pantalla tiene al menos un nivel padre. No se muestran breadcrumbs de un solo ítem. |
| Eyebrow | Solo en pantallas informativas sin datos (Inicio y Próximamente). |
| "Volver" al pie | Se elimina donde el breadcrumb ya lleva al mismo lugar. Se conserva en los estados vacío y error, donde no hay breadcrumb a la vista o donde la acción es la salida principal. |

Aplicarla:

- Materias pierde su breadcrumb de un ítem.
- `AdminPanel` queda sin breadcrumb, porque es de primer nivel.
- Las altas pierden el enlace inferior de `AltaForm.tsx:114`.
- Documentar la tabla en `front/OVERVIEW.md`, en la sección "Cómo armar una pantalla" de
  TASK-027.

### 2.2 Perfil dentro del shell (decisión 1)

- Extraer el shell de `app/home/layout.tsx` a `components/home/AppShell.tsx` (`RequireAuth`,
  `SidebarNav` y contenedor).
- `app/home/layout.tsx` y un nuevo `app/account/layout.tsx` usan `AppShell`. Las páginas de
  `/account` dejan de envolverse solas en `RequireAuth` y en `.account-container` / `.auth-card`.
- Las URLs no cambian. Se conservan `/account` y `/account/change-password`, los encabezados
  `no-store` y `no-referrer` de `next.config.ts`, la lista de `safeReturnPath` y los enlaces del
  menú de cuenta.
- El sidebar marca "Inicio" como activa en `/account/**`: no hay una sección "Perfil" en el
  menú lateral, porque el perfil se abre desde el menú de cuenta.
- El perfil y el cambio de contraseña pasan al layout de pantalla interna: título alineado a la
  izquierda, `Card` de panel y breadcrumb "Mi perfil › Cambiar contraseña" en la segunda.

### 2.3 Guards como pantallas completas

- **Acceso denegado.** Se muestra dentro del shell: `PageHeader` con "Acceso no permitido",
  `EmptyState` con el motivo y la acción "Volver al inicio" a `/home`.
- **Error temporal de sesión.** En `RequireAuth` y `RequireGuest` (variante sin
  `preserveReturn`): `PageHeader` con "No pudimos comprobar tu sesión", `Notice tone="error"` con
  el detalle, y las acciones "Reintentar comprobación" y "Volver a iniciar sesión" como botones.
- **Aviso de coordinación.** Un solo aviso: se separa la autorización por rol en
  `components/auth/RequireRole.tsx` (sin chequeo de sesión ni aviso).
  `app/home/admin/layout.tsx` usa `RequireRole roles={["ADMIN"]}`. El aviso queda solo en
  `RequireAuth`, dentro de `AppShell`.

### 2.4 Landmarks y header

- `SiteHeader`: se quita el `<nav>` que envuelve el menú de cuenta. Queda un `div` con el botón,
  que ya se anuncia con su `aria-label`, `aria-expanded` y `aria-controls`. Se borra la
  condición redundante de la línea 39.
- `SidebarNav`: el `<nav>` pasa a llamarse "Navegación principal". El `aside` deja de llevar
  `aria-label`, para no anunciar dos regiones con el mismo propósito.

### 2.5 Accesibilidad general

- Tamaño mínimo de texto `.75rem` (`--text-xs` de TASK-024): `.feature-category` pasa de `.68rem`
  a `.75rem`.
- Corregir todas las violaciones `serious` y `critical` de axe registradas en TASK-023. Las
  `moderate` se corrigen si tocan los archivos de esta tarea; las demás se listan en la sección 6.
- Quitar del spec visual las marcas de "violación conocida" que agregó TASK-023.

### 2.6 Tests

- Actualizar la línea base de capturas en las pantallas que cambian a propósito: perfil, cambio de
  contraseña, Materias (sin breadcrumb), altas (sin enlace al pie), y acceso denegado y error de
  sesión (pantallas nuevas en el spec). Adjuntar en el PR la comparación de antes y después.
- `auth-navigation.spec.ts`: el rechazo de permisos tiene un `h1` y el enlace va a `/home`.
- Test de `RequireRole`: ADMIN ve el contenido; USER ve la pantalla de acceso denegado; nunca
  muestra el aviso de coordinación.
- Los 12 e2e de `auth.browser.spec.mjs` pasan. Los que verifican textos o URLs de `/account`
  siguen valiendo, porque las URLs no cambian.

## 3. Fuera de alcance

- Normalizar valores de tokens (radios, paddings y sombras fuera de escala, y las variantes de
  `Card`), salvo el tamaño mínimo de texto. Es la tarea de normalización que dejó anotada
  TASK-024.
- Que los errores de los listados reciban foco: con `role="alert"` el lector de pantalla ya los
  anuncia, y robar el foco al cargar una lista interrumpe la navegación con teclado.
- Una sección "Perfil" en el sidebar.
- Cambiar las URLs de `/account`.
- Modo oscuro.
- Landing, login, registro y recuperación: no son pantallas internas y mantienen su layout
  centrado.

## 4. Decisiones de diseño

1. **El perfil entra al shell sin cambiar sus URLs (propuesta).** El usuario no tiene por qué
   perder el sidebar para ver su cuenta. Mover las rutas a `/home/cuenta` obligaría a cambiar
   `safeReturnPath`, los encabezados `no-store` de `next.config.ts`, los enlaces del menú y unos
   diez pasos del e2e de auth, sin ganancia para el usuario. Con un layout compartido, las URLs
   quedan como están. Alternativa: dejar el perfil fuera del shell como hoy, si el layout centrado
   fue una decisión de producto.
2. **Breadcrumb solo con nivel padre, eyebrow solo en pantallas informativas, sin "volver"
   duplicado (propuesta).** Un breadcrumb de un ítem no orienta ni lleva a ningún lado, y dos
   enlaces al mismo destino en la misma pantalla son ruido. Es la regla que las pantallas de
   segundo y tercer nivel ya cumplen, y se extiende al resto.
3. **Separar `RequireRole` de `RequireAuth` (propuesta).** Hoy la autorización por rol arrastra
   todo el guard de sesión, y por eso el aviso aparece dos veces. Con `RequireRole` cada guard hace
   una sola cosa, y el panel admin sigue protegido por la sesión que ya verifica `AppShell`.
4. **El sidebar es la "Navegación principal" (propuesta).** Es la navegación entre secciones. El
   menú de cuenta es un botón con desplegable y no necesita ser un landmark.

## 5. Criterios de aceptación

- axe no reporta violaciones `serious` ni `critical` en ninguna pantalla del spec visual, sin
  marcas de "conocida".
- Todas las pantallas internas, incluidas acceso denegado y error de sesión, tienen exactamente un
  `h1`, y ese `h1` recibe el foco al montar.
- No quedan breadcrumbs de un solo ítem: el spec visual de Materias no tiene `nav[aria-label=
  "Ubicación actual"]`.
- `/account` y `/account/change-password` muestran el sidebar, y sus URLs y encabezados HTTP no
  cambian (`curl -I` devuelve `Cache-Control: no-store` y `Referrer-Policy: no-referrer`).
- En `/home/admin`, con Web Locks deshabilitado, el aviso de coordinación aparece una sola vez.
- Hay un único landmark llamado "Navegación principal", y es el del sidebar.
- `grep -rn 'font-size: \.6' front/src/styles` no devuelve resultados.
- Los 12 e2e de auth, los tests de componentes y los nuevos pasan.
- `npm run lint`, `typecheck`, `test` y `build` del workspace `front` pasan.
- `front/OVERVIEW.md` documenta la regla de encabezado y el shell compartido.

## 6. Validación

Pendiente de ejecución.

### Pruebas manuales para el desarrollador

- Abrir "Mi perfil" desde el menú de cuenta: aparece el sidebar, y "Inicio" queda marcado.
  "Cambiar contraseña" muestra el breadcrumb de vuelta al perfil. El cambio de contraseña funciona
  igual que antes y termina en el login.
- Entrar con una cuenta USER a `/home/admin`: pantalla "Acceso no permitido" dentro del shell,
  con "Volver al inicio".
- Con el backend apagado, recargar `/home`: pantalla "No pudimos comprobar tu sesión" con
  "Reintentar comprobación". Prender el backend y reintentar entra al inicio.
- En un navegador sin Web Locks (o con `navigator.locks` borrado desde la consola), abrir
  `/home/admin`: el aviso aparece una vez.
- Con un lector de pantalla, la lista de landmarks muestra "Navegación principal" una sola vez.
- Recorrer landing, login, registro y recuperación: no tienen que cambiar.

### Violaciones `moderate` que quedan (completar al implementar)

## 7. Riesgos

1. **`AppShell` en `/account` agrega una comprobación de sesión.** Hoy cada página de `/account`
   tiene su propio `RequireAuth`. Al pasarlo al layout hay que quitarlo de las páginas, o la
   comprobación y el aviso se duplican, que es el mismo problema que esta tarea corrige.
2. **El cambio de contraseña es un flujo de auth.** Mover su contenedor no puede tocar
   `AccountForm` ni `services/auth.ts`. Los e2e de cambio de contraseña (`auth.browser.spec.mjs`,
   casos de líneas 154 y 193) son la red de seguridad.
3. **Las capturas cambian en muchas pantallas.** Para que la revisión sea posible, el PR agrupa los
   commits por punto de la sección 2, cada uno con sus capturas regeneradas.
