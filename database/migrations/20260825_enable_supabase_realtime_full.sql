-- =============================================================================
-- FOOLPROOF REALTIME STREAMING & REPLICA IDENTITY ENROLLMENT
-- Only runs on tables that actually exist in your Supabase database
-- =============================================================================

DO $$
DECLARE
    tbl text;
    tables_to_check text[] := ARRAY[
        'programs',
        'batches',
        'applications',
        'beneficiaries',
        'staff_profiles',
        'notifications',
        'interview_schedules',
        'approved_assistance',
        'distributions',
        'funds',
        'activity_log',
        'audit_logs',
        'otp_requests',
        'active_user_sessions'
    ];
BEGIN
    FOREACH tbl IN ARRAY tables_to_check
    LOOP
        -- 1. Set REPLICA IDENTITY FULL if table exists
        IF EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_name = tbl
        ) THEN
            EXECUTE format('ALTER TABLE public.%I REPLICA IDENTITY FULL;', tbl);
            RAISE NOTICE 'Set REPLICA IDENTITY FULL on public.%', tbl;

            -- 2. Add table to supabase_realtime publication if publication exists
            IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
                BEGIN
                    EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I;', tbl);
                    RAISE NOTICE 'Enrolled public.% into supabase_realtime', tbl;
                EXCEPTION 
                    WHEN duplicate_object THEN 
                        NULL; -- Already added, ignore
                    WHEN others THEN 
                        RAISE NOTICE 'Skipping publication for public.%: %', tbl, SQLERRM;
                END;
            END IF;
        END IF;
    END LOOP;
END $$;
