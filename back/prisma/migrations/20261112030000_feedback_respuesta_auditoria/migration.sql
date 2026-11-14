-- Valor compatible con VARCHAR(16); conserva entidades y eventos de auditoría anteriores.
ALTER TABLE "AdministracionHistorial"
  DROP CONSTRAINT "AdministracionHistorial_entidad_check",
  ADD CONSTRAINT "AdministracionHistorial_entidad_check"
    CHECK ("entidad" IN ('materia', 'profesor', 'cursada', 'comision', 'usuario', 'feedback', 'feedbackLike', 'respuesta'));
