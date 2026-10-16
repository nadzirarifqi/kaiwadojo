-- Migration 039: Add Referral Code Column to Profiles
-- Diisi (opsional) saat pendaftaran; ditampilkan read-only di halaman profil.

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS referral_code TEXT;

CREATE INDEX IF NOT EXISTS idx_profiles_referral_code ON public.profiles (referral_code);
