-- ============================================================
--  KaiwaDoJo — Initial Database Schema
--  Migration: 001_initial_schema.sql
-- ============================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enums
CREATE TYPE user_role       AS ENUM ('pelajar', 'pemateri');
CREATE TYPE course_level    AS ENUM ('pemula', 'menengah', 'mahir');
CREATE TYPE content_type    AS ENUM ('video', 'artikel', 'quiz');
CREATE TYPE video_provider  AS ENUM ('youtube', 'drive');

-- ============================================================
--  1. PROFILES
-- ============================================================
CREATE TABLE profiles (
  id              UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name       TEXT        NOT NULL,
  username        TEXT        UNIQUE NOT NULL,
  avatar_url      TEXT,
  bio             TEXT,
  role            user_role   NOT NULL DEFAULT 'pelajar',
  streak_days     INT         NOT NULL DEFAULT 0,
  last_active_at  TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO profiles (id, full_name, username, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'username',  NEW.email),
    COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'pelajar')
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
--  2. INSTRUCTOR PROFILES
-- ============================================================
CREATE TABLE instructor_profiles (
  id             UUID          PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  expertise      TEXT[]        DEFAULT '{}',
  total_students INT           NOT NULL DEFAULT 0,
  rating_avg     NUMERIC(3,2)  NOT NULL DEFAULT 0,
  verified       BOOLEAN       NOT NULL DEFAULT FALSE
);

-- ============================================================
--  3. COURSES
-- ============================================================
CREATE TABLE courses (
  id                      UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  instructor_id           UUID          NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title                   TEXT          NOT NULL,
  slug                    TEXT          UNIQUE NOT NULL,
  description             TEXT,
  thumbnail_url           TEXT,
  level                   course_level  NOT NULL DEFAULT 'pemula',
  language                TEXT          NOT NULL DEFAULT 'Bahasa Indonesia',
  category                TEXT,
  tags                    TEXT[]        DEFAULT '{}',
  is_published            BOOLEAN       NOT NULL DEFAULT FALSE,
  total_duration_minutes  INT           NOT NULL DEFAULT 0,
  total_lessons           INT           NOT NULL DEFAULT 0,
  created_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE TRIGGER courses_updated_at
  BEFORE UPDATE ON courses
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE course_sections (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  course_id   UUID        NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  title       TEXT        NOT NULL,
  order_index INT         NOT NULL DEFAULT 0
);

CREATE TABLE lessons (
  id               UUID            PRIMARY KEY DEFAULT uuid_generate_v4(),
  section_id       UUID            NOT NULL REFERENCES course_sections(id) ON DELETE CASCADE,
  course_id        UUID            NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  title            TEXT            NOT NULL,
  content_type     content_type    NOT NULL DEFAULT 'video',
  video_provider   video_provider,
  video_id         TEXT,
  content_body     TEXT,
  duration_minutes INT             NOT NULL DEFAULT 0,
  order_index      INT             NOT NULL DEFAULT 0,
  is_free_preview  BOOLEAN         NOT NULL DEFAULT FALSE
);

-- ============================================================
--  4. QUIZ
-- ============================================================
CREATE TABLE quiz_questions (
  id          UUID  PRIMARY KEY DEFAULT uuid_generate_v4(),
  lesson_id   UUID  NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  question    TEXT  NOT NULL,
  options     JSONB NOT NULL,
  order_index INT   NOT NULL DEFAULT 0
);

CREATE TABLE quiz_attempts (
  id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id    UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  lesson_id     UUID        NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  answers       JSONB       NOT NULL,
  score         INT         NOT NULL DEFAULT 0,
  passed        BOOLEAN     NOT NULL DEFAULT FALSE,
  attempted_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
--  5. ENROLLMENTS
-- ============================================================
CREATE TABLE enrollments (
  id            UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id    UUID          NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  course_id     UUID          NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  enrolled_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  completed_at  TIMESTAMPTZ,
  progress_pct  NUMERIC(5,2)  NOT NULL DEFAULT 0,
  UNIQUE(student_id, course_id)
);

-- ============================================================
--  6. LESSON PROGRESS
-- ============================================================
CREATE TABLE lesson_progress (
  id                     UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id             UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  lesson_id              UUID        NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  course_id              UUID        NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  is_completed           BOOLEAN     NOT NULL DEFAULT FALSE,
  last_watched_at        TIMESTAMPTZ,
  watch_duration_seconds INT         NOT NULL DEFAULT 0,
  replay_count           INT         NOT NULL DEFAULT 0,
  UNIQUE(student_id, lesson_id)
);

-- ============================================================
--  7. KOMENTAR / DISKUSI
-- ============================================================
CREATE TABLE comments (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  lesson_id   UUID        NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  user_id     UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  parent_id   UUID        REFERENCES comments(id) ON DELETE CASCADE,
  body        TEXT        NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER comments_updated_at
  BEFORE UPDATE ON comments
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
--  8. RATING & ULASAN
-- ============================================================
CREATE TABLE ratings (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id  UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  course_id   UUID        NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  rating      INT         NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment     TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(student_id, course_id)
);

-- ============================================================
--  9. STREAK / GAMIFIKASI
-- ============================================================
CREATE TABLE learning_streaks (
  id          UUID  PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id  UUID  NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  date        DATE  NOT NULL DEFAULT CURRENT_DATE,
  UNIQUE(student_id, date)
);

CREATE OR REPLACE FUNCTION update_streak_days()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_last_date DATE;
  v_streak    INT;
BEGIN
  SELECT date INTO v_last_date
  FROM learning_streaks
  WHERE student_id = NEW.student_id AND date < NEW.date
  ORDER BY date DESC LIMIT 1;

  IF v_last_date = NEW.date - INTERVAL '1 day' THEN
    SELECT streak_days INTO v_streak FROM profiles WHERE id = NEW.student_id;
    UPDATE profiles SET streak_days = v_streak + 1, last_active_at = NOW()
    WHERE id = NEW.student_id;
  ELSE
    UPDATE profiles SET streak_days = 1, last_active_at = NOW()
    WHERE id = NEW.student_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_streak_insert
  AFTER INSERT ON learning_streaks
  FOR EACH ROW EXECUTE FUNCTION update_streak_days();

-- ============================================================
--  10. INDEXES
-- ============================================================
CREATE INDEX idx_courses_instructor       ON courses(instructor_id);
CREATE INDEX idx_courses_published        ON courses(is_published);
CREATE INDEX idx_lessons_course           ON lessons(course_id);
CREATE INDEX idx_lessons_section          ON lessons(section_id);
CREATE INDEX idx_enrollments_student      ON enrollments(student_id);
CREATE INDEX idx_enrollments_course       ON enrollments(course_id);
CREATE INDEX idx_lesson_progress_student  ON lesson_progress(student_id);
CREATE INDEX idx_lesson_progress_course   ON lesson_progress(course_id);
CREATE INDEX idx_comments_lesson          ON comments(lesson_id);
CREATE INDEX idx_learning_streaks_student ON learning_streaks(student_id);

-- ============================================================
--  11. ROW LEVEL SECURITY (RLS)
-- ============================================================
ALTER TABLE profiles            ENABLE ROW LEVEL SECURITY;
ALTER TABLE instructor_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE courses             ENABLE ROW LEVEL SECURITY;
ALTER TABLE course_sections     ENABLE ROW LEVEL SECURITY;
ALTER TABLE lessons             ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_questions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_attempts       ENABLE ROW LEVEL SECURITY;
ALTER TABLE enrollments         ENABLE ROW LEVEL SECURITY;
ALTER TABLE lesson_progress     ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments            ENABLE ROW LEVEL SECURITY;
ALTER TABLE ratings             ENABLE ROW LEVEL SECURITY;
ALTER TABLE learning_streaks    ENABLE ROW LEVEL SECURITY;

-- PROFILES
CREATE POLICY "profiles_select_public" ON profiles FOR SELECT USING (TRUE);
CREATE POLICY "profiles_update_own"    ON profiles FOR UPDATE USING (auth.uid() = id);

-- INSTRUCTOR PROFILES
CREATE POLICY "instructor_profiles_select_public" ON instructor_profiles FOR SELECT USING (TRUE);
CREATE POLICY "instructor_profiles_update_own"    ON instructor_profiles FOR UPDATE USING (auth.uid() = id);

-- COURSES
CREATE POLICY "courses_select_published" ON courses FOR SELECT
  USING (is_published = TRUE OR instructor_id = auth.uid());

CREATE POLICY "courses_insert_pemateri" ON courses FOR INSERT
  WITH CHECK (
    instructor_id = auth.uid() AND
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'pemateri')
  );

CREATE POLICY "courses_update_own" ON courses FOR UPDATE USING (instructor_id = auth.uid());
CREATE POLICY "courses_delete_own" ON courses FOR DELETE USING (instructor_id = auth.uid());

-- COURSE SECTIONS
CREATE POLICY "sections_select" ON course_sections FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM courses
      WHERE id = course_sections.course_id
        AND (is_published = TRUE OR instructor_id = auth.uid())
    )
  );

CREATE POLICY "sections_write_instructor" ON course_sections FOR ALL
  USING (
    EXISTS (SELECT 1 FROM courses WHERE id = course_sections.course_id AND instructor_id = auth.uid())
  );

-- LESSONS (video_id hanya untuk enrolled atau pemateri pemilik)
CREATE POLICY "lessons_select_enrolled_or_preview" ON lessons FOR SELECT
  USING (
    is_free_preview = TRUE
    OR EXISTS (SELECT 1 FROM enrollments WHERE student_id = auth.uid() AND course_id = lessons.course_id)
    OR EXISTS (SELECT 1 FROM courses WHERE id = lessons.course_id AND instructor_id = auth.uid())
  );

CREATE POLICY "lessons_write_instructor" ON lessons FOR ALL
  USING (EXISTS (SELECT 1 FROM courses WHERE id = lessons.course_id AND instructor_id = auth.uid()));

-- QUIZ QUESTIONS
CREATE POLICY "quiz_questions_select" ON quiz_questions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM lessons l JOIN enrollments e ON e.course_id = l.course_id
      WHERE l.id = quiz_questions.lesson_id AND e.student_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM lessons l JOIN courses c ON c.id = l.course_id
      WHERE l.id = quiz_questions.lesson_id AND c.instructor_id = auth.uid()
    )
  );

CREATE POLICY "quiz_questions_write_instructor" ON quiz_questions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM lessons l JOIN courses c ON c.id = l.course_id
      WHERE l.id = quiz_questions.lesson_id AND c.instructor_id = auth.uid()
    )
  );

CREATE POLICY "quiz_attempts_own" ON quiz_attempts FOR ALL USING (student_id = auth.uid());

-- ENROLLMENTS
CREATE POLICY "enrollments_select_own" ON enrollments FOR SELECT
  USING (
    student_id = auth.uid()
    OR EXISTS (SELECT 1 FROM courses WHERE id = enrollments.course_id AND instructor_id = auth.uid())
  );

CREATE POLICY "enrollments_insert_pelajar" ON enrollments FOR INSERT
  WITH CHECK (
    student_id = auth.uid() AND
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'pelajar')
  );

-- LESSON PROGRESS
CREATE POLICY "lesson_progress_own" ON lesson_progress FOR ALL USING (student_id = auth.uid());

-- COMMENTS
CREATE POLICY "comments_select_enrolled" ON comments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM lessons l JOIN enrollments e ON e.course_id = l.course_id
      WHERE l.id = comments.lesson_id AND e.student_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM lessons l JOIN courses c ON c.id = l.course_id
      WHERE l.id = comments.lesson_id AND c.instructor_id = auth.uid()
    )
  );

CREATE POLICY "comments_insert_enrolled" ON comments FOR INSERT
  WITH CHECK (
    user_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM lessons l JOIN enrollments e ON e.course_id = l.course_id
      WHERE l.id = comments.lesson_id AND e.student_id = auth.uid()
    )
  );

CREATE POLICY "comments_update_own" ON comments FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "comments_delete_own" ON comments FOR DELETE USING (user_id = auth.uid());

-- RATINGS
CREATE POLICY "ratings_select_public" ON ratings FOR SELECT USING (TRUE);
CREATE POLICY "ratings_write_own"     ON ratings FOR ALL   USING (student_id = auth.uid());

-- LEARNING STREAKS
CREATE POLICY "streaks_own" ON learning_streaks FOR ALL USING (student_id = auth.uid());
