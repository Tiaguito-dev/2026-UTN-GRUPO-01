# Validación de criterios de aceptación — HU en revisión y cerradas

Fuente: tablero Trello [2026-UTN-Grupo-1](https://trello.com/b/K4u3MFOk/2026-utn-grupo-1),
listas "En revisión" y "Cerrado", relevado el 2026-10-31. Los escenarios se copian textuales
de cada tarjeta. Esta guía sirve para validar cada criterio de aceptación contra el sistema.

- **En revisión:** no hay HU. Solo está `TAREA-01 — Recuperación de contraseña operativa en el
  despliegue cloud`, que es una tarea técnica sin escenarios.
- **Cerrado:** HU-01, HU-02, HU-03, HU-04, HU-06, HU-10, HU-11 y HU-12. En HU-06 y HU-12, la
  tarjeta de "Cerrado" es un enlace: los escenarios se toman de la tarjeta original.

Estado de cada escenario: `[ ]` pendiente · `[x]` cumple · `[~]` cumple en parte · `[!]` no cumple
(anotar el motivo). Bugs en [bugs-y-fixes.md](./bugs-y-fixes.md) y faltantes en
[pendientes-implementacion.md](./pendientes-implementacion.md).

## Resumen

| HU | Escenarios | DoD en Trello | Validados |
|---|---|---|---|
| HU-01 | 3 | 5/5 | 0/3 |
| HU-02 | 4 | 5/5 | 0/4 |
| HU-03 | 3 | 0/5 | 1/3 (2 requieren cuenta de estudiante) |
| HU-04 | 1 | 4/5 | 0/1 |
| HU-06 | 4 | 0/6 | 0/4 |
| HU-10 | 4 | 4/5 | 0/4 |
| HU-11 | 4 | 1/5 | 2/4 (1 parcial, 1 no cumple) |
| HU-12 | 3 | 4/5 | 1/3 (E1 y E2 son de estudiante) |

---

## HU-01: Registro de usuario con correo institucional

[Tarjeta](https://trello.com/c/HIkR7UEG)

**Como** estudiante de la carrera, **quiero** registrarme utilizando mi correo institucional de la
facultad (ej. dominio `@frlp`), **para** garantizar que la comunidad sea exclusiva de alumnos
reales y mantener la seguridad del foro.

### [ ] Escenario 1: Registro con correo institucional válido

```
DADO que un estudiante no registrado accede al formulario de registro
Y completa sus datos con un correo de dominio institucional válido (ej. @frlp.utn.edu.ar)
CUANDO envía el formulario de registro
ENTONCES el sistema crea la cuenta en estado pendiente de verificación
Y envía un correo de verificación a la dirección ingresada
```

### [ ] Escenario 2: Verificación de cuenta antes de habilitar acceso

```
DADO que un usuario se registró con un correo institucional válido
Y recibió el correo de verificación
CUANDO hace clic en el enlace de verificación
ENTONCES la cuenta queda habilitada para iniciar sesión
```

### [ ] Escenario 3: Bloqueo de registro con correo externo

```
DADO que un usuario accede al formulario de registro
Y completa sus datos con un correo de dominio no institucional (ej. Gmail, Hotmail)
CUANDO envía el formulario de registro
ENTONCES el sistema rechaza el registro
Y muestra un mensaje indicando que debe usar su correo institucional
```

**Notas de la tarjeta:**

- El 2026-10-10, el Escenario 2 quedó formalmente pospuesto. Aun así, la QA del 2026-10-26 lo
  aprobó.
- El dominio que se exige hoy es `@alu.frlp.utn.edu.ar` (TASK-004).

---

## HU-02: Recuperación de contraseña

[Tarjeta](https://trello.com/c/OxD3UFy9)

**Como** usuario registrado, **quiero** poder restablecer mi contraseña mediante mi correo
institucional, **para** recuperar el acceso a mi cuenta si olvidé mis credenciales.

### [ ] Escenario 1: Solicitar recuperación de contraseña

```
DADO que un usuario registrado olvidó su contraseña
Y se encuentra en la pantalla de login
CUANDO hace clic en "¿Olvidaste tu contraseña?" e ingresa su correo
ENTONCES el sistema envía un token seguro con tiempo de expiración al correo del usuario
```

### [ ] Escenario 2: Restablecer contraseña con token válido

```
DADO que el usuario recibió el token de recuperación
Y el token no expiró
CUANDO ingresa una nueva contraseña que cumple los requisitos mínimos de seguridad
ENTONCES el sistema actualiza la contraseña
Y permite iniciar sesión con la nueva contraseña
```

### [ ] Escenario 3: Rechazo de token expirado o inválido

```
DADO que un usuario intenta restablecer su contraseña
CUANDO el token usado está expirado o es inválido
ENTONCES el sistema rechaza el restablecimiento
Y solicita generar un nuevo pedido de recuperación
```

### [ ] Escenario 4: Solicitud de recuperación con correo no registrado

```
DADO que alguien solicita recuperar contraseña con un correo que no existe en el sistema
CUANDO envía la solicitud
ENTONCES el sistema responde igual que si la cuenta existiera, sin revelar si el correo está registrado
```

**Notas de la tarjeta:**

- El token se entrega como un "link de recuperación". El equipo aprobó esa decisión.
- Opinión de QA: cuando el correo no es del dominio institucional, mostraría "correo no válido".
  Esto entra en tensión con el Escenario 4.

---

## HU-03: Roles mínimos (Estudiante y Administrador)

[Tarjeta](https://trello.com/c/SlEdO98o)

**Como** sistema, **quiero** clasificar a los usuarios en los roles mínimos Estudiante (USER) y
Administrador (ADMIN), **para** restringir o permitir el acceso a las funcionalidades
correspondientes.

### [ ] Escenario 1: Rol asignado al registrarse

```
DADO que un estudiante se registra desde el formulario público
CUANDO la cuenta se crea
ENTONCES queda con el rol Estudiante (USER), sin posibilidad de elegir otro rol
```

### [x] Escenario 2: Acceso del Administrador a la gestión académica

```
DADO que un usuario autenticado tiene el rol Administrador
CUANDO accede al panel de administración (materias, profesores, cursadas, comisiones y listado de usuarios)
ENTONCES puede operar sobre esas funcionalidades
```

### [ ] Escenario 3: Rechazo a un Estudiante en funciones administrativas

```
DADO que un usuario autenticado tiene el rol Estudiante
CUANDO intenta acceder a una funcionalidad administrativa
ENTONCES el sistema rechaza el acceso (403) y no muestra la sección de administración
```

**Notas de la tarjeta:** el DoD está en 0/5 y queda abierto el DoR "Validar con el equipo que el
Escenario 3 (Admin) no incluye moderación en esta iteración". La QA del 2026-10-26 aprobó los
tres escenarios.

**Validación 2026-10-31** (deploy, cuenta admin):

- **E1 sin validar:** hace falta registrar una cuenta de estudiante nueva. No la creo yo, porque es
  un sitio desplegado: la tiene que crear alguien del equipo.
- **E2 cumple.** El admin entra al panel y opera sobre materias, profesores, cursadas, comisiones y
  el listado de usuarios. Se verificó con alta y edición de cada entidad durante la validación de
  HU-11.
- **E3 sin validar:** necesita una sesión de estudiante, para entrar a `/home/admin` y llamar a un
  endpoint de administración esperando un 403.

---

## HU-04: Visualización de la jerarquía académica

[Tarjeta](https://trello.com/c/fmAZCSde)

**Como** estudiante, **quiero** navegar entre Materias, Cursadas y Comisiones, **para** entender
cómo se relacionan y encontrar exactamente la cursada y el turno que busco.

### [ ] Escenario 1: Navegar desde Materia hasta Comisión

```
DADO que un estudiante autenticado está en la vista de Materias
Y la base de datos relaciona Materia → Cursada → Comisión (PostgreSQL/Prisma)
CUANDO selecciona una Materia y luego una Cursada (año, cuatrimestre y profesor a cargo en ese período)
ENTONCES el sistema muestra las Comisiones (turnos) de esa Cursada
```

**Notas de la tarjeta:**

- La QA lo aprobó sin que hubiera comisiones cargadas: verificó solo que aparece el panel. Falta
  validarlo con datos reales.
- DoD pendiente: code review y merge a main.

---

## HU-06: Publicación de feedback con opción de anonimato

[Tarjeta original](https://trello.com/c/6J0ffDle) (en "Cerrado" hay solo un enlace)

**Como** estudiante que cursó una materia, **quiero** dejar una reseña detallada (calificación
numérica y texto libre) pudiendo elegir si quiero publicar de forma anónima o con mi usuario,
**para** aportar valor sin temor a represalias pero protegiendo mi identidad si lo prefiero.

### [ ] Escenario 1: Publicar feedback con nombre visible

```
DADO que un estudiante completó el formulario de feedback (preguntas cerradas/métricas + texto libre)
Y eligió "Publicar con mi nombre"
CUANDO envía el feedback
ENTONCES el comentario se publica mostrando el nombre del autor
```

### [ ] Escenario 2: Publicar feedback de forma anónima

```
DADO que un estudiante completó el formulario de feedback
Y eligió "Publicar como Anónimo"
CUANDO envía el feedback
ENTONCES el comentario se publica sin mostrar el autor a otros estudiantes ni profesores
Y el autor solo queda registrado a nivel de base de datos para control de abusos (múltiples reviews)
```

### [ ] Escenario 3: Reseña duplicada

```
DADO que un estudiante ya publicó una reseña para esa cursada
CUANDO intenta publicar otra
ENTONCES el sistema la rechaza e indica que ya tiene una reseña
```

### [ ] Escenario 4: Datos incompletos o inválidos

```
DADO que un estudiante completa el formulario de reseña
CUANDO falta una métrica obligatoria o el texto supera el límite
ENTONCES el sistema rechaza el envío e indica qué corregir
```

**Notas de la tarjeta:**

- Decisión del 2026-10-10: la reseña se asocia a una Cursada. Según la QA, lo implementado
  trabaja por Comisión.
- Las métricas cerradas y su escala nunca se definieron (DoR abierto), así que los Escenarios 1
  y 4 no se pueden validar tal como están escritos.
- DoD extra: verificar que el autor anónimo también quede oculto en la respuesta de la API, no
  solo en la UI.

---

## HU-10: Inicio y cierre de sesión, renovación y cambio de contraseña

[Tarjeta](https://trello.com/c/rF6YXoBX)

**Como** usuario registrado, **quiero** iniciar sesión, cerrar sesión, renovar mi sesión y
cambiar mi contraseña estando autenticado, **para** acceder de forma segura a la plataforma y
mantener el control de mi cuenta.

### [ ] Escenario 1: Inicio de sesión exitoso

```
DADO que un usuario está registrado (según lo que determine HU-01)
CUANDO ingresa su correo y contraseña correctos
ENTONCES el sistema genera una sesión (JWT access + refresh) y lo autentica
```

### [ ] Escenario 2: Cierre de sesión

```
DADO que un usuario tiene una sesión activa
CUANDO cierra sesión
ENTONCES el sistema revoca el refresh token de esa sesión (sessionId)
```

### [ ] Escenario 3: Renovación de sesión

```
DADO que el access token de un usuario expiró pero su refresh token sigue vigente
CUANDO el cliente solicita renovación
ENTONCES el sistema emite un nuevo access token sin requerir login nuevamente
```

### [ ] Escenario 4: Cambio de contraseña autenticado

```
DADO que un usuario autenticado quiere cambiar su contraseña
CUANDO ingresa su contraseña actual y una nueva que cumple los requisitos mínimos
ENTONCES el sistema actualiza la contraseña
```

**Notas de la tarjeta:** DoD pendiente: code review y merge a main.

---

## HU-11: Administración de materias, profesores, cursadas y comisiones (CRUD)

[Tarjeta](https://trello.com/c/RPTHzZ6t)

**Como** administrador de la plataforma, **quiero** crear, editar, listar o eliminar materias,
profesores, cursadas y comisiones, y consultar el listado de usuarios, **para** mantener
actualizada la información académica que consulta el resto de la plataforma.

### [x] Escenario 1: Alta, edición y listado de materias (ADM-01)

```
DADO que un administrador autenticado accede al panel de administración
CUANDO crea, edita o lista una materia
ENTONCES el sistema refleja el cambio, sin eliminar entidades existentes (fuera de alcance en esta iteración)
```

### [!] Escenario 2: Profesores y cursadas (ADM-03, ADM-04)

```
DADO que un administrador autenticado accede al panel de administración
CUANDO crea, edita o lista un profesor, o da de alta o edita una cursada (materia + año + cuatrimestre + profesor a cargo)
ENTONCES el sistema refleja el cambio
Y la cursada queda asociada al profesor que la dictó en ese período
```

### [x] Escenario 3: Listado de usuarios (ADM-05)

```
DADO que un administrador autenticado accede al panel de administración
CUANDO consulta el listado de usuarios
ENTONCES el sistema muestra los usuarios registrados en forma paginada, sin funciones de gestión de roles en esta iteración
```

### [~] Escenario 4: Alta y edición de comisiones (ADM-06)

```
DADO que un administrador autenticado accede al panel de administración
Y existe la cursada a la que pertenece la comisión
CUANDO crea o edita una comisión dentro de esa cursada
ENTONCES el sistema refleja el cambio
Y la comisión queda disponible en la navegación de la jerarquía académica (HU-04)
```

**Notas de la tarjeta:**

- QA (2026-10-28) no encontró cómo asociar un profesor a una cursada: hoy el profesor se asigna
  a la comisión. Eso afecta al Escenario 2.
- Faltan pruebas de la paginación de usuarios con más registros, del acceso sin sesión y tests de
  backend.
- El enunciado dice "eliminar", pero la eliminación quedó fuera de alcance en esta iteración.

**Validación 2026-10-31** (deploy `profesor-butchery-frontend.vercel.app`, cuenta admin):

- **E1 cumple.** Se creó "QA-PRUEBA Materia" con modalidad, carrera y año. Se editó a "QA-PRUEBA
  Materia Editada" y se reflejó en el listado (paginado, filtros por nombre, carrera y año) y en el
  detalle, que además muestra auditoría de alta y modificación.
- **E2 no cumple.** El alta y la edición de profesor funcionan, y también el alta y la edición de
  cursada (año y período). Pero el formulario de cursada no tiene campo de profesor: el profesor se
  asigna a la comisión ("Gestionar equipo docente", con cargo Titular, Adjunto o JTP). El listado
  de cursadas muestra la cantidad de profesores sumando los de sus comisiones. Falta decidir si se
  acepta ese modelo o si se implementa la asociación directa (ver pendientes). Además, la cursada
  aceptó un período que no coincide con la modalidad de la materia (ver bugs).
- **E3 cumple.** El listado muestra 6 usuarios, con búsqueda y filtros por rol y estado. No hay
  gestión de roles ni en el listado ni en el detalle. La paginación no se pudo probar con más de una
  página porque hay solo 6 registros; usa el mismo componente que materias y profesores, que sí
  paginan bien. Hay una acción extra fuera del CA: "Desactivar usuario".
- **E4 cumple en parte.** La comisión S-998 se creó dentro de la cursada, se editó a S-997 y se le
  asignó un profesor. No se pudo verificar que quede visible en la jerarquía académica de HU-04,
  porque la cuenta admin siempre redirige a `/home/admin`. Queda pendiente verificarlo con una
  cuenta de estudiante.

---

## HU-12: Filtrar y ordenar materias por año de la carrera

[Tarjeta original](https://trello.com/c/2rjm3cmP) (en "Cerrado" hay solo un enlace)

**Como** estudiante, **quiero** filtrar y ordenar las materias por año de la carrera, **para**
encontrar rápido las de mi año.

### [ ] Escenario 1: Listado ordenado por año de la carrera

```
DADO que un estudiante autenticado está en la vista de Materias
CUANDO se carga el listado
ENTONCES las materias aparecen agrupadas y ordenadas por año de la carrera (1.º a 5.º) y, dentro de cada año, por nombre
```

### [ ] Escenario 2: Filtrar por un año de la carrera

```
DADO que un estudiante autenticado está en la vista de Materias
CUANDO elige un año de la carrera
ENTONCES solo ve las materias de ese año
Y el filtro se conserva al volver desde el detalle de una materia
```

### [x] Escenario 3: Carga del año por el administrador

```
DADO que un administrador da de alta o edita una materia
CUANDO indica el año de la carrera
ENTONCES el sistema exige un valor entre 1 y 5 (o "Electiva")
```

**Notas de la tarjeta:**

- Se decidió asignar las electivas a un nivel (3.º, 4.º y 5.º) en vez de usar un valor
  "Electiva" suelto. Eso se contradice con el texto del Escenario 3.
- QA (2026-10-30) aprobó todo con el seed académico cargado.
- DoD pendiente: code review y merge a main.

**Validación 2026-10-31** (deploy, cuenta admin):

- **E1 y E2 sin validar:** son de estudiante. QA ya los aprobó el 2026-10-30 en local.
- **E3 cumple.** En la edición de materia, guardar sin año muestra "Elegí un año entre 1 y 5 o
  Electiva." y no guarda. Al elegir "Electiva" aparece "Nivel de electiva" (3.º, 4.º o 5.º), que
  también es obligatorio. Se guardó como "Electiva · 4.º Nivel" y así aparece en el detalle. El
  backend valida lo mismo con zod (`back/src/academic/application/materia-input.ts:9-10`), así que
  la regla no depende solo del formulario.
- Sugerencia de texto: el CA dice "entre 1 y 5 (o 'Electiva')", pero lo implementado pide además el
  nivel 3, 4 o 5 para las electivas, según la decisión de la tarjeta. Conviene actualizar el
  escenario.
- Bug visual menor: al cambiar a un valor válido, el mensaje de error queda en pantalla hasta el
  siguiente envío (ver BUG-03).
