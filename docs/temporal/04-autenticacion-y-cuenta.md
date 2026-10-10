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
| AUTH-10 | Registro exclusivo de correo institucional (`@frlp.utn.edu.ar`), rechazando dominios externos. | HU-01 Esc. 3 | **No implementado.** Depende de TASK-004 (Google OAuth con filtro de dominio vs. contraseña propia + verificación). |

## Decisiones ya tomadas (implementadas)

- Contraseñas con Argon2id.
- Access token de corta duración (JWT) + sesión server-side con refresh token opaco, revocable por `sessionId`.
- Rotación de refresh token en cada renovación, con detección de reuso que revoca la sesión completa ante un token ya consumido.
- CSRF y CORS por origen configurado explícitamente.
- Rol fijo `USER` en el registro; `ADMIN` solo se provisiona por comando explícito, sin endpoint público.

## Lo que queda abierto

AUTH-09 y AUTH-10 son, en los hechos, la misma pregunta: qué tan estricta es la identidad institucional en esta iteración. Mientras TASK-004 no se resuelva, el registro queda deliberadamente genérico (cualquier correo + contraseña), sabiendo que esto es una reducción de alcance temporal y no el diseño final de HU-01.

## Preguntas abiertas

1. TASK-004 — Google OAuth (filtro de dominio institucional) vs. contraseña propia + verificación por mail.
2. Spike 2 — validación de identidad UTN vía mail institucional, insumo directo para resolver TASK-004.
3. Si se adopta OAuth, evaluar si HU-02 (recuperación de contraseña) queda obsoleta o se mantiene como fallback.
