-- ============================================================================
-- Supabase PostgreSQL Security Hardening Script
-- Project: Autonomous AI Knowledge Worker
-- Resolves:
--   1. [Critical] RLS Disabled in Public on public.document_chunks (rls_disabled_in_public)
--   2. [Warning] Extension in Public for public.vector (extension_in_public)
-- ============================================================================

-- 1. Ensure extensions schema exists and relocate vector extension
CREATE SCHEMA IF NOT EXISTS extensions;
GRANT USAGE ON SCHEMA extensions TO postgres, anon, authenticated, service_role;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_extension e
        JOIN pg_namespace n ON e.extnamespace = n.oid
        WHERE e.extname = 'vector' AND n.nspname = 'public'
    ) THEN
        ALTER EXTENSION vector SET SCHEMA extensions;
    END IF;
END $$;

-- 2. Enable Row-Level Security (RLS) on all public tables
ALTER TABLE IF EXISTS public.document_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.document_embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.chat_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.refresh_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.token_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.history ENABLE ROW LEVEL SECURITY;

-- 3. Restrict anon direct PostgREST access to internal document chunks table
REVOKE ALL ON TABLE public.document_chunks FROM anon;
GRANT ALL ON TABLE public.document_chunks TO authenticated, service_role;
