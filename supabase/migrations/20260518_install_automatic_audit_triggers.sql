-- Database Trigger function to automatically record all write actions on public tables
CREATE OR REPLACE FUNCTION public.log_table_change()
RETURNS TRIGGER AS $$
DECLARE
    user_uuid UUID;
    action_str TEXT;
    entity_id_str TEXT;
    description_str TEXT;
    user_name_str TEXT;
    rec RECORD;
BEGIN
    -- Determine the current authenticated user
    user_uuid := auth.uid();
    
    -- Pick the correct record depending on action
    IF TG_OP = 'DELETE' THEN
        rec := OLD;
        action_str := 'DELETE';
    ELSIF TG_OP = 'INSERT' THEN
        rec := NEW;
        action_str := 'CREATE';
    ELSE
        rec := NEW;
        action_str := 'UPDATE';
    END IF;

    -- Extract entity ID if possible
    BEGIN
        entity_id_str := rec.id::text;
    EXCEPTION WHEN OTHERS THEN
        entity_id_str := NULL;
    END;

    -- Try to fetch user name
    IF user_uuid IS NOT NULL THEN
        SELECT COALESCE(full_name, email) INTO user_name_str 
        FROM public.profiles 
        WHERE user_id = user_uuid OR id = user_uuid
        LIMIT 1;
    END IF;
    
    IF user_name_str IS NULL THEN
        user_name_str := 'System';
    END IF;

    -- Build standard description
    IF TG_OP = 'UPDATE' THEN
        description_str := 'Updated record ' || COALESCE(entity_id_str, 'N/A') || ' inside table "' || TG_TABLE_NAME || '"';
    ELSIF TG_OP = 'INSERT' THEN
        description_str := 'Created new record ' || COALESCE(entity_id_str, 'N/A') || ' inside table "' || TG_TABLE_NAME || '"';
    ELSIF TG_OP = 'DELETE' THEN
        description_str := 'Deleted record ' || COALESCE(entity_id_str, 'N/A') || ' from table "' || TG_TABLE_NAME || '"';
    END IF;

    -- Do not loop audit_logs itself to prevent infinite recurse
    IF TG_TABLE_NAME = 'audit_logs' THEN
        RETURN rec;
    END IF;

    -- Insert into public.audit_logs
    INSERT INTO public.audit_logs (
        user_id,
        action_type,
        entity_name,
        entity_id,
        description,
        metadata,
        ip_address
    ) VALUES (
        user_uuid,
        action_str,
        UPPER(TG_TABLE_NAME),
        entity_id_str,
        description_str,
        jsonb_build_object(
            'table_name', TG_TABLE_NAME,
            'user_name', user_name_str,
            'operation', TG_OP
        ),
        '127.0.0.1'
    );

    RETURN rec;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Dynamically attach this audit trigger to all tables in the public schema
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
        -- Drop if exists first to avoid duplication
        EXECUTE format('DROP TRIGGER IF EXISTS trg_audit_%I ON public.%I', t, t);
        -- Create trigger to watch for write changes
        EXECUTE format('CREATE TRIGGER trg_audit_%I AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.log_table_change()', t, t);
    END LOOP;
END;
$$;
