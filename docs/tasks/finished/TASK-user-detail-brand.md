# Detalle de usuarios y marca superior

## Alcance
Refinar únicamente detalle administrativo de usuarios y BookOpen en SiteHeader compartido,
autorizado expresamente por el pedido. No alterar detalles académicos ni sus estilos.
Conservar operaciones, sesión, guards, confirmaciones y navegación con filtros.

## Decisiones
Componentes y CSS propios del detalle de usuario reutilizan PageHeader, Notice, Pagination y
AdminConfirmDialog. Sin cambios de tokens globales; colores pedidos limitados a esta vista.
Backend agrega nombres opcionales de actores solo a detalle users, resueltos en una consulta
por lote y seleccionando únicamente id/displayName; ningún cambio a permisos ni mutaciones.
Frontend distingue actor ausente y referencia no resoluble sin mostrar IDs. Zona local existente.

## Aceptación y validación
Identidad con iniciales, estado y acciones según sesión real; nota sobre propia cuenta.
Auditoría exclusiva ADMIN en tres/dos/una columnas y desplegable accesible con datos reales.
Sin IDs visibles; valores extensos y ausencias legibles. Marca decorativa compartida entre roles.
Regresiones de componentes y backend, typecheck y lint. Prueba de navegador a cargo del usuario
según instrucción previa. No commits.

## Evidencia
- Suite frontend completa con `--maxWorkers=2`: 65 archivos, 568 pruebas correctas.
  La primera ejecución simultánea con builds Docker tuvo ocho fallos de espera/timeout;
  la repetición con menor concurrencia pasó sin modificar lógica ni límites de las pruebas.
- Typecheck y lint de frontend y backend: correctos.
- Regresiones seleccionadas frontend: 5 archivos, 41 pruebas correctas antes de agregar tres casos
  adicionales de origen inválido al retorno.
- Backend: 4 archivos y 18 pruebas correctas; repetición final de admin-detail con 9 pruebas correctas,
  incluyendo referencias de actor no resolubles y ausencia de consultas nuevas en otras entidades.
- Builds Docker de backend y frontend correctos. Stack local saludable y HTTP 200 en `/` y `/health`.
- Prueba visual móvil y activación nativa de summary mediante Enter/Espacio a cargo del desarrollador.
  jsdom verifica foco y apertura por clic; no emula la activación nativa por teclado de summary.
- Nombres de actores corresponden al nombre público disponible al consultar, no a una identidad histórica reconstruida.
