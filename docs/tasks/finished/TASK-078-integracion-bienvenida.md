# TASK-078: Integrar bienvenida con sprint actual

Base desarrollo 4e83a99. Resolver conflictos conservando moderación, normas, reportes y cambios de navegación actuales. La muestra pública por materia debe excluir experiencias ocultas y pendientes de moderación según las políticas actuales. Conservar logo vigente, indicador de carga y entrada animada. Validar integración, tipos, lint, pruebas y flujo local antes de publicar PR contra desarrollo.

## Verificación
Integración HTTP PostgreSQL aprobada con siete experiencias publicadas de una materia y exclusiones de pendientes, rechazadas y ocultas por autor, administración o reportes. Regresión frontend 105/105 aprobada. Tipos y lint de ambas aplicaciones aprobados. Navegador local 3600 comprobó búsqueda real, selección por materia, límite protegido en servidor y enlace al formulario de acceso con contexto. El indicador de carga conserva la revelación de 950 ms y movimiento reducido.
