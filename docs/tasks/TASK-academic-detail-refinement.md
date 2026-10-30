# Detalles administrativos académicos

## Alcance

Refinar la presentación de Materias, Cursadas y Profesores conforme al pedido explícito: encabezado con acciones reales, datos actuales semánticos, auditoría e historial compartidos con usuarios, responsive y accesible. Sin commits.

## Exclusiones y restricciones

Conservar operaciones, contratos, permisos, validaciones, navegación contextual, menú y marca. Sin cambios a layout, router, autenticación, hooks compartidos, estilos base ni primitivas globales. Sin dependencias nuevas ni eventos ficticios.

## Decisiones antes de implementar

- Generalizar el componente de auditoría de usuarios con una variante de baja académica, sin duplicar su implementación. Limitar su adopción a los tres detalles solicitados; las demás entidades conservan su presentación.
- Mantener CSS Modules existentes, tokens y paleta local del detalle de usuarios. Usar PageHeader y sus primitivas actuales para mantener foco y breadcrumb; componer las acciones en un encabezado responsive local.
- Modalidad y período se presentan desde sus campos reales e independientes. Mantener todas las asociaciones y nivel de electiva por carrera.
- Los nombres de actores provienen exclusivamente del contrato administrativo autorizado: referencia sin nombre implica Usuario no identificado, ausencia de referencia implica No registrado.
- El esquema de cambios admite string o null: cadena vacía se presenta como Vacío, null como No registrado; una eliminación se etiqueta solo mediante la operación registrada, sin inferirla de null.

## Criterios de aceptación

- Orden navegación, identificación/acciones, datos, auditoría; máximo 1200px y distribución sin alturas fijas.
- Modalidad y cuatrimestre condicional, carreras/años completos; profesor sin datos inventados e iniciales reales; cursada con período registrado.
- Acciones, bajas y enlaces relacionados conservan confirmaciones, restricciones y contexto.
- Auditoría exclusivamente administrativa, sin IDs visibles, historial cerrado, teclado nativo, orden y paginación de tres, valores legibles.
- Mantener estados de carga, error/reintento y éxito; estados activos e inactivos explícitos.

## Validación

Perfil front para implementación y perfil test para pruebas de regresión. Caracterizar primero los recorridos existentes; actualizar las expectativas solo por cambios solicitados. Añadir cobertura de datos ausentes, modalidades, actores, eventos y permisos. Ejecutar pruebas frontend pertinentes, typecheck, lint y test backend administrativo. Revisión de navegador según disponibilidad de infraestructura, registrando limitaciones sin afirmar verificaciones no realizadas.

## Resultado

Pendiente.
