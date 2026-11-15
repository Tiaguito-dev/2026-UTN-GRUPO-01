# TASK-076: Experiencias públicas por materia
La búsqueda pública permite seleccionar materia y leer hasta cinco experiencias recientes de esa materia. Ambas opciones de lectura y búsqueda usan el mismo catálogo. El límite se aplica en servidor. Iniciar sesión para leer más conserva la materia. Mantener animación y marca. Verificar con más de cinco experiencias en una materia y datos de otra.

## Validación
Prueba HTTP con PostgreSQL y tres pruebas de interfaz aprobadas. Se verificó el máximo de cinco comentarios por cada materia, que los parámetros no amplían el límite y que los recursos privados requieren sesión. Se verificó en el navegador que buscar y alternar entre dos materias actualiza el detalle y conserva la selección en el enlace de inicio de sesión.
