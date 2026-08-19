-- Migration 008: Add Instructor / Teacher Accounts manually to database

INSERT INTO public.profiles (id, full_name, username, avatar_url, bio, role, streak_days, created_at, updated_at)
VALUES 
  ('00000000-0000-0000-0000-000000000001', 'Tanaka Sensei', 'tanakasensei', 'https://api.dicebear.com/7.x/avataaars/svg?seed=Tanaka', 'Pengajar Kaiwa Dojo Spesialis Bunpou & Listening N4-N3', 'pemateri', 35, NOW(), NOW()),
  ('00000000-0000-0000-0000-000000000002', 'Kenji Sensei', 'kenjisensei', 'https://api.dicebear.com/7.x/avataaars/svg?seed=Kenji', 'Pengajar Percakapan Alami & JLPT Preparation', 'pemateri', 42, NOW(), NOW()),
  ('00000000-0000-0000-0000-000000000003', 'Yuki Sensei', 'yukisensei', 'https://api.dicebear.com/7.x/avataaars/svg?seed=Yuki', 'Pengajar Business Japanese & Keigo Practice', 'pemateri', 28, NOW(), NOW())
ON CONFLICT (id) DO UPDATE SET
  full_name = EXCLUDED.full_name,
  role = 'pemateri';

-- Instructor Profiles details
INSERT INTO public.instructor_profiles (id, expertise, total_students, rating_avg, verified)
VALUES 
  ('00000000-0000-0000-0000-000000000001', ARRAY['Bunpou', 'Listening', 'N4'], 120, 4.95, true),
  ('00000000-0000-0000-0000-000000000002', ARRAY['Kaiwa', 'JLPT N3', 'Shadowing'], 95, 4.90, true),
  ('00000000-0000-0000-0000-000000000003', ARRAY['Business Japanese', 'Keigo', 'Culture'], 88, 4.98, true)
ON CONFLICT (id) DO NOTHING;
