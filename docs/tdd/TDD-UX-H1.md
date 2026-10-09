# TDD-UX-H1: Landing y simplificación del entorno local

Estado: Implementado y verificado; aprobación manual pendiente
Fecha: 2026-10-09

Reutilizar Next.js/React y CSS con tokens existentes. Hero centrado y CTA visibles; navegación
pública presenta proyecto/funcionalidades y muestra cuenta solamente con autenticación válida.
Carrusel client pequeño con perspectiva CSS, controles anterior/siguiente y teclado; sin autoplay,
con alternativa sin movimiento por prefers-reduced-motion y tarjetas legibles en móvil.
Las capacidades futuras se identifican como próximas, sin prometer funcionalidades implementadas.
No incorporar librerías de animación, fuentes remotas ni recursos de terceros.

Por decisión explícita del desarrollador, política de contraseña compartida de 8 a 128 caracteres
Unicode, sin recortar ni normalizar. Se actualizan dominio, frontend, mensajes, pruebas y docs;
los hashes existentes no requieren migración. Argon2id y límites de frecuencia se mantienen.

Compose dev usa proxy HTTP en loopback y configuración explícita AUTH_ALLOW_LOCAL_HTTP y
NEXT_PUBLIC_ALLOW_LOCAL_HTTP; URL pública, CORS y recuperación del mismo origen localhost.
Cookies HttpOnly/SameSite=Lax sin Secure únicamente en HTTP de desarrollo; configuración backend
existente rechaza esa excepción en producción. Nginx productivo y certificados externos no cambian.
No borrar volúmenes TLS/DB existentes; retirar generador TLS solamente del archivo dev.

El backend reconoce la excepción HTTP también cuando el socket pertenece al proxy controlado
de Docker, mediante la función de confianza compilada por Express. Solo se usa con la excepción
local habilitada y proxies configurados explícitamente; cabeceras reenviadas por un cliente no
confiado no autorizan transporte HTTP. La publicación del proxy permanece limitada a loopback.
