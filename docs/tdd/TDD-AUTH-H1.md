# TDD-AUTH-H1: Cuentas locales, etapa 1

Actualización de política: [TDD-UX-H1](./TDD-UX-H1.md) establece contraseñas nuevas de 8 a 128
caracteres, por solicitud del desarrollador. El mínimo de 15 que describe el diseño original
ya no rige; no se modifica el hash ni se normaliza la contraseña.

Estado: Implementado por solicitud del desarrollador; validación manual del equipo pendiente
Fecha: 2026-10-08

## Contexto y decisión

El pedido explícito de Profesor Butchery define autenticación local con contraseña y solo ADMIN
y USER para esta etapa. TASK-004 es investigación institucional pendiente, no un contrato
implementado; no se adopta OAuth, Neon Auth ni validación de dominios en esta entrega.
Se conservan PostgreSQL, Prisma 6, adapter pg, NestJS y Vitest del stack aprobado.

## Diseño

Monolito modular: users posee entidad y puerto específico findByEmail/create, adaptador Prisma
y proyección pública. auth posee validación, RegisterUser, ProvisionAdmin y puerto PasswordHasher.
Los casos de uso son TypeScript puro; providers NestJS conectan adaptadores mediante factories.
No hay dependencias circulares, repositorios CRUD genéricos ni carpetas para etapas futuras.

User: UUID, email único, displayName, passwordHash, role (USER por defecto), createdAt.
Migración aditiva crea enum, tabla e índice UNIQUE; los adaptadores traducen P2002 a error de
dominio. La consulta previa es una optimización; la restricción resuelve carreras.

Email: trim + lowercase para toda consulta/creación a través del puerto, máximo 254 caracteres,
formato ASCII local@dominio con al menos dos etiquetas. No se eliminan puntos ni alias +.
Nombre: trim, 1–100 caracteres, sin controles. Contraseña: 15–128 puntos de código Unicode,
sin trim, normalización ni reglas de composición. Se rechazan controles en email/nombre.
Argon2id mediante dependencia argon2: versión 19, memoria 19456 KiB, 2 iteraciones,
paralelismo 1, hash de 32 bytes, sal aleatoria por hash. Parámetros persistidos en formato PHC.

## Contrato HTTP y seguridad

POST /auth/register acepta únicamente email, displayName y password. Todo campo adicional,
incluido role, se rechaza. 201 devuelve id, email, displayName, role y createdAt; sin sesión.
400/409 usan formato estándar NestJS { statusCode, error, message }; no se devuelven entradas
inválidas ni detalles Prisma. Errores inesperados reciben mensaje 500 seguro.
Un filtro NestJS de BadRequest, registrado por auth, sanitiza el parseo anterior al controlador
solo en POST /auth/register. En otros endpoints delega al filtro estándar; las validaciones del
caso de uso conservan sus mensajes seguros mediante cause, que no se serializa.
createdAt registra el alta; no hay modificaciones ni borrado, por lo que no se expone historial
ni administración pública en esta etapa. El comando ADMIN es una capacidad operativa privada.

## Provisión y pruebas

Comando compilado separado del arranque HTTP, credenciales ADMIN_EMAIL/ADMIN_DISPLAY_NAME/
ADMIN_PASSWORD más DATABASE_URL. Admin existente: no-op, sin cambiar password/nombre.
USER existente: abortar. Carrera: tras conflicto releer; ADMIN implica no-op, USER implica aborto.
No imprimir credenciales, hash, excepciones internas ni configuración.

Pruebas unitarias de casos de uso y pruebas HTTP/Prisma sobre base exclusivamente de pruebas,
incluyendo creación concurrente y unicidad directa. No usar ni truncar base de desarrollo.
No se incorpora otro framework. Integración requiere TEST_DATABASE_URL y migración aplicada.
Sin variable, integración se declara omitida, nunca aprobada.

## Siguiente etapa

Login, JWT, sesiones, renovación, logout y gestión de contraseñas requieren un nuevo contrato.
Verificación de email, antiabuso/rate limiting y autorización se diseñarán con esos flujos.
