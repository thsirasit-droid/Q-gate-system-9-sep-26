/*
# QC System - Full Schema

1. Overview
This migration creates the complete database for a QC (Quality Control) system with:
- User profiles (admin / user roles) linked to Supabase Auth
- Part master with standard reference images
- Inspection items (admin-configurable per part) and daily inspection records + per-item results
- Online judgment system (problem reports + LINE-like reply thread + admin decision OK/NG/Rework)
- Problem history records with file attachments
- Storage bucket for standard images and problem attachments

2. New Tables
- `profiles`: extends auth.users with employee_id, full_name, role ('admin'|'user')
- `parts`: part master (part_no, part_name, standard_image_path)
- `inspection_items`: configurable inspection topics per part (admin-managed), with input_type
- `inspection_records`: a daily inspection sheet header (date, part, inspector, approved_by)
- `inspection_results`: per-item result rows belonging to an inspection record
- `judgments`: online judgment reports (problem area, reporter, detail, images, decision)
- `judgment_messages`: LINE-like reply thread on a judgment (chat messages)
- `problem_history`: historical problem records with attachments

3. Security
- RLS enabled on every table.
- profiles: each user reads/updates own profile; admins read all.
- parts, inspection_items: readable by all authenticated; write by admin only (via role check).
- inspection_records/results: users create/read own; admins read all and update approval.
- judgments: all authenticated can read; any authenticated can create; admin updates decision.
- judgment_messages: all authenticated read; creator inserts; admin can insert.
- problem_history: all authenticated read; creator inserts; admin updates.
- Storage: public read bucket 'standards' for standard images; private bucket 'attachments' for problem files with auth-scoped paths.

4. Notes
- Role is stored in profiles.role and mirrored into raw_app_meta_data via trigger so auth.jwt() carries role.
- Admin checks use a SECURITY DEFINER function is_admin() to avoid policy recursion.
*/

-- =========================================================
-- PROFILES
-- =========================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  employee_id text UNIQUE NOT NULL,
  full_name text NOT NULL,
  role text NOT NULL DEFAULT 'user' CHECK (role IN ('admin','user')),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- helper: is current user an admin?
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

DROP POLICY IF EXISTS "profiles_select_own_or_admin" ON public.profiles;
CREATE POLICY "profiles_select_own_or_admin" ON public.profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "profiles_insert_self" ON public.profiles;
CREATE POLICY "profiles_insert_self" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());

-- trigger: on new auth user, create profile placeholder (role defaults to 'user')
-- We do NOT auto-create profiles; the app creates them on signup with employee_id.
-- But we mirror role into raw_app_meta_data whenever profiles.role changes.
CREATE OR REPLACE FUNCTION public.mirror_role_to_metadata()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE auth.users
  SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('role', NEW.role)
  WHERE id = NEW.id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_role_mirror ON public.profiles;
CREATE TRIGGER profiles_role_mirror
AFTER INSERT OR UPDATE OF role ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.mirror_role_to_metadata();

-- =========================================================
-- PARTS (master + standard image)
-- =========================================================
CREATE TABLE IF NOT EXISTS public.parts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  part_no text NOT NULL,
  part_name text NOT NULL,
  standard_image_path text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (part_no)
);

ALTER TABLE public.parts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "parts_select_all" ON public.parts;
CREATE POLICY "parts_select_all" ON public.parts
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "parts_admin_write" ON public.parts;
CREATE POLICY "parts_admin_write" ON public.parts
  FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- =========================================================
-- INSPECTION ITEMS (admin configurable per part)
-- =========================================================
CREATE TABLE IF NOT EXISTS public.inspection_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  part_id uuid REFERENCES public.parts(id) ON DELETE CASCADE,
  label text NOT NULL,
  input_type text NOT NULL DEFAULT 'text' CHECK (input_type IN ('text','number','pass_fail','ok_ng','option')),
  options text[] DEFAULT '{}',
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.inspection_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "inspection_items_select_all" ON public.inspection_items;
CREATE POLICY "inspection_items_select_all" ON public.inspection_items
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "inspection_items_admin_write" ON public.inspection_items;
CREATE POLICY "inspection_items_admin_write" ON public.inspection_items
  FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- =========================================================
-- INSPECTION RECORDS (daily sheet header)
-- =========================================================
CREATE TABLE IF NOT EXISTS public.inspection_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  record_date date NOT NULL,
  part_id uuid REFERENCES public.parts(id) ON DELETE CASCADE,
  part_no text NOT NULL,
  part_name text NOT NULL,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  user_name text NOT NULL,
  approved boolean NOT NULL DEFAULT false,
  approved_by uuid REFERENCES auth.users(id),
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.inspection_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "inspection_records_select" ON public.inspection_records;
CREATE POLICY "inspection_records_select" ON public.inspection_records
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "inspection_records_insert_own" ON public.inspection_records;
CREATE POLICY "inspection_records_insert_own" ON public.inspection_records
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "inspection_records_update_admin" ON public.inspection_records;
CREATE POLICY "inspection_records_update_admin" ON public.inspection_records
  FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "inspection_records_delete_own_or_admin" ON public.inspection_records;
CREATE POLICY "inspection_records_delete_own_or_admin" ON public.inspection_records
  FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());

-- =========================================================
-- INSPECTION RESULTS (per item)
-- =========================================================
CREATE TABLE IF NOT EXISTS public.inspection_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  record_id uuid NOT NULL REFERENCES public.inspection_records(id) ON DELETE CASCADE,
  item_id uuid REFERENCES public.inspection_items(id) ON DELETE SET NULL,
  item_label text NOT NULL,
  value text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.inspection_results ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "inspection_results_select" ON public.inspection_results;
CREATE POLICY "inspection_results_select" ON public.inspection_results
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.inspection_records r
           WHERE r.id = record_id AND (r.user_id = auth.uid() OR public.is_admin()))
  );

DROP POLICY IF EXISTS "inspection_results_insert" ON public.inspection_results;
CREATE POLICY "inspection_results_insert" ON public.inspection_results
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.inspection_records r
           WHERE r.id = record_id AND (r.user_id = auth.uid() OR public.is_admin()))
  );

DROP POLICY IF EXISTS "inspection_results_delete" ON public.inspection_results;
CREATE POLICY "inspection_results_delete" ON public.inspection_results
  FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.inspection_records r
           WHERE r.id = record_id AND (r.user_id = auth.uid() OR public.is_admin()))
  );

-- =========================================================
-- JUDGMENTS (online judgment system)
-- =========================================================
CREATE TABLE IF NOT EXISTS public.judgments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  record_date date NOT NULL,
  part_no text NOT NULL,
  part_name text NOT NULL,
  area text NOT NULL,
  reporter text NOT NULL,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  detail text NOT NULL,
  image_paths text[] DEFAULT '{}',
  decision text CHECK (decision IN ('OK','NG','Rework') OR decision IS NULL),
  decision_note text,
  decided_by uuid REFERENCES auth.users(id),
  decided_at timestamptz,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','decided')),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.judgments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "judgments_select_all" ON public.judgments;
CREATE POLICY "judgments_select_all" ON public.judgments
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "judgments_insert_own" ON public.judgments;
CREATE POLICY "judgments_insert_own" ON public.judgments
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "judgments_update_admin" ON public.judgments;
CREATE POLICY "judgments_update_admin" ON public.judgments
  FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "judgments_delete_own_or_admin" ON public.judgments;
CREATE POLICY "judgments_delete_own_or_admin" ON public.judgments
  FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());

-- =========================================================
-- JUDGMENT MESSAGES (LINE-like thread)
-- =========================================================
CREATE TABLE IF NOT EXISTS public.judgment_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  judgment_id uuid NOT NULL REFERENCES public.judgments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  sender_name text NOT NULL,
  is_admin boolean NOT NULL DEFAULT false,
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.judgment_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "judgment_messages_select_all" ON public.judgment_messages;
CREATE POLICY "judgment_messages_select_all" ON public.judgment_messages
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "judgment_messages_insert_own" ON public.judgment_messages;
CREATE POLICY "judgment_messages_insert_own" ON public.judgment_messages
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "judgment_messages_delete_own_or_admin" ON public.judgment_messages;
CREATE POLICY "judgment_messages_delete_own_or_admin" ON public.judgment_messages
  FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());

-- =========================================================
-- PROBLEM HISTORY
-- =========================================================
CREATE TABLE IF NOT EXISTS public.problem_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  record_date date NOT NULL,
  part_name text NOT NULL,
  part_no text NOT NULL,
  customer text NOT NULL,
  problem text NOT NULL,
  problem_detail text,
  correction text,
  file_paths text[] DEFAULT '{}',
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  user_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.problem_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "problem_history_select_all" ON public.problem_history;
CREATE POLICY "problem_history_select_all" ON public.problem_history
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "problem_history_insert_own" ON public.problem_history;
CREATE POLICY "problem_history_insert_own" ON public.problem_history
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "problem_history_update_own_or_admin" ON public.problem_history;
CREATE POLICY "problem_history_update_own_or_admin" ON public.problem_history
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.is_admin())
  WITH CHECK (user_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "problem_history_delete_own_or_admin" ON public.problem_history;
CREATE POLICY "problem_history_delete_own_or_admin" ON public.problem_history
  FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());

-- =========================================================
-- STORAGE BUCKETS
-- =========================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('standards', 'standards', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('attachments', 'attachments', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: standards (public read, admin write)
DROP POLICY IF EXISTS "standards_public_read" ON storage.objects;
CREATE POLICY "standards_public_read" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'standards');

DROP POLICY IF EXISTS "standards_admin_write" ON storage.objects;
CREATE POLICY "standards_admin_write" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'standards' AND public.is_admin());

DROP POLICY IF EXISTS "standards_admin_update" ON storage.objects;
CREATE POLICY "standards_admin_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'standards' AND public.is_admin())
  WITH CHECK (bucket_id = 'standards' AND public.is_admin());

DROP POLICY IF EXISTS "standards_admin_delete" ON storage.objects;
CREATE POLICY "standards_admin_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'standards' AND public.is_admin());

-- Storage policies: attachments (auth user reads own, authenticated uploads to own folder)
DROP POLICY IF EXISTS "attachments_select_own" ON storage.objects;
CREATE POLICY "attachments_select_own" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'attachments' AND (auth.uid())::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "attachments_insert_own" ON storage.objects;
CREATE POLICY "attachments_insert_own" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'attachments' AND (auth.uid())::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "attachments_admin_all" ON storage.objects;
CREATE POLICY "attachments_admin_all" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'attachments' AND public.is_admin())
  WITH CHECK (bucket_id = 'attachments' AND public.is_admin());

-- =========================================================
-- INDEXES
-- =========================================================
CREATE INDEX IF NOT EXISTS idx_inspection_records_date ON public.inspection_records (record_date);
CREATE INDEX IF NOT EXISTS idx_inspection_records_part ON public.inspection_records (part_id);
CREATE INDEX IF NOT EXISTS idx_inspection_results_record ON public.inspection_results (record_id);
CREATE INDEX IF NOT EXISTS idx_judgments_date ON public.judgments (record_date);
CREATE INDEX IF NOT EXISTS idx_judgment_messages_judgment ON public.judgment_messages (judgment_id, created_at);
CREATE INDEX IF NOT EXISTS idx_problem_history_date ON public.problem_history (record_date);
CREATE INDEX IF NOT EXISTS idx_inspection_items_part ON public.inspection_items (part_id, sort_order);
