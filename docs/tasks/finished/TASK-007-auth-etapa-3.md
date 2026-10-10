# TASK-007: Renovación, rotación y logout

Estado: Terminada; validación manual confirmada por el desarrollador el 2026-10-09
Fecha: 2026-10-08
Diseño: [TDD-AUTH-H3](../../tdd/TDD-AUTH-H3.md)

## Alcance y aceptación

Separar access JWT (inicial 900 segundos) de sesión absoluta (inicial 7 días), refresh opaco
con hash persistido, login atómico con ambas cookies, RefreshSession y Logout. Rotación y
revocación comparten bloqueo por sesión. Reutilización reconocida revoca toda esa sesión.
Conservar guard, roles, CSRF, CORS, HTTPS, no-store y límites por IP. Migración aditiva sin
reactivar/extender sesiones previas, que solo podrán renovar después de un nuevo login.
Errores técnicos son 500 seguros; 401 de refresh limpia cookies, 500 temporal no las borra.

## Restricciones y exclusiones

Conservar NestJS/Prisma/PostgreSQL, casos de uso y puertos; no nuevas dependencias necesarias.
Sin frontend, dispositivos, logout global, gestión de contraseñas ni gestión académica.
Sin limpieza automática, commits, push o PR. Respetar cambios preexistentes ajenos.

## Validación

Unitarias y HTTP+PostgreSQL: ambas cookies/hash, access vencido renovable, rotación,
ausente/desconocido/consumido/vencido/revocado, revocación inmediata, concurrencia refresh/
refresh y refresh/logout, rollback real ante fallo, plazo absoluto, logout idempotente y
CSRF/rate limits, regresión de etapas anteriores. Build/tipos/lint si existe configuración.
Documentar contratos, variables, migración, cookies y consecuencia de renovación concurrente.

## Evidencia de cierre técnico

- 166/166 pruebas aprobadas, sin omisiones, con PostgreSQL 17 efímero. Incluyen HTTP,
  regresión H1/H2, rollback por restricción única, concurrencia refresh/refresh y refresh/logout,
  reutilización, plazo absoluto y renovación con un pool de una sola conexión.
- Compilación del monorepo y typecheck backend (producción y pruebas) aprobados.
- Prisma validate aprobado; migraciones aplicadas desde cero y sobre esquema H1/H2.
  Fechas y revocaciones de sesiones previas conservadas, sin credenciales nuevas para ellas.
- Prueba manual automatizada contra servidor compilado: registro, login, refresh, me,
  logout repetido, revocación inmediata y rechazo CSRF; sin secretos en respuestas o logs.
- No existe configuración/script de lint. Entorno disponible Node 22.17.0; queda pendiente
  repetir en Node 22.22.3 fijado por el repositorio.
- No se realizan commit, push ni PR. La tarea permanece aquí hasta validación del desarrollador.

## Cierre vigente

El desarrollador confirmó que los cambios realizados quedaron comprobados el 2026-10-09.
Esta aprobación cierra la validación manual indicada como pendiente en la evidencia histórica
de esta tarea. Los controles anteriores conservan sus resultados y límites: no se afirma
una nueva ejecución de la matriz automatizada completa de navegador ni entrega SMTP real.
La configuración y navegación vigentes se describen en README y los OVERVIEW de cada módulo.
