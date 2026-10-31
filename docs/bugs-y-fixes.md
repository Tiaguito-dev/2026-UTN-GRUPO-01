# Bugs y fixes — validación de CA

Comportamientos implementados que fallan o que hay que corregir, detectados al validar los
criterios de aceptación de [validacion-ca-hu.md](./validacion-ca-hu.md). Lo que directamente no
existe va en [pendientes-implementacion.md](./pendientes-implementacion.md).

Entorno: `https://profesor-butchery-frontend.vercel.app`, cuenta admin, 2026-10-31.

## Bloques de arreglo

Cada bloque agrupa los bugs que tocan el mismo código y se pueden resolver y probar juntos.

| Orden | Bloque | Bugs | Capa | ¿Requiere decisión? |
|---|---|---|---|---|
| 1 | A — Formularios y navegación del panel | BUG-02, BUG-03 | front | No |
| 2 | B — Unicidad de nombres y limpieza | DATA-01 | back (migración) + datos | No |
| 3 | C — Cursada coherente con la materia | BUG-01 (+ PEND-01) | back + front | **Sí** |

- **A va primero:** son fixes chicos que no cambian el modelo de datos ni dependen de ninguna
  decisión.
- **B después:** suma una migración. Antes hay que fusionar o renombrar los duplicados, porque si
  no el índice nuevo falla al crearse.
- **C al final:** BUG-01 y PEND-01 tocan el mismo formulario y el mismo caso de uso (alta y edición
  de cursada). Conviene resolverlos juntos una vez que el equipo decida el modelo, para no editar
  dos veces la misma pantalla.

### Cómo se valida cada bloque (agente validador con Claude in Chrome)

Mismo procedimiento que la validación del 2026-10-31:

1. Cargar las herramientas de Chrome y abrir **una pestaña nueva** en
   `https://profesor-butchery-frontend.vercel.app` (o en el entorno local si el fix todavía no
   está desplegado).
2. **El login lo hace el desarrollador a mano** en esa pestaña. El agente no escribe contraseñas
   en un sitio desplegado.
3. El agente usa `read_page` (filtro `interactive`) o `find` para obtener las referencias,
   `form_input` para completar campos, clics por referencia y `get_page_text` para leer
   resultados y mensajes. Saca una captura cuando un resultado es visual (errores, bordes).
4. Todos los datos que cree llevan el prefijo `QA-PRUEBA`. Anota los IDs que aparecen en la URL
   para limpiarlos después por SQL.
5. No toca botones de "Dar de baja": abren un cuadro de confirmación del navegador que traba la
   extensión.
6. Registra el resultado de cada caso (pasa / falla, con evidencia) en este documento, debajo del
   bug correspondiente.

---

## Bloque A — Formularios y navegación del panel (front)

### BUG-02 — El parámetro `returnTo` crece con cada navegación

- **Severidad:** baja.
- **Pasos:** navegar Materia → Cursadas → Cursada → Comisiones → Comisión → Editar.
- **Actual:** cada enlace vuelve a codificar el `returnTo` anterior dentro del nuevo
  (`%25252F...`). En la pantalla de una comisión, el link "Editar comisión" ya supera los 600
  caracteres. Con más niveles se puede pasar del límite de longitud de URL, y además vuelve
  ilegibles los enlaces compartidos.
- **Dónde mirar:** `front/src/lib/navigation.ts`, `front/src/validations/admin-academic-navigation.ts`
  y `front/src/components/admin/useAdminCommissionOrigin.ts`.
- **Fix sugerido:** que `returnTo` guarde solo la ruta del nivel anterior, sin anidar el `returnTo`
  que ya traía la URL. Si hace falta volver varios niveles, que la ruta de cada nivel se derive de
  los IDs (`materiaId`, `cursadaId`) y no de una cadena de `returnTo`.
- **Estado (2026-10-31):** corregido en código. Faltan la prueba manual y los casos A1–A3 con
  Chrome.
- **Resultado de las pruebas automáticas:** typecheck, lint, test (752 pruebas) y build del front
  aprobados. `admin-academic-navigation.spec.ts` recorre la cadena completa y verifica:
  - ningún link tiene `returnTo` dentro de otro (sin `%25`);
  - "Editar comisión" mide menos de 300 caracteres;
  - el breadcrumb sale de los IDs, y "Materias" conserva los filtros;
  - "Volver" lleva al nivel anterior con su página;
  - un link viejo anidado degrada al recorrido por IDs.

  Contra el código anterior, el spec actualizado falla en 21 casos (el link de edición llegaba a
  `%25252525…`).
- **Nota para A1:** `%25` todavía puede aparecer una vez si la búsqueda de Materias tiene
  acentos (`q=María`), porque ese texto ya viene codificado dentro de `materiaReturnTo`. No es
  anidamiento y no crece entre niveles.

### BUG-03 — El error de "Año de la carrera" no se limpia al corregir el valor

- **Severidad:** baja (UX).
- **Pasos:** en "Editar materia", dejar "Año de la carrera" vacío y guardar. Después elegir
  "Electiva" (o cualquier año).
- **Esperado:** el mensaje "Elegí un año entre 1 y 5 o Electiva." desaparece en cuanto el valor es
  válido.
- **Actual:** el mensaje y el borde rojo siguen en pantalla hasta el siguiente "Guardar cambios".
- **Dónde mirar:** `front/src/components/admin/MateriaForm.tsx`.
- **Fix sugerido:** limpiar el error del campo en su `onChange`. Revisar si el mismo patrón se
  repite en los otros formularios del panel (nivel de electiva, cursada, comisión, profesor) y
  corregirlo en el componente compartido, si existe, en vez de campo por campo.
- **Estado (2026-10-31):** corregido en código. Faltan la prueba manual y los casos A4–A6 con
  Chrome.
- **Resultado de las pruebas automáticas:** después de `npm ci`, los cuatro chequeos del front
  (typecheck, lint, test y build) aprobados. Hay casos nuevos en `use-form-submission.spec.tsx`,
  `admin-materia-form.spec.tsx` y `alta-form.spec.tsx`: enviar vacío, corregir el campo, y
  comprobar que desaparecen el error y el `aria-invalid`.

### Pruebas con Chrome — Bloque A

| Caso | Pasos | Resultado esperado |
|---|---|---|
| A1 | Admin → Materias → materia QA-PRUEBA → Ver cursadas → cursada → Ver comisiones → comisión. Con `find`, leer el `href` de "Editar comisión" y de "Volver". | Ningún `href` contiene `%2525` (doble codificación). Su longitud no crece entre niveles: la diferencia es solo el segmento del nivel nuevo. |
| A2 | Desde la comisión: Editar → Guardar cambios → "Volver" repetidas veces. | Cada "Volver" lleva al nivel anterior correcto (comisión → comisiones → cursada → cursadas → materia → materias), sin saltear niveles ni volver al inicio. |
| A3 | Repetir A1 entrando por Inicio del panel → "Nueva comisión" (otro origen). | Mismo resultado que A1. "Volver" respeta el origen. |
| A4 | Editar materia QA-PRUEBA → "Año de la carrera" = "Elegí una opción" → Guardar. Captura. Después elegir "3.º año" **sin guardar**. Captura. | Primera captura: error visible. Segunda: el error y el borde rojo desaparecen al cambiar el valor. |
| A5 | Igual que A4, pero eligiendo "Electiva" → guardar sin nivel → elegir "4.º Nivel" sin guardar. | El error de nivel desaparece al elegir un nivel válido. |
| A6 | Repetir el patrón de A4 en Nueva cursada (año vacío) y en Nueva comisión (número vacío). | Mismo comportamiento: el error se limpia al corregir. |

---

## Bloque B — Unicidad de nombres y limpieza (back + datos)

### DATA-01 — Nombres casi duplicados que la unicidad no detecta

- **Severidad:** baja.
- **Estado de la limpieza:** la materia "QA HU11 editada", su cursada y su comisión S-33, y los
  datos `QA-PRUEBA` del 2026-10-31 **ya se borraron por SQL** (2026-10-31).
- **Pendiente:**
  - "Diseño de sistemas de informacion" (sin la tilde de "información") convive con "Diseño de
    Sistemas de Información (Integradora)". Hay que confirmar si son la misma materia.
  - "Daniel Ocampo" convive con "Daniel Ocampo (Demo)".
- **Causa probable:** el índice único de materia es
  `"Materia_nombre_activa_key" ON "Materia" ("nombre") WHERE "deletedAt" IS NULL`
  (`back/prisma/migrations/20261105000000_administracion_estados_historial/migration.sql:21`).
  Compara el texto exacto, así que "Diseño de Sistemas" y "diseño de sistemas" o "informacion" e
  "información" no chocan. La búsqueda sí normaliza mayúsculas y tildes
  (`prisma-materia.repository.ts:18`), así que el criterio de búsqueda y el de unicidad no
  coinciden. Profesor no tiene índice único de nombre.
- **Fix sugerido:**
  1. Decidir los duplicados y fusionarlos o renombrarlos por SQL. Si alguno tiene cursadas o
     reseñas, reasignarlas antes.
  2. Migración: reemplazar el índice por uno funcional que normalice igual que la búsqueda (por
     ejemplo `lower(unaccent(nombre))`, o la misma expresión `translate(normalize(...))` del
     repositorio), filtrado por `deletedAt IS NULL`.
  3. Que el back traduzca la violación del índice al mismo mensaje de "nombre repetido" que ya usa.
  4. Profesores: si el equipo quiere el mismo criterio, aplicar la misma unicidad. Ojo: dos docentes
     pueden llamarse igual, así que esto requiere decisión.

### Pruebas con Chrome — Bloque B

| Caso | Pasos | Resultado esperado |
|---|---|---|
| B1 | Crear materia "QA-PRUEBA Unicidad". Después intentar crear "qa-prueba unicidad" (minúsculas). | La segunda se rechaza con el mensaje de nombre repetido, sin error genérico ni 500. |
| B2 | Intentar crear "QA-PRUEBA Únicidad" (con tilde de más). | Se rechaza igual que B1. |
| B3 | Editar otra materia QA-PRUEBA y ponerle "QA-PRUEBA UNICIDAD". | Se rechaza en la edición, no solo en el alta. |
| B4 | En Materias, buscar "diseño de sistemas". | Aparece una sola materia: los duplicados ya están resueltos. |
| B5 | Con `read_network_requests` (`urlPattern` del back), revisar la respuesta del intento de B1. | El back responde 409 (o 400) con mensaje claro, no 500. |

---

## Bloque C — Cursada coherente con la materia (back + front) — requiere decisión

### BUG-01 — La cursada acepta un período distinto de la modalidad de la materia

- **Severidad:** media.
- **Pasos:**
  1. Crear una materia con modalidad "Cuatrimestral · 1.er cuatrimestre".
  2. En sus cursadas, crear una cursada con período "2do cuatrimestre".
- **Esperado:** el sistema rechaza el período o solo ofrece el que corresponde a la modalidad de la
  materia.
- **Actual:** la cursada se crea igual ("2do cuatrimestre 2026") y la materia sigue diciendo
  "Primer cuatrimestre". También se ofrece "Anual" para una materia cuatrimestral.
- **Evidencia en código:** `back/src/academic/application/crear-cursada-input.ts` valida el año
  (2000 al año actual + 1) y que el período sea uno de los permitidos, pero no lo compara con la
  modalidad de la materia. `actualizar-cursada.ts` tampoco.
- **Decisión pendiente:** si la modalidad de la materia restringe el período de la cursada. Puede
  que no: una materia cambia de cuatrimestre entre planes, o se dicta en los dos. Si no lo
  restringe, la modalidad de la materia pierde sentido como dato y conviene revisar si hace falta.
- **Por qué va con PEND-01:** PEND-01 (agregar "profesor a cargo" a la cursada, o reescribir el CA)
  modifica el mismo formulario de cursada y los mismos casos de uso `crear-cursada` y
  `actualizar-cursada`. Resolver los dos juntos evita tocar esa pantalla dos veces.
- **Fix sugerido** (si la modalidad restringe):
  1. Back: en crear y actualizar cursada, cargar la materia y rechazar un período incompatible
     (materia ANUAL → solo ANUAL; materia PRIMERO o SEGUNDO → solo ese cuatrimestre), con un
     mensaje claro.
  2. Front: preseleccionar y limitar las opciones de período según la modalidad de la materia
     elegida.
  3. Datos: antes de desplegar, listar las cursadas incompatibles que ya existen y decidir qué
     hacer con ellas. La validación nueva no debería romper la edición de esos registros.

### Pruebas con Chrome — Bloque C

| Caso | Pasos | Resultado esperado |
|---|---|---|
| C1 | Crear materia QA-PRUEBA con modalidad "1.er cuatrimestre" → Ver cursadas → Nueva cursada. Leer las opciones de "Período" con `read_page`. | Solo se ofrece (o viene preseleccionado) "1er cuatrimestre". |
| C2 | Forzar el período incompatible: con `javascript_tool`, agregar la opción "SEGUNDO" al select, elegirla y enviar. | El back rechaza con mensaje claro. La cursada no aparece en el listado. |
| C3 | Materia "Anual" → Nueva cursada. | Solo se ofrece "Anual". |
| C4 | Editar la materia QA-PRUEBA de C1 a "2.º cuatrimestre" y abrir la cursada creada antes. | El comportamiento sigue la decisión tomada: avisa de la incoherencia o bloquea la edición. Nunca muestra un error genérico. |
| C5 | Si se implementa PEND-01: Nueva cursada con "Profesor a cargo" → guardar → abrir el detalle. | El detalle muestra el profesor a cargo. Lo mismo al editar. |
