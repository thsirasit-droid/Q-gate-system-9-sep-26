/*
# Add result_summary to inspection_records and draft status to problem_history

1. Changes to existing tables
- `inspection_records`: add `result_summary` text column (values 'OK' or 'NG' or null)
  - Allows users and admins to set an overall OK/NG summary on each inspection record.
- `problem_history`: add `status` text column (default 'published', values 'draft' or 'published')
  - Allows users to save a problem record as draft and come back to edit it later.

2. Security changes (RLS)
- `inspection_records`: add update policy allowing users to update their own records
  (in addition to the existing admin-only update policy), so users can set result_summary.
- `problem_history`: update policy already allows owner and admin updates, no change needed.
- `inspection_records`: delete policy already allows owner or admin, no change needed.

3. Important notes
- All new columns are nullable / have defaults so existing rows are unaffected.
- The result_summary CHECK constraint ensures only 'OK' or 'NG' values.
- The status CHECK constraint ensures only 'draft' or 'published' values.
*/

-- Add result_summary column to inspection_records
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'inspection_records' AND column_name = 'result_summary'
  ) THEN
    ALTER TABLE public.inspection_records ADD COLUMN result_summary text CHECK (result_summary IN ('OK', 'NG') OR result_summary IS NULL);
  END IF;
END $$;

-- Add status column to problem_history
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'problem_history' AND column_name = 'status'
  ) THEN
    ALTER TABLE public.problem_history ADD COLUMN status text NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'published'));
  END IF;
END $$;

-- Add update policy for inspection_records: users can update their own records
DROP POLICY IF EXISTS "inspection_records_update_own" ON public.inspection_records;
CREATE POLICY "inspection_records_update_own" ON public.inspection_records
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Add index for problem_history status filtering
CREATE INDEX IF NOT EXISTS idx_problem_history_status ON public.problem_history (status);
