-- Migration 040: Add Payment Status, Subscription Expiration, and Subscription Plans Table
-- Menambahkan kolom payment_status dan subscription_ends_at pada tabel profiles

-- 1. Tambah kolom ke tabel profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS plan_code TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'unpaid';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS subscription_ends_at TIMESTAMPTZ;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS access_level TEXT NOT NULL DEFAULT 'full';

-- 2. Index untuk pencarian dan query performa
CREATE INDEX IF NOT EXISTS idx_profiles_payment_status ON public.profiles (payment_status);
CREATE INDEX IF NOT EXISTS idx_profiles_subscription_ends_at ON public.profiles (subscription_ends_at);
CREATE INDEX IF NOT EXISTS idx_profiles_plan_code ON public.profiles (plan_code);

-- 3. Tabel subscription_plans
CREATE TABLE IF NOT EXISTS public.subscription_plans (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  group_name TEXT,
  duration_days INT,
  price NUMERIC(12,2) DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Seed data paket
INSERT INTO public.subscription_plans (code, name, description, group_name, duration_days, price, is_active, sort_order) VALUES
  ('minna1-mandiri-1bln', 'Minna 1 Mandiri Online · 1 Bulan', 'Akses online Minna no Nihongo 1 Mandiri selama 1 bulan', 'Minna 1 Mandiri', 30, 200000.00, true, 1),
  ('minna1-mandiri-6bln', 'Minna 1 Mandiri Online · 6 Bulan', 'Akses online Minna no Nihongo 1 Mandiri selama 6 bulan', 'Minna 1 Mandiri', 180, 1000000.00, true, 2),
  ('minna1-mandiri-1thn', 'Minna 1 Mandiri Online · 1 Tahun', 'Akses online Minna no Nihongo 1 Mandiri selama 1 tahun (Paling Hemat)', 'Minna 1 Mandiri', 365, 1500000.00, true, 3),
  ('minna1-kaiwa-1bln', 'Minna 1 Kaiwa Online · 1 Bulan', 'Akses online Minna no Nihongo 1 Kaiwa selama 1 bulan + kelas live 1x/minggu', 'Minna 1 Kaiwa', 30, 250000.00, true, 4),
  ('minna1-kaiwa-6bln', 'Minna 1 Kaiwa Online · 6 Bulan', 'Akses online Minna no Nihongo 1 Kaiwa selama 6 bulan + kelas live 1x/minggu', 'Minna 1 Kaiwa', 180, 1400000.00, true, 5),
  ('minna1-kaiwa-1thn', 'Minna 1 Kaiwa Online · 1 Tahun', 'Akses online Minna no Nihongo 1 Kaiwa selama 1 tahun + kelas live 1x/minggu', 'Minna 1 Kaiwa', 365, 1800000.00, true, 6),
  ('minna12-mandiri-1thn', 'Minna 1&2 Mandiri Online · 1 Tahun', 'Akses online paket komplit Minna 1 & 2 Mandiri selama 1 tahun', 'Minna 1&2 Mandiri', 365, 2500000.00, true, 7),
  ('minna12-kaiwa-1thn', 'Minna 1&2 Kaiwa Online · 1 Tahun', 'Akses online paket komplit Minna 1 & 2 Kaiwa selama 1 tahun + kelas live', 'Minna 1&2 Kaiwa', 365, 3500000.00, true, 8)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  group_name = EXCLUDED.group_name,
  duration_days = EXCLUDED.duration_days,
  price = EXCLUDED.price,
  is_active = EXCLUDED.is_active,
  sort_order = EXCLUDED.sort_order;
