# TASK-005: Autenticación de Profesor Butchery, etapa 1

Estado: Terminada; validación manual confirmada por el desarrollador el 2026-10-09
Fecha: 2026-10-08
TDD: [TDD-AUTH-H1](../../tdd/TDD-AUTH-H1.md)

## Objetivo y alcance

Implementar persistencia de cuentas, RegisterUser, POST /auth/register y comando explícito
de provisión ADMIN. La instrucción del desarrollador autoriza cambios en autenticación y
composición NestJS necesarios para esta etapa. PostgreSQL, Prisma y Vitest se conservan.

## Exclusiones y restricciones

Sin frontend, login, JWT, sesiones, refresh, logout, guards, recuperación ni gestión académica.
Sin commits, push o PR automáticos. No modificar archivos ajenos preexistentes.
Credenciales por configuración, sin secretos en respuestas o registros. Migración aditiva.

## Aceptación y validación

- Registro válido con USER obligatorio, validación estricta y email normalizado.
- Email único incluso bajo concurrencia; contraseña Argon2id verificable sin recortes.
- HTTP 201/400/409, respuesta pública y errores seguros.
- Provisión repetible sin duplicación ni promoción de USER.
- Pruebas unitarias y HTTP con persistencia PostgreSQL real; build, tipos y controles disponibles.
- Documentación de contrato, política, migración, comando y limitaciones.

La validación manual del desarrollador queda pendiente antes de mover a finished.

## Resultado y evidencia

- Modelo User, migración aditiva 20261008000000_auth_users, módulos users/auth y puertos específicos.
- Registro HTTP 201 con USER obligatorio, validación estricta, proyección pública y errores 400/409.
- Argon2id, normalización de email y UNIQUE real, incluyendo carreras de creación.
- Comando independiente auth:provision-admin, repetible, sin promoción de USER ni salida de secretos.
- Sanitización de errores JSON del parser: se detectó y corrigió reflexión de fragmentos sensibles.
- Contratos, política, variables, migración y comandos en back/OVERVIEW.md y .env.example.

Controles ejecutados en Windows con Node 22.17.0 y npm 10.9.2 (el repositorio fija Node 22.22.3):

| Control | Resultado |
|---|---|
| npm run build --workspace=back | Aprobado: Prisma Client y NestJS compilados |
| npm run typecheck --workspace=back | Aprobado: producción y pruebas |
| npm test --workspace=back, TEST_DATABASE_URL configurada | 40 pruebas aprobadas en 4 archivos; ninguna omitida |
| db:deploy sobre PostgreSQL 17 efímero aislado | Migración aplicada; repetición sin pendientes |
| prisma validate | Esquema válido |
| Smoke del código compilado | Health 200, registro 201 y errores JSON 400 sin fragmentos sensibles |
| CLI compilado en procesos independientes | ADMIN creado, segunda ejecución sin cambios; USER aborta con salida 1 |
| git diff --check | Sin errores de whitespace |
| Lint | No ejecutado: no hay comando/configuración en el repositorio |
| npm audit --omit=dev | Reportó 3 dependencias con severidad alta preexistentes: next, sharp, source-map-js |

El primer intento de test Argon2 asumía orden fijo de parámetros PHC: se corrigió para comprobar
valores sin depender del orden. La prueba JSON adicional detectó una fuga del parser y pasa con
la sanitización. La última suite completa es la evidencia de aprobación.
La auditoría no fue aprobada; no se actualizó frontend ni se ejecutó npm audit fix fuera del alcance.
La persistencia se verificó con PostgreSQL real en un contenedor independiente, sin bases de
desarrollo ni secretos reales. Las cuentas de prueba se eliminaron por sus IDs.

## Pendientes y entrega

Repetir controles en Node 22.22.3 para certificar el runtime fijado. Validación manual del
desarrollador pendiente para cerrar administrativamente la tarea y moverla a finished conforme
docs/tasks/OVERVIEW.md. No hay bloqueos de implementación de esta etapa.
Etapas futuras: login, JWT, sesiones, renovación, logout y gestión de contraseñas; ver TDD.
No se creó commit, rama, push ni PR. Archivos preexistentes ajenos (.github y TASK-002 CI) intactos.

Mensaje sugerido: `feat(auth): implementar registro y provisión administrativa segura`

## Cierre vigente

El desarrollador confirmó que los cambios realizados quedaron comprobados el 2026-10-09.
Esta aprobación cierra la validación manual indicada como pendiente en la evidencia histórica
de esta tarea. Los controles anteriores conservan sus resultados y límites: no se afirma
una nueva ejecución de la matriz automatizada completa de navegador ni entrega SMTP real.
La configuración y navegación vigentes se describen en README y los OVERVIEW de cada módulo.
