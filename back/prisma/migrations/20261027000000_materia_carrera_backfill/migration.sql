INSERT INTO "MateriaCarrera" SELECT id, 'S', "anioCarrera", "nivelElectiva" FROM "Materia" WHERE "anioCarrera" IS NOT NULL ON CONFLICT DO NOTHING;
