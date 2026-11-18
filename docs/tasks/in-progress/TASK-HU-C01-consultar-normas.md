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
Pendiente de ejecución.
