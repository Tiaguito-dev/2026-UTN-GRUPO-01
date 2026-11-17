# HU-C06 — Diferenciación visual por rol

## Alcance, base y autorización
Implementar exclusivamente la identidad visual transversal ADMIN, conservando USER. Base `origin/desarrollo` ef35f7f; rama exclusiva `feat/hu-c06-tema-administrativo`, worktree `.tmp/hu-c06`. La solicitud autoriza los cambios necesarios al contenedor compartido de autenticación, encabezado y estilos/tokens; no se alteran autenticación, guards, permisos, rutas, backend ni base de datos. No se implementan normas, sugerencias ni términos. Sin dependencias nuevas, push, PR, merge ni despliegue.

## Análisis previo
- `AuthProvider` vive en el layout raíz y provee estado/rol; incluye el monitor/diálogo de inactividad.
- `SiteHeader` es global. `AppShell` se comparte entre `/home` y `/account`, con `RequireAuth`, `RoleRouteBoundary` y `SidebarNav`. `RequireRole` conserva el límite administrativo. Las opciones del menú ya salen de `sectionsForRole` y las rutas de `adminNavigationSection`.
- Colores/tipografía en `styles/tokens.css`, estructura en `layout.css`; componentes comunes y CSS Modules consumen variables. Los diálogos nativos conservan la herencia de su árbol DOM incluso en top layer.
- USER actual utiliza primario #990f13, superficies claras y crema #fcf3eb. Se preservan esos valores (la paleta de la HU es orientativa).

## Decisiones previas
1. Agregar un contenedor presentacional `RoleTheme` con props `status` y `role`, dentro de `AuthContext.Provider`, envolviendo hijos y monitor de sesión. Variantes `admin`, `student`, `pending`, `public`, derivadas solo del estado autenticado confirmado. Sin efectos sobre document, localStorage, cookies, rutas ni nuevas consultas; el tema no otorga permisos.
2. Centralizar variables ADMIN en tokens CSS bajo `[data-role-theme="admin"]`: primario/header #650c15, sidebar #350f15, selección #84212b y texto claro. Reasignar también los alias de link/header/sidebar y RGB para que la herencia CSS no conserve alias calculados del tema raíz. Componentes y futuros layouts heredan automáticamente, incluidos perfil/cambio de contraseña y diálogos de inactividad.
3. Agregar tokens semánticos de encabezado y sidebar, con defaults iguales al diseño USER. Actualizar exclusivamente sus consumidores; botones/enlaces/selecciones generales heredan primario, hover y acento ADMIN. Mantener fondos crema, logo y tipografía, además de colores semánticos de error/éxito/alerta.
4. Mientras se comprueba la sesión o hay error temporal, encabezado neutral y sin identificación ADMIN ni menú de rol sin confirmar. El guard existente no muestra contenido protegido. SSR e hidratación comienzan con el mismo estado pending; sin flash rojo de estudiante ni persistencia de tema al logout. Un fallo de logout conserva el estado real, como hoy.
5. Identificación visible “Administración” en el encabezado para ADMIN, también en móvil, sin duplicar navegación ni modificar opciones/URLs. Sidebar claro para USER y oscuro para ADMIN, selección y foco de teclado con contraste suficiente en ambos.
6. Mantener capas CSS y documentar los nuevos tokens/ámbitos en `docs/standards/frontend-estilos.md` y `front/OVERVIEW.md`. Sin nuevo patrón de componentes duplicados. Checklist pantalla: foco visible, semántica/labels, estados de carga/error, navegación por rol, responsive 375/1280 y herencia a componentes compartidos.

## Criterios de aceptación y validación
CA01–09 de la HU: USER conserva identidad; ADMIN recibe tema/badge global; navegación, recarga, perfil, formularios y diálogos heredan; sesión incierta es neutral y logout restaura público; roles/permisos intactos; móvil operable; sin regresiones.

TDD: agente test escribe primero pruebas del tema y encabezado (ADMIN/USER/pending/error/logout y cambio de rol). Obtener RED antes de aplicación. Agente front implementa fuente/estilos, root coordina checks y commits. Reutilizar pruebas existentes de rutas/roles, sesión y navegación. Verificar tokens/contraste y, si es posible, render real móvil/escritorio con capturas. Node 22.22.3, typecheck, lint, suite frontend completa y build; sin tocar datos de desarrollo. Las limitaciones de navegador deben declararse, no presentarse como validación realizada.

## Commits previstos
1. Tokens semánticos y consumidores del tema (sin activar ADMIN), con pruebas pertinentes.
2. Contenedor por rol, identificación administrativa y regresiones de sesión/navegación.
3. Documentación y evidencia final; cierre en CHANGELOG y finished.

## Evidencia
- RED inicial: `role-theme.spec.tsx` falla al importar el componente todavía inexistente, antes de implementar la activación. Ejecutado con Node 22.22.3 en contenedor temporal reutilizado.
- El navegador y bibliotecas de Playwright se instalan exclusivamente en el contenedor temporal para revisión real y capturas; no se agregan dependencias al manifiesto ni lockfile del repositorio.
- Primera etapa sin activación: 89 regresiones de navegación/roles/límite de rutas aprobadas (3 archivos). Defaults USER conservados mediante tokens semánticos de encabezado/sidebar. Revisión `git diff --check` limpia.
- Validaciones y capturas: pendientes.
