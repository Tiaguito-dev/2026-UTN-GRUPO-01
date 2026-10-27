# TASK-056: Aislar la instalación del frontend en CI

Estado: Implementada y validada localmente; pendiente de validación en PR.
Fecha: 2026-10-26

## Objetivo y contexto

El check frontend falla en `npm ci` durante el postinstall de `@prisma/engines`
con `ECONNRESET`. La instalación raíz incluye dependencias del backend que este
job no necesita. El aviso de deprecación de ESLint no provoca este fallo.

## Alcance, exclusiones y restricciones

Limitar la instalación en `.github/workflows/front.yml` al workspace `front`,
conservar el lockfile único y todos los checks existentes. Documentar la decisión
y el resultado. Sin cambios al backend, dependencias, lockfile, aplicación,
triggers, permisos, commits, push ni ejecuciones remotas. Se permite instalar
dependencias del frontend en un directorio temporal para validar el aislamiento.

## Decisión previa a implementar

Usar `npm ci --workspace=front --include-workspace-root=false`. Evita instalar
Prisma en este job sin desactivar los scripts de instalación que necesitan las
dependencias del frontend. No agregar reintentos generales ni variables de Prisma.
Los tests browser locales usan backend, pero no se ejecutan en este workflow;
Vitest y el build no deben depender de él.

Referencia: https://docs.npmjs.com/cli/v10/commands/npm-ci/#workspace

## Criterios de aceptación y validaciones

- Instalación seleccionada excluye `@prisma/engines` y el workspace backend.
- Conserva typecheck, lint, tests y build del frontend.
- Validar instalación aislada y checks locales disponibles; registrar diferencias
  del entorno y cualquier limitación sin afirmar una ejecución remota de CI.
- Revisión manual del diff y `git diff --check`. No aplica prueba de UI ni tests
  backend: no se modifica comportamiento de aplicación.

## Evidencia

Validación local el 2026-10-26 con Node 22.17.0 y npm 10.9.2. CI usa
Node 22.22.3; no se afirma validación en ese entorno.

- En una carpeta temporal con los manifiestos y lockfile del proyecto,
  `npm ci --workspace=front --include-workspace-root=false --dry-run --ignore-scripts --offline`
  terminó con exit 0 y sin entradas Prisma, NestJS ni workspace backend.
- Control con `npm ci --dry-run --ignore-scripts --offline` en esa misma carpeta:
  exit 0; incluye `@prisma/engines 6.19.3` y `@utn-grupo-01/back`.
- La instalación real aislada con `--offline` no pudo completarse: `ENOTCACHED`
  para `zod-4.6.7.tgz`. Los dry-runs verifican la selección de paquetes, no la
  descarga ni ejecución de postinstall. El workflow conserva esos scripts.
- Con las dependencias locales existentes: typecheck, lint y build frontend
  terminaron con exit 0; Vitest aprobó 36 archivos y 281 tests.
- Build ejecutado con `NEXT_PUBLIC_API_URL=https://api.example.invalid`, como CI.
- Revisión manual: solo cambia el alcance de instalación del job; conserva
  triggers y los cuatro checks. No corresponde prueba de UI o backend.

La ejecución remota y aceptación del desarrollador quedan pendientes; se conserva
la tarea en `in-progress/`. No se realizó commit, push ni operación remota.
