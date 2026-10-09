# TDD-DOCKER-H1: Stack local completo en contenedores

Actualización vigente: [TDD-UX-H1](./TDD-UX-H1.md) reemplaza el TLS local de desarrollo por HTTP
en loopback. Producción conserva HTTPS y certificados externos. Las decisiones de TLS local
que siguen describen la implementación anterior, no los comandos actuales.

Estado: Implementado y verificado; aprobación manual pendiente
Fecha: 2026-10-09

Los Dockerfiles existentes están vacíos; Compose solo cubre PostgreSQL/Mailpit. Se mantienen
Node 22.22.3, npm workspaces, Prisma/pg y Next.js. Contexto de build raíz con exclusiones
de env, Git, pruebas, node_modules y builds locales. Backend separa build/dependencias
productivas/runtime y target de migración; frontend usa salida standalone monorepo.

Proxy Nginx no root termina TLS en puerto alto y publica únicamente loopback. Credenciales
JWT/DB/SMTP desde configuración privada, sin fallbacks productivos. Certificado autofirmado
local generado explícitamente en volumen por servicio de una ejecución; producción requiere
certificado confiable. Proxy tiene IP explícita en red configurable y backend confía solo
en esa IP; cabeceras reenviadas se sobrescriben. No se debilita control HTTPS del backend.
SMTP plaintext solo desarrollo explícito, con host local/container autorizado por configuración.

Cada servicio usa init, pids_limit, stop_grace_period, límites de memoria/CPU y logs rotados.
Apps/proxy read_only, tmpfs y cap_drop ALL/no-new-privileges; DB conserva volumen existente
y ejecuta como postgres, con escrituras necesarias. Healthchecks de proceso/HTTP/pg; readiness
del backend incluye SELECT 1 sin detalles internos. Migraciones esperan DB y preceden backend;
no provisión automática de ADMIN. Gzip para recursos públicos, excluido /auth y /reset-password.
Gracia de parada efectiva requiere enableShutdownHooks en Nest para desconectar Prisma.

Validación en proyecto Compose aislado, sin borrar volúmenes del desarrollador. Dockerfiles
y configuración documentados por módulo. Esto no modifica decisiones de hosting cloud H1.

Por solicitud del desarrollador se separan dos archivos completos e independientes:
`docker-compose.yml` productivo y `docker-compose.dev.yml` de desarrollo. Producción fija
NODE_ENV=production, SMTP TLS implícito, configuración pública y credenciales obligatorias,
certificados externos de solo lectura y PostgreSQL sin puertos publicados. Desarrollo conserva
Mailpit y generación TLS explícita, puertos de herramientas en loopback e imágenes con tag dev.
Se utilizan proyectos, volúmenes y subredes diferentes por entorno; no combinar archivos como
overrides ni usar el mismo nombre de proyecto. Desarrollo sirve builds compilados para validar
flujos; recarga automática sigue disponible mediante npm local, no se incorpora aquí.
