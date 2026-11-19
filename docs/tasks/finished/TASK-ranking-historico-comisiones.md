# Ranking histórico de comisiones con promedio bayesiano

## Alcance y aceptación

El ranking global de comisiones deja de listar una fila por cursada: agrupa todas las cursadas
(todos los años) de una misma comisión. Una comisión con muchas reseñas buenas a lo largo del
tiempo queda arriba; una nueva con pocas reseñas perfectas no la supera hasta juntar votos, y un
par de reseñas bajas casi no mueven a una histórica. La misma regla ordena el ranking de
profesores.

Aceptado por el desarrollador el 2026-11-18, sobre las cuatro recomendaciones propuestas.

## Decisiones

- **Comisión histórica = materia + carrera + número.** "Metodologías Ágiles · S-41" junta 2024,
  2025 y 2026. No se juntan materias distintas con el mismo número de comisión.
- **Orden por promedio bayesiano:** `puntaje = (v·R + m·C) / (v + m)`, con R el promedio de la
  comisión (o del profesor), v sus votos, C el promedio de todos los votos que entran en ese
  ranking y m = 5 votos imaginarios. Desempate por cantidad de votos, nombre e id. Las estrellas
  que se muestran siguen siendo el promedio real R; el puntaje solo decide el orden.
- **Profesores:** mismo orden bayesiano; sin cambios visuales.
- **Contrato:** `GET /rankings/comisiones` devuelve el ranking histórico (filtros `materiaId` y
  `minValoraciones`). Cada fila trae la comisión, la materia, las cursadas que tienen
  valoraciones (más reciente primero), el rango de años y la comisión más reciente para enlazar.
  El filtro `cursadaId` sale de ese endpoint: el distintivo "Mejor valorada" de cada cursada usa
  `GET /rankings/cursadas/:id/comisiones`, con la forma por comisión de antes.
- **Cursadas sin votos:** no figuran en el rango de años de la fila, porque el ranking se calcula
  desde los votos. Se agrega cuando se necesite mostrar la oferta completa.
- **Sin migraciones ni seeds nuevos.** Datos de demostración: se suman votos de 5 estrellas a
  Martin Sitnyk y Emilio Watemberg en Metodologías Ágiles para que sigan primeros con la regla
  nueva (pedido del desarrollador).

## Validación

Unitarias del dominio (agrupado entre años, ejemplos del bayesiano, desempates) y del servicio,
integración HTTP con PostgreSQL, pruebas de vistas del front, builds, typecheck, lint y revisión
en navegador. Documentar contratos en los OVERVIEW y registrar en CHANGELOG.

## Evidencia

- Back: `ranking.spec.ts` 15 pruebas (agrupado entre años, los tres ejemplos del bayesiano,
  desempates, endpoint por cursada, validación), `ranking.integration.spec.ts` 4 pruebas contra
  PostgreSQL aislado; suite unitaria completa 1213 aprobadas; lint, typecheck y `nest build`.
- Front: `ranking-views.spec.tsx` actualizado (filas históricas, enlace a la cursada más reciente,
  distintivo por cursada); suite completa 1341 aprobadas; typecheck y lint. Una corrida suelta de
  `registration-terms.spec.tsx` falló en la suite completa y pasó sola y en la corrida siguiente
  (ajeno a este cambio).
- Navegador con base local: `/home/materias/ranking` muestra filas como "Comisión I-1 · … —
  2025–2026 · 3 cursadas", ordenadas por bayesiano; el endpoint por cursada responde 200.
- Datos de demostración en producción (Neon): 42 votos de 5 estrellas en las tres S-41 de
  Metodologías Ágiles (2024, 2025 y 2026) para Sitnyk y Watemberg. Con la regla nueva quedan
  primeros (≈4,78) por encima de Hernán Villalba (≈4,63).
