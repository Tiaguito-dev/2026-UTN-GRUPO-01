-- El ledger administrativo registra también el actor de los snapshots de comentarios.
-- Se amplía el contrato existente sin modificar eventos ni identidades históricas.
ALTER TABLE "AdministracionHistorial"
  DROP CONSTRAINT "AdministracionHistorial_entidad_check",
  ADD CONSTRAINT "AdministracionHistorial_entidad_check"
    CHECK ("entidad" IN ('materia', 'profesor', 'cursada', 'comision', 'usuario', 'feedback'));
