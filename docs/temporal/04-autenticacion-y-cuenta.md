# Autenticación y cuenta

Estado: propuesta para discutir con el equipo. Cubre registro, sesiones, contraseñas y autorización inicial (HU-01, HU-02, HU-10). Distingue lo que ya está implementado en `back/src/auth` de lo que sigue abierto.

## Requisitos

| Código | Requisito | Historia | Estado en el código |
| --- | --- | --- | --- |
| AUTH-01 | Registro con correo y contraseña. | HU-01 | Implementado. |
| AUTH-02 | Login genera sesión (access token JWT + refresh token). | HU-10 Esc. 1 | Implementado. |
| AUTH-03 | Logout revoca el refresh token de la sesión (`sessionId`). | HU-10 Esc. 2 | Implementado. |
| AUTH-04 | Renovación de sesión emite un access token nuevo sin pedir login, mientras el refresh token siga vigente. | HU-10 Esc. 3 | Implementado, con rotación atómica y detección de reuso (si se detecta un refresh ya usado, se revoca toda la sesión). |
| AUTH-05 | Cambio de contraseña autenticado, validando la contraseña actual. | HU-10 Esc. 4 | Implementado. |
| AUTH-06 | Solicitud de recuperación de contraseña envía un token con expiración al correo. | HU-02 Esc. 1 | Implementado (SMTP, probado contra Mailpit en desarrollo). |
| AUTH-07 | Restablecimiento con token válido actualiza la contraseña; token inválido o expirado se rechaza. | HU-02 Esc. 2 y 3 | Implementado. |
| AUTH-08 | Solicitud de recuperación con correo no registrado responde igual que si la cuenta existiera (no revela existencia de la cuenta). | HU-02 Esc. 4 | Implementado. |
| AUTH-09 | Verificación de cuenta por correo antes de habilitar el login. | HU-01 Esc. 2 | **No implementado.** `04-autenticacion-y-cuenta.md` (este documento) deja este escenario fuera de alcance explícito hasta que el equipo lo confirme — ver preguntas abiertas en `02-alcance-primera-iteracion.md`. |
| AUTH-10 | Registro exclusivo de correo institucional de alumnos (`@alu.frlp.utn.edu.ar`), rechazando cualquier otro dominio. | HU-01 Esc. 3 | **Implementado (2026-10-10).** La regla vive en `RegisterUser`, no en la validación de email compartida, porque esa la usan login, recuperación de contraseña y la provisión de ADMIN, que no deben exigir dominio. |

## Decisiones ya tomadas (implementadas)

- Contraseñas con Argon2id.
- Access token de corta duración (JWT) + sesión server-side con refresh token opaco, revocable por `sessionId`.
- Rotación de refresh token en cada renovación, con detección de reuso que revoca la sesión completa ante un token ya consumido.
- CSRF y CORS por origen configurado explícitamente.
- Rol fijo `USER` en el registro; `ADMIN` solo se provisiona por comando explícito, sin endpoint público.

## Lo que queda abierto

AUTH-09 y AUTH-10 eran, en los hechos, la misma pregunta: qué tan estricta es la identidad
institucional en esta iteración. Quedó partida en dos: **AUTH-10 se implementó** (el dominio del
correo se valida), **AUTH-09 sigue fuera de alcance** (no se verifica que la casilla exista y
pertenezca a quien se registra). O sea: hoy alcanza con que el correo *tenga la forma* de uno
institucional, no se comprueba que sea real.

## Preguntas abiertas

1. ~~TASK-004 — Google OAuth vs. contraseña propia~~ **Resuelta (2026-10-10)**: no se adopta
   SSO. La premisa del documento original era falsa — la UTN FRLP usa **Microsoft 365, no Google
   Workspace**; el candidato real habría sido Azure AD, que exige que la UTN autorice la
   aplicación en su tenant, y no hubo respuesta al pedido. Se mantiene el auth propio con
   contraseña más el filtro de dominio de AUTH-10. Ver
   `docs/tasks/finished/TASK-004-investigar-autenticacion-institucional.md`.
2. **Spike 2 — parcialmente resuelto.** La parte de "qué proveedor de identidad usa la facultad"
   quedó contestada por TASK-004. Sigue abierto, acotado, lo que corresponde a AUTH-09: verificar
   que la casilla institucional existe y pertenece a quien se registra.
3. ~~Si se adopta OAuth, ¿HU-02 queda obsoleta?~~ **Resuelta (2026-10-10)**: no se adoptó OAuth,
   así que **HU-02 (recuperación de contraseña) sigue vigente sin cambios**.
4. **Registro de docentes: sin resolver y fuera de esta iteración.** No existe rol "docente"; un
   profesor que se registre hoy entra como `USER` y, con AUTH-10 activo, necesitaría un correo
   `@alu.frlp.utn.edu.ar`, que no le corresponde. Se evaluó la idea de admitir cualquier correo
   con aprobación manual de un administrador, pero quedó sin decidir.
