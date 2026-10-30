# TASK-063: Breadcrumbs compartidos

Estado: Implementación y comprobaciones técnicas finalizadas; aceptación visual pendiente.

## Alcance autorizado

Estandarizar los breadcrumbs existentes mediante Breadcrumb, PageHeader y BackLink compartidos.
La autorización incluye estas primitivas y su hoja de estilos; no modifica shell, router ni auth.
No agregar recorridos a páginas raíz. Mantener contexto académico y filtros al consultar,
crear, administrar y editar comentarios, y usar las entidades y rutas reales.

## Decisiones previas

- Breadcrumb compone el regreso separado y el recorrido semántico; PageHeader delega en él.
  Si falta un regreso interno válido se usa el último ancestro enlazado, o /home.
- ChevronRight y ArrowLeft de Lucide, separadores decorativos, solo el último ítem current.
- Paleta existente: surface, primary (#1240C9), border (#D8E0ED), soft-blue (#EDF2FF),
  muted y accent. Radio radius-sm (8 px), texto text-sm, sin colores locales nuevos.
- Regreso con destino explícito, sin router.back ni URLs externas. Los filtros académicos
  se propagan mediante los constructores existentes; no se inventa una página de cursada.
  Desde Experiencias, el identificador permitido origen=experiencias y experienciasPage
  conservan la página del listado general a través del detalle y la edición privada.
- Quitar overrides locales del breadcrumb y colores que redefinen tokens en el formulario.
- Breadcrumb adapta nombres completos y palabras largas con wrap, sin elipsis ni scroll.

## Exclusiones y criterios de aceptación

Sin cambios backend, reglas de comentarios, dependencias ni commits. Conservar cancelación
del formulario y permisos. Volver separado a la izquierda, con wrap en móvil; enlaces nativos,
foco visible, aria-label y un único aria-current. Contexto materia > comisión > comentario,
incluido el detalle privado y su edición. Administración reutiliza la misma presentación.

## Validación

RED/GREEN con tests enfocados de primitiva, regreso interno, teclado y propagación de filtros.
Suites afectadas, typecheck y lint. Revisión CSS responsive y nombres largos; sin navegador
por preferencia del desarrollador. Reconstruir frontend y proxy al finalizar, comprobar HTTP.
Actualizar front/OVERVIEW.md, estándar de componentes y CHANGELOG. Sin contenedores de prueba.

## Resultado y evidencia

- Breadcrumb y PageHeader centralizan regreso y recorrido en las páginas existentes;
  BackLink y separadores usan Lucide. Solo el último elemento lleva aria-current.
  Fallback al ancestro interno enlazado o /home; no depende del historial del navegador.
- Materia y comisión reales en alta, administración y edición del comentario, con filtros,
  búsqueda, página del catálogo, cursada seleccionada y página de comisiones conservados.
  Administración desde Experiencias conserva su página de origen, incluso al editar.
- Retirados overrides locales del formulario y sus redefiniciones de colores. La paleta
  sigue los tokens del sistema: primary #1240C9, border #D8E0ED y soft-blue #EDF2FF.
- Revisión CSS: contenedor limitado al ancho disponible, min-width 0, sin alturas fijas
  ni truncado, overflow-wrap anywhere, distribución en varias líneas bajo 600 px.
- RED: cinco fallos confirmados antes de implementar (regreso, semántica y contexto).
  GREEN: 93 pruebas distintas en 12 archivos. Primera ronda: 89 en 11 archivos; última
  ronda: 27 en los tres archivos de feedback afectados por el regreso desde Experiencias.
  Incluye enlaces, filtros, teclado, nombres largos, identidad, cancelación y edición.
- Typecheck y lint general aprobados. Tras el último ajuste se repitieron typecheck y
  lint enfocado de los archivos modificados, también aprobados. Revisión React según la
  skill react-best-practices sin nuevas dependencias, consultas ni efectos adicionales.
- Build Docker frontend aprobado. Su proceso de actualización dejó el frontend saludable;
  al informar el desarrollador que los servicios estaban apagados, se verificó Docker y se
  detuvo ese frontend para conservar el entorno apagado. No se inició backend/base/proxy.
  No se comprobó HTTP del conjunto. Aceptación visual y manual pendientes para otra etapa.
- Sin pruebas de navegador, contenedores efímeros ni commits. Cambio solo frontend y docs.

## Aceptación del usuario (2026-10-28)
Breadcrumbs y navegación verificados por el usuario. Se autoriza el commit local de este bloque; sin push.
