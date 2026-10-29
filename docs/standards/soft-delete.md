# Soft Delete

Estándar para entidades nuevas del backend, en general — no exclusivo de `academic`.
User conserva identidad y usa desactivación reversible de acceso con `disabledAt` (TASK-070).
Session y credenciales mantienen revocación/invalidación propias, sin adoptar una baja académica.

## Regla

Toda entidad nueva que pueda necesitar eliminarse en el futuro agrega `deletedAt: DateTime?`
(Prisma) / `deletedAt: Date | null` (TypeScript) desde que se crea, aunque todavía no exista
ningún caso de uso de borrado. `null` significa que no está borrada.

```prisma
model Materia {
  id        String    @id @default(uuid()) @db.Uuid
  nombre    String    @unique @db.VarChar(150)
  createdAt DateTime  @default(now()) @db.Timestamptz(3)
  deletedAt DateTime? @db.Timestamptz(3)
}
```

Todas las consultas de lectura de la entidad filtran `deletedAt: null` en el adaptador de
infraestructura (no en el caso de uso ni en el dominio — es un detalle de qué cuenta como
"existe" para la persistencia).

## Por qué desde el día uno, aunque nadie borre nada todavía

Agregar el campo después de que la tabla ya tiene datos y relaciones reales es una migración más
arriesgada que declararlo vacío desde el principio. El campo no implementa ningún caso de uso
por sí solo — solo deja el terreno listo.

## Unicidad y reutilización de claves

Los índices únicos de Postgres no filtran por `deletedAt IS NULL` a menos que se declaren como
índice parcial. Al implementar una baja real, las claves naturales que deban poder reutilizarse
se convierten a índices parciales de registros vigentes, conservando IDs y referencias históricos.

TASK-070 implementa esta regla para Materia.nombre, Cursada(materiaId,anio,cuatrimestre) y
Comision(cursadaId,carrera,numero). Los índices viven en SQL porque Prisma no expresa el
predicado parcial; los seeds consultan registros vigentes con findFirst. La baja es lógica,
protegida por ADMIN y rechaza relaciones vigentes en vez de borrar por cascada.

User usa `disabledAt` para desactivar acceso, sin borrar identidad ni comentarios. Es un estado
administrativo reversible con revocación de sesiones y auditoría, distinto de la baja académica.

## Referencia

`back/prisma/schema.prisma` — `Materia`, `Profesor`, `Cursada`, `Comision`.
