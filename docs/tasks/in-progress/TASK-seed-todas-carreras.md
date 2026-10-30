# Seed de demostración de todas las carreras

Estado: en progreso. Fecha: 2026-10-30.

## Objetivo y alcance
Completar la seed académica para S, C, Q, I y M con materias de todos los años,
electivas, cursadas 2025/2026, comisiones y docentes ficticios. Autorizado por Luana.

## Exclusiones y restricciones
Sin planes oficiales nuevos, usuarios, contraseñas, feedback atribuido a personas,
dependencias, migraciones, borrados ni cambios a registros existentes. Push de rama autorizado por Luana el 2026-10-30; PR manual.
La carga se limita a PostgreSQL local; no ejecutar contra destinos remotos.

## Decisiones
Conservar el catálogo de Sistemas ya aportado. Las otras carreras usan un catálogo
ilustrativo identificado con (Demo), sin afirmar equivalencia con planes oficiales.
Completar la oferta de cada materia con dos comisiones por carrera en ambos
cuatrimestres de 2026 y una anual de 2025. Mantener ofertas existentes.
Extraer datos a un módulo sin efectos para validar cobertura antes de ejecutar.

## Criterios y validaciones
Las cinco carreras tienen años 1–5 y electivas 3–5; cada asociación tiene cursadas,
comisiones y docentes. No hay identidades duplicadas en el dataset. Prueba RED/GREEN,
build y tipos backend. Dos cargas locales: la segunda debe informar cero altas.
Documentar cualquier impedimento real de ejecución y conservar cambios previos.

## Resultado y evidencia
- `git fetch origin` ejecutado antes de implementar el catálogo: HEAD y
  origin/desarrollo en 2ee59e2, sin diferencias de commits. Cambios locales conservados.
- RED: la prueba nueva falla por módulo de datos aún inexistente.
- GREEN: `npm run test --workspace=back -- seed-academic.spec.ts`: 6/6.
- Build, typecheck, lint backend y git diff --check aprobados.
- Docker Desktop iniciado con autorización; PostgreSQL local saludable.
- Primera ejecución contra localhost: 92 materias, 20 docentes, 392 cursadas y
  803 comisiones nuevos. Catálogo total: 135 materias, incluyendo 43 de Sistemas.
- Segunda ejecución: 0 materias, 0 docentes, 0 cursadas y 0 comisiones nuevos.
- Sin usuarios, feedback, borrados o sobrescritura de registros existentes.
- El host dispone de Node 24.22.0; las verificaciones se ejecutaron con esa versión,
  no con Node 22.22.3 fijado por el proyecto. No se cambiaron versiones del repo.
- Carga finalizada; pendiente aprobación visual/manual del desarrollador para mover
  esta tarea a finished según docs/tasks/OVERVIEW.md.
- Luana solicitó subir los cambios a GitHub; entrega en feat/seed-todas-carreras.
  Se excluyen los archivos y la entrada de changelog de QA HU11 por ser otra tarea.
