# TASK-077: Identidad visual en carga y acciones

Usar el isotipo vigente como favicon. Reutilizar la revelación del logo en los estados de carga de pantalla y datos, con un ciclo más breve y movimiento reducido. Mantener mensajes accesibles, guards, navegación y lógica de sesión. Presentar los enlaces de acceso de la bienvenida como botones, con su semántica de enlace. Validar favicon, estilos y flujos.

## Verificación
El favicon se sirve con HTTP 200 y figura como icono en el HTML. El indicador compartido conserva los mensajes de estado y usa la misma revelación de la bienvenida, repetida cada 950 ms cuando el movimiento está habilitado. En el navegador, el acceso para leer más conserva la materia seleccionada y usa el estilo de botón. Pasaron 96 pruebas de regresión de bienvenida, sesión, navegación y listados.
