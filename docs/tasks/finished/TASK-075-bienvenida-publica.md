# TASK-075: Bienvenida pública Opción 2

TASK-076 reemplaza la muestra global descrita aquí por una muestra por materia.

Reemplazar / en una rama derivada de desarrollo. Conservar animación de entrada y usar BrandMark, nombre y tipografía actuales. Catálogo público por búsqueda. Mostrar las cinco experiencias recientes de todo el sitio mediante un único feed público fijo, sin paginación ni acceso alternativo público por materia. Solo textos de experiencias vigentes y nombre de materia, sin identidad de autor. Para leer más o publicar, enlazar al login con retorno a la ruta protegida correspondiente. Mantener los guards existentes y probar el límite en servidor, UX y arranque local. Sin dependencias nuevas ni publicación.

## Verificación
El límite es global y se aplica en la consulta del servidor. La prueba HTTP con PostgreSQL crea siete experiencias vigentes de dos materias y comprueba que solo se entregan cinco. También comprueba exclusiones, ausencia de datos de autor y autenticación para leer el feed completo o publicar. Tres pruebas de interfaz cubren catálogo, muestra y acceso al login.

La vista local en el puerto 3500 confirmó el logo actual, la entrada sin encabezado, la búsqueda de dos materias y el paso desde la muestra al login. La animación revela el SVG existente mediante CSS y conserva la secuencia de la prueba de Opción 2. Queda pendiente regenerar las capturas comparativas del test visual en el entorno Linux especificado.
