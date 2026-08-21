-- Provision application profiles atomically with Supabase Auth users.

CREATE OR REPLACE FUNCTION handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_role user_role;
BEGIN
    v_role := CASE
        WHEN NEW.raw_user_meta_data->>'role' = 'provider' THEN 'provider'::user_role
        ELSE 'client'::user_role
    END;

    INSERT INTO profiles (
        id,
        user_id,
        role,
        full_name,
        email,
        phone,
        document_cpf,
        avatar_url,
        neighborhood,
        city,
        state,
        is_active
    ) VALUES (
        NEW.id,
        NEW.id,
        v_role,
        COALESCE(NULLIF(trim(NEW.raw_user_meta_data->>'full_name'), ''), split_part(NEW.email, '@', 1)),
        lower(NEW.email),
        COALESCE(NULLIF(trim(NEW.raw_user_meta_data->>'phone'), ''), 'Não informado'),
        NULLIF(regexp_replace(COALESCE(NEW.raw_user_meta_data->>'document_cpf', ''), '\D', '', 'g'), ''),
        NULLIF(trim(NEW.raw_user_meta_data->>'avatar_url'), ''),
        COALESCE(NULLIF(trim(NEW.raw_user_meta_data->>'neighborhood'), ''), 'Não informado'),
        'Rondonópolis',
        'MT',
        true
    )
    ON CONFLICT (user_id) DO NOTHING;

    IF v_role = 'provider' THEN
        INSERT INTO provider_profiles (profile_id, verification_status, is_available)
        VALUES (NEW.id, 'pending', false)
        ON CONFLICT (profile_id) DO NOTHING;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION handle_new_auth_user();

-- Repair Auth users created before the provisioning trigger existed.
INSERT INTO profiles (
    id,
    user_id,
    role,
    full_name,
    email,
    phone,
    document_cpf,
    avatar_url,
    neighborhood,
    city,
    state,
    is_active
)
SELECT
    au.id,
    au.id,
    CASE WHEN au.raw_user_meta_data->>'role' = 'provider' THEN 'provider'::user_role ELSE 'client'::user_role END,
    COALESCE(NULLIF(trim(au.raw_user_meta_data->>'full_name'), ''), split_part(au.email, '@', 1)),
    lower(au.email),
    COALESCE(NULLIF(trim(au.raw_user_meta_data->>'phone'), ''), 'Não informado'),
    NULLIF(regexp_replace(COALESCE(au.raw_user_meta_data->>'document_cpf', ''), '\D', '', 'g'), ''),
    NULLIF(trim(au.raw_user_meta_data->>'avatar_url'), ''),
    COALESCE(NULLIF(trim(au.raw_user_meta_data->>'neighborhood'), ''), 'Não informado'),
    'Rondonópolis',
    'MT',
    true
FROM auth.users au
WHERE au.email IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = au.id)
ON CONFLICT DO NOTHING;

INSERT INTO provider_profiles (profile_id, verification_status, is_available)
SELECT p.id, 'pending', false
FROM profiles p
JOIN auth.users au ON au.id = p.user_id
WHERE au.raw_user_meta_data->>'role' = 'provider'
  AND NOT EXISTS (SELECT 1 FROM provider_profiles pp WHERE pp.profile_id = p.id)
ON CONFLICT (profile_id) DO NOTHING;
