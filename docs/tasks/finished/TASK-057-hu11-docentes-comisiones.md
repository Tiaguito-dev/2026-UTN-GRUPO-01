# TASK-057: HU-11 docentes de comisiones

Estado: Implementada; preparada para revisión del desarrollador. Fecha: 2026-10-28.
Rama: feat/hu11-docentes-comisiones (desde desarrollo local).

## Alcance y criterios

Integrar gestión de docentes en edición administrativa de comisión: visualizar, asignar
profesores registrados, cambiar TITULAR/ADJUNTO/JTP y desvincular sin borrar entidades.
Persistir mediante servicios existentes, confirmar servidor antes del éxito, evitar duplicados,
mostrar carga, errores y reintentos. Solo ADMIN mediante guards existentes en front y back.
Sin cambios de autenticación, layout, hooks compartidos, esquema ni dependencias.
Sin commit, push ni PR. Parche solicitado ausente en raíz.
Restaurar las dependencias existentes con npm ci es necesario para los checks solicitados;
no se agregan dependencias ni se modifica el lockfile.

## Decisiones previas a implementación

Prisma ya modela Materia -> Cursada (año/período) -> Comisión -> ComisionProfesor -> Profesor.
La clave compuesta comisión/profesor permite varios profesores con un cargo cada uno.
Cursada no tiene profesor directo: la docencia del período deriva de sus comisiones.
No reintroducir la relación histórica retirada (TASK-055).
Ya existen asignarProfesorComision (upsert de cargo), quitarProfesorComision y listado paginado,
así como gestión en ComisionDetail. Reutilizar su editor de docentes a nivel de módulo;
operaciones con guardado individual explícito, independientes del número/carrera, para evitar
simular atomicidad de endpoints separados. Comunicar ese comportamiento en la pantalla.

## Validación y TDD

Testing escribe primero cobertura de integración del editor y ejecuta RED antes de cambios
de producción. Backend audita contratos, permisos y persistencia y pruebas existentes.
Frontend reutiliza editor actual y estilos. Ejecutar tests, typecheck, lint y builds existentes.
Integraciones SQL solo sobre base exclusiva de pruebas si está disponible; registrar omisiones.
Registrar evidencia, archivos y limitaciones al terminar; actualizar CHANGELOG y OVERVIEW.

## Implementación y evidencia

- Extraído `academic/DocentesComision` para reutilizar la misma gestión en detalle y edición.
  Usa `useAllPages`, `FormField`, `Notice`, tipos y servicios existentes. El catálogo conserva
  el límite existente de 2000 opciones y muestra error si no puede cargarlo completo.
- Respuestas PUT confirmadas actualizan asignación/cargo; DELETE confirmado quita únicamente
  la asociación. Hay exclusión de docentes asignados, bloqueo de doble envío y guardados cruzados,
  feedback de éxito/error y reintento. Guards ADMIN existentes conservados en ambos extremos.
- TDD real: 7 fallos y 2 aprobadas antes de integrar (ausencia de controles en EditarComision).
  Después: 24/24 aprobadas en hu11-docentes-comisiones, hu11-editar y comision-detalle.
  Nueve tests nuevos de interfaz y dos integraciones SQL/HTTP nuevas para sesión y roundtrip.
- `npm ci` restauró dependencias desde lockfile; sin cambios de versiones. Primer intento
  aislado interrumpido al no avanzar, segundo con permisos completado. Node disponible 24.22.0
  y npm 11.19.1; no se encontró Node 22.22.3 fijado. Validación limitada a ese runtime disponible.
- Pruebas de recarga de interfaz usan servidor simulado. TEST_DATABASE_URL no está definido;
  las integraciones PostgreSQL reales y el recorrido Playwright requieren base exclusiva.
  No se utilizó DATABASE_URL de trabajo ni se migraron bases existentes.
- `npm run test --workspace=front`: 335/335, 41 archivos aprobados.
- `npm run typecheck --workspace=front` y `npm run lint --workspace=front`: aprobados.
- `npm run build --workspace=front`: aprobado, 26/26 páginas generadas.
- `npm run db:generate --workspace=back`, `npm run typecheck --workspace=back`,
  `npm run lint --workspace=back` y `npm run build --workspace=back`: aprobados.
- Lint específico de archivos fuente y pruebas modificadas aprobado; `git diff --check` aprobado.
- `npm run test --workspace=back -- --maxWorkers=2`: 617 aprobadas, 167 omitidas por
  configuración DB/SMTP ausente. Primer intento sin límite tuvo un timeout de cinco segundos
  en DI de Brevo bajo carga concurrente; repetir la suite completa con dos workers pasó.

## Criterios cubiertos y límites

Implementados visualización, selección de profesores registrados, múltiples asociaciones,
los tres cargos, modificación, desvinculación, confirmación del servidor y recarga desde GET.
Pruebas de interfaz cubren duplicados, envío pendiente, fallos, reintento, catálogo paginado,
recarga simulada y guard ADMIN. Persistencia real, 401/403 y conservación de profesor cuentan
con cobertura HTTP/SQL existente y ampliada, pero esa cobertura quedó omitida en este entorno.
Pendientes: ejecutar integraciones y Playwright con DB/SMTP de pruebas y repetir checks sobre
Node 22.22.3. No se declara aprobada ninguna de esas verificaciones pendientes.
Cambios locales preparados para revisión, sin commit, push ni PR.

## Ajuste de interfaz solicitado (2026-10-28)

Quitar el acceso superior redundante a Asignar profesor. Separar la tarjeta de los botones
de datos de comisión con espaciado local. Convertir el formulario de asignación en sección
plegable inicialmente abierta; cerrarla solo tras asignación confirmada, manteniendo docentes
y éxito visibles. Permitir reabrir para asignar otro; ante error permanece abierta.
No cerrar la pestaña del navegador ni ocultar el listado de profesores. Tests primero para
ausencia del acceso duplicado, plegado tras confirmación y reapertura. Sin cambios backend.

Implementado: separación de 1,5 rem con token existente, acceso superior eliminado y sección
details/summary inicialmente abierta. Al confirmar asignación se pliega y el foco vuelve al
summary; el listado y el éxito permanecen visibles. Ante error se abre y conserva los datos.
RED real: 3 fallos / 13 aprobadas antes de código. GREEN: 24/24 en los tres archivos relevantes,
incluyendo confirmación pendiente, error, cierre, foco y reapertura. Sin cambios backend.
Verificación del ajuste: typecheck, lint completo y build oficiales del frontend aprobados;
Next generó 26/26 páginas. `git diff --check` aprobado. Contenedores sin reconstruir:
para visualizar el ajuste en Docker ejecutar
`docker compose -f docker-compose.dev.yml up -d --build --no-deps frontend`.

