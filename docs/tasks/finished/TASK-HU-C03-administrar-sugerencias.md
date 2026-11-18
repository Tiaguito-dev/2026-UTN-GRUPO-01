# HU-C03 — Administrar sugerencias

## Alcance y restricciones
Continuar en feat/modulo-comunidad. Bandeja privada ADMIN junto a normas; autor, categoría,
fecha, contenido, corazón compartido y eliminación confirmada. Sin estados, respuestas, HU-C05,
dependencias, cambios globales, PR ni merge. Conservar HU-C01/02/04 y cambios locales ajenos.

## Decisiones previas a implementación
- Reutilizar community y Sugerencia. Agregar meGusta boolean default false y deletedAt nullable
  con migración conjunta. Baja lógica conforme al estándar: excluye de administración pero
  conserva clave/recibo idempotente HU-C02; un reintento previo no resucita sugerencias eliminadas.
- GET /comunidad/sugerencias?page=1&pageSize=20&soloMeGusta=true|false: contrato compartido
  PaginatedResult, createdAt DESC/id DESC, autor {displayName}, sin email ni solicitudId/usuarioId.
- PUT /comunidad/sugerencias/:id/me-gusta con body estricto {meGusta:boolean}: asignación
  idempotente compartida, no toggle ciego. DELETE /comunidad/sugerencias/:id: baja lógica,
  204; inexistente/eliminada 404. Todos ADMIN con guards y CSRF existentes.
- Front reutiliza useUrlPagination, PaginatedListView, Card, Notice, Dialog; filtro reinicia
  página, mutaciones refrescan solo listado y corrigen página vacía tras cambios. Responsive
  y tokens administrativos existentes. No modificar primitivas ni hooks compartidos.
- Nginx: ruta exacta existente más prefijo /comunidad/sugerencias/ para escrituras por ID.

## Criterios y TDD
Solo ADMIN lee/escribe; PostgreSQL real; orden/paginación/filtro; asignación true/false
persistente y compartida; confirmar/cancelar eliminación; actualización sin reload; errores
y reintentos; privacidad e idempotencia HU-C02 incluso tras baja; normas y envío operativos.
Testing prepara RED antes de producción. Validación focal unit/integración Community,
E2E relevantes (incluyendo CSRF/proxy), typecheck y lint ambos paquetes. Sin suites completas,
builds generales ni comparaciones visuales; usar harness con dev server si permite evitar build.

## Evidencia y cierre

- RED comprobado antes de producción: imports inexistentes del caso AdministrarSugerencias y
  componente SugerenciasAdmin. Delegación back/front/test iniciada; los agentes alcanzaron su
  límite de uso tras preparar los contratos y las pruebas iniciales. El agente principal completó
  implementación y validación.
- PostgreSQL aislado existente: 28 migraciones aplicadas, incluida
  20261118020000_administrar_sugerencias. La prueba sobre datos previos conserva autor, contenido,
  fecha y unicidad; inicializa meGusta=false y deletedAt=null.
- Backend: 110 pruebas aprobadas en 7 archivos focales: administración (unidad/HTTP/migración),
  envío HU-C02 (unidad/HTTP) y consulta/edición de normas (HTTP). Sin omisiones.
- Frontend: 86 pruebas aprobadas en 5 archivos de Comunidad y 6 casos SugerenciasAdmin de
  listados.spec.tsx (36 de otros módulos excluidos por -t). Carga/error/reintento/vacío,
  URL, paginación, foco, confirmación, bloqueo de duplicados, asignación y respuestas antiguas.
- Typecheck y lint de ambos workspaces aprobados. Nginx dev y TLS: nginx -t aprobado; certificados
  y upstreams temporales solo en harness, sin modificar el entorno habitual del usuario.
- 9 E2E únicos aprobados mediante ejecuciones focales: 5 HU-C03 y 4 regresiones HU-C02.
  ADMIN a 375/1280 px, axe sin serious/critical, sin desbordamiento, persistencia tras recargar,
  filtro, confirmación/Cancelar/Escape/foco, última página, errores y reintentos; Nginx real
  verifica roles/CSRF, corazón compartido y baja que no resucita por reintento.
  Regresiones: envío con respuesta perdida, ADMIN sin formulario de envío, borrador al reintentar
  normas y privacidad/idempotencia por proxy. Los tests que fallaban solo la primera consulta
  se hicieron deterministas ante el doble montaje de StrictMode: mantienen el error hasta
  Reintentar. Se repitieron únicamente los casos afectados; no se afirma una corrida única de 9.
- Sin suites completas, npm build, nuevas capturas ni comparación/regeneración visual.
  E2E usó Next dev con configuración temporal y emisión TypeScript del backend para el harness.
- Commits separados: modelo/migración, API/proxy, interfaz/pruebas y cierre documental.
  Se revisaron git diff --cached y --check antes de cada commit.
- Sin pendientes funcionales de HU-C03. Para activar esta versión fuera del ambiente aislado
  corresponde aplicar migraciones y actualizar los servicios. Validaciones integrales reservadas
  al cierre del módulo. No se implementó HU-C05 ni se creó PR/merge.
