# TASK-055: Resolver hallazgo de lint y validar ambos workspaces

Estado: Finalizada.
Fecha: 2026-10-26

## Objetivo y alcance

Confirmar que los scripts `lint` existentes de `back` y `front` terminan sin errores
ni advertencias sobre el código actual. Resolver únicamente el hallazgo
`no-control-regex` de `back/src/auth/email.config.ts`.

## Restricciones y exclusiones

Sin dependencias nuevas, cambios de reglas globales, contratos, comportamiento de
autenticación, infraestructura ni archivos ajenos existentes sin seguimiento.
No cerrar las tareas de CI o Brevo, cuyo alcance es mayor. El desarrollador
autorizó posteriormente el commit local del ajuste; push y PR quedan fuera del alcance.

## Decisión previa a implementar

La expresión regular rechaza deliberadamente caracteres de control en las variables
de correo. Se conserva esa validación y se agrega una excepción de ESLint únicamente
en esa línea, con motivo explícito, igual que en `smtp.config.ts` y según TASK-036.
La ejecución previa de backend reprodujo un error y frontend terminó con exit 0.
No se agregan tests: el cambio es un comentario sin efecto en ejecución.

## Criterios de aceptación y validación

- `npm run lint --workspace=back`: exit 0, sin errores ni advertencias.
- `npm run lint --workspace=front`: exit 0, sin errores ni advertencias.
- Ejecutar los tests existentes de configuración de correo del backend.
- Revisar el diff y registrar el resultado en `CHANGELOG.md`.

## Evidencia

Ejecutada el 2026-10-26 en local:

| Comando | Resultado |
|---|---|
| `npm run lint --workspace=back` | Exit 0, sin errores ni advertencias. |
| `npm run lint --workspace=front` | Exit 0, sin errores ni advertencias. |
| `npm run test --workspace=back -- tests/auth-email-provider.config.spec.ts` | Exit 0, 13/13 pruebas aprobadas, incluidos rechazos de caracteres de control. |
| `git diff --check` | Exit 0. |

Revisión manual del diff: solo se agrega un comentario en el código; la validación
de entrada conserva su comportamiento. No aplica prueba manual de UI.

Entorno local: Node 22.17.0, npm 10.9.2; Node difiere del 22.22.3 fijado en
`.nvmrc`. Esta evidencia confirma ambos workspaces en el entorno local disponible;
no afirma una nueva ejecución de CI ni validación con Node 22.22.3.
