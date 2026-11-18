# HU-C05 — Consultar términos y condiciones

## Alcance y restricciones
En feat/modulo-comunidad, incorporar debajo de los bloques existentes de Comunidad para USER
y ADMIN: «Términos y condiciones», «Consultá las condiciones de uso de nuestra plataforma.»
y «Ver términos y condiciones». Consultar el documento completo y versión vigente en modal.
Sin nuevos endpoints, modelos, migraciones, dependencias ni modificación del texto, aceptación
o registros históricos. Sin validación integral del módulo, PR ni merge.

## Decisiones previas y autorización de alcance
- El pedido autoriza tocar AccountForm exclusivamente para extraer su visualización de términos.
  Conservar su carga, versión enviada, checkbox, validaciones y manejo de versión desactualizada.
- Crear components/terminos/TerminosDialog como visor de dominio, reutilizando Dialog y trasladando
  solo estilos del documento desde TerminosRegistro.module.css. Sin duplicar texto ni alterar
  primitivas globales/autenticación. Recibe documento o carga/error/reintento de su consumidor.
- Comunidad carga por demanda al abrir con obtenerTerminosCondiciones y GET /auth/terms existente.
  Cada apertura consulta la versión vigente; cerrar/desmontar invalida respuestas pendientes.
  Un error ofrece reintento y cierre; consultar nunca envía aceptación ni toca formularios.
- Mantener foco dentro del modal y retorno al botón/enlace, Cerrar/X/Escape, región desplazable
  y estilos con tokens. Sección común debajo de ambas composiciones, aun si fallan las normas.

## TDD y validación focal
Caracterizar registro y comprobar RED del nuevo componente antes de producción. Probar visor,
consulta USER/ADMIN, documento/versión, carga/error/reintento, cierre y respuestas antiguas;
registro obligatorio y datos/checkbox intactos. Reusar ambiente y harness Next dev existente.
Ejecutar unitarias de términos/registro/Comunidad, typecheck y lint front, y solo E2E relevantes
con backend real para igualdad del documento y ausencia de escrituras de consentimiento.
Sin suites completas, build general, snapshots ni capturas redundantes.

## Cierre

- Delegación front/test y gate previos. Caracterización del registro y servicio: 12 aprobadas.
  RED del visor y de Comunidad comprobado por imports inexistentes antes de cada implementación.
- Validación final focal: 39 pruebas aprobadas en registration-terms, terms-service,
  terminos-dialog, community-terms y community (5 archivos). Typecheck y lint front aprobados.
- 6 E2E únicos aprobados con repeticiones focales, usando el ambiente existente y Next dev:
  USER/ADMIN a 375/1280 px, sección debajo de los bloques, documento completo y versión comparados
  con GET /auth/terms real, cierres Cerrar/X/Escape, teclado/foco, fondo inerte y borrador intacto.
  También error/reintento y registro real: sin checkbox no crea cuenta; al marcar registra la
  versión vigente. Las consultas conservan exactamente los registros de AceptacionNormas.
- Diagnóstico de teclado: Tab hacia la interfaz de Chrome devuelve BODY con hasFocus=false
  aunque :modal siga activo. Se corrigió la expectativa del test para verificar Tab/Shift+Tab
  entre controles y bloqueo del fondo; no cambió Dialog ni la implementación. El fixture de login
  espera el foco inicial del PageHeader. No se modificaron timeouts ni se generaron capturas.
- Se conserva y traslada la excepción de tabindex de la región desplazable para lectura con teclado.
- Commits separados de extracción, consulta y cierre documental; revisión git diff --cached
  y --check. Sin nuevas dependencias, endpoints, migraciones, modelos o cambios en términos,
  validaciones de aceptación o backend. Sin suites completas ni builds; no se inició el cierre integral.
- Sin pendientes funcionales de HU-C05. La activación en el entorno habitual y la validación integral
  del módulo quedan fuera de esta entrega. No se creó PR ni se realizó merge.
