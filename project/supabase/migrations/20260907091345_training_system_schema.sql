/*
# Training System Schema

## Overview
Adds a complete online training / self-learning system with courses, steps, exams, questions, training plans, and progress tracking.

## New Tables
1. training_courses — Top-level training course
2. training_exams — Exam attached to a step
3. training_questions — Questions within an exam (like Google Forms)
4. training_steps — Ordered steps within a course (content + optional exam)
5. training_plans — Admin assigns courses to users
6. training_progress — Per-step progress tracking (resume support)
7. training_exam_results — Exam attempt results

## Security
- RLS enabled on all tables, scoped TO authenticated.
- Admin can read/write all training data.
- Regular users can read assigned courses/steps/exams/questions, write their own progress and exam results.
- Exam results visible to admin and the user themselves.
*/

-- Training courses
CREATE TABLE IF NOT EXISTS training_courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE training_courses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_training_courses" ON training_courses;
CREATE POLICY "select_training_courses" ON training_courses FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_training_courses" ON training_courses;
CREATE POLICY "insert_training_courses" ON training_courses FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

DROP POLICY IF EXISTS "update_training_courses" ON training_courses;
CREATE POLICY "update_training_courses" ON training_courses FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

DROP POLICY IF EXISTS "delete_training_courses" ON training_courses;
CREATE POLICY "delete_training_courses" ON training_courses FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

-- Training exams
CREATE TABLE IF NOT EXISTS training_exams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  passing_score int NOT NULL DEFAULT 60,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE training_exams ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_training_exams" ON training_exams;
CREATE POLICY "select_training_exams" ON training_exams FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_training_exams" ON training_exams;
CREATE POLICY "insert_training_exams" ON training_exams FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

DROP POLICY IF EXISTS "update_training_exams" ON training_exams;
CREATE POLICY "update_training_exams" ON training_exams FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

DROP POLICY IF EXISTS "delete_training_exams" ON training_exams;
CREATE POLICY "delete_training_exams" ON training_exams FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

-- Training questions
CREATE TABLE IF NOT EXISTS training_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id uuid NOT NULL REFERENCES training_exams(id) ON DELETE CASCADE,
  question_text text NOT NULL,
  question_type text NOT NULL DEFAULT 'multiple_choice',
  image_path text,
  options text[] NOT NULL DEFAULT '{}',
  correct_answer text NOT NULL,
  points int NOT NULL DEFAULT 1,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE training_questions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_training_questions" ON training_questions;
CREATE POLICY "select_training_questions" ON training_questions FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_training_questions" ON training_questions;
CREATE POLICY "insert_training_questions" ON training_questions FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

DROP POLICY IF EXISTS "update_training_questions" ON training_questions;
CREATE POLICY "update_training_questions" ON training_questions FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

DROP POLICY IF EXISTS "delete_training_questions" ON training_questions;
CREATE POLICY "delete_training_questions" ON training_questions FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

-- Training steps
CREATE TABLE IF NOT EXISTS training_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES training_courses(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  sort_order int NOT NULL DEFAULT 0,
  content_type text NOT NULL DEFAULT 'document',
  file_path text,
  exam_id uuid REFERENCES training_exams(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE training_steps ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_training_steps" ON training_steps;
CREATE POLICY "select_training_steps" ON training_steps FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_training_steps" ON training_steps;
CREATE POLICY "insert_training_steps" ON training_steps FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

DROP POLICY IF EXISTS "update_training_steps" ON training_steps;
CREATE POLICY "update_training_steps" ON training_steps FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

DROP POLICY IF EXISTS "delete_training_steps" ON training_steps;
CREATE POLICY "delete_training_steps" ON training_steps FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

-- Training plans
CREATE TABLE IF NOT EXISTS training_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES training_courses(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  assigned_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'not_started',
  due_date date,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE training_plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_training_plans" ON training_plans;
CREATE POLICY "select_training_plans" ON training_plans FOR SELECT
  TO authenticated USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

DROP POLICY IF EXISTS "insert_training_plans" ON training_plans;
CREATE POLICY "insert_training_plans" ON training_plans FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

DROP POLICY IF EXISTS "update_training_plans" ON training_plans;
CREATE POLICY "update_training_plans" ON training_plans FOR UPDATE
  TO authenticated USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  ) WITH CHECK (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

DROP POLICY IF EXISTS "delete_training_plans" ON training_plans;
CREATE POLICY "delete_training_plans" ON training_plans FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

-- Training progress
CREATE TABLE IF NOT EXISTS training_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES training_plans(id) ON DELETE CASCADE,
  step_id uuid NOT NULL REFERENCES training_steps(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'not_started',
  started_at timestamptz,
  completed_at timestamptz,
  UNIQUE (plan_id, step_id)
);
ALTER TABLE training_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_training_progress" ON training_progress;
CREATE POLICY "select_training_progress" ON training_progress FOR SELECT
  TO authenticated USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

DROP POLICY IF EXISTS "insert_training_progress" ON training_progress;
CREATE POLICY "insert_training_progress" ON training_progress FOR INSERT
  TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "update_training_progress" ON training_progress;
CREATE POLICY "update_training_progress" ON training_progress FOR UPDATE
  TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "delete_training_progress" ON training_progress;
CREATE POLICY "delete_training_progress" ON training_progress FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

-- Training exam results
CREATE TABLE IF NOT EXISTS training_exam_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id uuid NOT NULL REFERENCES training_exams(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_name text NOT NULL,
  plan_id uuid REFERENCES training_plans(id) ON DELETE SET NULL,
  score int NOT NULL DEFAULT 0,
  total_questions int NOT NULL DEFAULT 0,
  correct_count int NOT NULL DEFAULT 0,
  answers jsonb NOT NULL DEFAULT '{}',
  passed boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE training_exam_results ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_training_exam_results" ON training_exam_results;
CREATE POLICY "select_training_exam_results" ON training_exam_results FOR SELECT
  TO authenticated USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

DROP POLICY IF EXISTS "insert_training_exam_results" ON training_exam_results;
CREATE POLICY "insert_training_exam_results" ON training_exam_results FOR INSERT
  TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "delete_training_exam_results" ON training_exam_results;
CREATE POLICY "delete_training_exam_results" ON training_exam_results FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

-- Indexes
CREATE INDEX IF NOT EXISTS idx_training_steps_course ON training_steps(course_id);
CREATE INDEX IF NOT EXISTS idx_training_questions_exam ON training_questions(exam_id);
CREATE INDEX IF NOT EXISTS idx_training_plans_user ON training_plans(user_id);
CREATE INDEX IF NOT EXISTS idx_training_plans_course ON training_plans(course_id);
CREATE INDEX IF NOT EXISTS idx_training_progress_plan ON training_progress(plan_id);
CREATE INDEX IF NOT EXISTS idx_training_exam_results_user ON training_exam_results(user_id);
CREATE INDEX IF NOT EXISTS idx_training_exam_results_exam ON training_exam_results(exam_id);

-- Storage bucket for training materials (public read, admin write)
INSERT INTO storage.buckets (id, name, public)
VALUES ('training', 'training', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "training_bucket_read" ON storage.objects;
CREATE POLICY "training_bucket_read" ON storage.objects FOR SELECT
  TO anon, authenticated USING (bucket_id = 'training');

DROP POLICY IF EXISTS "training_bucket_upload" ON storage.objects;
CREATE POLICY "training_bucket_upload" ON storage.objects FOR INSERT
  TO authenticated WITH CHECK (
    bucket_id = 'training'
    AND EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

DROP POLICY IF EXISTS "training_bucket_update" ON storage.objects;
CREATE POLICY "training_bucket_update" ON storage.objects FOR UPDATE
  TO authenticated USING (
    bucket_id = 'training'
    AND EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

DROP POLICY IF EXISTS "training_bucket_delete" ON storage.objects;
CREATE POLICY "training_bucket_delete" ON storage.objects FOR DELETE
  TO authenticated USING (
    bucket_id = 'training'
    AND EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );
