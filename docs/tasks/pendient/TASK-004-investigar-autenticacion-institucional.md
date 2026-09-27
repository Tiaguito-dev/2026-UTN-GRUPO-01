# TASK-004: Investigar estrategia de autenticación institucional

Estado: Pendiente
Fecha: 2026-09-27
TDD relacionado: Pendiente (se redactará según la alternativa elegida)

## 1. Contexto y Problema

El sistema requiere que los usuarios se identifiquen con sus correos institucionales de la UTN
(`@alu.frlp.utn.edu.ar` para estudiantes y `@frlp.utn.edu.ar` para docentes) para acceder a las
funciones de comentarios y visualización de cátedras/comisiones.

La facultad no expone (ni requiere) una API interna (como SIU Guaraní) para validar alumnos. El
acceso activo al buzón de correo institucional es la prueba estándar de pertenencia a la
universidad.

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
      NestJS o mediante Neon Auth.
- [ ] Si se elige la Alternativa B (Neon Auth con contraseñas): registrar una cuenta gratuita en
      Resend y configurar las claves API en Neon.
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
