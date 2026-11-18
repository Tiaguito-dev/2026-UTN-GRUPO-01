-- T5 adds historical actions only. No rewriting prior reports or publication decisions.
BEGIN;
ALTER TYPE "FeedbackAccion" ADD VALUE 'OCULTAMIENTO_REPORTES';
ALTER TYPE "FeedbackAccion" ADD VALUE 'RESTITUCION_REPORTES';
COMMIT;
