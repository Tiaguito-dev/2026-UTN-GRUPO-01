# Resolver conflictos de PR de estética

## Alcance y autorización
Resolver PR 38, 37 y 39 contra desarrollo conservando funcionalidades, correcciones recientes, rediseño, nombre y logo. Autorizado por Luana en esta conversación.

## Exclusiones y restricciones
Sin funciones nuevas, dependencias, cambios directos a main o desarrollo, ni publicación sin aprobación final. Preservar archivos locales del directorio original.

## Decisiones
El commit a5b8f25 es el squash de desarrollo en main. Usar su contenido como base de la combinación evita falsos conflictos por historia duplicada. Registrar ambos padres reales en el commit de integración. Conservar ambas entradas de CHANGELOG. Propagar la integración a nombre y logo mediante merge sin reescribir historia.

## Criterios de aceptación
Las tres propuestas contienen desarrollo y conservan los commits estéticos. Ningún marcador pendiente. Backend idéntico a desarrollo. Tipos, lint, pruebas frontend y build verificados. Destino remoto desarrollo tras aprobación.

## Validaciones
Pendientes.