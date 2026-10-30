# TASK-004: Investigar estrategia de autenticación institucional

Estado: **Cerrada (2026-10-10)** — mantener auth custom, agregar validación de dominio
institucional solo para alumnos en el registro público; ya implementado (ver sección 8). Registro
de docentes queda explícitamente fuera de esta iteración (ver sección 7) — no hay rol "docente"
en el sistema hoy, ni HU que lo cubra; se retoma cuando exista esa historia.
Fecha: 2026-09-27 (creada) / 2026-10-09 (investigación y recomendación) / 2026-10-10 (confirmada
e implementada)

## 0. Corrección de rumbo (2026-10-09)

Esta tarea nunca se había investigado. En el medio, otra persona del equipo implementó el
módulo de auth (`back/src/auth`) **sin leer este documento**: registro + login con JWT de acceso
(15 min) + sesión con refresh token opaco rotativo + recuperación de contraseña por SMTP +
Argon2id para hashes. 277 tests backend pasando (al momento de esta investigación).

Esa implementación **no es ninguna de las dos alternativas** descriptas en la sección 2:
- No es la Alternativa A (no hay Google OAuth ni ningún OAuth).
- No es la Alternativa B tal como está escrita (no usa Neon Auth; es JWT + Argon2id + refresh
  token propios, hechos a mano).

Es una tercera vía de hecho: **auth con contraseña, 100% custom, ya construida y probada.**

Verificado en código (`back/src/auth/domain/registration-input.ts`): el registro validaba
formato de email genérico, pero **no restringía dominio** — cualquier email válido entraba.
Esto confirmó lo que ya se sabía: AUTH-10 (ver `docs/temporal/04-autenticacion-y-cuenta.md`)
seguía sin implementar. Ya está resuelto — ver sección 8.

Dado este punto de partida, la pregunta que esta tarea tuvo que responder ya no fue "¿A o B?"
tal como se planteó en septiembre. Fue más chica: **dado que el auth con contraseña ya existe y
funciona, ¿tiene sentido reemplazarlo por SSO institucional, o solo hay que agregarle la
validación de dominio que le falta?** La sección 6 responde esto con investigación, y la
sección 7 con la recomendación confirmada.

## 1. Contexto y Problema

El sistema requiere que los usuarios se identifiquen con sus correos institucionales de la UTN
(`@alu.frlp.utn.edu.ar` para estudiantes y `@frlp.utn.edu.ar` para docentes) para acceder a las
funciones de comentarios y visualización de cátedras/comisiones.

Esta tarea parte de **Spike 2 — Validación de identidad UTN vía mail institucional** (Trello,
`2026-UTN-Cloud`), no la reemplaza. Spike 2 ya cubre la pregunta de si el dominio `.frlp` es
exclusivo de la facultad y qué patrón de verificación de mail usar (token/OTP) — esa
investigación sigue siendo la fuente para esa parte, y no se repite acá.

Lo que agrega esta tarea es una capa arriba de esa pregunta: **decidir la estrategia de
autenticación completa** (Alternativa A o B más abajo), porque esa decisión cambia cuánto de
Spike 2 hace falta implementar:

- Si se elige **Alternativa A (Google OAuth)**, Google gestiona la verificación de la cuenta —
  gran parte del DoR de Spike 2 (patrón de verificación por mail, elección de proveedor de
  mailing) deja de ser necesario, y solo queda vigente la validación de dominio institucional.
- Si se elige **Alternativa B (Neon Auth con contraseña)**, sí hace falta completar Spike 2 tal
  como está planteada: mecanismo de verificación de mail y elección de proveedor.

Esta tarea tiene como propósito que cualquier integrante del equipo pueda retomar el análisis y
decidir el camino técnico a implementar para la autenticación, la verificación del correo y la
recuperación de contraseñas.

---

## 2. Alternativas Analizadas

### Alternativa A: "Iniciar sesión con Google" (OAuth2 / SSO) con filtro de dominio
* **Fundamento (⚠️ FALSO — ver sección 6):** Este documento asumía que la UTN FRLP utiliza
  Google Workspace for Education. La investigación de 2026-10-09 encontró evidencia pública
  consistente de que FRLP usa **Microsoft 365 / Office 365** (convenio UTN–Microsoft), no Google.
  Esta alternativa, tal como está redactada, no es viable: no hay cuentas de Google detrás de
  `@alu.frlp.utn.edu.ar`.
* **Flujo:**
  1. El usuario hace clic en "Ingresar con correo UTN".
  2. Google valida la identidad del usuario en su cuenta institucional.
  3. La aplicación recibe el email verificado y valida que termine en el dominio institucional.
* **Ventajas:**
  - **Cero almacenamiento de contraseñas:** La base de datos no guarda hashes ni contraseñas.
  - **Elimina el flujo de recuperación de contraseña:** La recuperación de clave la gestiona Google.
  - **Cero envío de correos:** No requiere contratar ni configurar servicios SMTP/Resend.
  - Experiencia de usuario rápida con un solo clic.
* **Desventajas:** Dependencia de la interfaz de Google OAuth.

### Alternativa B: Registro tradicional con contraseña mediante Neon Auth
* **Fundamento:** Utilizar la solución de autenticación gestionada de Neon (Neon Auth) sobre
  PostgreSQL.
* **Flujo:**
  1. El usuario se registra con su email `@alu.frlp.utn.edu.ar` y una contraseña.
  2. Neon Auth envía un código o enlace de verificación al correo institucional para validar la
     casilla.
  3. En caso de olvido de clave, Neon Auth genera tokens temporales seguros de un solo uso y envía el
     correo de reseteo.
* **Ventajas:**
  - El usuario crea credenciales específicas para la plataforma.
  - Neon Auth maneja la seguridad de los tokens de recuperación y encriptación.
* **Desventajas:**
  - Requiere configurar e integrar un proveedor de emails transaccionales (ej. Resend, gratuito
    hasta 3.000 envíos/mes).
  - Mayor fricción para el usuario (esperar correo, copiar código).

---

## 6. Investigación: ¿qué identidad usa realmente la UTN FRLP?

No hubo respuesta de la facultad al mail institucional que se envió consultando esto (dato
provisto por Tiago). Sin esa confirmación directa, la investigación se hizo contra fuentes
públicas:

- **`frlp.utn.edu.ar/noticias-microsoft`** (página oficial de FRLP): "debido al convenio
  realizado entre la UTN y Microsoft, la comunidad tecnológica tiene acceso al Office 365, el
  cual podrá ser descargado e instalado."
- **`frlp.utn.edu.ar/ayuda-para-campus-virtual-educacion-distancia`**: para entrar al Campus
  Virtual Global, la cuenta institucional debe estar "previamente activada en www.office.com" —
  es decir, el login pasa por el tenant de Microsoft, no por Google.
- Patrón consistente en otras regionales de UTN (ej. FRH/Haedo): cuentas de alumnos que
  inicialmente se llaman "Google Apps for Education" en documentación vieja, pero que en la
  práctica corren sobre **Office 365 / Azure AD** (una sola credencial sirve para webmail, Office
  y Teams). No es FRLP directamente, pero muestra que "Google Workspace" es un nombre que quedó
  dando vueltas en documentación de UTN sin ser lo que está detrás hoy.

**Conclusión:** el fundamento de la Alternativa A (Google Workspace) es incorrecto. Si hubiera
SSO institucional viable, el candidato real sería **"Iniciar sesión con Microsoft" (Azure
AD / Microsoft Entra ID)**, no Google OAuth. Esto es evidencia pública, no confirmación oficial
de la facultad — el nivel de certeza es "razonablemente alto, no definitivo".

Aun si fuera Microsoft, OAuth contra el tenant de Azure AD de la UTN requiere que **la UTN
registre y autorice nuestra aplicación** en su tenant (consentimiento de administrador de su
IT). Eso es exactamente el contacto institucional que ya se intentó y no tuvo respuesta. No es
algo que se pueda resolver solos escribiendo código del lado nuestro.

## 7. Recomendación — CONFIRMADA por Tiago el 2026-10-10

**Mantener el auth custom actual (contraseña + Argon2id + JWT + refresh rotativo) y agregar
solo la validación de dominio institucional que faltaba (AUTH-10 / HU-01 Esc. 3).** No se migra
a ningún SSO (ni Google ni Microsoft) en esta iteración.

Fundamento:
1. **Ninguna alternativa de SSO es ejecutable hoy.** Google queda descartado por premisa falsa
   (sección 6). Microsoft/Azure AD sería el candidato correcto en teoría, pero depende de que la
   UTN registre la app en su tenant — y ya no respondieron un mail pidiendo info básica. No hay
   forma de avanzar esto sin cooperación institucional que hoy no existe.
2. **El auth custom ya está construido, probado (277 tests) y en producción de hecho.**
   Reemplazarlo por SSO sería reescribir un módulo que funciona, para depender de un tercero
   (la facultad) que no contesta. El costo es alto y el riesgo de quedar bloqueados es real.
3. **Lo único que faltaba era un filtro, no una arquitectura nueva.** La validación de dominio
   es una regla de negocio chica (allowlist de sufijos de email) sobre un flujo que ya existía.
4. Si en el futuro la UTN responde y ofrece cooperación real para Azure AD, esto se puede
   reconsiderar — pero eso es una decisión a tomar con información que hoy no tenemos.

**Decisión de Tiago (2026-10-10):** para alumnos, la validación de dominio es firme:
`@alu.frlp.utn.edu.ar` y nada más.

Para docentes, **decisión final: queda fuera de esta iteración** (confirmado por Tiago el
2026-10-10). Hoy no existe rol "docente" en el sistema (solo `ADMIN`/`USER`), ni ninguna HU de
esta iteración lo cubre — un profesor que se registre hoy entra como `USER` común, igual que un
alumno, sin distinción. La idea que había planteado Tiago (cualquier mail + aprobación manual de
un admin) queda registrada como una opción a evaluar el día que se arme esa HU, sin prioridad
sobre otras alternativas (ej. lista de profesores pre-cargada que el profesor "reclama" con su
email) — no es una resolución, solo una nota para no perderla.

## 8. Impacto concreto e implementación

**HU-01, Escenario 3 (AUTH-10):** regla concreta y chica, **acotada a alumnos**: el registro
valida que el dominio del email sea exactamente `alu.frlp.utn.edu.ar` y rechaza cualquier otro
dominio con un error de validación explícito. No cambia el resto del flujo de registro (sigue
siendo email + contraseña + Argon2id). El registro de docentes queda explícitamente fuera de
esta regla hasta que haya una decisión de flujo para ese caso (ver sección 7).

**HU-02 (recuperación de contraseña): sigue viva, sin cambios.** Como no hay SSO, el flujo de
recuperación por SMTP que ya está implementado y probado sigue siendo necesario.

**Spike 2:** dado que no hay SSO, Spike 2 (verificación de identidad vía mail institucional)
sigue siendo relevante pero acotado — la verificación de *formato* de dominio la resuelve esta
tarea; si además se quiere verificar que la casilla específica existe y es controlada por su
dueño (no solo que el string matchea el dominio), eso es lo que queda para Spike 2.

**Implementación (2026-10-10), ya hecha:**
- Nuevo `back/src/auth/domain/institutional-domain.ts`: constante `alu.frlp.utn.edu.ar` +
  `validateInstitutionalEmailDomain(email)`, con comparación exacta contra la parte posterior al
  único `@` (no `endsWith`/`includes` — evita que un dominio como `evilalu.frlp.utn.edu.ar` pase
  por error).
- `back/src/auth/application/register-user.ts`: llama esa validación justo después de
  `validateRegistrationInput`. Deliberadamente **no** se tocó `validateAccountEmail` ni
  `validateRegistrationInput` en sí — esas funciones las comparten login, recuperación de
  contraseña y `ProvisionAdmin` (el comando de alta de ADMIN por consola, con un email arbitrario
  que no tiene por qué ser institucional). Meter la regla ahí habría roto esos tres flujos.
- Tests nuevos en `back/tests/auth.use-cases.spec.ts` (rechazo por dominio, éxito con dominio
  institucional, `ProvisionAdmin` con email no institucional sigue funcionando) y
  `back/tests/auth.integration.spec.ts` (caso HTTP 400 por dominio incorrecto).
- Suite completa verificada: 200 passed, 83 skipped (integración sin `TEST_DATABASE_URL`, sin
  cambios de comportamiento), 0 failed.

Nota sobre documentación de diseño: este repo ya no usa un documento de diseño técnico (TDD)
separado — las decisiones de diseño no triviales se documentan dentro de la propia tarea
(convención vigente desde 2026-10-10). Por eso el detalle de diseño de esta regla vive en esta
sección en vez de en un documento aparte.
