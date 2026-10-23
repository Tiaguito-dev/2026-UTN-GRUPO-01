# TASK-027: Corregir carga incompleta de materias administrativas

Estado: En progreso
Fecha: 2026-10-22
Rama / PR: `feat/filtros-materias`, #14

## Objetivo y contexto

Corregir el P2 detectado en revisión: con 181 materias, `listarMaterias` limita páginas a 9
y `useAllPages` devuelve solo 180 tras 20 pedidos, sin avisar. El desarrollador autorizó
corregir y subir el arreglo a la misma PR, sin aprobarla ni mergearla automáticamente.

## Alcance y exclusiones

- Restaurar páginas de hasta 100 materias para los selectores administrativos.
- Mantener nueve por defecto y nueve por página en el listado de materias.
- Evitar presentar opciones parciales como si fueran el catálogo completo al superar el
  límite de 20 páginas del hook compartido. El arreglo autoriza este cambio puntual del hook.
- Pruebas de regresión, documentación de contratos y evidencia de validación.
- Sin cambios de autenticación, datos reales, estilos, migraciones ni dependencias nuevas.
- Push autorizado por el desarrollador; no crear otra PR ni realizar merge.

## Decisiones técnicas

La API `/materias` admite `pageSize` entre 1 y 100 y conserva default 9. Separar el tamaño
predeterminado del máximo en su validador, sin alterar los límites del historial (3).
El cliente conserva default 9 y permite solicitudes explícitas de 100; los listados ya
solicitan 9. El hook mantiene su tope de 20 páginas, pero si falta completar el total, o
recibe una página vacía prematuramente, devuelve error en vez de opciones incompletas.
Así se preserva el límite de recursos sin ocultar materias ni cargar datos indefinidamente.

## Criterios de aceptación

1. Con 181 materias se recuperan las 181 en los selectores y puede elegirse la última.
2. El listado mantiene nueve materias por página, filtros y búsqueda.
3. La API acepta 100, rechaza 101 y conserva default 9; historial conserva máximo 3.
4. Tras 20 páginas sin completar el total, el hook muestra error sin publicar una lista parcial.
5. Pruebas frontend, backend académico, typechecks y builds apropiados aprobados.

## Validaciones y resultado

Reproducción previa confirmada (hook y servicio reales): 20 solicitudes de 9, 180 opciones,
sin error, con total 181. Se trasladará a una prueba de regresión versionada.
Se valida contra la base exclusiva de pruebas y con datos ficticios, sin enviar correos reales.
Implementación completada; pendiente validación manual del desarrollador antes de cierre.

- TDD: se reprodujeron primero los fallos del tamaño explícito 100, las 181 opciones,
  el límite de 20 páginas y la página vacía prematura; luego aprobaron con la corrección.
- `npm run test --workspace=front`: 128 pruebas aprobadas en 12 archivos.
- Suite backend académica (unitaria, filtros e integración HTTP/PostgreSQL): 81 pruebas
  aprobadas en tres archivos, sin omisiones, con `TEST_DATABASE_URL` de la base exclusiva.
  Las consultas del fixture se aislaron por su UUID para coexistir con otros datos de prueba.
- `npm run typecheck --workspace=back` y `npm run typecheck --workspace=front`: aprobados.
- `npm run build --workspace=back` y `npm run build --workspace=front`: aprobados.
- `npm run lint --workspace=front`: cero errores y 13 advertencias preexistentes.
- `git diff --check`: aprobado.
- Navegador contra API real en 3401 y frontend en 3400: la materia ficticia 181 está
  disponible y se selecciona en Nueva cursada; Materias conserva nueve entradas por página
  (página 1 de 21 para 181 registros), y el filtro Electiva / nivel 5 muestra las dos esperadas.
  Evidencia local no versionada: `.atl/pr14-catalogo-corregido.png`.
- README, credenciales y base de desarrollo sin cambios. No se enviaron correos reales.

El push actualiza la PR #14; no implica aprobación ni merge. El cierre de tarea y su entrada
en CHANGELOG quedan pendientes de la validación manual del desarrollador.
