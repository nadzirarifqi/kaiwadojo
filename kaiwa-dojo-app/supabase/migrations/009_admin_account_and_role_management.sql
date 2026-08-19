-- Migration 009: Add Admin Account in auth.users and public.profiles

-- 1. Insert into auth.users (if not exists) with encrypted password
INSERT INTO auth.users (
    id,
    instance_id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at
)
VALUES (
    '00000000-0000-0000-0000-000000000099',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'admin@kaiwadojo.com',
    crypt('inaconnextkaiwa6', gen_salt('bf')),
    NOW(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Super Admin Hiroshima","username":"kaiwahiroshima"}',
    NOW(),
    NOW()
)
ON CONFLICT (id) DO NOTHING;

-- 2. Insert into public.profiles
INSERT INTO public.profiles (
    id,
    full_name,
    username,
    email,
    avatar_url,
    bio,
    role,
    streak_days,
    created_at,
    updated_at
)
VALUES (
    '00000000-0000-0000-0000-000000000099',
    'Super Admin Hiroshima',
    'kaiwahiroshima',
    'admin@kaiwadojo.com',
    'https://api.dicebear.com/7.x/avataaars/svg?seed=HiroshimaAdmin',
    'System Administrator KaiwaDojo Hiroshima',
    'admin',
    99,
    NOW(),
    NOW()
)
ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    username = EXCLUDED.username,
    role = 'admin';
