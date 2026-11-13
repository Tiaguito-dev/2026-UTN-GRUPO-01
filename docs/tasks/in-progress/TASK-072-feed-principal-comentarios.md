# TASK-072: Feed principal de comentarios

Estado: En curso; diseño aprobado y preparación documental. Implementación pendiente de autorización por bloque.
Fecha de última actualización: 2026-11-12.
Responsables por dominio: back (lectura y operaciones), front (Inicio), test (pruebas).

## 1. Objetivo y contexto

Mostrar en `/home` comentarios públicos de estudiantes de todas las carreras, con estrellas
propias cuando existan, likes y respuestas. «Público» refiere a usuarios autorizados del sistema:
no implica abrir contenido a visitantes ni cambiar los guards existentes.

Reutilizar como antecedentes, sin duplicarlos:

- [TASK-013: Inicio](../finished/TASK-013-home-interno.md): `/home` y shell autenticado.
- [TASK-057: comentarios por comisión](../finished/TASK-057-feedback-por-comision.md):
  formulario, permisos, snapshots e historial.
- [TASK-061: experiencias generales](../finished/TASK-061-acceso-directo-comisiones-y-experiencias.md)
  y [TASK-065: filtros y lectura](../finished/TASK-065-experiencias-filtros.md): listado transversal,
  orden createdAt/id descendente, tarjetas públicas y contexto de navegación.
- [Eliminación por autor o administrador](../TASK-feedback-removal-permissions.md): permisos
  vigentes, baja lógica y auditoría; no deducir privilegios nuevos de tareas anteriores.
- [TASK-071: estrellas](../finished/TASK-071-valoracion-materias-estrellas.md): puntuación propia nullable
  del comentario, distinta de la última valoración global del autor para la materia.

La lectura transversal ya existe en Experiencias; esta tarea la integra en Inicio y agrega las
interacciones solicitadas sin sustituir ese listado ni reestructurar el módulo de comentarios.

## 2. Alcance funcional

### Inicio y tarjetas

- Reutilizar `/home`, layout autenticado, navbar, sidebar, estilos y componentes existentes.
  Ajustar solo la presentación local de Inicio y las extensiones de dominio necesarias.
- Feed de todas las carreras, sin filtro implícito por carrera del usuario. Orden de creación
  descendente con desempate estable por id; editar, valorar o reaccionar no sube el comentario.
- Cada tarjeta muestra nombre público o «Anónimo», materia, profesor o comisión cuando corresponda,
  fecha y hora, texto, estrellas del comentario si existen, cantidad de likes y cantidad de respuestas.
- Comentarios históricos sin estrellas siguen visibles, sin puntuación ficticia ni sustitución
  por el promedio de la materia o el voto global de su autor.
- Botón «Agregar comentario» hacia el formulario existente. Resolver dentro del flujo actual la
  selección de comisión cuando Inicio no dispone de una; no inventar una comisión predeterminada.
- Al completar la publicación, mostrar el comentario nuevo al inicio del feed, una sola vez.
  Conservar navegación global y retornos existentes; acordar el retorno contextual local del
  formulario sin alterar el comportamiento de otros orígenes.
- Scroll infinito con paginación estable, sin duplicados, carga incremental, final de resultados,
  estado inicial de carga, vacío, error inicial y error recuperable de página siguiente.
- Diseño responsive y accesible, con textos largos y acciones utilizables con teclado.

### Me gustas

- Un like por usuario autenticado y comentario; puede quitarlo, sin reaccionar al comentario propio.
- Validar propiedad en servidor incluso si la interfaz oculta la acción. Ser anónimo no habilita
  dar like al comentario propio ni obliga a revelar su autor para impedirlo.
- Total público únicamente para quienes pueden consultar el feed; no exponer identidades de
  quienes reaccionaron, ni en payloads ocultos del cliente.
- Evitar duplicados y estados inconsistentes en solicitudes concurrentes, dobles clics y reintentos.
  Likes de comentarios eliminados no habilitan lectura ni interacción con ellos.

### Respuestas

- Un único nivel: estudiantes autenticados responden a comentarios públicos vigentes, nunca a
  otras respuestas. Nombre público o «Anónimo» por respuesta, independiente del comentario padre.
- El autor puede editar y eliminar sus propias respuestas. No inventar privilegios de edición,
  lectura privada o moderación para administradores; revisar y aplicar solo políticas existentes.
- Si el comentario principal se elimina, sus respuestas dejan de mostrarse públicamente,
  incluidas consultas directas y contadores. Conservar datos según baja lógica y auditoría vigente.
- Mantener identidades reales de autores anónimos fuera de proyecciones públicas.
- Mostrar cantidad de respuestas vigentes y visibles, con carga paginada de respuestas; no
  descargar colecciones ilimitadas. Las respuestas no reciben estrellas ni votos de materia.

## 3. Propuesta técnica y revisiones previas

Antecedentes de revisión: las decisiones definitivas de la sección 9 prevalecen sobre las alternativas evaluadas aquí. Este documento no autoriza por sí solo implementación ni migraciones.

1. **Reutilización:** revisar InicioSection, ExperienceCard, servicios y GET /feedback existentes.
   Compartir proyección pública y reglas sin modificar componentes globales; preservar Experiencias,
   filtros, detalle privado y administración de comentarios.
2. **Paginación estable:** [paginacion.md](../../standards/paginacion.md) exige page/pageSize y
   `PaginatedResult<T>`. Evaluar un contexto estable de lectura compatible con ese contrato.
   Ordenar por createdAt/id y deduplicar en cliente no basta para evitar omisiones por bajas o
   inserciones entre páginas. Si se requiere cursor, snapshot u otro contrato, documentar la
   decisión aquí y solicitar autorización para cualquier cambio al estándar antes de implementarlo.
   No cambiar el listado de Experiencias de forma incompatible.
3. **Sesión de carga:** definir cómo se fija la ventana del feed y cómo se refresca tras publicar.
   Un comentario nuevo debe aparecer arriba sin desplazar páginas causando duplicados/omisiones.
   Cancelar o descartar respuestas tardías de cargas anteriores y no avanzar página ante error.
4. **Likes:** proponer relación por usuario/comentario con unicidad en base y operación explícita
   de dar/quitar like que tolere reintentos, evitando toggle ambiguo frente a fallos de red.
   Revisar baja/reactivación y auditoría conforme a [soft-delete](../../standards/soft-delete.md).
5. **Respuestas:** proponer entidad ligada al comentario principal y su autor, texto, anonimato,
   fechas y deletedAt; no relación recursiva. Validar texto con las reglas de comentarios que
   resulten aplicables, sin inventar límites nuevos. Revisar historial/auditoría, FK, índices y
   orden paginado antes de cerrar el modelo. No borrar en cascada los datos históricos.
6. **Permisos y atomicidad:** usar identidad de sesión y protección CSRF actuales. Revalidar
   visibilidad del padre al reaccionar/responder y coordinar con su eliminación concurrente.
   Derivar flags de propiedad/acción sin publicar identificadores privados ni emails.
7. **Contadores:** proponer agregaciones de likes y respuestas vigentes evitando consultas N+1,
   joins que multipliquen resultados y contadores persistidos redundantes sin justificación.
   No contar respuestas eliminadas ni mostrar contenido de un padre dado de baja.
8. **Errores:** conservar borradores y resultados ya cargados. Si hay actualizaciones optimistas,
   definir reversión y reconciliación con servidor para cantidades y estado de like; manejar
   reintentos sin duplicar publicaciones/respuestas ni perder el contexto de scroll.
9. **Referencia visual:** la imagen mencionada no está adjunta ni localizada en los materiales
   disponibles. No se asume su composición. Antes del tramo visual, el desarrollador debe
   aportar la referencia y acordar aquí sus elementos y criterios de comparación; esto no
   impide preparar esta tarea documental. No declarar fidelidad visual validada sin referencia.
10. **Formulario y auditoría:** cerrar retorno desde publicación, recuperación ante resultado
    incierto, formatos de fecha/hora existentes y políticas concretas de auditoría de likes y
    respuestas. Confirmar moderación aplicable a respuestas sin ampliar permisos por analogía.

Cerrar estas revisiones antes del tramo correspondiente. Una necesidad de tocar áreas sensibles
o documentación adicional exige autorización específica; no se considera incluida en este plan.

## 4. Exclusiones y restricciones

- Sin cambios de autenticación, roles, permisos globales, router principal, navbar, sidebar,
  layout, hooks compartidos, estilos base ni primitivas globales.
- Sin Ranking, búsqueda global, notificaciones, respuestas anidadas ni likes a respuestas.
- No sustituir el formulario existente ni reestructurar módulos. No alterar trabajo de otros
  integrantes fuera de la integración estrictamente necesaria y expresamente revisada.
- Mantener reglas académicas y una experiencia vigente por usuario/comisión. Las estrellas y
  promedios se definen en TASK-071; no implementarlos de nuevo en el feed.
- Stack oficial y herramientas actuales; no instalar dependencias ni cambiar configuración global.
- Autorización actual limitada a proteger el documento, crear la rama encadenada, trasladar y
  actualizar esta tarea y realizar un commit documental. Sin implementación, migraciones,
  pruebas, acceso a bases, cambios de infraestructura, push ni creación de PR.
- El cierre futuro requiere evidencia, aceptación manual, documentación y CHANGELOG según
  la convención. No declarar terminada la tarea antes de esas verificaciones.

## 5. Criterios de aceptación

1. `/home` conserva shell y protección actuales y muestra comentarios vigentes de carreras
   distintas, incluida una materia compartida, sin duplicar comentarios por sus asociaciones.
2. Tarjetas presentan todos los datos de la sección 2 sin publicar emails, ids privados ni
   identidad de autores anónimos. Estrellas coinciden con el comentario, no con el voto global.
3. Igual fecha de creación se resuelve siempre por id descendente; ediciones, likes y respuestas
   no cambian la posición. Comentarios históricos siguen visibles sin estrellas inventadas.
4. «Agregar comentario» abre el flujo existente y permite elegir contexto válido. Tras publicar
   desde Inicio el comentario aparece primero una sola vez; otros orígenes conservan sus retornos.
5. Cargar sucesivas páginas no repite ni omite elementos de la ventana acordada ante inserciones
   y bajas concurrentes; desaparecen los eliminados. Se define actualización explícita de ventana.
   Dobles disparos, red lenta y respuestas tardías no mezclan páginas; un fallo permite reintentar.
6. Un usuario da y quita un like; reintentos/concurrencia mantienen cantidad correcta. Se rechaza
   reaccionar al comentario propio, incluso anónimo o mediante llamada directa. No se listan reactores.
7. Respuestas tienen un nivel y anonimato independiente. Autor edita/elimina las propias; terceros
   no pueden. No se conceden permisos administrativos adicionales; el conteo refleja respuestas visibles.
8. Baja del comentario padre oculta respuestas y bloquea nuevas interacciones, incluso por URL/API
   directa y frente a concurrencia; se conserva historia conforme a la política revisada.
9. Hay carga inicial, vacío real, errores inicial/incremental, reintento y fin de lista; no se
   pierde lo cargado ni los borradores por fallos. Cancelar formularios no realiza escrituras.
10. Escritorio y móvil sin desbordamiento horizontal, orden de foco coherente, controles
    etiquetados, anuncios accesibles de carga/error y acceso por teclado a acciones y respuestas.
    La comparación visual queda pendiente hasta disponer de la referencia.
11. Experiencias, formularios, detalle privado, filtros, anonimato, historial y eliminación por
    autor/ADMIN conservan sus contratos. No se abre el feed a usuarios sin autorización.

## 6. Validaciones futuras

- TDD: pruebas RED de cada contrato antes del código; GREEN y regresión del dominio al completar
  cada tramo. Herramientas existentes, según [frontend-tests](../../standards/frontend-tests.md).
- Backend unitario: validación de paginación, unicidad de likes, rechazo de auto-like, permisos,
  proyección anónima, restricciones de respuestas y cálculo de contadores.
- HTTP/PostgreSQL aislado y autorizado: orden con empates, páginas bajo escrituras concurrentes,
  comentarios de varias carreras, bajas, doble like/quitar/reintentar, respuesta frente a baja
  del padre, rollback/auditoría, CSRF y acceso directo de autor/tercero/ADMIN/sin sesión.
- Verificar anonimato tanto en DOM como en payloads públicos y errores. La moderación debe
  probarse contra la política acordada, no contra privilegios supuestos.
- UI con jsdom: carga, vacío, errores, reintentos, scroll incremental, solicitudes duplicadas,
  respuestas tardías, fin de lista, publicación con retorno, borradores, likes y respuestas.
- Integración con TASK-071: puntuación propia distinta de global, comentarios históricos sin
  estrellas, actualización al editar y retiro de comentario/voto sin inconsistencias en el feed.
- Navegador: recorrido publicar/volver/reaccionar/responder/eliminar, teclado y responsive a
  390px y 1280px, además de ancho estrecho; axe sin violaciones serious/critical nuevas.
  Comparación con referencia aportada y aceptación visual manual; snapshots solo desde el
  entorno permitido por frontend-tests. No generar capturas durante esta ejecución documental.
- Typecheck, lint, tests y builds pertinentes; ambos checks CI obligatorios de CONTRIBUTING
  antes del cierre. Registrar resultados y limitaciones futuras sin declarar pruebas no ejecutadas.

## 7. Dependencias, riesgos y secuencia incremental

Dependencia parcial de TASK-071: la tarjeta necesita su contrato de estrellas propias; lectura
sin estrellas, likes y respuestas pueden planificarse sin duplicar la valoración. El flujo final
de publicación obligatorio con estrellas requiere completar su formulario.

Secuencia propuesta conjunta, sin autorización de implementación implícita:

1. Persistencia y backend de estrellas (TASK-071).
2. Formulario de creación/edición con estrellas (TASK-071).
3. Resumen por materia (TASK-071).
4. Feed en Inicio reutilizando lectura paginada, tarjetas y publicación actuales (TASK-072).
5. Likes (TASK-072).
6. Respuestas (TASK-072).
7. Scroll infinito estable y pruebas de integración (TASK-072); cerrar su contrato antes de
   implementar la lectura incremental, aunque la entrega visual de scroll ocurra al final.

Riesgos: paginación por offset puede omitir comentarios bajo bajas concurrentes; deduplicar no
lo resuelve. Ampliar tarjetas compartidas puede afectar Experiencias y comisión. Auto-like y
respuestas anónimas requieren permisos en servidor sin filtrar identidad. Reintentos pueden
duplicar operaciones, y conteos por join pueden multiplicarse. Padre borrado y cargas tardías
pueden revelar respuestas retiradas. La referencia ausente impide verificar fidelidad visual.
Mitigar con revisión previa de contratos, pruebas concurrentes y regresión de componentes.

## 8. Resultado y evidencia

Planificación documental preparada el 2026-11-11. Sin implementación, tests ni builds ejecutados.
Estado inicial conservado como antecedente: las propuestas técnicas se cerraron en la sección 9; siguen pendientes la referencia visual y la autorización explícita de código.
No se declara la funcionalidad terminada ni validada.

## 9. Diseño ejecutable aprobado — 2026-11-12

### Git y dependencia de TASK-071

- TASK-071 está implementada en `feat/feed-principal`; PR #41 hacia `desarrollo` pendiente
  de merge según el estado informado. TASK-072 no modifica esa rama ni ese PR.
- Excepción temporal autorizada al flujo general: `feat/feed-comentarios` nace desde
  `2f8326aa2373a7b4c50110c58bd709e54dfde07b` de `feat/feed-principal`.
- El futuro PR será Draft, head `feat/feed-comentarios`, base `feat/feed-principal`.
  No se crea todavía. Después del merge de TASK-071 se revisará expresamente cómo cambiar
  la base a `desarrollo`, considerando si hubo squash; no hacer rebase o cherry-pick automático.
- Documento original protegido fuera del repositorio. SHA-256 previo al traslado y edición:
  `276DF986B88E3A172F7AFBDFE34C2A944DCB103968BAD76247533ECC61DC4D6A`.

### Lectura del feed y excepción local de paginación

- Nuevo `GET /feedback/feed?pageSize=9&cursor=...`, autenticado y sin caché; conservar
  `GET /feedback` y los contratos paginados de Experiencias. Declarar la ruta estática antes
  de `GET /feedback/:id` y probar el despacho HTTP, UUID, historial y guards.
- Excepción aprobada a `paginacion.md` exclusivamente para este endpoint. No cambiar
  estándares globales ni `PaginatedResult` existente. `pageSize` entero entre 1 y 9, default 9.
- Cursor base64url con objeto estricto `{ v: 1, pageSize, upper: { createdAt, id },
  after: { createdAt, id } }`. Límite de 1024 caracteres; validar versión, claves exactas,
  fechas UTC ISO válidas, UUID, coincidencia de pageSize y `after <= upper`. Error 400 ante
  valores inválidos. No incluir identidad ni secretos; el cursor no sustituye autorización.
- Orden `createdAt DESC, id DESC`; consultar tuplas `<= upper` y `< after`, con `pageSize + 1`.
  Respuesta `{ items, nextCursor, hasMore }`; cursor null al terminar. Comparar valores sin
  depender de que la fila ancla siga existiendo. No reordenar por edición, likes o respuestas.
- Fijar límite superior en la primera página. Nuevas publicaciones aparecen al refrescar la
  ventana o volver del formulario. No prometer un snapshot histórico persistente entre HTTP:
  las bajas se filtran en cada consulta y una página posterior puede quedar vacía.
- Cliente: una carga incremental en vuelo, deduplicación por id, descarte de respuestas de
  ventanas anteriores y avance de cursor solo tras éxito. Conservar páginas ante error;
  permitir reintento y alternativa accesible «Cargar más». Refrescar explícitamente la ventana
  tras publicar; no duplicar el comentario mediante inserciones optimistas independientes.

### Likes, respuestas y concurrencia

- Likes con PUT/DELETE explícitos e idempotentes, unicidad usuario/comentario y sin autolikes,
  incluso si el padre es anónimo. No exponer autores reales para comprobar propiedad.
- Respuestas de un nivel, anonimato independiente, sin estrellas ni voto global. Historial,
  auditoría y soft-delete según convenciones vigentes; conservar evidencias sin cascada física.
- Creación de respuesta: padre vigente y visible; comisión inactiva produce 409. Padre eliminado
  produce 404 y no admite nuevas interacciones. Lectura y baja propia conservan reglas vigentes;
  edición respeta autoría y comisión activa, sin conceder privilegios administrativos nuevos.
- Idempotencia local: `solicitudId` UUID, único por autor, sin tabla general de operaciones.
  Primera creación 201; repetición equivalente devuelve el mismo recurso (200), sin otra
  respuesta, historial ni auditoría. Comparar contra el snapshot inicial, no el texto editado.
  Reutilizar clave con distinto padre, texto o anonimato produce 409. Un reintento no sobrescribe
  una edición posterior ni reactiva una respuesta eliminada; esta última situación produce 409.
  Comprobar primero visibilidad del padre. Resolver conflictos P2002 fuera de transacciones abortadas.
- Orden de bloqueos: comisión → comentario → interacción, compatible con la eliminación del
  padre y TASK-071. Revalidar estado después de adquirirlos. No introducir bloqueos inversos
  ni tomar el bloqueo de valoración por materia en interacciones que no lo necesitan.
- Contadores por lote sobre entidades vigentes y padre visible, sin N+1 ni joins que multipliquen
  cantidades. No ocultar errores de agregación devolviendo ceros ficticios.

### Reutilización y límites

- Reutilizar `InicioSection`, `ExperienceCard` y `FeedbackForm`; mantener `AppShell`,
  `SiteHeader`, `SidebarNav`, autenticación, permisos y estilos globales sin cambios.
- Extensiones locales del feed preservan consumidores de Experiencias, comisión y administración.
  Resolver selección de contexto académico y retorno a Inicio sin cambiar otros orígenes.
- Mostrar estrellas individuales de Feedback, nunca sustituirlas por el promedio global.
  Auditar payloads y DOM para evitar identidades privadas de autores anónimos.
- Modelos, rutas concretas de interacciones y archivos finales se revisan en cada bloque antes
  de implementarlo; esta preparación no autoriza código ni ampliaciones de alcance.

### Secuencia TDD, aceptación y regresiones

1. Lectura por cursor: tests RED de validación, orden con empates, inserciones/bajas, ancla
   eliminada, privacidad y colisión de rutas; GREEN y regresión de contratos de Feedback.
2. Persistencia de interacciones: diseño de likes, respuestas e historial con claves e índices;
   migración incremental y generación solo con autorización específica. Sin cambios históricos.
3. Likes: PUT/DELETE repetidos y concurrentes, autolike anónimo, padre eliminado, contadores;
   regresión de feed, anonimato y eliminación de comentarios.
4. Creación de respuestas: idempotencia equivalente/conflictiva, solicitudes simultáneas con
   la misma clave, rollback, reintento tras edición/baja y carrera con eliminación del padre
   o inactivación de comisión. Verificar una fila y una sola evidencia por creación efectiva.
5. Lectura/edición/baja de respuestas: permisos, anonimato independiente, historial, paginación,
   contadores y ocultamiento del padre; regresión de likes, feed y reglas de comentarios.
6. Inicio y carga incremental: carga/vacío/error/fin, doble disparo, respuestas tardías, scroll,
   teclado y ausencia de duplicados; regresión de Experiencias y tarjetas compartidas.
7. Publicación contextual e interacciones UI: borradores y solicitudId estables ante reintentos,
   retorno a Inicio, contadores y permisos; regresión del formulario y otros orígenes.
8. Antes del cierre: regresión completa, typechecks sin emisión/incremental, lint y diff-check;
   PostgreSQL aislado y navegador solo bajo autorización, responsive y accesibilidad, CI y
   aceptación manual. Registrar omisiones reales; la referencia visual sigue pendiente.

Cada bloque incorpora sus pruebas junto con el cambio funcional y un commit acotado; separar
persistencia, lectura del feed, likes, creación de respuestas, gestión de respuestas, UI del feed,
publicación contextual e interacciones. No acumular toda la implementación en un único commit.

Criterios verificables adicionales: GET /feedback conserva su contrato; /feedback/feed alcanza
el handler correcto; no se generan respuestas duplicadas en reintentos; baja del padre impide
lectura directa e interacciones; el conteo no crece por reintentos; las operaciones concurrentes
mantienen atomicidad y el orden de bloqueos acordado. Las regresiones existentes no se debilitan.

### Evidencia de esta preparación

Verificados rama de origen, HEAD, origin, sincronización remota, inexistencia de la nueva rama
local/remota y único pendiente TASK-072. Backup original con SHA-256 coincidente y documento
intacto después del cambio de rama. Solo preparación documental: no se ejecutaron pruebas,
migraciones, seeds ni builds; no se accedió a bases ni se modificaron servicios o contenedores.