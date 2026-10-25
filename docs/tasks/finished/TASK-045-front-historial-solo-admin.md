# TASK-045: El front pide el historial de materia solo para admin (D3 de TASK-037, parte front)

Estado: Completada.
Depende de TASK-037 (D3 cerrada). Independiente de TASK-039 a TASK-044. Va antes de TASK-046.
Fecha: 2026-10-25

## Objetivo

El detalle de materia deja de pedir y mostrar el historial a usuarios que no son admin. Cuando
TASK-046 restrinja el endpoint a ADMIN, ningún usuario común va a ver un error.

## Contexto verificado (2026-10-25)

- `front/src/components/academic/MateriaDetail.tsx`:
  - L38 renderiza `<MateriaHistory>` para todos.
  - L46-58: `MateriaHistory` pide con `usePaginatedFetch(\`historial:${materiaId}\`, … listarHistorialMateria …)`.
  - L39 ya usa `account?.role === "ADMIN"` (de `useAuth()`) para el enlace de edición.
- `front/tests/materia-detalle.spec.tsx` (4 tests) es el único spec del front que cubre el historial.

## Decisiones

- El condicional va en el padre (`{esAdmin && <MateriaHistory … />}`): si `MateriaHistory` no se
  monta, el hook no corre y no hay pedido. No se agrega `enabled` a `usePaginatedFetch` (hook
  compartido, área sensible).
- Mientras `useAuth` carga, `account` es null y no se pide: el admin ve el historial cuando la
  sesión resuelve.

## Alcance

- `front/src/components/academic/MateriaDetail.tsx`: el condicional.
- `front/tests/materia-detalle.spec.tsx` (agente `test`): usuario común → no se llama
  `listarHistorialMateria` y no aparece la sección; admin → se llama y aparece.

## Fuera de alcance

- `@Roles` en el back y `actor.displayName` (TASK-046).
- Rediseño del detalle (TASK-043).

## Pasos

1. Test: los dos casos, que fallan primero (hoy el usuario común sí pide).
2. Front: el condicional.
3. Verificación.

## Criterio de "listo"

```powershell
npm run lint --workspace=front
npm run typecheck --workspace=front
npm run test --workspace=front
npm run build --workspace=front
```

Manual (Tiago, en local):
- Como usuario común, el detalle de una materia no muestra historial y en la pestaña Network no hay pedido a `/historial`.
- Como admin, se ve igual que hoy.
- Que no se rompa: detalle, cursadas embebidas y enlace de edición.

## Skills para la implementación

- `ponytail`.
- Agentes `front` y `test`. Estándar `docs/standards/frontend-tests.md`.

## Riesgos y preguntas abiertas

- Desplegar en Vercel antes que TASK-046 en Render. Si el orden se invierte, el usuario común ve
  un error en el detalle hasta que llegue el front.
- Conflicto posible con TASK-042 en `MateriaDetail.tsx`.

## Al cerrar

- `front/OVERVIEW.md`: una línea en el detalle de materia.
- `CHANGELOG.md`; mover a `finished/`.

## Resultado

Completada.
- Se condicionó el renderizado de `MateriaHistory` en `front/src/components/academic/MateriaDetail.tsx` con `{isAdmin ? <div className="academic-aside"><MateriaHistory ... /></div> : null}`.
- Al no montarse `MateriaHistory` para usuarios no administradores, `usePaginatedFetch` no se ejecuta y no se emiten peticiones a `/historial`.
- Se actualizaron las pruebas en `front/tests/materia-detalle.spec.tsx` verificando que un usuario regular no ve el historial ni llama a `listarHistorialMateria`, mientras que ADMIN sí.
- Verificación completa con `lint`, `typecheck`, `test` (30 suites, 274 pruebas) y `build` exitosos.
