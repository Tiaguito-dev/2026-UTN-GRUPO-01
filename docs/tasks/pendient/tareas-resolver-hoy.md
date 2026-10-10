# TAREAS PARA RESOLVER HOY



Prioridad 1 — Decisiones (baratas, pero bloquean todo lo que viene)

- TASK-004 (estrategia auth institucional): bloquea cerrar de verdad HU-01 (Escenario 3, dominio @frlp) y decide si HU-02 sigue viva si se elige OAuth. La muevo antes que la auditoría UX/back porque sin esto no sabés si vas a reescribir media capa de auth.

- Tu punto 0 (auditoría de los 14 TDD contra [template.md](http://template.md)) — pero sumale escribir los TDD nuevos que faltan para HU-04, HU-05 y HU-11 antes de programarlas, no después.

- Tu punto 2.1/2.2 (catálogo de errores vía PROC-DEV-002 adaptado a Exception Filters de Nest, + auditoría de estándares back) — definir el patrón ahora, antes de escribir 3 módulos nuevos, para no retrofitear error handling en back/src/auth y en lo nuevo por separado.

Prioridad 2 — Construir lo que realmente falta del MVP

- Back, en este orden por dependencia de datos: HU-04 (jerarquía Materia→Cátedra→Profesor) → HU-05 (validación comisiones/profesores, mock, solo Escenario 1) → HU-11 (CRUD admin sobre esas mismas entidades).

- Front: recién acá entra tu punto 1.2 ("pantallas que faltan") — drill-down de HU-04 y panel admin de HU-11. Antes no tenía sentido hablar de pantallas faltantes sin saber que estas 3 HU son el hueco real.

Prioridad 3 — Auditoría UX/UI de lo ya construido (en paralelo a Prioridad 2)

- Tu punto 1 (tipografías/estilo vs. técnico, con agente) + 1.1 (badge de errores) sobre landing/auth/cuenta — para que las pantallas nuevas de Prioridad 2 nazcan consistentes con esa revisión, en vez de auditar todo de nuevo después.

Prioridad 4 — Continuo

- Punto 4 (tests): de cada pieza a medida que se construye, no en bloque al final.

- Punto 5 cierre: una vez el código alcance a Trello, reconciliar estados reales y resolver los diffs sin commitear de TASK-002/TASK-004.