# TASK-042: El front usa el contrato de carreras, comisiones y profesores (PR4a de TASK-037)

Estado: Finalizada. Implementada y verificada el 2026-10-25.
Depende de TASK-041 (lecturas nuevas desplegadas en Render).
Fecha: 2026-10-25

## Objetivo

Las pantallas actuales pasan al modelo nuevo con el estilo de hoy:
- filtro por carrera en materias;
- alta y edición de materias con casillas de carrera;
- alta de comisión con carrera y número;
- cursadas con cantidades;
- comisiones con profesores y cargo;
- página nueva de detalle de comisión, donde el admin asigna y quita profesores.

El front deja de leer los campos legados. El rediseño visual del canvas va en TASK-043.

## Contexto verificado (2026-10-25)

- `front/src/services/schemas.ts` L25-62: esquemas anotados como `z.ZodType<T>` contra los tipos de
  `front/src/services/academic.ts` y `front/src/types/materias.ts`. Si cambia un tipo, cambian los dos.
  `parseResponse` convierte un desajuste en `HttpError(502)`.
- `front/src/services/materias.ts`:
  - `listarMaterias` manda `anioCarrera`/`nivelElectiva`, y el nivel solo si el año es `ELECTIVA`.
  - `crearMateria` usa `protectedPost`.
  - `actualizarMateria` hace `PATCH` con `requestJson`.
- `front/src/services/academic.ts`: `crearCursada` con `profesorId`, `crearComision({cursadaId, nombre})`,
  `listarProfesores`. No hay helpers de `PUT` ni `DELETE`: el agente revisa los helpers HTTP existentes
  antes de crear uno.
- `front/src/types/materias.ts`: `ANIOS_CARRERA`, `NIVELES_ELECTIVA`, `Materia`, `MateriaInput`.
  No existe `CARRERAS`.
- Pantallas:

  | Componente | Hoy |
  |---|---|
  | `components/academic/MateriasList.tsx` | Chips de año y electiva, búsqueda, estado en la URL |
  | `components/academic/MateriaDetail.tsx` | Incluye `CursadasList`; historial para todos |
  | `components/academic/CursadasList.tsx` | Período + `cursada.profesor` |
  | `components/academic/ComisionesList.tsx` | `nombre` + marca de inactiva; ruta `app/home/materias/[materiaId]/cursadas/[cursadaId]/page.tsx` |
  | `components/admin/MateriaForm.tsx` (vía `AltaMateria` y `EditarMateria`) | Año y nivel |
  | `components/admin/AltaCursada.tsx` | Selector de profesor |
  | `components/admin/AltaComision.tsx` | Nombre libre (`MAX_NOMBRE_COMISION`) |

- `front/src/validations/academic.ts` refleja los límites del back. `front/tests/validation-parity.spec.ts`
  los compara.
- Admin en el front: `useAuth().account?.role === "ADMIN"`. `RequireRole` protege `/home/admin`.
- `front/AGENTS.md`: leer la guía de `node_modules/next/dist/docs/` antes de escribir código Next.
  `.agents/front.md`: comandos de verificación y chequeos `rg` de deriva. Una pantalla nueva sigue
  `docs/standards/frontend-pantallas.md#checklist-de-pantalla-nueva`.

## Decisiones

- **Alcance funcional, no visual**: estilo y componentes de hoy. Las etiquetas "Común a las 5
  carreras" / "Solo Sistemas" sí entran (son datos, TASK-037 §7).
- **Constantes**:
  - `CARRERAS` en `front/src/types/materias.ts`, junto a `ANIOS_CARRERA` y con el mismo estilo:
    S Ingeniería en Sistemas, C Ingeniería Civil, Q Ingeniería Química, I Ingeniería Industrial,
    M Ingeniería Mecánica.
  - `CARGOS`: Titular, Adjunto, JTP.
- **Esquemas**: forma de TASK-037 §5.1, salvo `materiaHistorialSchema`, que solo suma `"carreras"` a
  `campo` (el `actor` llega con TASK-046). `cursadaSchema` deja de declarar `profesorId`.
- **Listado de materias**:
  - Chips de carrera primero ("Todas" + 5), con estado `carrera` en la URL.
  - Los chips de año y electiva solo aparecen con una carrera elegida.
  - El año de cada tarjeta es el de la carrera elegida; con "Todas" no se muestra año.
- **Formulario de materia**:
  - Casillas de carrera y un solo año (y nivel) compartido; "Elegí al menos una carrera".
  - En edición se precarga el año de la primera carrera. Si las carreras tienen años distintos, se
    muestra un aviso de que guardar los iguala (el editor por carrera está fuera de alcance, TASK-037 D1).
- **Detalle de comisión**:
  - Ruta `app/home/materias/[materiaId]/cursadas/[cursadaId]/comisiones/[comisionId]/page.tsx` con
    `components/academic/ComisionDetail.tsx`.
  - Muestra profesores con cargo y, solo para admin, un selector de profesor (de `GET /profesores`)
    + cargo → `PUT`, un cambio de cargo → `PUT` y un quitar → `DELETE`.
  - También: "Otras comisiones" de la misma cursada y "Experiencias de esta comisión: Próximamente" (D2).
- **Comisiones de una cursada**: se pide `pageSize=100` y se filtra por carrera en el cliente
  (TASK-037 §5.2). Cada comisión enlaza a su detalle.
- **Alta de comisión**: materia → cursada → carrera (solo las de la materia) + número 1-999, con
  vista previa del nombre `S-31`.
- **Alta de cursada**: sin selector de profesor.

## Alcance

- `front/src/types/materias.ts`: `CARRERAS`, `Carrera`, `MateriaCarrera`; `Materia` y `MateriaInput`
  con `carreras` (sin `anioCarrera`/`nivelElectiva` sueltos).
- `front/src/services/academic.ts`: tipos `CursadaResumen`, `Cursada`, `Comision`, `ComisionDetalle`,
  `ProfesorAsignado`, `CargoDocente`, `CARGOS`; funciones `obtenerComision`, `asignarProfesorComision`,
  `quitarProfesorComision`; `crearCursada` sin profesor y `crearComision` con carrera y número.
- `front/src/services/materias.ts`: parámetro `carrera`; alta y edición con `carreras`.
- `front/src/services/schemas.ts`: esquemas según §5.1 (ver Decisiones).
- `front/src/validations/academic.ts`: validación de número de comisión (1-999) en espejo del back.
- `front/src/validations/materias.ts`: helpers de etiqueta de carrera y `materiaListHref` con `carrera`.
- `front/src/components/academic/MateriasList.tsx` (+ `.module.css` si hace falta), `MateriaDetail.tsx`
  (carreras con su año y etiqueta de historial `"carreras"`), `CursadasList.tsx`, `ComisionesList.tsx`,
  `ComisionDetail.tsx` (nuevo).
- `front/src/app/home/materias/[materiaId]/cursadas/[cursadaId]/comisiones/[comisionId]/page.tsx` (nuevo).
- `front/src/components/admin/MateriaForm.tsx`, `AltaCursada.tsx`, `AltaComision.tsx`.
- `front/OVERVIEW.md`: ruta y contratos nuevos.
- Tests (agente `test`):
  - `academic-service.spec.ts`, `academic-components.spec.ts`, `materias-filtros.spec.tsx`,
    `listados.spec.tsx`, `materia-detalle.spec.tsx`, `alta-form.spec.tsx`, `validation-parity.spec.ts`.
  - Un spec nuevo para `ComisionDetail`.

## Fuera de alcance

- Rediseño visual del canvas, primitiva Dialog y versión móvil del modal (TASK-043).
- Historial solo para admin y `displayName` (TASK-045/046).
- Edición y baja de comisiones; editor de año por carrera; experiencias.
- Back: no se toca.

## Pasos

1. Tiago comprueba en Neon `SELECT count(*) FROM "Comision" WHERE "carrera" IS NULL OR "numero" IS NULL;` = 0
   (si no, el esquema nuevo da 502 en esas pantallas).
2. Test: specs que fallan primero para esquemas, servicios y cada pantalla tocada.
3. Front: tipos, constantes, esquemas, servicios.
4. Front: listado de materias y formulario de materia.
5. Front: cursadas, comisiones, detalle de comisión y altas de admin.
6. Verificación completa y chequeos de deriva de `.agents/front.md`.

## Criterio de "listo"

Automático (desde la raíz):

```powershell
npm run lint --workspace=front
npm run typecheck --workspace=front
npm run test --workspace=front
npm run build --workspace=front
npm run test --workspace=back
```

- `npm run test --workspace=back`: `validation-parity` cruza los dos lados.
- `npm run test:e2e --workspace=front` en local, con back de TASK-041 y `TEST_DATABASE_URL` (base
  Docker de TASK-039). Las capturas visuales que cambien no se regeneran en Windows (`.agents/test.md`).
- Chequeos `rg` de deriva de `.agents/front.md` sin hallazgos nuevos.

Manual (Tiago, en local con el seed de TASK-040):
- Listado: "Todas" ordena por el criterio legado sin año en tarjeta. "Química" muestra solo
  Análisis Matemático II con "Común a las 5 carreras". Año y electiva aparecen solo con carrera.
- Nueva materia sin carrera marcada muestra "Elegí al menos una carrera"; con S y Q se crea y
  aparece en los dos filtros.
- Cursada: cantidades y letras. Comisiones: filtro por carrera; un clic abre el detalle.
- Detalle de comisión como admin: asignar profesor como JTP, cambiarlo a Titular y quitarlo.
  Como usuario común: no se ven los controles.
- Alta de comisión: carrera ajena a la materia no aparece; número 0 o 1000 da error en el formulario.
- Que no se rompa: búsqueda y paginación del listado, edición de nombre de materia, alta de profesor,
  navegación desde el panel de admin.

## Skills para la implementación

- `ponytail`.
- Agentes `front` y `test`. Estándares: `docs/standards/frontend-componentes.md`, `frontend-estilos.md`,
  `frontend-pantallas.md`, `frontend-tests.md`.

## Riesgos y preguntas abiertas

- Áreas sensibles (AGENTS.md): agregar una página bajo `app/home/materias/...` no toca el router
  principal ni el layout. Si hiciera falta tocar un componente de `components/ui/` o un hook
  compartido, el agente frena y pide autorización.
- Despliegue: Vercel después de que Render tenga TASK-041. Al revés, el front nuevo da 502.
- Esta tarea y TASK-045/046 tocan `MateriaDetail.tsx`: la segunda en mergear resuelve el conflicto.

## Al cerrar

- `front/OVERVIEW.md` actualizado (está en el alcance).
- `CHANGELOG.md`; mover a `finished/`.

## Resultado

Finalizada el 2026-10-25.

- Contratos y tipos migrados en `front/src/types/materias.ts` y `front/src/services/academic.ts` (`carreras: MateriaCarrera[]`, `carrera`, `numero`, `profesores: ProfesorAsignado[]` con cargos docentes).
- `services/http.ts` ampliado con soporte de métodos `PUT` y `DELETE` para mutaciones de profesores en comisiones.
- `services/schemas.ts` actualizado con validaciones Zod completas y seguras.
- `components/academic/MateriasList.tsx` con chips de carrera y comportamiento condicional de años/electivas y badges en listado.
- `components/admin/MateriaForm.tsx` con casillas multicarretera y advertencia de discrepancia.
- `components/academic/CursadasList.tsx` con conteo de comisiones, profesores y letras de carrera.
- `components/academic/ComisionesList.tsx` con filtrado por chip de carrera y visualización de docentes y cargos.
- Nueva pantalla de detalle `components/academic/ComisionDetail.tsx` y ruta `app/home/materias/[materiaId]/cursadas/[cursadaId]/comisiones/[comisionId]/page.tsx` con administración de profesores (`PUT`/`DELETE`) para rol ADMIN, otras comisiones y placeholder de experiencias.
- Formularios de administración `AltaCursada.tsx` y `AltaComision.tsx` adaptados al nuevo modelo (sin profesor en cursada, carrera y número 1-999 en comisiones con preview en vivo).
- Pruebas automatizadas actualizadas y nueva suite `front/tests/comision-detalle.spec.tsx`:
  - `npm run lint --workspace=front`: 0 advertencias, 0 errores.
  - `npm run typecheck --workspace=front`: 0 errores.
  - `npm run test --workspace=front`: 24 archivos de test, 238 pruebas pasando.
  - `npm run build --workspace=front`: Build de Next.js exitoso.
  - `npm run test --workspace=back`: 456 pruebas pasando (incluyendo `validation-parity.spec.ts`).
- Documentación de arquitectura en `front/OVERVIEW.md` y registro en `CHANGELOG.md`.

