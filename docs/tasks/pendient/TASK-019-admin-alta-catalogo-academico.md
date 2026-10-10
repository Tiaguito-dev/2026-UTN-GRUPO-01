# TASK-019: Administración del catálogo académico — alta y listado (HU-11, etapa 1)

Estado: En progreso.
Fecha: 2026-10-10

## 1. Contexto y objetivo

`TASK-014` dejó el módulo `academic` con solo lectura (HU-04). Esta tarea agrega la **escritura
administrativa**: que un `ADMIN` pueda dar de alta Materias, Profesores, Cursadas y Comisiones
desde la aplicación, en vez de editar el script de seed y redesplegar. Cubre ADM-01, ADM-03,
ADM-04, ADM-05 y ADM-06 de `docs/temporal/06-administracion.md`, **acotados a alta y listado**.

**No hace falta ninguna migración**: las 4 tablas ya existen con sus restricciones únicas desde
`TASK-014`. Esta tarea es escritura sobre un modelo de datos que ya está.

## 2. Alcance

- Backend `academic`: puertos de escritura, casos de uso de alta, validadores Zod, errores de
  dominio y adaptadores Prisma para Materia, Profesor, Cursada y Comisión.
- Backend `users`: `findAll` paginado y su caso de uso (ADM-05).
- Endpoints administrativos protegidos con `@Roles("ADMIN")`.
- Cuenta administrativa provista para poder probar.
- Tests unitarios y de integración, incluido el rechazo 403 a un `USER` común.

## 3. Fuera de alcance

- **Edición** de cualquier entidad (`PATCH`): es la etapa 3 del plan, decisión de Tiago del
  2026-10-10 para tener antes algo usable.
- **Eliminación**: fuera de alcance de toda la iteración (ver `06-administracion.md`; además
  exigiría convertir los índices únicos a parciales).
- **Frontend**: es la etapa 2, tarea aparte.
- Gestión de roles desde el panel.

## 4. Decisiones

1. **Entrega por etapas con checkpoint** (Tiago, 2026-10-10): backend primero y verificado contra
   la base real, frontend después. Motivo: no construir pantallas sobre una API que todavía puede
   cambiar de forma.
2. **Alta y listado antes que edición**: con eso ya se puede cargar la jerarquía completa desde la
   aplicación, que es el valor real; la edición duplica superficie (endpoints, formularios
   precargados, tests) sin habilitar nada nuevo.
3. **Primer consumidor real de `RolesGuard`**: el guard y el decorador `@Roles` existen, están
   cableados y exportados desde `auth.module.ts`, pero ningún endpoint los usaba — una auditoría
   los marcó como código muerto. No hay que construir autorización, solo aplicarla.
4. **Rango de año de Cursada**: 2000 hasta el año actual + 1. Evita que un error de tipeo cargue
   una cursada de un año imposible, sin bloquear la planificación del período siguiente.
5. **`Comision.activa` nace en `true`**; cambiarla es edición (etapa 3).
6. **La unicidad de Comisión es por cursada**, no global (`@@unique([cursadaId, nombre])`): dos
   cursadas distintas pueden tener cada una su "Comisión 1 - Mañana". Los tests tienen que
   verificar explícitamente que el mismo nombre se acepta en otra cursada, porque sin ese caso una
   implementación con unicidad global pasaría igual.
7. **Cuenta administrativa**: se provisiona con el comando `auth:provision-admin` ya existente,
   con el email de Tiago y una contraseña generada. El alta administrativa **no valida dominio
   institucional** a propósito (`ProvisionAdmin` no pasa por la regla de `RegisterUser`), así que
   un email no institucional es válido para este caso.

## 5. Estándares que aplican

- [Validación con Zod](../../standards/validacion-con-zod.md) — primeros `POST` de `academic`.
- [Catálogo de errores](../../standards/catalogo-de-errores.md) — errores nuevos extienden
  `DomainError`; sin `try/catch` en controladores.
- [Paginación](../../standards/paginacion.md) — todos los listados, incluido el de usuarios.
- [Arquitectura de capas](../../standards/arquitectura-de-capas.md) — `domain/` sin imports.

## 6. Criterios de aceptación

- Un `ADMIN` puede dar de alta Materia, Profesor, Cursada y Comisión por HTTP, y los datos
  aparecen en el drill-down de lectura ya existente.
- Un `USER` común recibe **403** en cada endpoint administrativo.
- Los duplicados se rechazan con 409: materia por nombre, cursada por (materia, año,
  cuatrimestre), comisión por (cursada, nombre) — y el mismo nombre de comisión se acepta en otra
  cursada.
- Alta de Cursada con materia o profesor inexistente devuelve 404.
- `GET /users` devuelve el listado paginado sin exponer `passwordHash`.
- `npm run typecheck --workspace=back` y la suite de back en verde.

## 7. Validación

Evidencia al cierre: resultado de typecheck, suite de tests, y verificación de los endpoints
contra la base de desarrollo real con altas efectivas (no mocks), según pidió Tiago.
