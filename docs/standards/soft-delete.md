# Soft Delete

Estándar para entidades nuevas del backend, en general — no exclusivo de `academic`. No es
retroactivo para `User`/`Session`/etc. de `auth`: evaluar ahí es deuda técnica registrada en
Trello, condicionada a que exista un caso de uso real de baja de cuenta.

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

## Límite conocido, no resuelto

Los índices únicos de Postgres no filtran por `deletedAt IS NULL` a menos que se declaren como
índice parcial. Mientras no exista ningún caso de uso real de borrado, esto no importa (nadie
intenta reutilizar un nombre de un registro "borrado"). El día que exista ese caso de uso, hay
que convertir los índices únicos afectados a parciales — no antes, porque sería resolver un
problema que todavía no existe.

## Referencia

`back/prisma/schema.prisma` — `Materia`, `Profesor`, `Cursada`, `Comision`.
