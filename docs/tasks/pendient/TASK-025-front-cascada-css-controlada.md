# TASK-025: Cascada CSS controlada en el frontend (capas, archivos por área y estilos base mínimos)

Estado: Pendiente. Decisiones 1 a 4 propuestas, a confirmar por el desarrollador antes de mover
la tarea a `in-progress/`. Depende de TASK-023 y TASK-024.
Fecha: 2026-10-21

## 1. Contexto y objetivo

Todo el CSS del frontend vive en `front/src/app/globals.css`, que tiene 188 líneas. Varios
selectores de elemento cargan estilos que en realidad son de un componente, y el resto de la app
los deshace con reglas más específicas. Inventario sobre `desarrollo` (`253c650`):

| Selector global | Pensado para | Quién lo deshace o lo hereda sin querer |
|---|---|---|
| `nav, .actions { display:flex… }` y `nav a { color: muted; font-weight:600; text-decoration:none… }` (líneas 18-19) | Header | Hereda: `Breadcrumb` (los enlaces se ven grises, sin subrayado y con peso 600, como el menú del header). Deshace: `.system-sidebar nav` (l. 34). |
| `button { …botón primario… }` (l. 112-114) | Botón primario | Deshacen: `.carousel-arrow`, `.carousel-dot`, `.account-menu-trigger`, `.account-menu-action`, `.system-sidebar button`. |
| `main { width…; padding-block: 4rem }` (l. 98) | Páginas públicas | Deshacen: `.system-main` (l. 30) y `.landing` (l. 128). |
| `h1 { text-align: center }` (l. 101) | Auth y perfil | Deshace: `.system-content h1` (l. 43). |
| `dl { background; padding… }` (l. 123) | Ninguno | Deshace: `.profile-details` (l. 88), que es el único `<dl>` de la app. |
| `button:disabled { cursor: wait }` (l. 114) | Envío en curso | Hereda: "Anterior" y "Siguiente" de la paginación en sus límites, y el envío bloqueado de las altas. Muestran reloj de espera sin estar cargando. |

Además, los estilos base (l. 98-127) están *después* de los de componentes. El resultado depende
de la especificidad, y agregar un `<nav>`, un `<button>` o un `<dl>` nuevo hereda estilos de otro
componente.

Clases muertas: `nav .nav-account` (l. 20) no se usa. `system-home` (`app/home/layout.tsx:10`) y
`account-profile` (`AccountPanel.tsx:14`) no tienen regla.

Objetivo: que cada estilo de componente viva en una clase, que los selectores de elemento solo
tengan tipografía y reset, y que el orden de la cascada lo fijen capas `@layer` y no la
especificidad. El único cambio visual buscado es el breadcrumb (decisión 3) y el cursor de los
botones deshabilitados.

Es la Etapa 2 del plan de refactorización del frontend. Necesita los tokens de TASK-024 y la
línea base de capturas de TASK-023.

> Toca estilos base y el layout global, que `AGENTS.md` lista como áreas sensibles. Esta tarea es
> la autorización explícita para hacerlo, dentro del alcance de la sección 2.

## 2. Alcance

1. **Capas.** `globals.css` pasa a declarar el orden y a importar los archivos:
   `@layer reset, tokens, base, layout, components, utilities;`. Ninguna regla queda fuera de una
   capa, porque una regla sin capa le gana a todas las que tienen capa.
2. **Archivos por área** en `front/src/styles/` (decisión 1):
   `reset.css`, `tokens.css` (el `:root` de TASK-024), `base.css` (elementos: tipografía, `a`,
   `:focus-visible`, formularios), `layout.css` (header, sidebar, contenido, `.page`),
   `components/` con un archivo por área: `button.css`, `notice.css`, `form.css`,
   `breadcrumb.css`, `pagination.css`, `card.css` (auth, perfil, paneles, vacíos),
   `account-menu.css`, `landing.css` (hero, features, carrusel, footer), `academic.css`.
   Se mueven las reglas tal como están. Cambiarlas es la normalización.
3. **Sacar estilos de componente de los selectores de elemento:**
   - `nav` y `nav a`: pasan a `.site-header nav`. Cada propiedad que algún consumidor heredaba se
     copia a ese consumidor. Ejemplo conocido: `.account-menu-panel a` necesita
     `text-decoration: none`, que hoy le llega de `nav a`. Se borra `.system-sidebar nav {
     display:block }`.
   - `button`: queda solo con `font: inherit` y `cursor: pointer`. El aspecto de botón primario
     pasa a `.button`, que ya existe y usan 6 enlaces (decisión 2). Se borran las propiedades que
     `.carousel-arrow`, `.carousel-dot`, `.account-menu-trigger`, `.account-menu-action` y
     `.system-sidebar .button` hoy deshacen.
   - `main`: el ancho y el padding pasan a `.page`, que se agrega en los `<main>` de `login`,
     `register`, `forgot-password`, `reset-password`, `account` y `account/change-password`. Se
     borra el override de `.system-main` y el `padding-top: 0` de `.landing` en la medida en que
     dejen de hacer falta.
   - `h1`: el centrado pasa a `.auth-card h1` y `.account-container h1`. Se borra
     `.system-content h1 { text-align:left }`.
   - `dl`: se borran el fondo y el padding base y el reset de `.profile-details`.
4. **Botones en los TSX.** Los 10 `<button>` que hoy dependen del estilo base primario reciben
   `className="button"` (o `"button submit"`): `MateriasList.tsx:24`, `CursadasList.tsx:27`,
   `ComisionesList.tsx:39`, `UsuariosList.tsx:28`, `Pagination.tsx:5,7`, `opciones.tsx:20`,
   `AltaForm.tsx:111`, `AccountForm.tsx:141`, `RequireAuth.tsx:22`, `RequireGuest.tsx:21`.
   `LogoutButton` cambia su valor por defecto a `"button button-secondary"`. En cada `<button>`,
   `className` va como primer atributo (ver riesgo 2).
5. **Cursor.** `button:disabled { cursor: not-allowed }`. El reloj de espera queda solo para
   `[aria-busy="true"] button:disabled` y `button[aria-busy="true"]`, que es como ya marcan el
   envío `AccountForm`, `AltaForm` y `LogoutButton`.
6. **Clases muertas.** Borrar `.nav-account`. Quitar `system-home` de `app/home/layout.tsx` y
   `account-profile` de `AccountPanel.tsx`.
7. **Documentación.** En `front/OVERVIEW.md`, reemplazar "`globals.css` centraliza colores…" por
   la estructura de `src/styles/`, el orden de capas y la regla "los selectores de elemento solo
   llevan tipografía y reset".

## 3. Fuera de alcance

- Normalizar valores (radios, tamaños, paddings) o unificar las cinco variantes de tarjeta.
  Eso es la normalización de tokens y las primitivas de la Etapa 3.
- Renombrar clases de dominio usadas como genéricas (`.academic-panel` en admin, `.profile-role`
  como badge). Se resuelve con las primitivas de la Etapa 3.
- CSS Modules o cualquier librería de estilos.
- Componentes React nuevos (`Button`, `Card`): son de la Etapa 3. Acá solo cambian clases.
- Cambiar el landmark del header (`aria-label="Navegación principal"`): es un cambio de
  accesibilidad de la Etapa 6.
- Modo oscuro.

## 4. Decisiones de diseño

1. **`@layer` + archivos por área importados desde `globals.css` (propuesta).** Con las capas,
   una regla de `components` le gana a una de `base` sin importar la especificidad, y eso es lo que
   permite borrar los overrides. Next empaqueta los `@import` locales sin dependencias nuevas.
   Alternativa descartada: CSS Modules, que obligan a cambiar todos los `className` a la vez.
   Pueden adoptarse más adelante para componentes nuevos.
2. **Se conservan los nombres `.button` y `.button-secondary`, y `<button>` sin clase deja de
   verse como botón primario (propuesta).** Reusar los nombres que ya existen reduce el diff a
   10 botones. Que un `<button>` pelado no tenga aspecto de componente es la regla que evita que
   el problema vuelva. Alternativa descartada: un prefijo nuevo (`.btn`), que tocaría también los
   6 enlaces y los tests sin ganancia.
3. **El breadcrumb pasa a verse como enlace (propuesta).** Hoy hereda por accidente el estilo
   del menú del header: gris, sin subrayado y peso 600. Con el cambio toma el estilo base de
   `a`, color primario con subrayado. Es el único cambio visual buscado y se documenta en el PR
   con la captura de antes y después. Alternativa descartada: copiar el aspecto actual dentro de
   `.breadcrumb a`, que conservaría un estilo que nadie eligió.
4. **El reloj de espera queda solo para el envío en curso (propuesta).** "Deshabilitado" y
   "ocupado" son estados distintos. `aria-busy` ya marca el envío en los tres componentes que
   envían, así que el selector sale de lo que ya está.
5. **Primero mover, después cambiar.** El paso 2.2 (repartir reglas en archivos y capas sin
   tocarlas) va en un commit propio con captura idéntica. Los cambios de 2.3 a 2.6 van en commits
   separados, así cada diferencia visual se atribuye a un commit.

## 5. Criterios de aceptación

- `globals.css` contiene solo la declaración de capas y los `@import`.
  `grep -c '{' front/src/app/globals.css` da 0.
- Cada archivo de `src/styles/` envuelve todas sus reglas en un `@layer`. Ninguna regla queda
  sin capa.
- En `base.css` ningún selector de elemento define `background`, `border`, `padding`, `width`,
  `display` ni `text-align`. Se aceptan las excepciones de `input, select`, que son controles de
  formulario y se listan en la sección 6.
- Desaparecen los overrides de la tabla de la sección 1: `.system-sidebar nav { display:block }`,
  `.system-content h1 { text-align:left }`, el reset de `.profile-details` y el reset de
  `.system-main`.
- El spec visual de TASK-023 tiene diferencias **solo** en el breadcrumb (Materias, Cursadas,
  Comisiones, altas y Usuarios). Se regenera la línea base para esas capturas y se adjunta la
  comparación en el PR.
- `npm run lint`, `typecheck`, `test` y `build` del workspace `front` pasan.
- `front/OVERVIEW.md` describe la estructura de estilos y la regla de los selectores de elemento.

## 6. Validación

Pendiente de ejecución.

### Pruebas manuales para el desarrollador

- Recorrer landing, login, registro, recuperación, inicio, materias hasta comisiones, una alta,
  usuarios, perfil y cambio de contraseña, en escritorio y en un ancho de celular. Lo único
  distinto tiene que ser el breadcrumb.
- Abrir el menú de cuenta: sus opciones no tienen que quedar subrayadas.
- En la primera página de Materias, pasar el mouse por "Anterior" (deshabilitado): el cursor
  tiene que ser "no permitido", no el reloj. Enviar un alta: mientras guarda, el botón muestra el
  reloj.
- Carrusel de la landing: flechas y puntos tienen que verse igual que antes.

### Excepciones en `base.css` (completar al implementar)

## 7. Riesgos

1. **Propiedades heredadas que nadie declaró.** Al sacar estilos de `nav a` o `button`, un
   consumidor puede perder algo que hoy recibe sin pedirlo, como el subrayado del menú de cuenta.
   Lo detecta la comparación de capturas. Por eso el paso 2.2 va en un commit propio y los
   cambios en commits separados (decisión 5).
2. **Tests que comparan HTML literal.** `academic-components.spec.ts` busca, por ejemplo,
   `'aria-label="Página anterior" disabled="">Anterior<'`. Si `className` queda después de
   `disabled`, el texto cambia y el test falla sin que haya un bug. Por eso `className` va como
   primer atributo. Si aun así algún test se rompe por el orden de atributos, lo ajusta el agente
   de testing (`.agents/test.md`) sin cambiar lo que verifica.
3. **Orden de `@import` y capas.** Un `@import` después de otra regla se ignora. La declaración
   `@layer` y los `@import` tienen que ir al principio de `globals.css`. Confirmarlo con la guía
   de la versión instalada en `node_modules/next/dist/docs/`.
