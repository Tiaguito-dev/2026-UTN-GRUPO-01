-- Extiende el ledger existente sin modificar eventos ni mezclar likes con comentarios.
ALTER TABLE "AdministracionHistorial"
  DROP CONSTRAINT "AdministracionHistorial_entidad_check",
  ADD CONSTRAINT "AdministracionHistorial_entidad_check"
    CHECK ("entidad" IN ('materia', 'profesor', 'cursada', 'comision', 'usuario', 'feedback', 'feedbackLike'));
