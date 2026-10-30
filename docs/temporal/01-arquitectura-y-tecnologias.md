# Arquitectura y tecnologías del software

## Objetivo

Proponer una base técnica para Profesor Butchery que permita implementar operaciones concretas del producto, mantener responsabilidades claras y agregar funcionalidades sin acoplar la lógica de negocio a la base de datos, al framework o a servicios externos.

La arquitectura es una propuesta inicial, sujeta a revisión con el equipo. Debe ayudar a desarrollar el sistema y resultar comprensible para quienes lo mantengan.

## Tecnologías

| Elemento | Definición o propuesta | Motivo |
| --- | --- | --- |
| Lenguaje del backend | TypeScript, definido. | Expresar contratos y mantener tipos explícitos. |
| Framework del backend | NestJS, definido. | Organizar módulos y utilizar su inyección de dependencias, controladores y guards. |
| Comunicación con el frontend | API HTTP con recursos y operaciones explícitas, propuesta. | Exponer los casos de uso sin trasladar reglas de negocio al cliente. |
| Persistencia | Base de datos relacional; PostgreSQL como candidato. | Representar relaciones e integridad entre usuarios, asignaciones académicas y valoraciones. |
| Acceso a datos | ORM por definir; Prisma o TypeORM como alternativas. | Implementar persistencia y migraciones detrás de contratos propios. |
| Sesiones | Access token JWT de corta duración y refresh token con estado revocable, propuesta. | Renovar credenciales y permitir finalizar sesiones. |
| Frontend | Tecnología por definir. | No se acordó todavía un framework para el producto principal. |
| Email | Proveedor por definir, detrás de un puerto de aplicación. | Permitir recuperar contraseñas sin depender de un proveedor dentro del caso de uso. |
| Moderación | Contrato abstracto; implementación futura. | Analizar comentarios sin condicionar el sistema a un modelo o proveedor. |

La elección del ORM, el frontend, el proveedor de email y el despliegue no se considera cerrada por este documento. No se fijan versiones de dependencias.

## Arquitectura propuesta

Se propone un **monolito modular con arquitectura hexagonal, organizado alrededor de casos de uso y puertos de persistencia**.

El backend se ejecutaría como una aplicación NestJS. Los módulos agrupan capacidades de negocio; dentro de cada módulo se separan las reglas, las operaciones de aplicación y los detalles externos.

| Módulo | Responsabilidad |
| --- | --- |
| `auth` | Registro, autenticación, renovación y finalización de sesiones, recuperación y cambio de contraseña. |
| `users` | Identidad y datos de cuenta utilizados por los otros módulos. |
| `academic` | Materias, cátedras, profesores y sus asignaciones; comisiones si se acuerdan como entidad. |
| `reviews` | Consulta de valoraciones y comentarios; futura creación y moderación. |
| `shared` | Utilidades técnicas realmente compartidas y de alcance reducido. |

La administración puede presentarse como un área de la interfaz, pero sus operaciones pertenecen al módulo correspondiente. Crear una materia sigue siendo una operación de `academic` aunque la ejecute un administrador.

## Por qué se propone

El sistema tiene acciones bien delimitadas: consultar comentarios de un profesor en una cátedra, obtener su valoración en ese contexto, registrar una cuenta o asignar un profesor. Organizar el código alrededor de estas acciones permite identificar qué hace el software sin inferirlo de servicios CRUD genéricos.

Los puertos permiten sustituir detalles de persistencia y servicios externos y probar los casos de uso de manera aislada. La inyección de dependencias de NestJS permite conectar las implementaciones concretas con los contratos definidos por la aplicación.

El monolito modular mantiene simple el despliegue y la coordinación del equipo. La separación interna aporta límites sin introducir comunicación distribuida ni múltiples servicios desde la primera iteración.

Esto no implica eliminar los controladores ni los servicios necesarios. Los controladores siguen resolviendo HTTP; los casos de uso coordinan cada operación y los servicios de dominio se incorporan cuando una regla compartida lo justifique.

## Responsabilidades y dependencias

| Parte | Responsabilidad | Límite |
| --- | --- | --- |
| Dominio | Entidades, invariantes y reglas propias del negocio. | No importa NestJS, el ORM ni clientes de proveedores. |
| Aplicación | Casos de uso, entradas, salidas y puertos necesarios para ejecutarlos. | No conoce SQL, cookies ni formatos específicos de proveedores. |
| Presentación | Controladores, DTO HTTP y guards; traducción de errores a respuestas. | No concentra reglas de negocio. |
| Infraestructura | Adaptadores de repositorios, email y otros servicios externos. | Implementa contratos; no decide las reglas de valoración o publicación. |
| Composición | Módulos y configuración de providers de NestJS. | Conecta contratos con implementaciones. |

Las dependencias de código apuntan hacia dominio y aplicación. Que el flujo de ejecución llame a un adaptador no significa que el caso de uso deba importar ese adaptador.

## Organización de referencia

Para `reviews`, la distribución propuesta es:

- `domain/`: entidades y reglas de valoración.
- `application/use-cases/`: acciones como `ListarReseñasDeCursada` y `ObtenerPromedioDeCursada`. (El nivel exacto al que se asocia una reseña —`Cursada` o `Comision`— es la pregunta abierta #1 de `03-modelo-de-dominio.md`; estos nombres son ilustrativos hasta resolverla.)
- `application/ports/`: contratos de consultas, persistencia y futura moderación.
- `infrastructure/persistence/`: implementaciones de esos contratos con el ORM elegido.
- `presentation/http/`: controladores y DTO de entrada y salida.
- `reviews.module.ts`: conexión de providers y exposición del módulo.

Los casos de uso pueden ser clases TypeScript sin decoradores de NestJS, creadas mediante providers con `useFactory`. Los identificadores de inyección pueden ser símbolos o clases abstractas; las interfaces TypeScript no existen en tiempo de ejecución y necesitan un token explícito para resolverlas en el contenedor.

## Repositorios y consultas

Los puertos deben declarar las operaciones que necesita el producto. No se propone un repositorio genérico con todas las operaciones CRUD para cada tabla.

Un contrato de consulta de valoraciones puede ofrecer `findByCursadaId`; un contrato de cursadas puede permitir verificar si una cursada existe. Cada operación se agrega cuando un caso de uso la requiere.

Los adaptadores de repositorio se ocupan de consultar, persistir y mapear datos. La aplicación coordina transacciones cuando una operación requiere varias escrituras atómicas. Las restricciones de la base de datos complementan las validaciones del negocio.

Las lecturas pueden devolver proyecciones: por ejemplo, profesor, cátedra, promedio, cantidad de valoraciones y comentarios. No hace falta reconstruir todas las entidades de dominio para mostrar una pantalla de consulta. Esta separación no requiere introducir CQRS formal ni buses de comandos.

## Moderador de comentarios como abstracción

La moderación se representa como una capacidad externa que la aplicación podrá utilizar al incorporar la publicación de comentarios. No se vincula a un proveedor concreto.

Un contrato inicial posible es:

```typescript
export interface CommentModerator {
  analyze(comment: string): Promise<boolean>;
}
```

`true` indica que el comentario cumple la política de publicación; `false`, que no la cumple. Esta definición debe quedar documentada para evitar confundir una respuesta negativa con una falla técnica del servicio.

El adaptador implementará el análisis. El caso de uso futuro decidirá cómo continuar: aceptar, rechazar o aplicar el flujo acordado. Una falla del moderador se informa como error; no se convierte silenciosamente en una aprobación o rechazo.

Si posteriormente se necesitan motivos, categorías o intensidades, el contrato puede evolucionar a una respuesta estructurada:

```typescript
export interface ModerationResult {
  accepted: boolean;
  reasons?: string[];
}

export interface CommentModerator {
  analyze(comment: string): Promise<ModerationResult>;
}
```

Son alternativas sucesivas, no dos contratos que deban implementarse ahora. La complejidad se incorpora cuando exista un requerimiento concreto. La evolución requerirá ajustar los consumidores del puerto, aunque los detalles del proveedor seguirán encapsulados.

En la primera iteración no se publica contenido ni se implementa la integración de moderación. Puede documentarse el puerto futuro sin crear adaptadores o archivos vacíos. Un fake puede incorporarse cuando comiencen los casos de uso de escritura.

## Límites de la propuesta

- No incorporar microservicios, event sourcing, buses o CQRS formal sin una necesidad identificada.
- No crear entidades, interfaces o capas exclusivamente para satisfacer una estructura de carpetas.
- No generar operaciones de modificación o eliminación que el producto todavía no necesita.
- No hacer que un módulo importe repositorios concretos o tablas internas de otro; utilizar contratos explícitos cuando necesite colaborar.
- No compartir entidades del ORM con el frontend ni convertirlas en contratos públicos de la API.

## Verificación de la arquitectura

Los casos de uso con reglas relevantes deben poder probarse con implementaciones en memoria de sus puertos. La persistencia necesita pruebas de integración para relaciones y restricciones. Los guards y la autenticación deben verificarse también por HTTP, especialmente el rechazo de operaciones administrativas ejecutadas por un usuario común.

Se prioriza comprobar comportamientos reales y límites entre módulos. No se requiere un framework de pruebas distinto para cada capa.

## Decisiones pendientes

1. Seleccionar base de datos y ORM.
2. Seleccionar frontend y acordar contratos de API.
3. Definir la topología de frontend/backend para concretar cookies, CORS y protección CSRF.
4. Acordar herramientas de pruebas, migraciones y ejecución local.
5. Revisar con el equipo si la separación propuesta es sostenible para el tiempo disponible.
