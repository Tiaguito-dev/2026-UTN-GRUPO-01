# Actualizar el nombre visible de la aplicación

## Alcance

Solicitud explícita de Luana: usar `Professors' butchery` como nombre visible. Incluye encabezado compartido, portada, inicio, metadata de páginas y documentación del frontend. Se autoriza el cambio textual en encabezado y metadata raíz.

## Exclusiones

Sin cambios de rutas, identificadores técnicos, configuración, backend ni comportamiento. Sin reemplazar menciones históricas en tareas anteriores.

## Criterios y validaciones

- Nombre consistente en encabezado, contenido y títulos del frontend.
- Actualizar las expectativas de navegación para el nuevo nombre accesible sin cambiar enlaces.
- Ejecutar lint y pruebas de navegación existentes.

## Decisión

Conservar exactamente la capitalización y apóstrofo solicitados. En JSX, escapar el apóstrofo como entidad HTML; en metadata y strings, conservar el carácter literal.

## Resultado

Nombre actualizado en el frontend. Lint aprobado; 33 pruebas de navegación aprobadas. Diff revisado sin errores de espacios. Rama `style/nombre-aplicacion` creada desde la rama de rediseño para conservar la vista actual. No se modificaron main ni desarrollo.
