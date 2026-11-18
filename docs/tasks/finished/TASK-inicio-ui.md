# Ajustes de presentación de Inicio

## Alcance y aceptación

Encabezado del feed con acciones agrupadas; variante de ExperienceCard limitada a Inicio con interacciones dentro de la tarjeta; ocultamiento propio confirmado usando contratos existentes; selector de materia/cursada/comisión con pasos, opciones compactas y navegación accesible. Mantener datos, anonimato, likes, respuestas, enlaces, consultas y paginación.

## Decisiones previas

- No se encontró HTML de propuesta en los archivos disponibles: se aplican los criterios escritos por el usuario, sin afirmar fidelidad a una referencia ausente.
- No cambiar primitivas, layout, autenticación, políticas ni backend. CSS Modules acotados y puntos de composición opcionales preservan otros usos.
- El feed público omite versión privada: obtener el detalle propio autorizado antes de confirmar ocultamiento, comprobar aprobación y enviar su versionModeracion. En 409 cerrar confirmación y actualizar feed; conservar mensajes seguros.
- Selector con selección explícita y Siguiente/Anterior, conservando los servicios y la comprobación final de comisión vigente. Dialog existente conserva Escape y restauración de foco.
- Por pedido explícito no ejecutar navegador ni pruebas visuales. Validación manual a cargo del usuario; no declarar E2E ni accesibilidad visual aprobados.

## Exclusiones

Sin cambios en Experiencias, Mis experiencias, detalle propio, reportes, Comunidad, IA/M1.3; sin dependencias, commits, push ni despliegue.

## Validación prevista

Tests relevantes de componentes y contratos, typecheck, lint, build y git diff --check. Reconstruir con Docker Compose oficial, comprobar healthchecks y dejar servicios levantados sin reinicializar datos.

## Implementación y evidencia

- `FeedPrincipal`: encabezado, descripción y grupo de acciones; mensajes persistentes al refrescar tras ocultamiento/conflicto.
- `ExperienceCard`: variante opcional `inicio`, pie y acciones secundarias por composición. Los usos sin variante conservan su presentación.
- `FeedbackInteracciones`: composición opcional del pie, íconos y estados activos; endpoints y lógica de likes/respuestas conservados.
- `HideFeedExperienceAction`: consulta privada autorizada, comprobación de pertenencia/estado, Dialog, versión, bloqueo de doble envío, errores seguros y refresh. Sin eliminación ni restitución en feed.
- `SeleccionComisionComentario` y CSS Module: radios, tres pasos, invalidación de dependencias al cambiar selección, búsqueda/paginación existentes y área de resultados desplazable con navegación accesible fuera del scroll.
- React: revisadas composición, hooks, peticiones bajo interacción, controles nativos, labels y ausencia de controles anidados. Sin cambios a primitivas globales.
- Tests: 76/76 en `inicio-ui.spec.tsx` (22) y `feedback-components.spec.tsx` (54), log `.tmp/inicio-components-final-tests.log`; 88/88 adicionales en seis suites de regresión, log `.tmp/inicio-regresion.log`.
- Primeras ejecuciones fallaron al introducir los nuevos controles; se adaptó solamente el bloque de publicación de Inicio. La prueba de conflicto detectó dos avisos idénticos: se conservó un único Notice del padre y la reejecución pasó.
- No se ejecutó navegador ni E2E. Apariencia a 360/600 px/escritorio, contraste efectivo, Escape y foco nativo quedan para validación manual del usuario. Las pruebas de componentes usan mocks de servicios y no prueban persistencia real.
- Typecheck y lint finales: exit 0, logs `.tmp/inicio-typecheck-final.log` y `.tmp/inicio-lint-final.log`. `git diff --check` sin errores.
- Build Docker de producción frontend satisfactorio (Next.js 16.3.8), log `.tmp/inicio-docker-build.log`. El primer `up --build --wait` devolvió 1 aunque todos los servicios estaban healthy y migrate terminó 0; no se identificó la causa de ese código de salida. La reejecución `docker compose -f docker-compose.dev.yml --profile mail up -d --wait backend frontend proxy postgres mailpit` terminó 0, todos healthy. Migraciones sin pendientes.
- Stack oficial levantado en http://localhost:8080/home con PostgreSQL de desarrollo conservado. Mailpit en http://localhost:8025. Sin seed, reinicialización, cambios de backend ni commits.

## Estado de cierre

Implementación y validación automatizada terminadas. Aceptación visual/manual pendiente del usuario. No se afirma coincidencia exacta con HTML no disponible ni validación E2E de estos ajustes.
