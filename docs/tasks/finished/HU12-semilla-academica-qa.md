# HU12 — Semilla académica local de QA

## Alcance
Incorporar los datos del ZIP aportado por Luana al seed académico existente para probar HU11/HU12 localmente.

## Exclusiones y restricciones
Sin usuarios, credenciales, cambios de esquema, dependencias, borrados ni escrituras en entornos remotos. Conservar registros existentes.

## Decisión
Adaptar las tres búsquedas findUnique del archivo recibido a findFirst con deletedAt: null: el esquema actual usa índices únicos parciales para materias, cursadas y comisiones. Mantener createMany con skipDuplicates para asociaciones.

## Criterios de aceptación
43 materias de Sistemas con años y electivas; cursadas, comisiones y docentes demo del ZIP. Compila con el esquema actual. Dos ejecuciones locales consecutivas no duplican registros.

## Validación
Pendiente: build backend, carga local y segunda ejecución. Docker Desktop está pausado.

Build backend correcto (npm run build --workspace=back) y git diff --check correcto. Carga e idempotencia pendientes por Docker pausado.

## Resultado local
Docker reconstruido y saludable; migraciones completadas. Primera carga: 43 materias, 11 profesores, 17 cursadas y 20 comisiones. Segunda carga: 0 altas en las cuatro entidades. No se borraron datos. Pruebas funcionales HU12 pendientes de sesión USER en navegador.
