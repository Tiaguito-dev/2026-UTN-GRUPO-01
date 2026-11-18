# HU-C02 — Enviar sugerencias a los creadores

## Alcance y base
Continuar en feat/modulo-comunidad, worktree .tmp/modulo-comunidad, base HU-C04 c65cadb verificada idéntica en local/upstream/GitHub. Sin cambios locales pendientes ni modificación de commits anteriores. Solo HU-C02; sin bandeja, likes, borrado, estados, feed o términos. Push autorizado al cerrar; sin PR/merge/force push ni siguiente historia. Conservar workspace original. Leer perfiles back/front/test y skill commit-work.

## Análisis y decisiones previas
- Reutilizar módulo community, consultas/edición de normas y guards; USER recibe formulario, ADMIN conserva HU-C04. Autorización real backend, no tema como seguridad. Sin dependencias nuevas ni cambios de autenticación, hooks/estilos globales.
- Entidad Sugerencia: UUID, usuarioId FK User Restrict, categoria enum CategoriaSugerencia (MEJORA_PLATAFORMA, NUEVA_FUNCIONALIDAD, REPORTAR_ERROR, CORRECCION_ACADEMICA, OTROS), contenido texto <=5000, createdAt default now, solicitudId UUID. Índice único compuesto usuarioId/solicitudId para idempotencia; índice de creación para futura HU-C03 sin implementar su UI/estados. Nueva migración 20261118010000_sugerencias; no seeds ni modificación de normas/aceptaciones.
- POST /comunidad/sugerencias, sesión USER exclusiva, Origin/CSRF existentes; body estricto {solicitudId,categoria,contenido}. Autor de authUser, fecha de base; rechazar id/autor/fechas ajenos. Trim contenido, min1/max5000, enum y UUID válidos. Respuesta 201 {id,createdAt}, sin retornar contenido/autor ni crear endpoint de lectura. No listar sugerencias en Comunidad ni exponerlas a otros usuarios; administración se implementará en HU-C03.
- Caso RegistrarSugerencia.execute(body,usuarioId), puerto SugerenciasRepository.registrar(input,usuarioId), dominio y repositorio Prisma en community. Inserción con unicidad y comparación del contenido normalizado: mismo usuario/solicitud/payload devuelve mismo id/fecha; reutilizar clave con otro contenido/categoría da409 sin sobrescribir. Usar createMany skipDuplicates + findUnique bajo transacción (sin catches genéricos de unicidad que oculten otros errores). Garantizar concurrencia con prueba PostgreSQL real.
- Frontend servicio registrarSugerencia con protectedPost y esquema de respuesta. Clave UUID estable por intento y payload normalizado, conservar ante fallo/reintento, renovar solo tras éxito o nueva operación explícita. Reutilizar patrón FeedbackRespuestaForm: si se cambió contenido de intento incierto, pedir confirmación/acción explícita para nueva sugerencia, sin generar claves nuevas automáticamente que dupliquen un envío previo ambiguo. Bloqueo ref/disabled mientras envía; error conserva borrador; éxito exacto de HU y reset completo. Más de una sugerencia legítima usa nuevas claves.
- Formulario con título/descripcion/privacidad exactos de HU, selector obligatorio sin selección por defecto y cinco etiquetas provistas, textarea requerida con contador/límite5000, Enviar sugerencia. Validaciones/foco/avisos existentes; texto plano sin HTML/rich text ni storage de borradores privados.
- Distribución local CSS Module: mensaje del equipo encima, normas y formulario lado a lado en escritorio; formulario después de las normas en móvil. Mantener estilo USER y tema ADMIN, sin alterar su formulario de normas. Consulta/error de normas no debe inventar contenido ni hacer públicos envíos.
- Nginx dev/TLS agrega únicamente location exacto /comunidad/sugerencias, autenticación/CSRF en backend. Validar ruta real en proxy temporal; sin modificar proxy/aplicación local del usuario.

## TDD y aceptación
Gate previo a producción. Test escribe RED backend/frontend/migración antes de implementación. Cubrir CA01–12: visibilidad por rol/categorías, envío/confirmación/reset, errores/retención, campos/límites, claves concurrentes/reintentos/409/nuevas operaciones, USER201/ADMIN403/sin sesión401/CSRF, autor/fecha, privacidad sin GET, persistencia tras reconstruir app, Nginx, teclado/axe/375-1280 y regresiones HU-C01/04/06.

Node22.22.3; PostgreSQL/Mailpit/Nginx temporales reutilizados y exclusivos, suites completas, tipos/lint/build ambos. Capturas USER escritorio/móvil y confirmación; referencias previas conservar si no cambian pantallas oficiales. Registrar comandos/resultados reales. No tocar datos de desarrollo.

## Commits previstos
1. Modelo/migración y prueba de persistencia/unicidad.
2. Registro backend idempotente, endpoint/proxy y regresiones.
3. Formulario/distribución frontend con pruebas.
4. CHANGELOG/evidencia/cierre de tarea. Revisar staged diff y mantener mensajes españoles.

## Evidencia
- RED inicial de RegistrarSugerencia/SugerenciaForm por imports inexistentes y de migración por SQL todavía ausente, ejecutados en Node22.22.3. Luego migración27 aplicada exclusivamente a comunidad_test; tres pruebas de esquema/persistencia aprobadas.
- Modelo/migración guardados en `fd68682`; endpoint privado idempotente, validaciones/permisos, Nginx y pruebas en `739d54e`. No se modificaron commits anteriores.
- Backend focal: 23 unitarias y 25 HTTP aprobadas. Suite completa final: 1383 pruebas/67 archivos y typecheck/lint/build aprobados. Concurrencia, claves compartidas entre usuarios, reintentos,409, persistencia tras nueva instancia de app y ausencia de GET público verificados con PostgreSQL.
- Proxy RED confirmó404 en lugar de401 antes del location nuevo; tras agregarlo, nginx -t dev/TLS y el caso E2E de permisos/CSRF/idempotencia aprobaron, sin tocar proxy local del usuario.
- Frontend focal 44 casos aprobados; suite completa 1100/97 archivos aprobada. Controles nativos locales conservan IDs/descriptores accesibles y disabled durante envío: FormField actual no soporta textarea ni prop disabled; se reutilizan Card, Notice y useFormSubmission sin ampliar primitivas globales. Sin storage de borradores privados.

## Resultados finales y comandos
- `npm run test --workspace=back -- --maxWorkers=1 --reporter=dot`: **1383 pruebas en 67 archivos aprobadas**, sin omisiones; 51 nuevas de HU-C02 (23 aplicación, 25 HTTP, 3 migración). Ejecutadas con TEST_DATABASE_URL y Mailpit temporales explícitos. Typecheck, lint y build backend aprobados.
- `npm run test --workspace=front -- --maxWorkers=1 --reporter=dot`: **1100 pruebas en 97 archivos aprobadas**, sin omisiones; 20 nuevas entre formulario, servicio y conservación del borrador al cargar/reintentar normas. Typecheck, lint y build frontend aprobados; lint repetido tras los ajustes finales de E2E, también aprobado.
- Navegador: `npx playwright test --config=playwright.config.ts front/tests/community-suggestion.browser.spec.mjs front/tests/community-admin.browser.spec.mjs front/tests/community.browser.spec.mjs front/tests/visual.browser.spec.mjs front/tests/auth.browser.spec.mjs --grep 'HU-C0[124]|visual|logout sincroniza|roles backend reales'`, con COMMUNITY_PROXY_URL del namespace aislado. **31 casos únicos verificados con repeticiones focalizadas**: 7 HU-C02, 9 HU-C04, 7 HU-C01, 6 visuales y 2 de sesión/autorización. Las 28 referencias existentes compararon correctamente, sin regenerarlas ni modificarlas.
- Dos corridas completas tuvieron 30/31 aprobados cada una por preparación de interacciones. La primera falló esperando error de transporte, pero la captura mostraba texto vacío y validación previa al POST. El caso aislado instrumentado verificó servidor201, respuesta abortada, reintento explícito con idéntico UUID/payload y una sola fila. Se reforzó openForm esperando el foco inicial del PageHeader y fill comprobando categoría, contenido y contador antes de enviar, sin esperar GET de normas.
- La segunda corrida aprobó los siete casos HU-C02 y falló en un reintento por teclado ADMIN de HU-C01. Se respetó el mismo foco inicial y se usó `retry.press('Enter')` en lugar de dos operaciones separadas de foco/teclado global. Los dos casos focales USER/ADMIN aprobaron (11,2 s totales). No se aumentaron timeouts, no se relajaron aserciones ni se cambió producción por estas incidencias. No se afirma una corrida única de 31 verdes. Se retiraron todos los registros temporales de diagnóstico.
- Ambos Nginx aprobaron `nginx -t`, con upstreams del harness y TLS efímero. El nuevo location exacto pasó RED404→GREEN: POST sin sesión401, ADMIN403, CSRF obligatorio, USER201, recibo mínimo, reintento igual y GET ausente404.
- Axe sin infracciones serious/critical, teclado, ausencia de overflow y posición relativa normas/formulario comprobados a 375/1280. Cuatro capturas de revisión en `.tmp/community-suggestion-captures`: `user-{375,1280}-formulario.png` y `user-{375,1280}-confirmacion.png`. Inspección visual de formulario desktop y confirmación móvil; cabecera sticky en scroll superior.
- Entorno: Node22.22.3, PostgreSQL17 temporal; Chromium156 para Comunidad y Chrome158.0.8127.36/Linux para referencias. Sin nuevas dependencias ni cambios de autenticación, hooks/estilos globales, normas existentes o aceptaciones históricas.

## Criterios cubiertos
| Criterio | Evidencia |
| --- | --- |
| CA01/CA02 | Formulario USER exclusivo, sin selección inicial, cinco categorías exactas; ADMIN sin formulario. |
| CA03/CA04 | POST real persiste autor/fecha/categoría/texto, recibo confirmado, agradecimiento exacto y reset; otra sugerencia usa nueva clave. |
| CA05 | Front/back validan categoría, texto vacío/espacios, UUID/propiedades y límite5000, con foco al primer error. |
| CA06 | Fallo conserva datos y clave; reintento explícito funciona aun si la primera respuesta se pierde. |
| CA07 | Ref/disabled en frontend; unicidad y transacción ReadCommitted en PostgreSQL, peticiones concurrentes y reintentos devuelven mismo ID/fecha con una fila. |
| CA08 | USER201, ADMIN403, sin sesión401 y CSRF comprobados por HTTP y Nginx; autor proviene de sesión. |
| CA09 | Sin GET/listados propios o ajenos, respuesta sin contenido/autor, texto privado no reaparece en Comunidad ni se guarda en storage. |
| CA10 | Nueva instancia de la aplicación conserva la fila PostgreSQL y reconoce la misma operación. |
| CA11 | Normas/formulario adyacentes desktop y formulario debajo móvil, medidos en navegador; axe y teclado aprobados. |
| CA12 | Suites completas y checks ambos proyectos, consulta/edición/tema/sesión y 28 referencias preservados. |

## Archivos y commits
- `fd68682 feat(back): incorporar persistencia de sugerencias`: schema, nueva migración, prueba de conservación/unicidad y planificación.
- `739d54e feat(back): registrar sugerencias privadas sin duplicados`: dominio/puerto/caso/repositorio nuevos dentro de community; controller/módulo existentes, tests y OVERVIEW; locations Nginx dev/TLS y documentación de infraestructura.
- `0631adf feat(front): enviar sugerencias privadas desde Comunidad`: SugerenciaForm y CSS Module, composición responsive del documento, tipos/validaciones/formato, esquema/servicio, OVERVIEW y regresiones unit/browser.
- Cuarto commit documental para CHANGELOG y este cierre. Staged diffs revisados y diff --check aprobados; historia previa conservada.

## Decisiones y continuidad
La clave identifica una operación, no el contenido global: distintas sugerencias legítimas pueden repetir texto con claves nuevas. La misma operación exige payload normalizado idéntico; usar la clave con otro payload devuelve409 sin sobrescribir. El formulario conserva su intento en memoria hasta éxito o Nueva sugerencia explícita; abandonar la pantalla inicia otro formulario, sin persistir contenido privado en el navegador. El mensaje de intento incierto explica esa decisión al usuario.

Nueva migración `20261118010000_sugerencias`: tabla/enum/FK/índices, sin seeds ni estados. Las migraciones HU-C01/HU-C04 permanecen intactas. Para activar esta versión en un entorno: `npm run db:deploy --workspace=back`, generar Prisma y reconstruir backend/frontend/proxy. No se actualizó la base ni la aplicación local activa del usuario.

Sin pendientes funcionales conocidos de HU-C02. Bandeja, likes, eliminación/estados, términos y feed permanecen fuera de alcance. Publicar solo en feat/modulo-comunidad, conservar seguimiento remoto y rama para próximas HU autorizadas; sin PR, merge, force push ni eliminación. Los cambios originales del workspace se preservaron.
