# TDD-UX-H3: Entrada pública y home interno

`/` conserva la landing visual, envuelta por control de visitante que espera comprobación
de sesión, redirige autenticados a `/home` y presenta error recuperable si no puede comprobar.
No usar presencia de cookie como autoridad ni mostrar contenido público durante la comprobación.
Aplicar el mismo control a login/registro para evitar ofrecerlos a cuentas ya autenticadas;
recuperación y reset conservan su comportamiento existente.

Excepción de recuperación: visitar explícitamente `/login` permite iniciar una sesión nueva
ante un error temporal, mostrando la advertencia sin afirmar que la sesión anterior terminó.
Esto conserva la salida de una renovación ambigua que no se puede repetir automáticamente.
Landing y registro mantienen comprobación/reintento antes de mostrar su contenido público.

El logo apunta a `/home` autenticado y `/` en otros estados. El icono de cuenta existe solo
autenticado. `/home` usa RequireAuth; `/account` y cambio mantienen la protección existente.
Retornos internos explícitos admiten `/home`; destino ausente/inseguro y `/` llevan a `/home`.

Home con menú lateral fijo en escritorio y adaptación móvil accesible; botones seleccionan
Inicio, Profesores, Materias, Experiencias y Comunidad. Los módulos previstos presentan
información y estado Próximamente, sin datos inventados ni operaciones ficticias. No añadir
backend académico. Perfil se accede desde menú de cuenta. Estados y revocación siguen en auth.
