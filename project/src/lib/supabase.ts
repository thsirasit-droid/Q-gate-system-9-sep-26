import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});

export type Profile = {
  id: string;
  employee_id: string;
  full_name: string;
  role: 'admin' | 'user';
  created_at: string;
};

export type Part = {
  id: string;
  part_no: string;
  part_name: string;
  standard_image_path: string | null;
  created_at: string;
};

export type InspectionItem = {
  id: string;
  part_id: string | null;
  label: string;
  input_type: 'text' | 'number' | 'pass_fail' | 'ok_ng' | 'option';
  options: string[];
  sort_order: number;
  created_at: string;
};

export type InspectionRecord = {
  id: string;
  record_date: string;
  part_id: string | null;
  part_no: string;
  part_name: string;
  user_id: string;
  user_name: string;
  approved: boolean;
  approved_by: string | null;
  approved_at: string | null;
  result_summary: 'OK' | 'NG' | null;
  created_at: string;
};

export type InspectionResult = {
  id: string;
  record_id: string;
  item_id: string | null;
  item_label: string;
  value: string;
  created_at: string;
};

export type Judgment = {
  id: string;
  record_date: string;
  part_no: string;
  part_name: string;
  area: string;
  reporter: string;
  user_id: string;
  detail: string;
  image_paths: string[];
  decision: 'OK' | 'NG' | 'Rework' | null;
  decision_note: string | null;
  decided_by: string | null;
  decided_at: string | null;
  status: 'pending' | 'decided';
  created_at: string;
};

export type JudgmentMessage = {
  id: string;
  judgment_id: string;
  user_id: string;
  sender_name: string;
  is_admin: boolean;
  message: string;
  created_at: string;
};

export type ProblemHistory = {
  id: string;
  record_date: string;
  part_name: string;
  part_no: string;
  customer: string;
  problem: string;
  problem_detail: string | null;
  correction: string | null;
  file_paths: string[];
  user_id: string;
  user_name: string;
  status: 'draft' | 'published';
  created_at: string;
};

export type TrainingCourse = {
  id: string;
  title: string;
  description: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type TrainingExam = {
  id: string;
  title: string;
  description: string | null;
  passing_score: number;
  created_by: string | null;
  created_at: string;
};

export type TrainingQuestion = {
  id: string;
  exam_id: string;
  question_text: string;
  question_type: 'multiple_choice' | 'true_false' | 'short_answer';
  image_path: string | null;
  options: string[];
  correct_answer: string;
  points: number;
  sort_order: number;
  created_at: string;
};

export type TrainingStep = {
  id: string;
  course_id: string;
  title: string;
  description: string | null;
  sort_order: number;
  content_type: 'document' | 'pdf' | 'powerpoint' | 'video';
  file_path: string | null;
  exam_id: string | null;
  created_at: string;
};

export type TrainingPlan = {
  id: string;
  course_id: string;
  user_id: string;
  assigned_by: string | null;
  status: 'not_started' | 'in_progress' | 'completed';
  due_date: string | null;
  created_at: string;
};

export type TrainingProgress = {
  id: string;
  plan_id: string;
  step_id: string;
  user_id: string;
  status: 'not_started' | 'in_progress' | 'completed';
  started_at: string | null;
  completed_at: string | null;
};

export type TrainingExamResult = {
  id: string;
  exam_id: string;
  user_id: string;
  user_name: string;
  plan_id: string | null;
  score: number;
  total_questions: number;
  correct_count: number;
  answers: Record<string, string>;
  passed: boolean;
  created_at: string;
};
