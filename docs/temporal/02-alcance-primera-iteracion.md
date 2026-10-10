# Alcance de la primera iteración

Estado: propuesta para discutir con el equipo. Este documento fija qué entra y qué no entra en la primera iteración de Profesor Butchery, y distingue lo que ya está decidido de lo que sigue abierto.

## Objetivo

Entregar un primer vertical del producto que permita a un estudiante registrarse, iniciar sesión y navegar la jerarquía académica (Materia → Cursada → Comisión) hasta encontrar la asignación que busca, mientras un administrador mantiene esa información académica desde un panel propio. No se publican comentarios ni valoraciones todavía — esta iteración resuelve la base de cuenta y de datos académicos sobre la que se apoyará la publicación de contenido en la siguiente.

## Alcance incluido (IN)

| Historia | Qué cubre esta iteración | Qué queda reducido o pendiente |
| --- | --- | --- |
| HU-01 — Registro de usuario | Registro con correo y contraseña, cuenta creada y utilizable, con filtro de dominio institucional de alumnos (`@alu.frlp.utn.edu.ar`). | Sin verificación de cuenta por correo (Escenario 2). TASK-004 resuelta (2026-10-10): sin SSO institucional; registro de docentes queda fuera de esta iteración. |
| HU-02 — Recuperación de contraseña | Flujo completo: solicitud, token con expiración, restablecimiento, rechazo de token inválido/expirado, respuesta uniforme ante correo no registrado. | Ninguno — TASK-004 confirmó que se mantiene el auth con contraseña propia, así que esta historia sigue vigente. |
| HU-10 — Login, logout, renovación y cambio de contraseña | Sesión con access token JWT + refresh token revocable, logout que revoca la sesión, renovación sin pedir login de nuevo, cambio de contraseña autenticado. | Ninguno — es la historia más completa de esta iteración. |
| HU-04 — Jerarquía académica (Escenario 1) | Navegación Materia → Cursada → Comisión, hasta el turno/grupo concreto de cursada. | Ninguno — Comisión confirmada como entidad de esta iteración (2026-10-10, ver `03-modelo-de-dominio.md`). |
| HU-05 — Validación de comisiones y profesores (Escenario 1 únicamente) | Listado de profesores/comisiones consultable desde el backend, mock en NestJS o API real de la facultad según lo que determine el Spike 1. | El Escenario 2 (asociar un comentario a una comisión/profesor) queda explícitamente **fuera de esta iteración** — depende de la publicación de comentarios (HU-06), que esta iteración no incluye. Decisión registrada en Trello el 2026-10-09. |
| HU-11 — Administración (CRUD académico) | Alta, edición y listado de Materias, Profesores, Cursadas y Comisiones, más el listado paginado de usuarios registrados. | Sin eliminación de entidades ni gestión de roles. Ver `06-administracion.md`: ADM-02 (Cátedras) se retiró con la fusión en Materia, y la administración de Comisiones **sí entra** (ADM-06, decisión del 2026-10-10) — pero HU-11 todavía no tiene un escenario que la cubra en Trello. |

## Alcance excluido (OUT)

- **HU-06 — Publicación de feedback con opción de anonimato.** Ninguna forma de comentario o valoración se publica en esta iteración; by extension, el Escenario 2 de HU-05 tampoco aplica.
- **HU-09 — Reporte de comentarios inapropiados.** No hay contenido que reportar todavía.
- **HU-03 — Modelo de roles más allá del mínimo para registro/login.** Estudiante/Admin alcanzan para esta iteración; Profesor, Visitante y Jefe Departamental (y la pregunta abierta sobre JWT con rol embebido vs. sesiones server-side) quedan para cuando se publique contenido.

## Entregables

1. Backend: módulos `auth`, `users` y `academic` funcionando end-to-end contra PostgreSQL/Prisma.
2. Frontend: pantallas de registro, login, cuenta, recuperación de contraseña, navegación de jerarquía académica (drill-down) y panel de administración CRUD.
3. Datos de ejemplo cargados (ver `05-consulta-de-contenido.md`) para que la demo no se muestre vacía.

## Demostración de la iteración

Guion sugerido: (1) un usuario se registra con su email de alumno y confirma que su cuenta queda utilizable; (2) inicia sesión y navega Materia → Cursada → Comisión hasta encontrar un turno concreto; (3) un administrador entra al panel, da de alta una materia y una cursada nueva y las ve reflejadas en la navegación del paso anterior; (4) el usuario cierra sesión y recupera su contraseña desde cero.

## Preguntas abiertas

1. ~~Estrategia de autenticación institucional (TASK-004)~~ **Resuelta (2026-10-10)**: se
   mantiene contraseña propia + filtro de dominio para alumnos; sin SSO. Ver
   `docs/tasks/finished/TASK-004-investigar-autenticacion-institucional.md`.
2. ~~¿Se confirma Comisión como entidad de esta iteración?~~ **Resuelta (2026-10-10): sí.**
3. Disponibilidad de la API real de la facultad para HU-05 (Spike 1) — determina si el Escenario 1 se resuelve con mock o con integración real.
