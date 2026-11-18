# HU-C04 — Administrar normas de convivencia

## Alcance y base
Continuar exclusivamente en `feat/modulo-comunidad`, worktree `.tmp/modulo-comunidad`, base HU-C01 `7c7e3b4`. Estado local/remoto verificado idéntico y limpio. Reutilizar comunidad sin duplicar módulos; no alterar commits/migración anteriores ni cambios del workspace original. Push autorizado al cerrar; sin PR, merge ni siguiente historia. Aplicar skill commit-work.

Se autorizan los cambios de modelo/módulo, rutas y componentes locales de Comunidad requeridos por HU-C04. Conservar autenticación, layouts, estilos base y tema HU-C06. Sin nuevas dependencias ni hooks globales. Excluye sugerencias/likes/feed/términos y registros históricos de aceptación.

## Análisis y decisiones previas
- HU-C01: singleton NormasConvivencia `vigentes`, array ordenado, createdAt/updatedAt, GET autenticado mediante puerto/repositorio Prisma. Nginx dev/TLS ya reenvía el location exacto sin limitar el método.
- Nueva columna nullable `actualizadoPorId` UUID con relación a User y onDelete Restrict, sin backfill ni seed. Nullable identifica correctamente documentos aún no editados. Nueva migración aditiva conserva contenido, fechas y la migración anterior. Reusar @updatedAt; createdAt no entra en el update.
- Mantener el GET y su DTO público existentes, sin exponer el UUID del administrador a estudiantes. El responsable se registra en persistencia; la respuesta PUT conserva el documento público. La trazabilidad se comprueba en PostgreSQL.
- PUT `/comunidad/normas`, AuthenticationGuard + RolesGuard + @Roles ADMIN. Caso `ActualizarNormas.execute(body,actorId)` valida objeto estricto `{titulo,introduccion,normas,cierre}`: texto trim no vacío, título <=160 (modelo), lista >=1 y cada norma no vacía. Rechaza propiedades desconocidas (actor/fechas/id). Actor obligatorio desde sesión, nunca del body. Mantener saltos internos y texto plano. Errores de dominio 400/404 y manejo global para inesperados.
- Puerto `actualizarVigentes(input,actorId)` y una única sentencia de actualización del documento+actor+fecha (sin read-then-write y sin upsert que invente documentos). Actualizaciones simultáneas completas siguen semántica de último guardado, sin mezclar campos; no introducir versionado ajeno a la HU.
- Botón/enlace “Administrar normas de convivencia” solo ADMIN en Comunidad. Ruta `/home/admin/comunidad/editar` bajo guard existente. Página carga contenido real; formulario local controlado con título/introducción/cierre, filas con IDs estables, agregar/eliminar y subir/bajar mediante botones de texto accesibles. No drag-only, rich text ni deps.
- Validaciones frontend equivalentes, foco al primer error, mensajes claros; bloquear envío duplicado con ref además de disabled, mantener borrador ante fallo; deshabilitar edición mientras guarda para no perder cambios posteriores. Tras éxito volver a `/home/admin/comunidad?actualizada=1`, aviso de éxito y consulta fresca. Cancelar sin cambios regresa directamente, con cambios requiere confirmación.
- Protección local de cambios sin guardar: diálogo existente para Cancelar y enlaces que abandonen la pantalla (incluye navegación compartida mediante captura local de clicks), beforeunload nativo para recarga/cierre y manejo local de Atrás mediante entrada de historial del mismo URL. No parchear router ni hooks compartidos. Debe permitir continuar editando o confirmar salida, conservar borrador al cancelar y limpiar listeners al desmontar; expiración de sesión conserva prioridad de seguridad. Documentar ajustes si el navegador exige otra implementación.
- CSS Module local y primitivas existentes; USER conserva la apariencia de HU-C01 y solo ve el nuevo contenido guardado. Nginx debe permitir PUT; comprobar autenticación/CSRF por proxy real aislado, sintaxis dev/TLS y sin modificar el proxy local activo.

## Criterios y TDD
CA01–12 de la HU: acceso ADMIN/USER, precarga, actualización/campos/lista/orden, lectura USER nueva, cancelación/confirmación de abandono, validación, error/reintento, seguridad y trazabilidad, responsive/regresión.

Agentes front/back/test según OVERVIEW. Test primero y RED antes de producción. Cubrir migración conservadora, usecase/validación, HTTP con PostgreSQL real, sesión401/USER403/ADMIN200 y spoofing/CSRF; frontend formulario/cancelación/borrador/reorden/envío duplicado y guard de abandono; navegador 375/1280, axe, capturas ADMIN formulario + USER actualizado, proxy y regresiones HU-C01/06. Node22.22.3, suites completas y tipos/lint/build ambos, DB/Mailpit/proxy temporales. No afirmar pruebas no ejecutadas.

## Commits previstos
1. Modelo+ nueva migración de responsable con prueba conservadora.
2. Actualización backend con permisos, validaciones y regresiones.
3. Acceso/formulario/frontend con regresiones y capturas pertinentes.
4. CHANGELOG/evidencia/cierre. Ajustar límites a cambios lógicos reales; revisar staged diff antes de cada commit.

## Evidencia
- RED inicial ejecutado Node22.22.3: faltan ActualizarNormas y NormasForm antes de implementar; tres casos de migración fallan por SQL inexistente en el contenedor antes de copiar la nueva migración.
- Entorno Docker estaba apagado; se inició y se reutilizaron contenedores de prueba con PostgreSQL/Mailpit/Nginx aislados. Se restauraron las 25 migraciones anteriores y se aplicó la 26 solo a comunidad_test. No se modificó la base local activa.
- Primer focal backend: 48 aprobados (incluye C01 y edición/metadata/errores). Se ampliaron luego dos casos de actor ausente, que se incluyen en suite completa. Frontend: 37 aprobados entre formulario, servicio y consulta compartida.
- Commit de modelo `f94e1e9` incluye únicamente columna/relación, nueva migración, prueba conservadora, plan y adaptación parcial del test de lectura al DTO público. La migración de HU-C01 sigue sin cambios.

## Revisión del historial del editor
Se identificaron dos carreras durante revisión y se corrigieron antes del navegador: el diálogo de Atrás espera el popstate que restaura la entrada protectora, y esa entrada se mantiene hasta salir aunque el usuario revierta exactamente los campos (sin ejecutar history.back mientras escribe). Atrás limpio salta la copia del mismo URL sin pedir confirmación; salida confirmada y guardado colapsan la entrada antes de reemplazar ruta. Los avisos beforeunload nativos dependen de activación de usuario y políticas del navegador; no se garantiza texto personalizado. La navegación programática de expiración/cierre de sesión mantiene prioridad de seguridad y no se intercepta.

El cierre de sesión deliberado mediante el botón del encabezado también representa abandono: confirmar su click localmente cuando hay borrador, mediante el markup estable `.logout-control button`, sin modificar LogoutButton ni duplicar su lógica. Usar confirmación nativa síncrona para esta acción: un modal DOM movería el foco, cerraría el menú mediante onBlur y desmontaría LogoutButton. Cancelar impide el evento; aceptar deja pasar el click original, sin redispatch, timers ni callbacks de componentes desmontados. El guard permanece activo si el logout falla; los eventos programáticos de vencimiento siguen sin bloquearse. El resto de salidas usa Dialog existente; agregar regresión para distinguir esa acción manual de la salida de seguridad.

## Resultados finales
- Backend: `npm run test --workspace=back -- --maxWorkers=1 --reporter=dot`, con PostgreSQL17 y Mailpit temporales explícitos: **1332 casos en 64 archivos aprobados**, sin omisiones. Incluye 38 casos nuevos (21 aplicación/repositorio, 14 HTTP, 3 migración). Typecheck, lint y build backend aprobados.
- Frontend: primera suite completa 1079 aprobados; tras agregar la protección manual de logout, RED específico confirmado y focal de 14 casos aprobado. La suite completa final `npm run test --workspace=front -- --maxWorkers=1 --reporter=dot` aprobó **1080 casos en 96 archivos**, sin omisiones. Typecheck, lint y build aprobados; lint repetido después del último ajuste de captura, también aprobado.
- Se corrigió `exact` en consultas de Testing Library, que no forma parte de ByRoleOptions; las comparaciones de name:string continúan siendo exactas por defecto. No se modificaron las opciones equivalentes de Playwright.
- Primera corrida E2E: 23/24 aprobados y un timeout en la espera de recarga cancelada. El diagnóstico mostró beforeunload+dismiss con URL y borrador intactos; `page.reload()` esperaba un load que no debía producirse. El test ahora dispara `window.location.reload()` en el navegador y comprueba identidad del documento (UUID), URL y borrador, sin catch silencioso ni aumentar timeouts. Focal corregido aprobado en 3,8 s, sin cambios de producción por este hallazgo.
- Corrida final, con TEST_DATABASE_URL y COMMUNITY_PROXY_URL del namespace temporal: `npx playwright test --config=playwright.config.ts front/tests/community-admin.browser.spec.mjs front/tests/community.browser.spec.mjs front/tests/visual.browser.spec.mjs front/tests/auth.browser.spec.mjs --grep 'HU-C0[14]|visual|logout sincroniza|roles backend reales'`: **24/24 aprobados** (3 minutos), sin regenerar referencias. Son 9 propios de HU-C04, 7 de HU-C01, 6 visuales y 2 de sesión/autorización. Las 28 referencias de HU-C06/01 compararon correctamente y no se modificaron.
- Axe sin infracciones serious/critical en formulario ADMIN y lectura USER, a 375/1280. Overflow horizontal comprobado. Teclado, reordenar, agregar/eliminar, confirmaciones, Escape, navegación, recarga, reversión exacta del borrador, logout, reintento y lectura fresca cubiertos en navegador.
- Nginx: sintaxis dev y TLS aprobada con `nginx -t`, usando upstreams del harness y certificado temporal. La ruta exacta existente permite PUT sin cambios de configuración: prueba real por Nginx verifica 401 sin sesión, 403 USER, CSRF obligatorio y 200 ADMIN con persistencia/actor real.
- Cuatro capturas en `.tmp/community-admin-captures`: `admin-{375,1280}-formulario.png` y `user-{375,1280}-normas-actualizadas.png`. Las del editor se toman desde scroll superior para evitar que la cabecera sticky aparezca a mitad del documento. Los dos recorridos de guardado/lectura se repitieron tras ese ajuste y aprobaron; son repeticiones, no casos únicos adicionales. Inspección visual de editor escritorio y lectura móvil, temas y textos legibles.
- Entorno Node22.22.3, PostgreSQL17, Chromium156 para Comunidad y Chrome158.0.8127.36/Linux para referencias. Sin nuevas dependencias, cambios de autenticación/estilos globales ni modificación de aceptaciones históricas.

## Criterios de aceptación cubiertos
| Criterio | Evidencia |
| --- | --- |
| CA01/CA02 | Enlace solo en wrapper ADMIN; ruta protegida. USER sin enlace ni formulario y PUT403 real. |
| CA03 | GET real precarga título, introducción, todas las normas y cierre; tests de formulario/navegador. |
| CA04/CA05 | PUT persiste todos los textos y orden exacto; agregar, editar, subir/bajar y eliminar cubiertos. |
| CA06 | Otro contexto USER consulta el contenido guardado por ADMIN a 375/1280 sin cambiar su tema. |
| CA07 | Cancelar limpio inmediato; borrador pide confirmar, permite continuar y no guarda; Atrás, enlaces y recarga cubiertos. |
| CA08 | Front y backend rechazan requeridos/espacios, lista vacía y título >160; sin escrituras parciales ni metadatos arbitrarios. |
| CA09 | Fallo de PUT conserva campos/orden y permite reintento explícito, sin duplicar envíos ni mostrar secretos. |
| CA10 | Sesión, rol ADMIN y CSRF comprobados por HTTP y Nginx; no autenticado401/USER403. |
| CA11 | Responsable de sesión y updatedAt guardados atómicamente; createdAt y aceptaciones históricas preservados. |
| CA12 | Suites completas, tipos/lint/build y 24 E2E, referencias sin cambios, axe, teclado y responsive aprobados. |

## Archivos y commits
- `f94e1e9 feat(back): registrar responsable de actualización de normas`: schema, migración aditiva, prueba conservadora, proyección del test público y planificación.
- `47e6849 feat(back): implementar edición administrativa de normas`: caso de uso, puerto/repositorio, controller y módulo existentes, documentación backend y regresiones.
- `87a4a3e feat(front): administrar normas de convivencia`: ruta de edición, wrapper/enlace/aviso ADMIN, formulario y guard local, tipo/servicio/validación, OVERVIEW y pruebas unit/browser. No se duplicó el módulo Comunidad.
- Cierre documental en cuarto commit (CHANGELOG y este informe). Cada staged diff se revisó y pasó diff --check; no se reescribieron commits previos.

## Migración, continuidad y pendientes
Nueva `20261118000000_normas_responsable`: columna nullable/FK/índice, sin seed ni backfill. La migración de HU-C01 sigue intacta y el documento preexistente mantiene contenido, fechas y responsable null hasta su primera edición. Para activar esta versión en un entorno, aplicar `npm run db:deploy --workspace=back`, generar Prisma y reconstruir las imágenes del stack, incluido el proxy con la configuración de HU-C01 si todavía no se activó esa historia; esa ruta ya permite PUT. No se actualizó la base ni la aplicación local del usuario.

Sin pendientes funcionales conocidos de HU-C04. La apariencia/texto del aviso nativo de beforeunload depende del navegador; la UI propia usa Dialog para el resto de salidas y confirm nativo síncrono solo para logout manual. La expiración programática de sesión no se bloquea.

Publicación autorizada de esta historia en la misma rama feat/modulo-comunidad con seguimiento remoto, sin PR, merge, force push ni eliminación de rama. Conservar los cambios originales del workspace y mantener esta rama para futuras historias, que requieren nueva autorización.
