# Plantilla TDD

Molde para la Technical Design Documentation (TDD) de este proyecto. Sirve para cualquier TDD del repo
(back, front o test) — las secciones atadas a un stack particular se completan una vez que la
tecnología esté elegida, no antes.

## Encabezado — obligatorio en todo TDD

```
# TDD-[MÓDULO]-H[N]: [Nombre de la funcionalidad / hito]

Estado: Propuesto / En Revisión / Aprobado
Autor: [Nombre de quien lo escribió]
Fecha: AAAA-MM-DD
```

- **ID**: `TDD-[MÓDULO]-H[N]` para el TDD de un hito concreto de un módulo (ej. `TDD-AUTH-H1`).
  `TDD-[MÓDULO]` para el TDD general de un módulo, sin hito específico. `[MÓDULO]` es el nombre
  corto del caso de uso o feature (ej. `AUTH`, `PAGOS`) — no hace falta un código oficial, alcanza
  con que sea consistente en todo el repo.
- **Estado**: `Propuesto` = recién escrito, sin ninguna revisión. `En Revisión` = ya se
  iteró/usó como referencia, pero el equipo todavía no lo validó formalmente. `Aprobado` = el
  equipo llegó a consenso sobre la decisión.
- **Autor**: quién lo escribió.
- **Fecha**: la de la última edición de fondo del documento, no la de creación si difieren.

## Cuándo un TDD por módulo, y cuándo un documento compartido

Una feature que solo tiene sentido dentro de un módulo va en el TDD de ese módulo. Una feature
compartida por varios módulos sale a su propio documento bajo `docs/tdd/compartidos/`, y cada
TDD que la necesite la referencia en vez de repetirla.

## TDD de hito vs. TDD general

El TDD general de un módulo (`TDD-[MÓDULO].md`) es el diseño ideal del módulo completo. El TDD
de un hito concreto (`TDD-[MÓDULO]-H[N].md`) es lo más cercano a lo que realmente se construye en
cada etapa — y es a partir de esos hitos que el TDD general se completa y se corrige, no al
revés. Un TDD de hito tiene que poder leerse solo, sin compararse constantemente contra el
general.

---

## 1. Contexto de Negocio (el "Qué")

### 1.1. Objetivo

Qué problema real resolvemos.

### 1.2. User Personas

Roles humanos — quién interactúa directamente con esta funcionalidad y qué espera lograr. Los
componentes de sistema (frontend, backend, servicios externos) no van acá — se documentan en la
Sección 3, en el lugar donde corresponde técnicamente.

### 1.3. Criterios de Aceptación (User Stories)

- Como [rol], quiero [acción] para [beneficio].
- Escenario de éxito: Given [precondición], When [acción], Then [resultado].
- Escenario de borde/fallo: Given [precondición], When [acción], Then [resultado].

### 1.4. Qué no vamos a hacer en esta fase

Para no perder el foco.

## 2. Diseño Técnico (el "Cómo")

### 2.1. Modelo de Dominio (Entidad)

La entidad tal como la ve la capa de dominio, en el stack que corresponda una vez elegido. Si el
dominio de un hito puntual necesita menos campos que el esquema de persistencia completo (§2.3,
que puede ser compartido por otros módulos), la entidad de dominio se define acotada a lo que ese
caso de uso realmente usa — no se copia el esquema completo por comodidad.

### 2.2. Contrato de API

Endpoint, método HTTP, request body, response de éxito. Si el proyecto todavía no tiene definido
el nombre real del módulo/paquete compartido, se marca como pendiente — no se inventa. No se
agrega ningún prefijo de ruta (`/api/v1`, etc.) que no esté ya en uso en el resto de los TDD,
salvo que sea una decisión tomada explícitamente en otro lado.

### 2.3. Esquema de Persistencia

Esquema en pseudocódigo, notación de esquema legible — sin compromiso con ningún ORM en
particular hasta que se decida el stack.

**Por qué elegimos este camino y no otro**: cuando la decisión es sobre modelo de dominio,
contrato de API o persistencia, la justificación va acá, al final de esta sección — no salteada
al cierre del documento.

## 3. Arquitectura y Flujo

### 3.1. Definición del Puerto (Repository Interface)

Métodos que el dominio requiere de la infraestructura. Puertos ya definidos en otro documento se
referencian, no se redefinen. Acá también se nombran los componentes de sistema que consumen
estos puertos (front, back, servicios externos).

### 3.2. Lógica del Caso de Uso

Paso a paso qué hace el código al recibir una petición, como lista numerada de lógica de negocio
(ej. validar datos de entrada → comprobar reglas de negocio → mapear DTO a entidad de dominio →
persistir a través del repositorio) — no como traza de request/response cruda. Complementar con
un recorrido paso a paso usando un caso concreto (datos reales, no genéricos) ancla mejor el
diseño que la prosa sola. Cuando el hito tiene más de un caso de uso, se detalla el principal
paso a paso y los demás se resumen brevemente.

**Por qué elegimos este camino y no otro**: cuando la decisión es sobre el flujo o los puertos,
la justificación va acá, al final de esta sección.

## 4. Casos de Borde y Manejo de Errores

| Escenario de Error | Validación / Regla de Negocio | Código HTTP |
|---|---|---|
| ... | ... | ... |

Las **precondiciones** (qué tiene que ser cierto para que el flujo funcione) van como una línea
aparte antes de la tabla, no como sección propia.

## 5. Observaciones Adicionales

- **Preguntas abiertas** — puntos sin resolver.
- **Detalles técnicos adicionales** — cualquier detalle técnico extra, como uso de librerías
  externas o consideraciones de performance. No hace falta completarla si todavía no hay nada
  concreto para ese TDD.

No incluye "Por qué elegimos este camino y no otro": esa justificación va pegada a la sección de
diseño que explica (§2 o §3). Acá solo quedan preguntas sin resolver y detalles técnicos sueltos
que no justifican ninguna decisión puntual de diseño. **Observabilidad** (qué se loguea para
saber si esto falla en producción) es opcional, y cuando aplica entra como un ítem más de
"Detalles técnicos adicionales".
