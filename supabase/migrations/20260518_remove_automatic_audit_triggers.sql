-- Migration: Remove automatic audit triggers to prevent duplicating every database write into audit_logs.
-- This ensures only clean, explicit user-initiated actions from the frontend are recorded.

DO $$
DECLARE
    t text;
BEGIN
    FOR t IN 
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
          AND table_type = 'BASE TABLE' 
          AND table_name != 'audit_logs'
    LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS trg_audit_%I ON public.%I', t, t);
    END LOOP;
END;
$$;

DROP FUNCTION IF EXISTS public.log_table_change() CASCADE;
