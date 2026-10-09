# TASK-011: Landing, UX de cuenta y HTTP local

Estado: Terminada; validación manual confirmada por el desarrollador el 2026-10-09
Fecha: 2026-10-09
Diseño: [TDD-UX-H1](../../tdd/TDD-UX-H1.md)

El desarrollador autoriza modificar layout, estilos y autenticación para mejorar la experiencia.
Implementar hero centrado con propósito del proyecto, descripción y CTA registro/login,
navegación pública sin accesos de cuenta, carrusel 3D de funcionalidades futuras accesible,
formularios modernos con paleta existente, mínimo de contraseña 8 caracteres consistente
en registro/reset/cambio. HTTP solamente en Compose de desarrollo local, conservando CSRF,
cookies HttpOnly y producción HTTPS. No crear funcionalidades académicas ni nuevas dependencias.

Validación: casos frontera 7/8 caracteres y regresiones backend/frontend; tipos y builds,
Compose dev real, recorrido navegador registro/login/mail/reset/cambio/logout, carrusel teclado,
movimiento reducido y móvil/escritorio. Documentar comandos y evidencias; sin commit automático.

## Resultado

Landing y formularios actualizados, con propósito del Team Charter, hero centrado y CTA,
navegación pública contextual y carrusel 3D de cuatro funcionalidades futuras. Componentes
pequeños, sin dependencias ni fuentes remotas; controles de teclado, foco, avisos de estado,
movimiento reducido y tarjetas con altura flexible. Revisada la skill React best practices.

Política coherente de 8–128 caracteres Unicode en frontend y dominio backend. No se normaliza
contraseña ni se modifica el hash existente; registro/provisión/reset/cambio reutilizan la política.
HTTP de desarrollo en `http://localhost:8080`, sin generador ni mounts TLS; producción HTTPS
intacta. Cookie HttpOnly/SameSite=Lax sin Secure solo en HTTP local explícito; CSRF/CORS y guards
vigentes. Ajustada la confianza del socket del proxy controlado para permitir HTTP local a través
de Docker, sin aceptar cabeceras falsificadas desde sockets no confiados.

## Evidencia

- Backend: 277/277 pruebas, 14 archivos, PostgreSQL y SMTP/Mailpit reales; concurrencia y roles.
  Incluye límites 7/8 ASCII/Unicode y máximo128 en registro/reset/cambio, hash verificable,
  rechazo sin consumo/revocación, y nueve casos de transporte HTTP/proxy/cabeceras falsificadas.
- Frontend: 38/38 pruebas, dos archivos. Tipos backend/frontend aprobados.
- Builds Docker con Node 22.22.3 aprobados, Compose validado y servicios saludables,
  migraciones exit 0; se conservaron las cuentas, sesiones y volúmenes existentes.
- Chromium contra stack real HTTP: landing escritorio1440 y móvil390/320 sin desbordamiento,
  hero centrado, CTA, navbar pública/contextual, carrusel flechas/Home y movimiento reducido.
  Formularios 7 rechazado/8 aceptado, registro/login, me/recarga, refresh, cambio, logout,
  rechazo de contraseña anterior/nueva aceptada, correo en Mailpit y reset de ocho caracteres.
  Token retirado de URL, cookies correctas para HTTP, sin credenciales en storage, CSRF403;
  sin errores de JavaScript. Capturas revisadas de landing escritorio/móvil y formulario móvil.
- Contraste sobre blanco de primary/hover/accent: 8.07/6.91/4.68:1; texto secundario6.00:1,
  borde de input3.24:1. Color centralizado en tokens; errores con texto y foco visible.
- No hay lint configurado; no se declara ejecutado. Tipos/tests locales con Node22.17.0.

La primera prueba HTTP encontró un 403 de transporte por socket Docker y se corrigió; pasada
final de navegador y regresión aprobadas. El recorrido comprueba este ajuste, no reemplaza la
matriz completa pendiente de etapa 5 ni la aprobación manual. SMTP probado con buzón local,
sin afirmar entrega externa. Tarea permanece en progreso hasta aprobación del desarrollador.

## Cierre vigente

El desarrollador confirmó que los cambios realizados quedaron comprobados el 2026-10-09.
Esta aprobación cierra la validación manual indicada como pendiente en la evidencia histórica
de esta tarea. Los controles anteriores conservan sus resultados y límites: no se afirma
una nueva ejecución de la matriz automatizada completa de navegador ni entrega SMTP real.
La configuración y navegación vigentes se describen en README y los OVERVIEW de cada módulo.
