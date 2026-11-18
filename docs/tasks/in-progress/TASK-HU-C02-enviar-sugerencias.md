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
Pendiente de ejecución.
