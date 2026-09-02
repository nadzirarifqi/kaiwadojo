-- ============================================================
-- MIGRATION 030: Backfill streak caps (learning_streaks)
-- Untuk semua user yang punya daily_missions hari sebelumnya
-- tapi belum mendapat cap di learning_streaks.
--
-- Logika:
--   1. Rest day (isNoPlan): target semua = 0 -> langsung beri cap
--   2. Mission dengan target > 0: tidak bisa dibackfill dari server
--      (diselesaikan dari sisi app saat user buka Dashboard)
--
-- Jalankan di: Supabase Dashboard > SQL Editor
-- ============================================================

-- Backfill cap untuk semua REST DAY (No Plan / Freeze)
INSERT INTO public.learning_streaks (id, student_id, date)
SELECT
  gen_random_uuid()::text AS id,
  dm.student_id,
  dm.date
FROM public.daily_missions dm
WHERE
  dm.target_replay_count = 0
  AND dm.target_quiz_count = 0
  AND dm.target_kotoba_count = 0
  AND NOT EXISTS (
    SELECT 1
    FROM public.learning_streaks ls
    WHERE ls.student_id = dm.student_id
      AND ls.date = dm.date
  )
ON CONFLICT (student_id, date) DO NOTHING;

-- Tampilkan hasil untuk verifikasi
SELECT
  dm.student_id,
  p.full_name,
  p.username,
  COUNT(*) AS rest_day_caps_added
FROM public.daily_missions dm
JOIN public.profiles p ON p.id = dm.student_id
WHERE
  dm.target_replay_count = 0
  AND dm.target_quiz_count = 0
  AND dm.target_kotoba_count = 0
GROUP BY dm.student_id, p.full_name, p.username
ORDER BY rest_day_caps_added DESC;
