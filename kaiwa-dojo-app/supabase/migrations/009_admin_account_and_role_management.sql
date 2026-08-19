-- Migration 009: Add Admin Account (kaiwahiroshima) & Role System

INSERT INTO public.profiles (id, full_name, username, avatar_url, bio, role, streak_days, created_at, updated_at)
VALUES 
  ('00000000-0000-0000-0000-000000000099', 'Super Admin Hiroshima', 'kaiwahiroshima', 'https://api.dicebear.com/7.x/avataaars/svg?seed=HiroshimaAdmin', 'System Administrator KaiwaDojo Hiroshima', 'admin', 99, NOW(), NOW())
ON CONFLICT (id) DO UPDATE SET
  full_name = 'Super Admin Hiroshima',
  username = 'kaiwahiroshima',
  role = 'admin';
