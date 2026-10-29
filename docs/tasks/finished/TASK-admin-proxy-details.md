# Corrección del enrutamiento de detalles administrativos

## Alcance
Corregir que los botones de detalle de todos los módulos fallan en el stack real. Mantener contratos, permisos y contenido. Sin commits. Reconstruir/reiniciar servicios afectados según autorización de la sesión.

## Causa y decisión
Los proxies dev y TLS sólo encaminan prefijos académicos y rutas exactas /users y /profesores. Falta /admin/ (detalles de todos los módulos), /users/ (estado/historial) y /profesores/ (detalle/edición/historial). Las peticiones caen en frontend y reciben HTML404. Agregar esos tres prefijos hacia backend en ambas configuraciones; conservar /home/admin y demás páginas en frontend. No se cambia router principal ni autenticación.

## Criterios
Los seis detalles administrativos llegan al backend a través del proxy, responden JSON y conservan 401 sin sesión, 403 sin permisos y 200 con ADMIN para registros existentes. Las rutas de estado de usuarios y detalle/historial de profesor también llegan al backend. Ningún dato de autenticación se expone. Validar nginx y recorrido real del stack. Documentar evidencia, actualizar OVERVIEW y CHANGELOG.

## Validación
Reproducir antes y después por HTTP en localhost8080. Prueba de regresión del enrutamiento. Verificar datos reales de las seis entidades en UI/API con fixtures propios y limpieza. Reiniciar proxy y comprobar salud. Sin reconstruir aplicaciones si no cambian.

## Resultado y evidencia
- Reproducción previa: `/admin/users/:id/detalle`, `/users/:id/historial` y `/profesores/:id` respondían 404 text/html detrás de localhost8080.
- Corregidos ambos proxies dev y TLS con los tres prefijos faltantes. Sin cambios de controllers, permisos, services ni schemas.
- `scripts/check-admin-proxy.mjs`: 16/16 comprobaciones aprobadas contra stack real; sin sesión las APIs responden401 JSON y las seis páginas frontend200 HTML.
- Chrome real contra localhost8080 con fixtures propios temporales: materias, profesores, cursadas, comisiones, usuarios y comentarios mostraron auditoría del identificador correcto, sin mensajes de error. En los seis endpoints ADMIN recibió200 con registro.id correcto y USER403. Login, API y páginas pasaron por Nginx, sin HTTP simulado. Fixtures y sesiones de prueba eliminados al terminar; se conservaron todos los datos existentes.
- Script reproducible de esa comprobación funcional local en `.tmp/admin-proxy-details-smoke.mjs` (requiere la base local explícita de la sesión); no agrega funcionalidad de creación ni modifica cuentas existentes.
- Proxy reconstruido/reiniciado con `docker compose -f docker-compose.dev.yml up -d --build --no-deps proxy`; `nginx -t` correcto. La configuración TLS recibe las mismas rutas; no se afirma una prueba TLS con certificado productivo.
- Sin commits. Mensaje sugerido: `fix(proxy): enrutar los detalles administrativos al backend`.
