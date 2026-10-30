# TASK-020: Frontend — panel de administración del catálogo académico (HU-11, etapa 2)

Estado: Implementado y verificado contra el stack Docker real; validación manual del equipo
pendiente.
Fecha: 2026-10-10

## 1. Contexto y objetivo

`TASK-019` cerró el backend de las altas administrativas (materia, profesor, cursada, comisión)
y el listado de usuarios, verificado contra la base real, y dejó el frontend explícitamente
fuera de alcance ("es la etapa 2, tarea aparte"). Esta es esa etapa: las pantallas para que un
`ADMIN` cargue la jerarquía académica desde la aplicación en vez de editar el seed.

Endpoints ya disponibles (todos exigen sesión; los administrativos además rol `ADMIN`, con 403
para un `USER`):

```
POST /materias     { nombre }                                    -> 201 Materia
POST /profesores   { nombreCompleto }                            -> 201 Profesor
POST /cursadas     { materiaId, profesorId, anio, cuatrimestre } -> 201 Cursada
POST /comisiones   { cursadaId, nombre }                         -> 201 Comision
GET  /profesores?page&pageSize                                   -> PaginatedResult<Profesor>
GET  /users?page&pageSize                                        -> PaginatedResult<PublicUser>
```

## 2. Alcance

- Sección "Administración" en el menú lateral, visible solo para `ADMIN`.
- Rutas bajo `/home/admin/**`: índice del panel, 4 formularios de alta y listado de usuarios.
- `front/src/services/academic.ts`: las 4 altas y `listarProfesores`; `services/users.ts` nuevo.
- `AuthService.protectedPost` para las escrituras protegidas.
- Validación local espejo de la del backend, previa al envío.

## 3. Fuera de alcance

- Cualquier archivo de `back/`.
- Edición y baja de entidades (etapas posteriores de HU-11).
- Gestión de roles desde el panel: `/home/admin/usuarios` es solo consulta.
- Tests — a cargo del agente de Testing (`.agents/test.md`); este agente solo corre la suite
  existente para confirmar que no se rompe.
- Dependencias nuevas.

## 4. Decisiones de diseño

1. **Una pantalla por entidad, con un índice en `/home/admin`** (en vez de un único formulario
   con pestañas o un acordeón). Cada alta tiene campos y dependencias distintas —comisión
   necesita elegir materia antes de ver cursadas— y así cada una es una URL propia, con su
   `metadata.title`, enlazable y recargable, igual que el drill-down de lectura de TASK-018. El
   índice además ordena el recorrido: materia → profesor → cursada → comisión.
2. **El ítem del menú se muestra solo con la sesión ya confirmada**
   (`status === "authenticated" && account.role === "ADMIN"`): `SYSTEM_SECTIONS` gana un campo
   opcional `role` y `SidebarNav` filtra. Oculto por defecto, nunca aparece y desaparece.
3. **El guard de rol vive en `app/home/admin/layout.tsx`**, no en cada página: un solo
   `RequireAuth roles={["ADMIN"]}` cubre todo el subárbol, así escribir la URL a mano tampoco
   alcanza. El `<main>`, el sidebar y el guard de sesión siguen viniendo de `app/home/layout.tsx`.
4. **`AuthService.protectedPost` en vez de llamar a `requestJson` directo.** Un 401 en estos
   endpoints lo genera el guard de autenticación antes del handler, así que la escritura no se
   ejecutó y reintentarla una vez después del refresh no puede duplicar un alta. Cualquier otro
   fallo (409, 404, 400, red) se devuelve sin reintentar. Es la misma garantía que ya documenta
   `changePassword`; sin esto, un formulario abierto un rato fallaba con "la sesión terminó".
5. **Un `AltaForm` compartido por las 4 altas**, configurado con descriptores de campo. El
   recorrido es idéntico en las cuatro (validar local, foco al primer campo inválido, conservar
   lo escrito en el error, bloquear el botón durante el envío, mostrar el mensaje del backend) y
   es el mismo que ya usa `AccountForm`: campos no controlados leídos con `FormData`. Lo único
   que cambia por entidad son los campos y el `onSubmit`.
6. **Los selects se pueblan trayendo el listado completo** (`useAllPages`, páginas de 100 hasta
   un tope de 2000 ítems): el backend pagina todo y un `<select>` necesita todas las opciones de
   una. Con catálogos más grandes haría falta un endpoint de búsqueda por texto, no un select.
7. **En el alta de comisión la materia es un filtro, no un campo del alta**: el backend lista
   cursadas por materia (`GET /materias/:id/cursadas`), así que elegir materia es el único camino
   para llegar a una cursada. Al cambiar de materia el navegador deshace la selección de cursada
   (la opción deja de existir) y, por las dudas, la validación exige que la cursada elegida
   pertenezca a la materia visible.
8. **Validación local espejo de la del backend** (`validations/academic.ts`: trim, no vacío,
   máximos de 150/100 puntos de código, sin caracteres de control, año entre 2000 y el año
   siguiente). Avisa antes de gastar un viaje al servidor; el backend sigue siendo la autoridad y
   su mensaje es el que se muestra cuando rechaza.
9. **`services/pagination.ts`**: `PaginatedResult`, `PaginationInput` y `toQuery` salen de
   `academic.ts` para que `users.ts` no duplique el armado de query string. `academic.ts`
   reexporta los tipos, así no cambia ningún import existente.

## 5. Criterios de aceptación

- Un `ADMIN` ve "Administración" en el menú y puede dar de alta materia, profesor, cursada y
  comisión; lo creado aparece en el drill-down de lectura.
- Un `USER` no ve el ítem del menú y, entrando por URL, recibe "Acceso no permitido" sin ver el
  panel ni los formularios.
- Un duplicado muestra el mensaje del backend sin romper la pantalla y conservando lo escrito.
- Cada formulario avisa de los errores de entrada antes de enviar, con foco en el primer campo
  inválido, y no permite un doble envío.
- `npm run typecheck --workspace=front` y `npm run test --workspace=front` sin romper nada.

## 6. Validación

`npm run typecheck --workspace=front`: limpio.
`npm run test --workspace=front`: 75/75 (4 archivos), sin cambios en la suite existente.

Recorrido real en el navegador (Chromium sobre el stack Docker, `http://localhost:8080`, imagen
de frontend reconstruida):

- ADMIN: ítem "Administración" visible en el menú; el panel lista los 5 accesos.
- Alta de materia vacía: error junto al campo y foco en el campo, sin llamar al backend.
- Alta de materia real: confirmación y formulario limpio. Repetir el mismo nombre: "Ya existe una
  materia con ese nombre." en la pantalla, conservando lo escrito.
- Alta de profesor y de cursada (año 3000 rechazado localmente con el rango 2000–2027; alta
  efectiva con 2026, 2do cuatrimestre).
- Alta de comisión: sin materia elegida, aviso y botón deshabilitado; con materia y cursada
  elegidas, alta efectiva; repetirla devuelve "Ya existe una comisión con ese nombre en esa
  cursada.".
- Drill-down de lectura: la materia, la cursada (con su profesor) y la comisión nuevas aparecen
  en `/home/materias` → cursada → comisiones.
- `/home/admin/usuarios`: lista las cuentas con su rol y la fecha de alta.
- USER descartable (`@alu.frlp.utn.edu.ar`): sin ítem "Administración" en el menú; `/home/admin` y
  `/home/admin/materias/nueva` por URL directa muestran "Acceso no permitido" y ningún contenido
  del panel.

Los datos de prueba (2 materias, 2 profesores, 1 cursada, 1 comisión y la cuenta descartable) se
borraron al terminar: el seed de demo quedó en 3 materias, 4 profesores, 5 cursadas, 8 comisiones
y 2 usuarios.

## 7. Limitaciones conocidas

- La pantalla de "Acceso no permitido" de `RequireAuth` usa `<h2>` y no aporta un `<h1>`: es
  marcado preexistente del componente compartido, no se tocó en esta tarea.
- Los selects dejan de servir si el catálogo supera los 2000 ítems (ver decisión 6).
