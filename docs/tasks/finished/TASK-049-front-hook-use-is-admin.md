# TASK-049: Hook useIsAdmin()

Estado: Terminada (2026-10-25) dentro de [TASK-043](TASK-043-front-rediseno-academico.md), que la absorbió.
Sin dependencias de back ni de otras tareas.
Fecha: 2026-10-25

## 1. Contexto y objetivo

Todos los artboards de Page 2 muestran acciones según el rol (`MateriasAdmin.dc.html`: "Nueva materia"
y "Administración"; `MateriaDetalle.dc.html`: "Editar materia", "Nueva cursada", chip "Activa",
"Historial de cambios · Solo admin"; `CursadaDetalle.dc.html`: "Nueva comisión";
`ComisionDetalle.dc.html`: "Asignar profesor"). Hoy el patrón se escribe a mano:

- `front/src/components/academic/MateriaDetail.tsx:16` `const { account } = useAuth();` y `:39`
  `account?.role === "ADMIN" && …`.
- `account` viene de `hooks/useAuth.ts`; `Role = "ADMIN" | "USER"` (`types/auth.ts`).
- `RequireRole` (`roles.includes(account.role)`) y `SidebarNav` (`account?.role === item.role`) son
  genéricos por rol y no necesitan el hook.

Objetivo: un hook `useIsAdmin(): boolean` para que cada pantalla del rediseño no repita la comparación.

> Esta tarea crea un hook compartido (`AGENTS.md`, áreas sensibles). Esta tarea es la autorización
> explícita, dentro del alcance de la sección 2. Justificación: al menos cinco pantallas del
> rediseño lo van a usar; un literal `"ADMIN"` repetido es fácil de escribir mal y difícil de buscar.

## 2. Alcance

- `front/src/hooks/useIsAdmin.ts`: `return useAuth().account?.role === "ADMIN";`
- `MateriaDetail.tsx`: reemplazar la comparación de la línea 39 por el hook.
- `front/tests/use-is-admin.spec.tsx`.

## 3. Fuera de alcance

- `RequireRole` y `SidebarNav` (comparan contra un rol recibido por parámetro).
- Permisos más finos que admin/no admin.
- Ocultar acciones por rol en el back: el back ya valida; el hook es solo presentación.

## 4. Decisiones de diseño

1. **Devuelve `boolean`, `false` mientras no hay cuenta (propuesta).** Durante la carga de la sesión
   no se muestran acciones de admin; evita un parpadeo de botones que después desaparecen.
2. **Vive en `hooks/`, no en `components/ui/` (propuesta).** `components/ui/` no puede conocer roles
   (`frontend-componentes.md`).

## 5. Casos de prueba y criterios de aceptación

Vitest + Testing Library (jsdom, `AuthContext` de prueba):

- cuenta con rol `ADMIN` → `true`;
- cuenta con rol `USER` → `false`;
- sin cuenta (`account` nulo) → `false`;
- `MateriaDetail` muestra "Editar" solo con admin y materia no dada de baja (caso existente o nuevo).

Criterios:

- `rg '"ADMIN"' front/src/components` solo devuelve `sections.ts` y lo que no compare la cuenta
  actual contra admin.
- `npm run lint --workspace=front`, `npm run typecheck --workspace=front` y
  `npm run test --workspace=front` pasan.
- Sin cambios visibles: no hay capturas nuevas ni regeneradas.

## 6. Validación

Pendiente de ejecución.

### Pruebas manuales para el desarrollador

- Con un usuario admin, el detalle de una materia muestra "Editar"; con un usuario común, no.

## 7. Riesgos

- Bajo. Si TASK-050 se hace antes, toca la misma zona de `MateriaDetail.tsx`: hacer esta primero.
