# TASK-004: Investigar estrategia de autenticación institucional

Estado: Pendiente
Fecha: 2026-09-27
TDD relacionado: Pendiente (se redactará según la alternativa elegida)

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
* **Fundamento:** La UTN FRLP utiliza Google Workspace for Education. Las cuentas
  `@alu.frlp.utn.edu.ar` son cuentas de Google.
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

## 3. Alcance de la Tarea

- [ ] Presentar ambas alternativas al equipo y/o docente para definir la preferencia.
- [ ] Si se elige la Alternativa A (Google OAuth): definir si se implementa mediante Passport en
      NestJS o mediante Neon Auth. Cerrar/reducir Spike 2 a solo la validación de dominio.
- [ ] Si se elige la Alternativa B (Neon Auth con contraseñas): retomar Spike 2 para el mecanismo
      de verificación de mail (token/OTP) y la elección de proveedor, registrar una cuenta
      gratuita en Resend y configurar las claves API en Neon.
- [ ] Redactar el TDD correspondiente (`TDD-AUTH-H1.md`) con el modelo de dominio `User` para Prisma.
- [ ] Definir los roles (alumno, docente, moderador) y la regla de validación de dominios permitidos.

---

## 4. Exclusiones

- No escribir código en backend ni frontend hasta que la decisión esté acordada en el TDD.
- No solicitar permisos ni accesos a autoridades de la facultad (no son necesarios).

---

## 5. Criterios de Aceptación

1. Existe consenso documentado en el equipo sobre la alternativa elegida (A o B).
2. Se redactó y aprobó `docs/tdd/TDD-AUTH-H1.md`.
3. Se generaron las historias de usuario y tareas de implementación derivadas para frontend y backend.
