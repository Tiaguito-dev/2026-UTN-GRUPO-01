# Contribuir

## Workflow

1. Crear una rama desde `desarrollo` usando `tipo/descripcion-corta` (ej. `feat/login-form`, `fix/cors-error`).
2. Commitear usando [Conventional Commits](https://www.conventionalcommits.org/): `tipo(scope): descripción` (`feat`, `fix`, `docs`, `refactor`, `test`, `chore`, ...).
3. Abrir un pull request contra `desarrollo`. Mantener los PR chicos y acotados a un solo cambio.
4. Se requiere al menos una aprobación de revisión antes de mergear.
5. Una vez mergeado, borrar la rama de la feature.

Detalle completo (modelo de branching, formato de commit): [docs/standards/git-workflow.md](docs/standards/git-workflow.md).
El mismo flujo como skill ejecutable por agentes: [.agents/skills/commit-work/SKILL.md](.agents/skills/commit-work/SKILL.md).

## Integración continua y Definition of Done

Pasar en CI es obligatorio para completar una tarea. Cada PR hacia `desarrollo`
o `main`, incluso si cambia solo documentación, ejecuta los dos workflows:

| Workflow | Check obligatorio | Verificaciones |
|---|---|---|
| `.github/workflows/back.yml` | `backend-ci` | Prisma, deriva de migraciones, typecheck, lint, tests y build. |
| `.github/workflows/front.yml` | `frontend-ci` | Typecheck, lint, tests y build. |

Los workflows se ejecutan sobre PR y sus actualizaciones; no repiten la ejecución
en el push posterior al merge. Usan Node de `.nvmrc`, `npm ci` desde la raíz y el
lockfile compartido. Backend prepara PostgreSQL 17, una base shadow y Mailpit
aislados en el runner; `TEST_DATABASE_URL` y `TEST_MAILPIT_API_URL` permiten ejecutar
las suites de integración. Una corrida local que omite esas suites no reemplaza CI.
Las pruebas backend se ejecutan por archivo en serie para evitar saturar SMTP.

El DoD exige typecheck y tests de ambos módulos en verde en CI, sin errores ni
advertencias de lint, builds exitosos y, en backend, migraciones consistentes.
Un check fallido o pendiente impide considerar terminada la tarea. Docker builds
y Playwright quedan fuera de esta verificación; tienen su validación separada.

### Configuración administrativa de GitHub

El YAML por sí solo no bloquea merges. Un administrador debe revisar las reglas
existentes en Settings > Branches o Rules > Rulesets y, para **ambas** ramas
`desarrollo` y `main`:

1. Conservar los requisitos vigentes de PR y revisión.
2. Activar `Require status checks to pass before merging` y exigir `backend-ci`
   y `frontend-ci`, publicados por GitHub Actions. Seleccionarlos después de su
   primera ejecución en una PR con estos workflows.
3. Reemplazar el check antiguo `verify` por los dos nombres nuevos si estaba
   requerido, conservando los demás checks obligatorios del repositorio.
4. Revisar los permisos de bypass para que el bloqueo alcance a los roles del
   equipo que deben cumplir el DoD. No probar mediante un merge con bypass.

La selección de estos checks es un paso administrativo pendiente de verificar;
no debe inferirse que la protección está activa por tener estos archivos.

### Evidencia de aceptación de CI

1. Abrir una PR de prueba hacia `desarrollo` y verificar que aparecen los dos
   checks, ambos verdes; registrar URL, SHA y resultados de tests, incluidas
   las suites de integración backend y cualquier omisión justificada.
2. Por decisión del desarrollador, comprobar el bloqueo cuando un test falle
   durante el desarrollo. Registrar el fallo del paso de tests y que GitHub
   bloquea el merge por el check obligatorio; no se requiere provocar una falla
   artificial ahora.
3. Corregir el test o el código correspondiente y confirmar ambos checks verdes.
4. Verificar también la regla y los checks en una PR hacia `main`. Incluir una PR
   que cambie solo documentación para comprobar que no se omite ningún workflow.
5. Registrar la evidencia en TASK-002. Su aceptación remota permanece pendiente
   hasta demostrar ejecución y bloqueo; coordinar con TASK-036 la evidencia del
   backend y su prueba específica de lint, sin duplicar pipelines.

## Estándares

Los estándares y convenciones de código en detalle viven en `docs/standards/`. Este archivo solo
enuncia las reglas que aplican a todo el repo; cualquier cosa que requiera más profundidad
(convenciones de nombres, estrategia de testing, detalles de git workflow, guías de estilo por
stack, etc.) tiene su propio archivo bajo `docs/standards/` y se linkea desde acá a medida que se
escribe.

## Reglas de Documentación

- **Un solo README, un solo index.** `README.md` e `index.md` existen únicamente en la raíz del
  repositorio. Ninguna otra carpeta puede tener un archivo llamado `README.md` o `index.md`.
- **Las explicaciones a nivel de carpeta usan `OVERVIEW.md`.** Si el contenido de una carpeta no
  se explica solo, agregar un `OVERVIEW.md` adentro describiendo su propósito y estructura. Nunca
  duplicar `README.md` o `index.md` para esto.

## Agentes, Skills y Reglas

Este repositorio soporta desarrollo multiagente:

- **Los agentes** se definen como perfiles `.md` bajo `.agents/`, un archivo por agente,
  describiendo su rol, alcance y responsabilidades.
- **Las skills** viven bajo `.agents/skills/`. Una skill solo puede agregarse si cumple las tres
  condiciones:
  1. **Justificada** — el archivo de la skill indica por qué hace falta (qué problema resuelve
     que no esté ya cubierto).
  2. **Usada** — al menos un perfil de agente bajo `.agents/` la referencia.
  3. **Portable** — está escrita para poder usarse con agentes de Claude, Codex y Gemini (sin
     sintaxis específica de una herramienta, salvo que sea explícita e inevitable).
- **Las reglas** bajo `rules/` definen restricciones que los agentes deben seguir al operar en
  este repo (ej. límites de alcance, criterios de escalamiento).

## Variables de Entorno

Nunca commitear secretos reales en `.env`. Agregar las variables nuevas a `.env.example` con
valores de ejemplo cada vez que `.env` cambie.
