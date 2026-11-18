# Integrar Comunidad y cerrar presentación de reportes

## Alcance

Integrar origin/desarrollo c418172 (Comunidad HU-C01 a HU-C05) en feature/clasificador-comentarios, conservar los 26 commits propios y resolver conflictos sin descartar funcionalidades. Recuperar la etapa visual de reportes respaldada en stash y realizar su commit tras validación, conforme aprobación explícita del usuario. Mantener stack local actualizado y saludable.

## Restricciones

Sin push, PR automática, despliegue remoto, reset, pérdida de trabajo, reinicialización de datos ni funcionalidades nuevas. Los cambios de modelos, auth y proxy se limitan a integrar lo existente en ambas ramas. El rediseño aprobado mantiene sus restricciones funcionales.

## Decisiones y plan

- Respaldo con git stash --include-untracked antes de merge --no-commit. Conservar el stash hasta confirmar recuperación y commit.
- Cuatro conflictos: CHANGELOG.md, front/OVERVIEW.md, back/OVERVIEW.md y relaciones inversas de User en schema.prisma. Son adiciones independientes: conservar ambos bloques y las relaciones de reportes y Comunidad. No generar migraciones nuevas por unir relaciones inversas.
- Commit de integración separado del commit visual de reportes para trazabilidad. Regenerar Prisma y validar tipos, lint, builds y pruebas afectadas de ambas aplicaciones antes de cerrar.
- Recompilar el stack local, aplicar únicamente migraciones versionadas pendientes y mantener volúmenes. Registrar evidencia y limitaciones reales; no afirmar E2E a partir de mocks.

## Criterios de aceptación

Sin marcadores/archivos en conflicto; merge conserva ambas ramas; Prisma válido con relaciones de ambos módulos; Comunidad y reportes compilan y sus pruebas pasan; reportes visuales recuperados íntegros; dos commits trazables, sin push; stack disponible para revisión.
