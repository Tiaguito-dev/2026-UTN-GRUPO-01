# Administración

Estado: sincronizado con las decisiones del 2026-10-10. Cubre HU-11 — gestión académica mínima y
acceso administrativo de esta iteración.

## Sincronización con el modelo real (2026-10-10)

Este documento se escribió contra un modelo que ya no existe. Qué cambió:

- **ADM-02 (Cátedras) se elimina.** `Cátedra` se fusionó dentro de `Materia`: en la práctica de
  esta facultad no hay más de una cátedra por materia, así que separarlas era una capa sin
  beneficio. El código ADM-02 queda retirado y no se reutiliza, para no confundir referencias
  viejas.
- **ADM-04 cambia de significado, no solo de nombre.** Era "asignar un Profesor a una Cátedra"
  (`ProfessorChair`, una relación atemporal). Ahora es **dar de alta una Cursada**: materia +
  año + cuatrimestre + el profesor que la dictó *ese* período. El cambio existe para que una
  reseña futura quede atada al profesor que realmente dictó, y no al que figure hoy
  (ver `03-modelo-de-dominio.md`).
- **ADM-06 es nuevo**: administración de Comisiones, que este documento antes dejaba fuera.
- La numeración conserva los códigos originales de los requisitos que sobreviven; el salto en
  ADM-02 es deliberado.

## Requisitos

| Código | Requisito | Escenario (HU-11) |
| --- | --- | --- |
| ADM-01 | Alta, edición y listado de Materias. | Escenario 1 |
| ADM-03 | Alta, edición y listado de Profesores. | Escenario 2 |
| ADM-04 | Alta y edición de Cursadas: materia + año + cuatrimestre + profesor a cargo. | Escenario 2 |
| ADM-05 | Listado **paginado** de usuarios registrados, sin funciones de gestión de roles. | Escenario 3 |
| ADM-06 | Alta y edición de Comisiones dentro de una Cursada. | **Sin escenario en la HU todavía** |

**ADM-06 no tiene escenario en HU-11.** La historia en Trello se escribió cuando `Commission`
estaba fuera de alcance; si se implementa este requisito, hay que agregarle el escenario
correspondiente a la HU antes de darla por lista.

Por qué entra ADM-06: Comisión es el nivel final del drill-down que ya funciona en producción de
hecho. Sin alta desde el panel, agregar una comisión real exige editar el script de seed y
redesplegar — es trabajo de desarrollo, no de administración, y deja la jerarquía a medias.

## Fuera de alcance explícito

- **Eliminación de cualquier entidad.** Esta iteración solo agrega y edita, nunca borra —
  decisión confirmada el 2026-10-10. El campo `deletedAt` ya existe en las 4 entidades
  (`docs/standards/soft-delete.md`) pero ningún caso de uso lo usa todavía.
  Límite conocido que hay que resolver *antes* de habilitar la baja: los índices únicos
  (`Materia.nombre`, `Comision` por `(cursadaId, nombre)`) **no son parciales**, así que una
  entidad dada de baja seguiría bloqueando su nombre. Habilitar el borrado exige primero una
  migración que los convierta a `WHERE deletedAt IS NULL`.
- Gestión de roles de usuario desde el panel (promover/degradar, suspender cuentas). El listado
  de ADM-05 es de solo consulta.

## Dónde vive esta responsabilidad

Según `01-arquitectura-y-tecnologias.md`, la administración es una vista de la interfaz, pero las
operaciones pertenecen al módulo `academic` (ADM-01, ADM-03, ADM-04, ADM-06) y a `users`
(ADM-05) — no se crea un módulo `admin` separado con lógica propia. Un administrador ejecuta las
mismas operaciones de dominio que cualquier otro caso de uso; lo único que cambia es el guard que
exige el rol `ADMIN`.

## Acceso

El acceso al panel requiere rol `ADMIN`. La provisión de administradores ya está resuelta
(comando `auth:provision-admin`, sin endpoint público); este documento no agrega una forma nueva
de volverse administrador.

Dato relevante: `RolesGuard` y el decorador `@Roles` **ya existen, están cableados y exportados
desde `auth.module.ts`, pero hoy ningún endpoint los usa** — una auditoría los marcó como código
muerto a la espera de su primer consumidor. HU-11 es ese consumidor: no hay que construir el
mecanismo de autorización, solo aplicarlo.

## Estándares que aplican

Este módulo nace con las convenciones ya vigentes del proyecto, no inventa las suyas:

- [Validación con Zod](../standards/validacion-con-zod.md) — HU-11 trae los primeros `POST`/`PATCH`
  de `academic`, así que es donde la validación de entrada realmente entra en juego.
- [Catálogo de errores](../standards/catalogo-de-errores.md) — los errores nuevos (nombre
  duplicado, entidad inexistente) extienden `DomainError`; ningún controlador lleva `try/catch`.
- [Paginación](../standards/paginacion.md) — todo listado nuevo devuelve `PaginatedResult`,
  incluido ADM-05.
- [Arquitectura de capas](../standards/arquitectura-de-capas.md) — `domain/` sin imports, puertos
  en `application/ports/`.

## Qué falta construir

**Backend `academic`** (hoy solo tiene lectura, ver `TASK-014`):

- Puertos de escritura en `application/ports/` para Materia, Profesor, Cursada y Comisión.
- Casos de uso: crear y editar de cada una. El alta de Cursada valida que la materia y el
  profesor existan; el alta de Comisión, que la cursada exista.
- Validadores Zod de entrada (`CrearMateriaInput`, etc.) en `application/`.
- Errores de dominio nuevos: nombre de materia duplicado, cursada ya registrada para ese
  período, comisión duplicada dentro de la cursada → todos con su `httpStatus` (409).
- Adaptadores Prisma que traduzcan el `P2002` de las restricciones únicas al error de dominio
  correspondiente, mismo patrón que ya usa `users` con `EmailAlreadyRegisteredError`.
- Controller con `AuthenticationGuard` + `RolesGuard` y `@Roles("ADMIN")`.

**Backend `users`**:

- `UserRepository.findAll(pagination)` — hoy el puerto solo tiene `findById`, `findByEmail` y
  `create`.
- Caso de uso `ListarUsuarios` y su endpoint, también con `@Roles("ADMIN")`.

**Frontend**:

- Pantallas de administración con formularios: el primer trabajo de escritura del front sobre
  `academic`. `RequireAuth` ya acepta restringir por rol, así que esa parte está resuelta.
- Decisión pendiente de diseño: dónde viven esas pantallas y si el panel aparece como una
  sección más del sidebar visible solo para `ADMIN`.

**Tests**: unitarios de casos de uso con repositorios en memoria, y de integración HTTP
verificando que un `USER` recibe 403 en cada endpoint administrativo — ese rechazo es justamente
lo que `01-arquitectura-y-tecnologias.md` pide comprobar por HTTP.

## Preguntas abiertas

1. ~~¿ADM-05 necesita paginación?~~ **Resuelto (2026-10-10): sí**, paginado, por consistencia con
   el estándar del proyecto.
2. ~~¿La administración de Comisiones entra en esta pantalla o se evalúa por separado?~~
   **Resuelto (2026-10-10): entra** como ADM-06.
3. ~~¿Ubicación de las pantallas de administración en el frontend?~~ **Resuelto (2026-10-10)**:
   una sección más del sidebar, visible únicamente para cuentas con rol `ADMIN`. El sidebar ya es
   una lista de rutas (`front/src/components/home/SidebarNav.tsx`), así que es un ítem más
   renderizado condicionalmente según el rol de la sesión.
4. ~~Agregar a HU-11 en Trello el escenario que cubra ADM-06~~ — **delegado al PO el 2026-10-10**.
