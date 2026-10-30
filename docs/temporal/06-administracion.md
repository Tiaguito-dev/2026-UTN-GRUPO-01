# Administración

Estado: alcance de HU-11 actualizado el 2026-10-26. Las decisiones y la evidencia de esta
iteración se registran en [TASK-055](../tasks/finished/TASK-055-hu11-crud-modelo-actual.md).

## Requisitos

| Código | Requisito | Escenario HU-11 |
| --- | --- | --- |
| ADM-01 | Crear, editar y listar materias con su oferta por carrera. | 1 |
| ADM-03 | Crear, editar y listar profesores. | 2 |
| ADM-04 | Crear, editar y listar cursadas: materia, año y período (anual o cuatrimestral). | 2 |
| ADM-05 | Consultar usuarios registrados con paginación. | 3 |
| ADM-06 | Crear, editar y listar comisiones dentro de una cursada. | 4 |

ADM-02 está retirado: Cátedra se fusionó en Materia. El modelo vigente se definió en
[TASK-037](../tasks/finished/TASK-037-modelo-carreras-comisiones-profesores.md) y se contrajo en
[TASK-044](../tasks/finished/TASK-044-contraer-modelo-legado.md). Los profesores se asignan a
**comisiones**, con cargo docente; una cursada no tiene un profesor único. Una comisión se
identifica por carrera y número, y su nombre visible se deriva de ambos (por ejemplo, S-101).

## Alcance y reglas

- Las operaciones administrativas requieren sesión ADMIN y las escrituras mantienen la
  protección CSRF existente. La provisión de administradores usa el comando ya disponible
  `auth:provision-admin`; no hay gestión de roles desde el panel.
- Una cursada puede cambiar de materia, año y cuatrimestre conservando sus comisiones. Se
  rechaza el cambio de materia si alguna comisión no borrada pertenece a una carrera que la
  materia destino no ofrece, incluso si la comisión está inactiva.
- El período admite Anual, Primer cuatrimestre y Segundo cuatrimestre. El contrato conserva
  el campo `cuatrimestre` con valores `ANUAL`, `PRIMERO` y `SEGUNDO` por compatibilidad. La
  materia puede ofrecerse en más de una carrera mediante un selector de selección múltiple.
- Una comisión permite editar carrera y número conservando su cursada, sus profesores y cargos.
  Su carrera debe estar ofrecida por la materia de la cursada.
- No se permite retirar de una materia una carrera usada por sus comisiones. Las validaciones
  transaccionales protegen estas relaciones también frente a escrituras simultáneas.
- Las restricciones únicas evitan materias duplicadas por nombre, cursadas por materia/período
  y comisiones por cursada/carrera/número. Los conflictos devuelven 409; los datos incompatibles,
  400; los identificadores inexistentes, 404.
- Quedan fuera de alcance bajas, cambios de activa, gestión de roles y auditoría nueva. Se
  conserva el historial de materias. Los índices únicos actuales no son parciales; cualquier
  futura baja requiere revisar previamente la reutilización de identificadores.

## Presentación y navegación

Se conserva la portada del panel actual. Desde allí se accede a listados administrativos de
Materias, Profesores, Cursadas, Comisiones y Usuarios, mediante tablas paginadas sin filas
colapsables. Crear aparece sobre el listado y Editar a la derecha de cada fila; Usuarios es de
solo consulta. Las cursadas se filtran por materia y las comisiones por cursada. Al volver de
un formulario se conserva el contexto del listado; si cambia la materia de una cursada, se
regresa a la primera página de la nueva materia.

## Responsabilidades y contratos

Las operaciones académicas pertenecen a `academic` y el listado de usuarios a `users`. No se
agrega un módulo administrativo de dominio. Los GET de detalle de cursada y comisión mantienen
sus contratos de navegación para usuarios autenticados. El detalle de profesor y las nuevas
ediciones son administrativos. Las entradas PATCH son parciales, estrictas y no vacías.

Se aplican los estándares de [validación](../standards/validacion-con-zod.md),
[errores](../standards/catalogo-de-errores.md), [paginación](../standards/paginacion.md) y
[capas](../standards/arquitectura-de-capas.md). La verificación combina casos de uso, HTTP con
roles/CSRF y PostgreSQL, pruebas de interfaz y recorrido local sobre una base aislada.
