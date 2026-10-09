# TASK-009: Integración frontend y recorrido completo

Estado: Terminada; validación manual confirmada por el desarrollador el 2026-10-09
Fecha: 2026-10-08
Diseño: [TDD-AUTH-H5](../../tdd/TDD-AUTH-H5.md)

## Alcance y aceptación

Verificar H4 antes de integrar Next.js existente. Cliente HTTP con cookies/CSRF, estado de
cuenta central, refresh único y coordinación entre pestañas, formularios registro/login/
recuperación/reset/cuenta/cambio y logout. Navegación protegida, roles y retorno interno seguro.
Paleta centralizada, accesibilidad, estados temporales recuperables y protección del enlace.
Demostrar todo el recorrido en navegador con PostgreSQL y SMTP/Mailpit reales, sin minutos
de espera ni credenciales en almacenamiento/logs. Regresiones H1–H4 y controles de ambos paquetes.

## Restricciones y exclusiones

Reutilizar Next.js App Router/React/TypeScript, NestJS y Prisma. Dependencia Playwright justificada
por pruebas reales de navegador; sin endpoints ficticios en producto. Infra administrativa solo
en harness de tests. Sin frontend académico, perfil general, MFA, OAuth ni diseño definitivo.
Cambios en layout/auth/estilos autorizados únicamente para este alcance. No commits/push/PR.

## Validaciones

H4 completa contra DB+SMTP antes de integración. E2E desktop/móvil: registro/login, recarga/me,
access vencido/refresh, peticiones concurrentes y pestañas, logout, reset por buzón, cambio y
revocación en otros navegadores, roles, fallos red/500/401/403 y recuperación del estado.
Inspeccionar cookies/CORS/CSRF/storage/logs, contrastes y teclado. Build/tipos/tests/lint si existe.

## Cierre vigente

El desarrollador confirmó que los cambios realizados quedaron comprobados el 2026-10-09.
Esta aprobación cierra la validación manual indicada como pendiente en la evidencia histórica
de esta tarea. Los controles anteriores conservan sus resultados y límites: no se afirma
una nueva ejecución de la matriz automatizada completa de navegador ni entrega SMTP real.
La configuración y navegación vigentes se describen en README y los OVERVIEW de cada módulo.
