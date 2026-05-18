-- ========================================================
-- TechWisdom ERP V4 - Drop Legacy Activity Log Table
-- Reason: Unified all logging into the secure audit_logs table
-- ========================================================

-- 1. Drop indices
DROP INDEX IF EXISTS idx_activity_log_created;
DROP INDEX IF EXISTS idx_activity_log_user;

-- 2. Drop RLS policies
DROP POLICY IF EXISTS "Anyone can read activity_log" ON public.activity_log;
DROP POLICY IF EXISTS "Anyone can insert activity_log" ON public.activity_log;

-- 3. Drop table
DROP TABLE IF EXISTS public.activity_log CASCADE;
