# Aceptación de términos en el registro

## Alcance y autorización
Solicitud explícita: trasladar el consentimiento del primer comentario al alta pública de cuenta. Incluye autenticación, contrato HTTP, persistencia, formulario/modal de registro y eliminación del gate de comentarios. Sin push, merge, despliegue, nuevas dependencias ni cambios ajenos. Se usa la rama `feat/terminos-en-registro`, desde desarrollo `ed43214`, en el worktree aislado existente.

## Decisiones previas a implementar
- Fuente única: documento estructurado del backend, expuesto por `GET /auth/terms` público como `{version, secciones: [{titulo, parrafos: string[]}]}`. Frontend valida con Zod. Versión inicial `terminos-2026-11-17`, distinta de la versión histórica `1` de normas; no se reinterpretan aceptaciones previas.
- Alta pública exige `aceptaTerminos: true` booleano estricto y `versionTerminos` igual a la publicada. Campo ausente/falso/no booleano devuelve 400 con “Debés aceptar los términos y condiciones para crear tu cuenta”. Versión obsoleta exige releer y aceptar el documento vigente, conservando el formulario. Provisión administrativa conserva su contrato sin fabricar consentimientos.
- Reutilizar `AceptacionNormas`: alta de usuario y aceptación mediante escritura anidada Prisma atómica, fecha con default de PostgreSQL. No hace falta modificar el modelo ni migrar datos. Cuentas existentes y aceptaciones históricas permanecen intactas. La publicación ya no consulta ni registra consentimiento; conserva autoría, puntuación, estado de comisión, duplicados y permisos.
- Modal de módulo reutiliza Dialog nativo existente, con X y Escape, agrega botón Cerrar y contenido desplazable con CSS Module local. Checkbox sin selección inicial, error asociado; abrir/cerrar no modifica campos ni envía el formulario y restaura foco al enlace. Sin modificar estilos base, layout ni hooks compartidos.
- Accesibilidad del contenido largo: excepción local a `jsx-a11y/no-noninteractive-tabindex` para la región con nombre accesible y `tabIndex=0`. Se necesita foco por teclado para desplazar y leer el documento dentro del modal; no se desactiva la regla globalmente.
- Contenido: propósito académico, cuenta e identidad, experiencias propias, conductas prohibidas, responsabilidad, opiniones personales, moderación real y privacidad real. No hay política de privacidad independiente encontrada; no inventar enlace. Explicar datos de cuenta/sesión, publicaciones e historial, asociación interna aun bajo anonimato, administración autorizada y correo de verificación/recuperación. No prometer borrado/anonimato absoluto, afiliación, garantía ni canal de reportes inexistente.

## Criterios de aceptación
1. Registro desmarcado por defecto; texto exacto solicitado y bloqueo frontend/backend sin booleano true.
2. Documento completo accesible sin sesión, modal con título, foco interno, X/Cerrar/Escape y retorno al enlace; datos y casilla se conservan.
3. Registro válido persiste fecha real y versión vigente junto al usuario; registro inválido no crea aceptación ni cuenta.
4. Comentarios de cuentas nuevas y existentes funcionan sin pedir aceptación ni crear registros ficticios.
5. Se mantienen validaciones previas y provisión admin; errores de carga/versiones impiden aceptar términos no mostrados.

## Validación / TDD
Agente test escribe regresiones y obtiene RED antes de implementar. Backend: validación estricta, HTTP, persistencia y atomicidad con PostgreSQL exclusivo de prueba, usuario existente publica sin aceptación. Frontend: registro, servicio, modal/foco/teclado/datos, retiro de normas y suites afectadas, paridad de validadores. Ejecutar typecheck, lint, tests y build de ambos workspaces en Node 22.22.3. Pruebas con un worker por memoria disponible. No usar ni cambiar datos de desarrollo para integraciones. Registrar evidencia y pendientes concretos al cerrar en finished y CHANGELOG.

## Evidencia
- RED inicial: `tests/registration-terms.spec.ts`, 5 fallos contra desarrollo sin modificar (omisión, false, string, número y null no producen todavía el mensaje requerido). Ejecutado con Node 22.22.3 en `terms-back-check`.
- PostgreSQL 17 temporal exclusivo `terms_test`, sin volumen persistente ni puertos publicados; las 24 migraciones existentes aplican correctamente desde cero. No se usan datos de desarrollo.
- Backend GREEN: 1274 pruebas aprobadas en 56 archivos, con PostgreSQL real; 5 casos SMTP inicialmente omitidos se ejecutaron luego con Mailpit temporal y aprobaron (2 archivos, `--testTimeout=20000` por el entorno lento; un intento previo agotó 5000 ms). Total: 1279 pruebas backend aprobadas. Se comprobó documento público, rechazo HTTP estricto, versión vigente, fecha real, rollback y publicación de cuenta existente sin crear aceptaciones.
- `npm run typecheck --workspace=back`, `npm run lint --workspace=back` y `npm run build --workspace=back`: aprobados en Node 22.22.3. Prisma generado sin cambio de esquema.
- Frontend: suite completa de 90 archivos/1007 casos: 1004 aprobados y 3 expectativas antiguas del gate en `feedback-session-drafts` detectadas. Se actualizaron exclusivamente esas regresiones manteniendo protección de borradores; los 13 casos de ese archivo aprobaron en la repetición focalizada. Cobertura final verificada: 1007 casos. Modal (Cerrar/X/Escape, foco/datos/checkbox, versión obsoleta), servicio Zod y paridad backend/frontend aprobados.
- `npm run typecheck --workspace=front`, `npm run lint --workspace=front` y `npm run build --workspace=front`: aprobados en Node 22.22.3. Después del ajuste de pruebas se repitieron tipos/lint y el archivo afectado; no se modificó aplicación después del build.
- Revisión Git: `git diff --check`, revisión del diff staged (`git diff --cached`) y commits separados por backend/contrato/persistencia y frontend/interacción. No dependencias nuevas, migraciones, backfills, push, merge ni despliegue. El worktree original conserva sus cambios ajenos intactos.

## Pendiente concreto
No se ejecutaron Playwright ni capturas/revisión visual en navegador real: el entorno de pruebas no tiene Chrome/Chromium instalado. Foco, cierre, borradores y aceptación se verificaron con Testing Library/jsdom y la API con PostgreSQL/SMTP reales. Queda esa revisión visual móvil/escritorio; no se presenta como realizada.
