# Guía Operativa para Agentes

Este archivo define las reglas obligatorias para cualquier agente que trabaje en el repositorio.
Se aplica desde la raíz a `front/`, `back/`, `docs/`, infraestructura y automatizaciones. Una
instrucción más específica de una tarea puede ampliar estas reglas, pero no reducir controles de
seguridad, aprobación, pruebas o documentación.

## 1. Stack oficial

- Lenguaje: TypeScript.
- Runtime: Node.js 22.22.3, fijado en `.nvmrc` y `package.json`.
- Gestión de paquetes: npm workspaces con un único `package-lock.json`.
- Backend: NestJS.
- Frontend: Next.js con App Router y React.
- Persistencia: PostgreSQL con Prisma ORM y adapter `pg`.
- Desarrollo local de infraestructura: Docker Compose.
- Pruebas backend: Vitest y utilidades de testing de NestJS.

No se incorpora una tecnología o dependencia nueva sin una necesidad concreta, una tarea que la
incluya y la decisión técnica correspondiente.

## 2. Enfoque SDD obligatorio

El proyecto usa Spec-Driven Development. Antes de implementar una feature deben existir:

1. Una tarea autocontenida bajo `docs/tasks/pendient/` con objetivo, alcance, exclusiones,
   restricciones y criterios de aceptación.
2. Un TDD bajo `docs/tdd/` cuando exista una decisión no trivial de arquitectura, dependencia,
   contrato, persistencia o integración.
3. Una lista de casos de prueba propuesta por el agente que cubra éxito, errores, permisos,
   límites y regresiones relevantes.
4. La revisión del desarrollador, quien puede aprobar, ampliar o rechazar casos antes de la
   implementación.

Al comenzar, la tarea pasa a `docs/tasks/in-progress/`. Al terminar y quedar validada, se completa
el resultado y se mueve a `docs/tasks/finished/`.

Un agente no empieza una tarea ambigua. Si una decisión cambia materialmente alcance,
arquitectura, datos o seguridad, debe explicarla y esperar la respuesta del desarrollador.

## 3. Flujo de desarrollo

1. Leer `AGENTS.md`, la tarea, su TDD y los documentos referenciados.
2. Inspeccionar el árbol de trabajo y preservar cambios ajenos.
3. Presentar al desarrollador el plan de casos a probar.
4. Esperar la validación de esos casos antes de implementar la feature.
5. Trabajar únicamente dentro del alcance aprobado.
6. Actualizar backend y frontend de forma coherente cuando cambie una entidad o contrato.
7. Ejecutar las pruebas automatizadas del módulo.
8. Ejecutar las comprobaciones manuales que pueda realizar el agente y entregar al desarrollador
   la lista reproducible para su validación.
9. El desarrollador prueba la feature, incluidos los casos de error, y aprueba o solicita ajustes.
10. Solo después de esa aprobación se actualizan una única vez la documentación de entrega, el
    resultado final de la tarea y `CHANGELOG.md`.
11. Con la documentación final aprobada se usa la skill `commit-work` para revisar, agrupar,
    preparar y, cuando el desarrollador lo solicite expresamente, crear los commits.

No se stagean ni crean commits antes de la aprobación manual del desarrollador. El agente nunca
hace push, abre un pull request ni integra cambios a una rama protegida sin una instrucción
explícita. Todo cambio se trabaja en una rama y se integra mediante pull request.

## 4. Uso obligatorio de `commit-work`

La skill `commit-work` se usa al finalizar una feature, nunca como sustituto de su validación.

Antes de usarla deben cumplirse todos estos puntos:

- pruebas automatizadas aprobadas;
- comprobaciones manuales del agente completadas;
- casos de éxito y error validados por el desarrollador;
- documentación de entrega y `CHANGELOG.md` actualizados después de la aprobación manual;
- ausencia de secretos, logs de depuración y cambios ajenos;
- autorización explícita del desarrollador para preparar o crear commits.

Los commits siguen Conventional Commits: `tipo(scope opcional): descripción breve`. Se separan
por contenido semántico cuando los cambios sean independientes. Antes de cada commit se revisa
`git diff --cached`. Si el desarrollador no autorizó ejecutar commits, el agente entrega solamente
los mensajes propuestos, el resumen por grupo y los comandos de staging/revisión.

## 5. Validación por feature y módulo

Cada módulo modificado debe contar con:

- tests automatizados de código para comportamiento exitoso y errores relevantes;
- prueba manual del flujo completo;
- verificación de permisos por rol cuando aplique;
- verificación de mensajes visibles de éxito y error;
- validación de contratos entre frontend, backend y persistencia;
- prueba de regresión proporcional al alcance.

La lista propuesta al desarrollador debe indicar para cada caso:

| Campo | Contenido esperado |
|---|---|
| ID | Identificador estable del caso. |
| Tipo | Automatizado, manual o ambos. |
| Precondición | Datos, rol y estado necesarios. |
| Acción | Pasos concretos para ejecutar el caso. |
| Resultado esperado | Respuesta, navegación, persistencia y feedback de UI. |
| Prioridad | Crítica, alta, media o baja. |

No se considera terminada una feature si solo compila o si únicamente se probó el camino feliz.

## 6. Convenciones funcionales

### Navegación después de guardar

- Edición: volver siempre al detalle con `successMessage`.
- Alta: volver al home con `successMessage`.

### Paginación

- Homes: máximo 9 elementos por página.
- Historial de cambios: 3 elementos por página.

### Pantallas de detalle

Toda pantalla de detalle incluye:

- tarjeta principal de datos;
- tarjeta `Auditoría`;
- tarjeta `Historial de cambios`;
- botón `Volver`;
- botón `Editar` solo si la entidad está activa y el rol lo permite.

Toda entidad con historial expuesto por backend debe consumirlo en frontend. Si el endpoint no
existe, se implementa como parte del flujo completo. El historial contempla cambios de campos y
eventos relacionales.

### Formularios

- En edición se envían solo diferencias reales.
- Si no hay cambios, no se llama al backend.
- Las relaciones permiten altas y bajas en el mismo formulario.
- Las operaciones relacionales se consolidan al guardar; no se llama al backend por cada cambio
  local del formulario.
- La desvinculación sigue la misma regla de consolidación.
- Los errores muestran `body.error` o `body.message` mediante un texto seguro, claro y orientado a
  la acción, por ejemplo: "Lo sentimos. No pudimos recuperar la información. Intente nuevamente".
- Los éxitos usan el estilo actual de `successMessage` y deben ser visibles.

### Coherencia integral

Cuando una entidad cambia en backend, por defecto se actualiza todo su flujo: service, tipos,
hooks, validaciones, home, formulario, detalle, historial, permisos, tests y documentación. Una
incoherencia menor entre frontend y backend que bloquee el flujo puede corregirse de manera
acotada si respeta la arquitectura actual.

## 7. Arquitectura y organización

Toda nueva funcionalidad debe favorecer:

- modularidad y separación de responsabilidades;
- reutilización sin acoplamiento prematuro;
- contratos explícitos entre frontend y backend;
- extensibilidad para nuevos módulos;
- versionado de datos y trazabilidad histórica;
- migración parcial futura a microservicios;
- eficiencia de consultas y minimización de renders.

Cada módulo debe contener, cuando aplique:

Frontend:

- service dedicado;
- tipos TypeScript;
- hooks reutilizables;
- validaciones;
- manejo uniforme de errores;
- vistas y componentes del módulo.

Backend:

- rutas;
- controller;
- service;
- modelo;
- historial;
- permisos;
- repositorio o acceso a datos desacoplado.

Las dependencias de dominio no deben apuntar directamente a detalles del frontend ni de
infraestructura. Los futuros recursos TypeScript compartidos deben vivir en un workspace
dedicado con contrato público y una versión de TypeScript compatible con ambos consumidores.

## 8. Seguridad

Toda feature contempla según corresponda:

- permisos por rol en backend y frontend;
- validación backend como autoridad final;
- validación frontend para prevención y feedback;
- auditoría y trazabilidad;
- soft delete;
- protección de endpoints críticos;
- sanitización de inputs;
- mensajes que no expongan información sensible.

No se guardan secretos en Git. Las variables nuevas se documentan con valores de ejemplo. Se
ejecuta auditoría de dependencias y no se aplica una corrección destructiva o con breaking changes
sin evaluación y aprobación.

## 9. UX y accesibilidad

Las implementaciones respetan:

- heurísticas de Nielsen;
- consistencia visual;
- placeholders y feedback visible;
- prevención y recuperación de errores;
- accesibilidad básica;
- diseño responsive;
- minimalismo institucional;
- español completo con tildes.

## 10. Documentación obligatoria

La documentación debe permanecer actualizada y sin emojis. La especificación SDD —tarea, TDD y
plan de pruebas— se escribe antes de implementar. La documentación de entrega se modifica una
sola vez después de la aprobación manual del desarrollador y antes de ejecutar `commit-work`.

Cada módulo frontend documenta vistas, services, componentes, hooks, permisos y validaciones.
Cada módulo backend documenta endpoints, payloads, reglas de negocio, modelos, relaciones,
estados, errores, permisos e historial.

Además:

- `README.md` presenta el proyecto, tecnologías y primeros pasos.
- `index.md` mantiene el mapa de la estructura.
- `front/OVERVIEW.md` y `back/OVERVIEW.md` explican cada aplicación.
- `docs/tdd/` conserva decisiones técnicas.
- `docs/tasks/` conserva especificaciones y resultados de tareas.
- `CHANGELOG.md` registra lo realizado al finalizar cada tarea.

No se crean otros archivos `README.md` o `index.md` fuera de la raíz; las carpetas usan
`OVERVIEW.md`.

## 11. Infraestructura y rendimiento

Todo cambio mantiene compatibilidad con Docker, Docker Compose, variables de entorno,
healthchecks, proxy reverso, balanceo, cloud deployment y un CI/CD futuro.

Las funcionalidades deben considerar paginación, queries optimizadas, carga diferida,
reutilización, minimización de renders y eficiencia de consultas. No se agregan servicios,
imágenes, ejecutables o artefactos de despliegue hasta que una tarea los requiera.

## 12. Áreas sensibles y acciones externas

No se modifican sin autorización explícita:

- layout global;
- router principal;
- autenticación;
- hooks compartidos;
- estilos base;
- componentes reutilizables globales.

El agente no descarga archivos ni genera ejecutables innecesarios. Si necesita una acción
particular, destructiva, externa o fuera del alcance directo, debe explicar qué hará, por qué es
necesario, qué elementos afecta y esperar la respuesta del desarrollador.

Los cambios ajenos presentes en el árbol de trabajo pertenecen a sus autores y deben preservarse.
