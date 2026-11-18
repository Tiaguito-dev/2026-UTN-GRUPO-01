# HU-C01 — Consultar normas de convivencia

## Alcance y base
Implementar exclusivamente consulta de normas persistidas para USER y ADMIN. Base `origin/desarrollo` 1133767, con HU-C06 integrada mediante PR #46 verificada. Rama única del módulo `feat/modulo-comunidad`, worktree `.tmp/modulo-comunidad`; preservar cambios del workspace original. Push autorizado al finalizar HU-C01; sin PR, merge ni siguiente historia.

Se autoriza navegación por rol para incorporar Comunidad, el registro del nuevo módulo en AppModule y Prisma. No se cambia autenticación, layouts, tema global ni permisos existentes. Sin dependencias nuevas. No implementar edición, sugerencias, likes, feed ni términos.

## Análisis y decisiones previas
- NestJS por módulo con aplicación/puertos e infraestructura Prisma, controllers protegidos por AuthenticationGuard. Front Next App Router con servicios Zod/protectedGet y shell/navegación por rol.
- `AceptacionNormas` registra consentimientos históricos y no contiene documentos: no se reutiliza para almacenar contenido ni se modifican aceptaciones. Nueva entidad `NormasConvivencia`, singleton ID `vigentes`, título, introducción, array ordenado de normas, cierre, createdAt y updatedAt. Sin autor hasta que HU-C04 defina la edición.
- Migración de modelo y carga inicial SQL en el mismo cambio; INSERT ON CONFLICT DO NOTHING, conservando modificaciones posteriores. No hacer seed en lecturas ni inicializaciones de la aplicación. Contenido inicial exacto de la HU, párrafos separados por saltos de línea, cierre incluye lema y firma. No hardcodear contenido en el frontend.
- Contrato GET `/comunidad/normas`, solo sesiones autenticadas USER/ADMIN, devuelve `{id,titulo,introduccion,normas,cierre,createdAt,updatedAt}`; normas String[] en orden y fechas ISO. Si falta el documento, 404 con mensaje informativo; fallo inesperado conserva manejo global y no expone detalles. Sin endpoints de escritura.
- Servicio `ConsultarNormas` y puerto `NormasRepository.obtenerVigentes()`, repositorio Prisma y módulo Comunidad. Migraciones en base temporal exclusiva para validar; no tocar datos de desarrollo sin necesidad.
- Página compartida `ComunidadPageContent` en `/home/comunidad` y `/home/admin/comunidad`, hereda tema HU-C06. Adaptar `sections` y `roleDestination` según límites de rutas existentes. Reutilizar PageHeader, Panel/Notice/carga y botón Reintentar; estados explícitos de carga, error, documento vacío y éxito. Texto como texto React, sin HTML ni controles ficticios.
- Estructura con sección mensaje administrativo y lista semántica de normas, cierre legible; CSS Module limitado a Comunidad si hace falta, tokens existentes. Preparación futura por composición, sin placeholders de funciones pendientes.

## Criterios y pruebas
CA01/02 consulta USER/ADMIN con identidad heredada; CA03 contenido real persistido y orden; CA04 lectura exclusiva y autorización; CA05 error/reintento; CA06 375/1280, teclado/axe/overflow; CA07 regresión.

TDD: test escribe regresiones antes de implementación y obtiene RED; back/front implementan sus dominios. Pruebas de consulta, Prisma/migración idempotente preservando edición simulada, endpoint autenticado/no autenticado/sin escritura; frontend contrato Zod, carga/error/reintento/contenido/menús/guards. Node22.22.3; suites pertinentes y completas según recursos, typecheck/lint/build de ambos workspaces; navegador con API real y base temporal cuando sea posible. Registrar comandos/resultados reales.

## Commits previstos
1. Modelo, migración/carga inicial y prueba de persistencia.
2. Consulta autenticada backend con regresiones y documentación de contrato.
3. Comunidad frontend y navegación por rol con pruebas.
4. Evidencia/CHANGELOG/cierre de tarea. Ajustar límites si lo requiere la coherencia de los cambios.

## Evidencia
- RED antes de producción: unit backend falla por importar ConsultarNormas inexistente; componente frontend falla por ComunidadPageContent inexistente; tres casos de migración fallan ENOENT del SQL. Ejecutados con Node22.22.3 en contenedor temporal.
- Prisma generado y 25 migraciones aplicadas a PostgreSQL17 temporal exclusivo, incluida la nueva `20261117000000_normas_convivencia`; sin tocar base de desarrollo.
- Primera validación focal: 14 pruebas backend aprobadas (3 migración, 3 aplicación, 8 HTTP iniciales) y 19 frontend (6 componente, 13 contrato). Se amplió después HTTP con fallo500/no-store, pendiente de suite completa.
- Commit inicial `2c7b526` agrupa modelo, migración/carga inicial, prueba de persistencia y planificación. Restricciones SQL singleton y array no vacío; carga INSERT conservadora.

## Actualización visual prevista
El nuevo enlace Comunidad modifica intencionalmente el menú administrativo y por tanto las capturas internas de HU-C06. Actualizar únicamente las referencias afectadas desde Chrome/Linux del entorno usado para las referencias actuales, revisar las imágenes y repetir la comparación sin `--update-snapshots`. El resto de referencias públicas/guards debe conservarse. Nuevos recorridos específicos de Comunidad usan el backend real y generan capturas de revisión sin añadir comparaciones redundantes.

## Integración de proxy
Revisión de extremo a extremo detectó que los dos Nginx usan una lista explícita de endpoints API. Sin agregar `/comunidad/normas`, Compose serviría la ruta desde Next y la consulta no funcionaría aunque los tests directos al backend pasaran. Extender únicamente ese location exacto en desarrollo y TLS, conservando el resto de reglas. Validar sintaxis de ambos y consulta autenticada real mediante un Nginx temporal con los mismos locations (solo upstreams sustituidos por las direcciones del harness); sin tocar el proxy de desarrollo activo.

## Cierre y resultados finales
- Backend: `npm run test --workspace=back -- --maxWorkers=1 --reporter=dot`, con TEST_DATABASE_URL y Mailpit temporales explícitos: **1294 pruebas en 61 archivos aprobadas**, sin omisiones. Incluye 15 casos propios de HU-C01 (3 migración, 3 aplicación, 9 HTTP). Typecheck, lint y build del workspace back aprobados.
- Frontend: `npm run test --workspace=front -- --maxWorkers=1 --reporter=dot`: **1061 pruebas en 95 archivos aprobadas**, sin omisiones. Typecheck, lint y build aprobados; lint repetido después de añadir la prueba de proxy, también aprobado.
- TDD proxy: nueva prueba E2E obtuvo RED real (404 desde Next en lugar de 401 del backend). Después de agregar el location exacto, `nginx -t` aprobó ambas configuraciones, usando upstreams del harness y certificados TLS efímeros para verificar sintaxis. No se alteraron certificados ni servicios de desarrollo.
- `npx playwright test --config=playwright.config.ts front/tests/community.browser.spec.mjs`, con COMMUNITY_PROXY_URL=http://localhost:8080 dentro del namespace aislado: **7 aprobadas** (34,2 s). Consulta real USER/ADMIN directa y mediante Nginx; sin sesión 401, no-store, contenido de PostgreSQL, orden, recarga, navegación por teclado, rechazo de ruta ADMIN para USER, traducción ADMIN y errores/reintento. Cuatro variantes USER/ADMIN 375/1280 auditadas por axe, sin infracciones serious/critical y sin overflow.
- Actualizadas únicamente 20 referencias internas que cambiaron por el enlace Comunidad. Sin cambios a las ocho referencias públicas/guards. Inspección visual de Comunidad móvil/admin y escritorio/user, además de Cursadas móvil y perfil desktop administrativos.
- `npx playwright test --config=playwright.config.ts front/tests/visual.browser.spec.mjs front/tests/auth.browser.spec.mjs --grep 'visual|logout sincroniza|roles backend reales'`: **8 aprobadas** (1 minuto), sin actualizar snapshots. Comparación final de las 28 referencias y auditoría axe sin serious/critical; revocación/logout en dos pestañas, roles reales, CSRF/CORS conservados. Total **15 casos E2E únicos** entre ambas suites, sin contar la regeneración como una validación adicional.
- Entorno: Node22.22.3, PostgreSQL17 temporal, Chromium156 para Comunidad y Chrome158.0.8127.36/Linux para las referencias existentes, sin dependencias nuevas. Se reutilizó el contenedor de dependencias; todos los datos son de pruebas.
- Capturas de revisión (cuatro): `.tmp/community-captures/{user,admin}-{375,1280}-comunidad.png` en el worktree. Las referencias oficiales permanecen versionadas en front/tests/visual.browser.spec.mjs-snapshots.

| Criterio | Evidencia |
| --- | --- |
| CA01/CA02 | Misma consulta persistida USER/ADMIN, temas y menús correctos, E2E a dos tamaños. |
| CA03 | Migración/seed real, edición simulada leída en HTTP, orden y fecha; reseed conserva cambios. |
| CA04 | No hay controles ni endpoints de escritura; sesiones inválidas/revocadas rechazadas y guards conservados. |
| CA05 | Error500 sin datos internos, 404 informativo, 503 en navegador y Reintentar funcional para ambos roles. |
| CA06 | Teclado, axe, revisión de capturas y ausencia de overflow a 375/1280. |
| CA07 | Suites completas, tipos/lint/build, regresión visual y sesión/autorización aprobadas. |

## Archivos, commits y continuidad
- Persistencia: schema Prisma, migración nueva y prueba de carga conservadora, commit `2c7b526`.
- Backend: nuevo módulo community (dominio, aplicación/puerto, repositorio, controller/module), AppModule, OVERVIEW y pruebas unit/HTTP, commit `7030d04`.
- Frontend: componente/tipo/servicio/esquema, dos rutas, navegación, OVERVIEW y pruebas; locations Nginx y documentación de infraestructura; 20 referencias, commit `eeee69d`.
- Cierre: CHANGELOG y este informe, en commit documental separado. Se revisó el staged diff antes de cada commit, además de diff --check.
- Para aplicar el cambio en un entorno de ejecución se requiere `npm run db:deploy --workspace=back` (incluye la carga inicial) y generar Prisma/build del backend; las imágenes del frontend y proxy también deben reconstruirse. No se aplicó a la base local de desarrollo ni se activó esta versión en localhost del usuario.
- Sin pendientes funcionales conocidos de HU-C01. HU-C04/02/03/05 quedan fuera de alcance, requieren autorización para comenzar. No hay edición, sugerencias, feed ni cambios de términos o consentimientos. Push autorizado solo de feat/modulo-comunidad; mantener esta misma rama para próximas historias, sin PR ni merge. Los cambios originales del workspace se conservaron intactos.
