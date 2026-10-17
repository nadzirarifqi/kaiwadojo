-- Migration 039: Add Referral Code Column to Profiles
-- Diisi (opsional) saat pendaftaran; ditampilkan read-only di halaman profil.

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS referral_code TEXT;

CREATE INDEX IF NOT EXISTS idx_profiles_referral_code ON public.profiles (referral_code);

SELECT * FROM deleted_rows_archive WHERE owner_id = '<user_id>' ORDER BY deleted_at DESC;