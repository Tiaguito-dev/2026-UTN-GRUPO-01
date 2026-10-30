# TASK-008: Recuperación y cambio de contraseña

Estado: Terminada; validación manual confirmada por el desarrollador el 2026-10-09
Fecha: 2026-10-08
Diseño: [TDD-AUTH-H4](../../tdd/TDD-AUTH-H4.md)

## Alcance y aceptación

Implementar RequestPasswordReset, ResetPassword y ChangePassword, tokens opacos con hash,
vencimiento inicial de 30 minutos, uso único, SMTP y buzón local inspeccionable. Mantener
respuestas equivalentes de recuperación, cookies, CSRF, límites y arquitectura por puertos.
Restablecimiento/cambio revocan todas las sesiones y credenciales en una operación atómica.
Coordinar login, refresh y cambios concurrentes sin hashing ni email bajo bloqueos.

## Restricciones y exclusiones

Reutilizar NestJS, Prisma/PostgreSQL, Argon2 y generador seguro existente. SMTP requiere
Nodemailer como dependencia justificada; no existe proveedor previo. Sin frontend, colas,
reintentos distribuidos, MFA, verificación/cambio de email o administración de cuentas.
Sin commits, push ni PR. Preservar cambios previos y no modificar flujos del frontend.

## Validaciones

Pruebas unitarias, HTTP y PostgreSQL real: recorrido buzón/reset/login; equivalencia pública,
tokens hash/uso único/vencimiento/invalidation, fallo SMTP seguro y concurrente, rollback,
reset/change/login/refresh concurrentes, revocación, CSRF, frecuencia y regresiones H1–H3.
Build, tipos y lint si está configurado. Documentar migración, configuración, contratos,
SMTP/buzón, límites temporales contra enumeración y responsabilidades del futuro frontend.

## Resultado y evidencia

- 233/233 pruebas aprobadas en 13 archivos, sin omisiones, con PostgreSQL 17 y SMTP/Mailpit
  reales. Incluyen las 166 regresiones H1–H3, equivalencia pública, tokens, email, CSRF/rates,
  rollback después de modificar contraseña/consumo y concurrencia determinística.
- Login verificado con hash anterior no crea sesión después del cambio; dos cambios del mismo
  hash solo aceptan uno; reset durante hashing no sobrescribe cambio. Refresh concurrente no
  conserva credenciales utilizables tras revocación. Fallo SMTP tardío no invalida token posterior.
- Compilación del monorepo, typecheck de producción/pruebas y Prisma validate aprobados.
- Migración aplicada sobre H1–H3 y comprobada con usuarios, sesiones activas/revocadas y refresh
  existentes: datos, fechas y estados conservados, sin tokens de recuperación retrospectivos.
- Recorrido contra servidor compilado y buzón SMTP: 202 uniforme, enlace recibido, reset/cambio
  204, cookies limpias, JWT anteriores rechazados y login obligatorio con contraseña nueva.
- No existe script/configuración de lint. Node disponible 22.17.0; pendiente repetir en 22.22.3.
- npm audit no está aprobado: reporta hallazgos previos en Next.js, sharp y source-map-js.
  Nodemailer no aparece entre los paquetes vulnerables. No se actualiza frontend fuera de alcance.
- Piso temporal no garantiza tiempo constante bajo saturación de DB/red. Sin cola/reintentos,
  pantalla frontend, limpieza automática ni verificación de email. Límites siguen por proceso;
  despliegue con varias réplicas necesita store compartido/gateway según H2/H3.
- Sin commits, push o PR. La tarea permanece en in-progress hasta validación del desarrollador.

## Cierre vigente

El desarrollador confirmó que los cambios realizados quedaron comprobados el 2026-10-09.
Esta aprobación cierra la validación manual indicada como pendiente en la evidencia histórica
de esta tarea. Los controles anteriores conservan sus resultados y límites: no se afirma
una nueva ejecución de la matriz automatizada completa de navegador ni entrega SMTP real.
La configuración y navegación vigentes se describen en README y los OVERVIEW de cada módulo.
