# Actores de auditoría en todas las entidades administrativas

## Alcance y aceptación

Resolver nombres autorizados de creación, modificación, baja e historial para todas las entidades de AdminDetailService: materias, profesores, cursadas, comisiones, users y feedback. Verificar que las operaciones existentes registran actor real. Conservar datos históricos ausentes sin inventar atribuciones. Materias debe resolver también el actor del último MateriaHistorial aunque no esté en la página visible ni en el ledger administrativo.

El frontend debe consumir nombres también en la presentación anterior AdminAuditPanel usada por comisiones y experiencias; no mostrar UUID como actor. Mantener permisos, fechas, operaciones, orden y paginación actuales. Cambio acotado de este componente compartido autorizado por el pedido de corregir el comportamiento de auditoría en los elementos restantes; sin cambios de diseño ni auth.

## Exclusiones y restricciones

Sin migraciones, atribución retrospectiva ficticia, cambios globales de layout/router/auth, dependencias, pruebas visuales ni eliminación de volúmenes. La última instrucción reserva los commits al usuario: entregar únicamente títulos y archivos por grupo tras validar todo. No ejecutar staging, commit, push, PR ni merge.

## Decisiones previas

Eliminar la selección por entidad en la resolución agrupada de nombres, manteniendo una consulta User con select id/displayName. Calcular una única referencia de última modificación para ID y nombre, incluyendo MateriaHistorial. En AdminAuditPanel usar nombres disponibles y los textos Usuario no identificado / No registrado según referencia. No reemplazar el componente ni cambiar el diseño de otros detalles.

## Validación

Baseline y RED/GREEN de backend para todas las entidades, actor de MateriaHistorial fuera de página, legado y nombres no resolubles, privacidad y paginación. Regresiones frontend para ambos componentes de auditoría y nombres seguros. Revisar escrituras y ejecutar suites pertinentes. Typecheck/lint de ambos workspaces. Reconstruir y recrear stack dev con volúmenes conservados, verificar salud y smoke HTTP. Validar datos persistidos mediante lecturas y, si corresponde, operaciones temporales dentro de transacción revertida.

Antes de los commits, ejecutar las suites completas de frontend y backend. Backend debe incluir integraciones sobre PostgreSQL temporal aislado y Mailpit con ejecución secuencial como en CI, además de comprobar migraciones/schema y builds. La imagen PostgreSQL ya usada en el proyecto se ejecuta temporalmente sin volumen persistente, en puerto separado, y se elimina al terminar.

## Resultado

- Resolución agrupada aplicada a las seis entidades, incluyendo actor de MateriaHistorial fuera de página. AdminAuditPanel consume nombres y alternativas seguras sin UUID de actor. No cambian escrituras, permisos, operaciones ni presentación.
- Baseline backend admin-detail 16/16 y auditorías frontend 11/11. RED confirmó los fallos de nombres ausentes y referencias visibles; GREEN incluye 32 casos backend de auditoría y ambos presentadores frontend.
- Suite completa frontend: 70 archivos, 640/640 pruebas aprobadas. Suite completa backend con TEST_DATABASE_URL aislada y Mailpit, --no-file-parallelism como CI: 38 archivos, 895/895 pruebas aprobadas, sin integraciones omitidas (30/10/2026). Una ejecución preliminar paralela sin base de integración tuvo un timeout de Brevo; la ejecución completa secuencial final no presenta fallos.
- Typecheck y lint de ambos workspaces aprobados, incluyendo comprobación final de tipos de tests. Builds Docker frontend y backend aprobados. Prisma migrate diff sin diferencias; las 17 migraciones aplicadas correctamente en PostgreSQL temporal sin datos de desarrollo.
- Stack dev reconstruido y recreado con volúmenes conservados. Tras la pausa nocturna se volvió a iniciar: postgres, mailpit, backend, frontend y proxy saludables; migrate termina con código 0. Smoke HTTP 16/16 aprobado sin navegador.
- Lectura real del servicio en todas las páginas locales: materias 17 registros/6 eventos, profesores 28/1, cursadas 17/5, comisiones 18/3, users 2/6 y feedback 4/7. Los actores resolubles coinciden con User.displayName; última modificación de materia resuelta. Seis snapshots legados de feedback no tienen referencia y conservan su ausencia, sin atribuirlos al autor actual.
- Revisión React de hooks, foco, semántica, permisos y renderizado sin cambios globales ni dependencias. Sin pruebas visuales; revisión de navegador a cargo del usuario.
- Entrega en grupos propuestos de UI, auditoría y documentación. No se ejecutan staging, commits, push ni merge por instrucción final del usuario.
