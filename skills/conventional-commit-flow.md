# Skill: Conventional Commit Flow

## Por qué

Mantiene todo cambio en este repo pasando por el mismo git workflow (definido en
[docs/standards/git-workflow.md](../docs/standards/git-workflow.md)) sin importar qué agente o
persona lo haga, y evita que queden ramas viejas dando vueltas después de un merge.

## Usada por

Default para todo el repo: cualquier agente (Claude, Codex, Gemini) que haga operaciones de git
en este repositorio usa esta skill. Linkearla explícitamente desde un perfil de agente bajo
`agents/` una vez que exista uno.

## Compatibilidad

Claude Code, Codex, Gemini — solo comandos de shell `git`/`gh`, sin sintaxis específica de
ninguna herramienta.

## Procedimiento

Dado un cambio para commitear:

1. **Definir el tipo y scope de Conventional Commit** (`feat`, `fix`, `docs`, `refactor`, `test`,
   `chore`, `style`, `perf`, `ci`, `build`).
2. **Crear una rama desde `desarrollo`**, con nombre `tipo/descripcion-corta` (mismo tipo que el
   commit):
   ```
   git checkout desarrollo
   git pull
   git checkout -b tipo/descripcion-corta
   ```
3. **Commitear** usando `tipo(scope): descripción`.
4. **Pushear** la rama al remoto:
   ```
   git push -u origin tipo/descripcion-corta
   ```
5. **Abrir el pull request contra `desarrollo`.** Paso manual — el agente se detiene acá; el PR
   lo abre una persona.
6. **Una vez aprobado el PR**, mergear a `desarrollo` y borrar la rama:
   ```
   gh pr merge --squash --delete-branch
   ```

## Notas

- Los pasos 4 y 6 tocan estado compartido (rama remota, rama compartida `desarrollo`). Confirmar
  con la persona antes de ejecutarlos — este repo no otorga autorización permanente para pushear
  o mergear.
- El paso 5 siempre es manual, sin importar el agente.
