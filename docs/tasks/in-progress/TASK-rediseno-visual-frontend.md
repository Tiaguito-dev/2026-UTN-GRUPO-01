# Rediseño visual del frontend existente

## Alcance y autorización

Solicitud de Luana: aplicar la estética y distribución del collage de Professor’s Butchery al frontend existente. Incluye explícitamente estilos base, tokens, encabezado global, menú lateral y presentación compartida de tarjetas, listados y formularios. Rama desde `origin/main`; destino de integración: `desarrollo`.

## Exclusiones y restricciones

Sin cambios de backend, servicios, permisos, autenticación, rutas o lógica de formularios. Sin dependencias nuevas. No implementar feed, ranking, notificaciones, likes, búsqueda global, comunidad ni asistente por pasos que no existan. Conservar las pantallas de próximamente y los controles actuales.

## Decisiones

- Paleta bordó y crema, superficies cálidas y selección salmón; conservar los nombres de tokens para evitar cambios funcionales o una migración de componentes.
- Encabezado bordó compacto, identidad tipográfica serif, navegación lateral clara y contenido con ancho legible. En móvil, navegación en filas y contenido sin margen lateral.
- Aplicar la referencia a los datos y estructuras existentes, sin inventar datos o controles. Materias conserva búsqueda, filtros y agrupación actuales, con filas en tarjetas separadas.
- Mantener el inicio informativo y su enlace de perfil: el feed de la referencia requiere otra tarea.
- Validación mediante tipos, lint, tests existentes y build. Al ser presentación reversible sin comportamiento nuevo, no agregar tests que reproduzcan reglas CSS. Las capturas de referencia existentes se regeneran únicamente desde Linux según el estándar.

## Criterios de aceptación

- [ ] Encabezado, navegación, tarjetas, listados y formularios comparten la estética de referencia.
- [ ] Escritorio y móvil conservan controles accesibles, foco visible y contenido sin desbordes.
- [ ] Sin cambios en enlaces, guards, permisos, carga, errores, filtros o envío.
- [ ] No aparecen funcionalidades pendientes nuevas.
- [ ] Tipos, lint, tests y build verificados; limitaciones registradas.
- [ ] Revisar diff respecto de desarrollo antes de integrar para conservar sus correcciones posteriores a main.

## Validación

Tipos y lint aprobados. Suite Vitest: 74 archivos, 727 pruebas aprobadas (`npm run test --workspace=front -- --maxWorkers=2`). Build aprobado fuera del sandbox tras un EPERM de escritura. Host Node 24.22.0; el proyecto fija Node 22.22.3.

Las capturas locales solo muestran el aviso de conexión por falta de URL del backend; no acreditan la revisión visual de portada ni pantallas privadas. Revisión visual completa pendiente. No se regeneraron baselines. La tarea permanece en progreso. No se incorporó desarrollo ni se modificó main; la integración se revisará al preparar la PR hacia desarrollo.
