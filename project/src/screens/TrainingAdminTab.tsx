import { useState, useEffect, useCallback } from 'react';
import { supabase, type TrainingCourse, type TrainingStep, type TrainingExam, type TrainingQuestion, type TrainingPlan, type TrainingExamResult, type Profile } from '@/lib/supabase';
import { useToast } from '@/context/ToastContext';
import { formatDate, todayISO } from '@/lib/utils';
import {
  GraduationCap, Plus, X, Save, Trash2, Edit3, FileText, FileSpreadsheet,
  ClipboardList, Users, ChevronDown, ChevronRight, Award, BookOpen,
  CheckCircle2, Clock, AlertCircle, Map as MapIcon, FileDown,
  CalendarDays, ChevronLeft,
} from 'lucide-react';

export default function TrainingAdminTab() {
  const { notify } = useToast();
  const [courses, setCourses] = useState<TrainingCourse[]>([]);
  const [exams, setExams] = useState<TrainingExam[]>([]);
  const [plans, setPlans] = useState<(TrainingPlan & { course_title?: string; user_name?: string })[]>([]);
  const [results, setResults] = useState<TrainingExamResult[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'courses' | 'exams' | 'plans' | 'results'>('courses');

  const load = useCallback(async () => {
    const [c, e, p, r, u] = await Promise.all([
      supabase.from('training_courses').select('*').order('created_at', { ascending: false }),
      supabase.from('training_exams').select('*').order('created_at', { ascending: false }),
      supabase.from('training_plans').select('*, course:training_courses(title), profile:profiles(full_name)').order('created_at', { ascending: false }),
      supabase.from('training_exam_results').select('*').order('created_at', { ascending: false }),
      supabase.from('profiles').select('*').order('full_name'),
    ]);
    setCourses((c.data as TrainingCourse[]) ?? []);
    setExams((e.data as TrainingExam[]) ?? []);
    const planData = ((p.data ?? []) as any[]).map((row) => ({
      ...row,
      course_title: row.course?.title,
      user_name: row.profile?.full_name,
    })) as (TrainingPlan & { course_title?: string; user_name?: string })[];
    setPlans(planData);
    setResults((r.data as TrainingExamResult[]) ?? []);
    setProfiles((u.data as Profile[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <GraduationCap className="w-6 h-6 text-cyan-600" />
          ระบบฝึกอบรมออนไลน์ (Admin)
        </h2>
        <p className="text-slate-500 text-sm mt-1">จัดการหลักสูตร ข้อสอบ แผนฝึกอบรม และดูผลสอบ</p>
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-1 bg-slate-100 rounded-lg p-1 w-fit">
        {([
          { id: 'courses', label: 'หลักสูตร', icon: BookOpen },
          { id: 'exams', label: 'ข้อสอบ', icon: ClipboardList },
          { id: 'plans', label: 'แผนฝึกอบรม', icon: Users },
          { id: 'results', label: 'ผลสอบ', icon: Award },
        ] as const).map((t) => (
          <button
            key={t.id}
            onClick={() => setView(t.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              view === t.id ? 'bg-white text-cyan-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <t.icon className="w-4 h-4" />
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="p-8 text-center text-slate-400">กำลังโหลด...</div>
      ) : view === 'courses' ? (
        <CourseManager courses={courses} exams={exams} onChanged={load} notify={notify} />
      ) : view === 'exams' ? (
        <ExamManager exams={exams} onChanged={load} notify={notify} />
      ) : view === 'plans' ? (
        <PlanManager courses={courses} profiles={profiles} plans={plans} onChanged={load} notify={notify} />
      ) : (
        <ResultsViewer results={results} exams={exams} notify={notify} />
      )}
    </div>
  );
}

// =================== Course Manager ===================

function CourseManager({
  courses, exams, onChanged, notify,
}: {
  courses: TrainingCourse[];
  exams: TrainingExam[];
  onChanged: () => void;
  notify: (type: 'success' | 'error' | 'info', msg: string) => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<TrainingCourse | null>(null);
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [steps, setSteps] = useState<TrainingStep[]>([]);

  async function loadSteps(courseId: string) {
    const { data } = await supabase
      .from('training_steps')
      .select('*')
      .eq('course_id', courseId)
      .order('sort_order');
    setSteps((data as TrainingStep[]) ?? []);
  }

  async function saveCourse() {
    if (!title.trim()) { notify('error', 'กรุณากรอกชื่อหลักสูตร'); return; }
    if (editing) {
      const { error } = await supabase
        .from('training_courses')
        .update({ title: title.trim(), description: desc.trim() || null, updated_at: new Date().toISOString() })
        .eq('id', editing.id);
      if (error) { notify('error', 'แก้ไขไม่สำเร็จ: ' + error.message); return; }
      notify('success', 'แก้ไขหลักสูตรเรียบร้อย');
    } else {
      const { error } = await supabase
        .from('training_courses')
        .insert({ title: title.trim(), description: desc.trim() || null });
      if (error) { notify('error', 'สร้างไม่สำเร็จ: ' + error.message); return; }
      notify('success', 'สร้างหลักสูตรเรียบร้อย');
    }
    setShowForm(false);
    setEditing(null);
    setTitle('');
    setDesc('');
    onChanged();
  }

  async function deleteCourse(id: string) {
    if (!confirm('ยืนยันการลบหลักสูตรนี้? ข้อมูลทั้งหมดจะถูกลบ')) return;
    const { error } = await supabase.from('training_courses').delete().eq('id', id);
    if (error) { notify('error', 'ลบไม่สำเร็จ: ' + error.message); return; }
    notify('success', 'ลบหลักสูตรเรียบร้อย');
    onChanged();
  }

  async function saveStep(courseId: string, stepData: Partial<TrainingStep> & { title: string }) {
    const { error } = await supabase.from('training_steps').insert({
      course_id: courseId,
      title: stepData.title,
      description: stepData.description ?? null,
      sort_order: stepData.sort_order ?? steps.length,
      content_type: stepData.content_type ?? 'document',
      file_path: stepData.file_path ?? null,
      exam_id: stepData.exam_id ?? null,
    });
    if (error) { notify('error', 'เพิ่มขั้นตอนไม่สำเร็จ: ' + error.message); return; }
    notify('success', 'เพิ่มขั้นตอนเรียบร้อย');
    loadSteps(courseId);
  }

  async function deleteStep(stepId: string, courseId: string) {
    if (!confirm('ยืนยันการลบขั้นตอนนี้?')) return;
    const { error } = await supabase.from('training_steps').delete().eq('id', stepId);
    if (error) { notify('error', 'ลบไม่สำเร็จ: ' + error.message); return; }
    notify('success', 'ลบขั้นตอนเรียบร้อย');
    loadSteps(courseId);
  }

  async function uploadStepFile(file: File, stepId: string, courseId: string) {
    const ext = file.name.split('.').pop();
    const path = `step-${stepId}-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from('training').upload(path, file);
    if (upErr) { notify('error', 'อัปโหลดไม่สำเร็จ: ' + upErr.message); return; }
    const { error } = await supabase.from('training_steps').update({ file_path: path }).eq('id', stepId);
    if (error) { notify('error', 'บันทึกไฟล์ไม่สำเร็จ: ' + error.message); return; }
    notify('success', 'อัปโหลดไฟล์เรียบร้อย');
    loadSteps(courseId);
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => { setEditing(null); setTitle(''); setDesc(''); setShowForm(true); }} className="btn-primary">
          <Plus className="w-4 h-4" /> สร้างหลักสูตร
        </button>
      </div>

      {showForm && (
        <div className="card p-6">
          <h3 className="font-semibold text-slate-800 mb-4">{editing ? 'แก้ไขหลักสูตร' : 'สร้างหลักสูตรใหม่'}</h3>
          <div className="space-y-4">
            <div>
              <label className="form-label">ชื่อหลักสูตร</label>
              <input value={title} onChange={(e) => setTitle(e.target.value)} className="form-input" placeholder="เช่น การฝึกอบรมความปลอดภัย" />
            </div>
            <div>
              <label className="form-label">รายละเอียด</label>
              <textarea value={desc} onChange={(e) => setDesc(e.target.value)} className="form-input" rows={3} />
            </div>
            <div className="flex gap-2">
              <button onClick={saveCourse} className="btn-primary"><Save className="w-4 h-4" /> บันทึก</button>
              <button onClick={() => setShowForm(false)} className="btn-secondary">ยกเลิก</button>
            </div>
          </div>
        </div>
      )}

      {courses.length === 0 ? (
        <div className="card p-8 text-center text-slate-400">ยังไม่มีหลักสูตร</div>
      ) : (
        <div className="space-y-3">
          {courses.map((c) => (
            <div key={c.id} className="card overflow-hidden">
              <div className="flex items-center gap-3 px-6 py-4 hover:bg-slate-50">
                <button onClick={() => {
                  if (expandedId === c.id) { setExpandedId(null); }
                  else { setExpandedId(c.id); loadSteps(c.id); }
                }} className="text-slate-400 hover:text-cyan-600">
                  {expandedId === c.id ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </button>
                <div className="flex-1">
                  <div className="font-medium text-slate-800">{c.title}</div>
                  {c.description && <div className="text-sm text-slate-500 mt-0.5">{c.description}</div>}
                </div>
                <button
                  onClick={() => { setEditing(c); setTitle(c.title); setDesc(c.description ?? ''); setShowForm(true); }}
                  className="p-1.5 text-cyan-500 hover:bg-cyan-50 rounded-lg"
                ><Edit3 className="w-4 h-4" /></button>
                <button
                  onClick={() => deleteCourse(c.id)}
                  className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg"
                ><Trash2 className="w-4 h-4" /></button>
              </div>

              {expandedId === c.id && (
                <div className="border-t border-slate-100 px-6 py-4 bg-slate-50">
                  <h4 className="text-sm font-semibold text-slate-700 mb-3">ขั้นตอนการเรียน (Steps)</h4>
                  {steps.length === 0 ? (
                    <p className="text-sm text-slate-400 mb-3">ยังไม่มีขั้นตอน</p>
                  ) : (
                    <div className="space-y-2 mb-4">
                      {steps.map((s, i) => (
                        <div key={s.id} className="flex items-center gap-3 bg-white rounded-lg px-4 py-3 border border-slate-200">
                          <span className="w-6 h-6 rounded-full bg-cyan-100 text-cyan-600 flex items-center justify-center text-xs font-bold">{i + 1}</span>
                          <div className="flex-1">
                            <div className="text-sm font-medium text-slate-700">{s.title}</div>
                            <div className="text-xs text-slate-400">
                              {contentTypeLabel(s.content_type)}
                              {s.exam_id && ' · มีข้อสอบ'}
                            </div>
                          </div>
                          {s.file_path && (
                            <a
                              href={supabase.storage.from('training').getPublicUrl(s.file_path).data.publicUrl}
                              target="_blank" rel="noreferrer"
                              className="text-cyan-500 hover:text-cyan-700 text-xs"
                            >ดูไฟล์</a>
                          )}
                          <label className="cursor-pointer text-xs text-blue-500 hover:text-blue-700">
                            อัปโหลด
                            <input type="file" className="hidden" onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f) uploadStepFile(f, s.id, c.id);
                            }} />
                          </label>
                          <button onClick={() => deleteStep(s.id, c.id)} className="p-1 text-red-400 hover:bg-red-50 rounded">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <AddStepForm exams={exams} onSave={(data) => saveStep(c.id, data)} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AddStepForm({
  exams, onSave,
}: {
  exams: TrainingExam[];
  onSave: (data: Partial<TrainingStep> & { title: string }) => void;
}) {
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [contentType, setContentType] = useState<TrainingStep['content_type']>('document');
  const [examId, setExamId] = useState('');

  return (
    <div className="bg-white rounded-lg p-4 border border-slate-200 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <input value={title} onChange={(e) => setTitle(e.target.value)} className="form-input" placeholder="ชื่อขั้นตอน" />
        <select value={contentType} onChange={(e) => setContentType(e.target.value as TrainingStep['content_type'])} className="form-input">
          <option value="document">เอกสาร (Document)</option>
          <option value="pdf">PDF</option>
          <option value="powerpoint">PowerPoint</option>
          <option value="video">วีดีโอ (Video)</option>
        </select>
      </div>
      <input value={desc} onChange={(e) => setDesc(e.target.value)} className="form-input" placeholder="รายละเอียด (ไม่บังคับ)" />
      <div className="flex gap-3 items-end">
        <div className="flex-1">
          <label className="text-xs text-slate-500 block mb-1">เลือกข้อสอบ (ไม่บังคับ)</label>
          <select value={examId} onChange={(e) => setExamId(e.target.value)} className="form-input">
            <option value="">— ไม่มีข้อสอบ —</option>
            {exams.map((e) => (
              <option key={e.id} value={e.id}>{e.title}</option>
            ))}
          </select>
        </div>
        <button
          onClick={() => {
            if (!title.trim()) return;
            onSave({ title: title.trim(), description: desc.trim() || null, content_type: contentType, exam_id: examId || null });
            setTitle(''); setDesc(''); setExamId('');
          }}
          className="btn-primary"
        ><Plus className="w-4 h-4" /> เพิ่มขั้นตอน</button>
      </div>
    </div>
  );
}

function contentTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    document: 'เอกสาร',
    pdf: 'PDF',
    powerpoint: 'PowerPoint',
    video: 'วีดีโอ',
  };
  return labels[type] ?? type;
}

// =================== Exam Manager ===================

function ExamManager({
  exams, onChanged, notify,
}: {
  exams: TrainingExam[];
  onChanged: () => void;
  notify: (type: 'success' | 'error' | 'info', msg: string) => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<TrainingExam | null>(null);
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [passingScore, setPassingScore] = useState(60);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<TrainingQuestion[]>([]);

  async function loadQuestions(examId: string) {
    const { data } = await supabase
      .from('training_questions')
      .select('*')
      .eq('exam_id', examId)
      .order('sort_order');
    setQuestions((data as TrainingQuestion[]) ?? []);
  }

  async function saveExam() {
    if (!title.trim()) { notify('error', 'กรุณากรอกชื่อข้อสอบ'); return; }
    if (editing) {
      const { error } = await supabase
        .from('training_exams')
        .update({ title: title.trim(), description: desc.trim() || null, passing_score: passingScore })
        .eq('id', editing.id);
      if (error) { notify('error', 'แก้ไขไม่สำเร็จ: ' + error.message); return; }
      notify('success', 'แก้ไขข้อสอบเรียบร้อย');
    } else {
      const { error } = await supabase
        .from('training_exams')
        .insert({ title: title.trim(), description: desc.trim() || null, passing_score: passingScore });
      if (error) { notify('error', 'สร้างไม่สำเร็จ: ' + error.message); return; }
      notify('success', 'สร้างข้อสอบเรียบร้อย');
    }
    setShowForm(false); setEditing(null); setTitle(''); setDesc(''); setPassingScore(60);
    onChanged();
  }

  async function deleteExam(id: string) {
    if (!confirm('ยืนยันการลบข้อสอบนี้?')) return;
    const { error } = await supabase.from('training_exams').delete().eq('id', id);
    if (error) { notify('error', 'ลบไม่สำเร็จ: ' + error.message); return; }
    notify('success', 'ลบข้อสอบเรียบร้อย');
    onChanged();
  }

  async function addQuestion(examId: string, q: Partial<TrainingQuestion> & { question_text: string }) {
    const { error } = await supabase.from('training_questions').insert({
      exam_id: examId,
      question_text: q.question_text,
      question_type: q.question_type ?? 'multiple_choice',
      options: q.options ?? [],
      correct_answer: q.correct_answer ?? '',
      sort_order: q.sort_order ?? questions.length,
    });
    if (error) { notify('error', 'เพิ่มคำถามไม่สำเร็จ: ' + error.message); return; }
    notify('success', 'เพิ่มคำถามเรียบร้อย');
    loadQuestions(examId);
  }

  async function deleteQuestion(qId: string, examId: string) {
    const { error } = await supabase.from('training_questions').delete().eq('id', qId);
    if (error) { notify('error', 'ลบไม่สำเร็จ'); return; }
    loadQuestions(examId);
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => { setEditing(null); setTitle(''); setDesc(''); setPassingScore(60); setShowForm(true); }} className="btn-primary">
          <Plus className="w-4 h-4" /> สร้างข้อสอบ
        </button>
      </div>

      {showForm && (
        <div className="card p-6 space-y-4">
          <h3 className="font-semibold text-slate-800">{editing ? 'แก้ไขข้อสอบ' : 'สร้างข้อสอบใหม่'}</h3>
          <input value={title} onChange={(e) => setTitle(e.target.value)} className="form-input" placeholder="ชื่อข้อสอบ" />
          <textarea value={desc} onChange={(e) => setDesc(e.target.value)} className="form-input" rows={2} placeholder="รายละเอียด" />
          <div className="flex items-center gap-3">
            <label className="form-label !mb-0">คะแนนผ่าน (%)</label>
            <input type="number" value={passingScore} onChange={(e) => setPassingScore(Number(e.target.value))} className="form-input !w-24" min={0} max={100} />
          </div>
          <div className="flex gap-2">
            <button onClick={saveExam} className="btn-primary"><Save className="w-4 h-4" /> บันทึก</button>
            <button onClick={() => setShowForm(false)} className="btn-secondary">ยกเลิก</button>
          </div>
        </div>
      )}

      {exams.length === 0 ? (
        <div className="card p-8 text-center text-slate-400">ยังไม่มีข้อสอบ</div>
      ) : (
        <div className="space-y-3">
          {exams.map((e) => (
            <div key={e.id} className="card overflow-hidden">
              <div className="flex items-center gap-3 px-6 py-4 hover:bg-slate-50">
                <button onClick={() => {
                  if (expandedId === e.id) setExpandedId(null);
                  else { setExpandedId(e.id); loadQuestions(e.id); }
                }} className="text-slate-400 hover:text-cyan-600">
                  {expandedId === e.id ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </button>
                <div className="flex-1">
                  <div className="font-medium text-slate-800">{e.title}</div>
                  <div className="text-xs text-slate-400">คะแนนผ่าน {e.passing_score}%</div>
                </div>
                <button onClick={() => { setEditing(e); setTitle(e.title); setDesc(e.description ?? ''); setPassingScore(e.passing_score); setShowForm(true); }} className="p-1.5 text-cyan-500 hover:bg-cyan-50 rounded-lg">
                  <Edit3 className="w-4 h-4" />
                </button>
                <button onClick={() => deleteExam(e.id)} className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              {expandedId === e.id && (
                <div className="border-t border-slate-100 px-6 py-4 bg-slate-50">
                  <h4 className="text-sm font-semibold text-slate-700 mb-3">คำถาม ({questions.length})</h4>
                  {questions.length > 0 && (
                    <div className="space-y-2 mb-4">
                      {questions.map((q, i) => (
                        <div key={q.id} className="bg-white rounded-lg px-4 py-3 border border-slate-200">
                          <div className="flex items-start gap-2">
                            <span className="text-xs font-bold text-slate-400 mt-0.5">Q{i + 1}</span>
                            <div className="flex-1">
                              <div className="text-sm text-slate-700">{q.question_text}</div>
                              <div className="text-xs text-slate-400 mt-1">
                                {questionTypeLabel(q.question_type)} · คำตอบ: <span className="text-emerald-600 font-medium">{q.correct_answer}</span>
                              </div>
                              {q.options.length > 0 && (
                                <div className="text-xs text-slate-500 mt-1">ตัวเลือก: {q.options.join(', ')}</div>
                              )}
                            </div>
                            <button onClick={() => deleteQuestion(q.id, e.id)} className="p-1 text-red-400 hover:bg-red-50 rounded">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  <AddQuestionForm onAdd={(q) => addQuestion(e.id, q)} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AddQuestionForm({
  onAdd,
}: {
  onAdd: (q: Partial<TrainingQuestion> & { question_text: string }) => void;
}) {
  const [text, setText] = useState('');
  const [type, setType] = useState<TrainingQuestion['question_type']>('multiple_choice');
  const [options, setOptions] = useState('');
  const [answer, setAnswer] = useState('');

  return (
    <div className="bg-white rounded-lg p-4 border border-slate-200 space-y-3">
      <div className="flex gap-2">
        <select value={type} onChange={(e) => setType(e.target.value as TrainingQuestion['question_type'])} className="form-input !w-48">
          <option value="multiple_choice">ปรนัย (เลือกตอบ)</option>
          <option value="true_false">ถูก/ผิด</option>
          <option value="short_answer">เติมคำ</option>
        </select>
      </div>
      <textarea value={text} onChange={(e) => setText(e.target.value)} className="form-input" rows={2} placeholder="คำถาม" />
      {type === 'multiple_choice' && (
        <input value={options} onChange={(e) => setOptions(e.target.value)} className="form-input" placeholder="ตัวเลือก (คั่นด้วยจุลภาค: ก,ข,ค,ง)" />
      )}
      {type === 'true_false' ? (
        <select value={answer} onChange={(e) => setAnswer(e.target.value)} className="form-input">
          <option value="">เลือกคำตอบ</option>
          <option value="ถูก">ถูก</option>
          <option value="ผิด">ผิด</option>
        </select>
      ) : (
        <input value={answer} onChange={(e) => setAnswer(e.target.value)} className="form-input" placeholder="คำตอบที่ถูก" />
      )}
      <button
        onClick={() => {
          if (!text.trim() || !answer.trim()) return;
          onAdd({
            question_text: text.trim(),
            question_type: type,
            options: type === 'multiple_choice' ? options.split(',').map((o) => o.trim()).filter(Boolean) : [],
            correct_answer: answer.trim(),
          });
          setText(''); setOptions(''); setAnswer('');
        }}
        className="btn-primary"
      ><Plus className="w-4 h-4" /> เพิ่มคำถาม</button>
    </div>
  );
}

function questionTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    multiple_choice: 'ปรนัย',
    true_false: 'ถูก/ผิด',
    short_answer: 'เติมคำ',
  };
  return labels[type] ?? type;
}

// =================== Plan Manager ===================

// =================== Plan Calendar Overview ===================

function PlanCalendar({ plans, onPlanClick }: {
  plans: (TrainingPlan & { course_title?: string; user_name?: string })[];
  onPlanClick: (planId: string, courseId: string) => void;
}) {
  const [calMonth, setCalMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  const year = calMonth.getFullYear();
  const month = calMonth.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startWeekday = firstDay.getDay();
  const daysInMonth = lastDay.getDate();
  const monthNames = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
  const weekdayShort = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];

  const plansByDate: Record<string, typeof plans> = {};
  plans.forEach((p) => {
    const dateKey = p.due_date ?? p.created_at?.slice(0, 10);
    if (!dateKey) return;
    if (!plansByDate[dateKey]) plansByDate[dateKey] = [];
    plansByDate[dateKey].push(p);
  });

  const todayKey = todayISO();

  const cells: (number | null)[] = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div className="card p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
          <CalendarDays className="w-5 h-5 text-cyan-600" />
          ปฏิทินแผนฝึกอบรม
        </h3>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCalMonth(new Date(year, month - 1, 1))}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"
          >
            <ChevronLeft className="w-4 h-4 rotate-180" />
          </button>
          <span className="font-semibold text-slate-700 min-w-[140px] text-center">
            {monthNames[month]} {year + 543}
          </span>
          <button
            onClick={() => setCalMonth(new Date(year, month + 1, 1))}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 mb-1">
        {weekdayShort.map((w) => (
          <div key={w} className="text-center text-xs font-semibold text-slate-400 py-2">{w}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, i) => {
          if (day === null) return <div key={`e${i}`} className="min-h-[80px] rounded-lg bg-slate-50/50" />;
          const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const dayPlans = plansByDate[dateStr] ?? [];
          const isToday = dateStr === todayKey;
          return (
            <div
              key={day}
              className={`min-h-[80px] rounded-lg border p-1.5 ${
                isToday ? 'border-cyan-400 bg-cyan-50/30' : 'border-slate-100 bg-white'
              }`}
            >
              <div className={`text-xs font-medium mb-1 ${isToday ? 'text-cyan-600' : 'text-slate-400'}`}>{day}</div>
              <div className="space-y-1">
                {dayPlans.slice(0, 3).map((p) => (
                  <button
                    key={p.id}
                    onClick={() => onPlanClick(p.id, p.course_id)}
                    className={`block w-full text-left text-[10px] px-1.5 py-1 rounded truncate transition-colors ${
                      p.status === 'completed' ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' :
                      p.status === 'in_progress' ? 'bg-amber-100 text-amber-700 hover:bg-amber-200' :
                      'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                    title={`${p.course_title ?? ''} — ${p.user_name ?? ''}`}
                  >
                    {p.course_title ?? '—'}
                  </button>
                ))}
                {dayPlans.length > 3 && (
                  <div className="text-[10px] text-slate-400 px-1">+{dayPlans.length - 3} อื่นๆ</div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-4 mt-4 text-xs text-slate-500">
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-emerald-100" /> เสร็จสิ้น</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-amber-100" /> กำลังเรียน</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-slate-100" /> ยังไม่เริ่ม</span>
      </div>
    </div>
  );
}

// =================== Plan Manager ===================

function PlanManager({
  courses, profiles, plans, onChanged, notify,
}: {
  courses: TrainingCourse[];
  profiles: Profile[];
  plans: (TrainingPlan & { course_title?: string; user_name?: string })[];
  onChanged: () => void;
  notify: (type: 'success' | 'error' | 'info', msg: string) => void;
}) {
  const [courseId, setCourseId] = useState('');
  const [userId, setUserId] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [planView, setPlanView] = useState<'table' | 'calendar'>('table');
  const [roadmapPlanId, setRoadmapPlanId] = useState<string | null>(null);
  const [roadmapSteps, setRoadmapSteps] = useState<TrainingStep[]>([]);
  const [roadmapProgress, setRoadmapProgress] = useState<Record<string, string>>({});

  async function showRoadmap(planId: string, courseId: string) {
    const [stepRes, progRes] = await Promise.all([
      supabase.from('training_steps').select('*').eq('course_id', courseId).order('sort_order'),
      supabase.from('training_progress').select('*').eq('plan_id', planId),
    ]);
    setRoadmapSteps((stepRes.data as TrainingStep[]) ?? []);
    const progMap: Record<string, string> = {};
    ((progRes.data as any[]) ?? []).forEach((p) => { progMap[p.step_id] = p.status; });
    setRoadmapProgress(progMap);
    setRoadmapPlanId(planId);
  }

  async function assign() {
    if (!courseId || !userId) { notify('error', 'กรุณาเลือกหลักสูตรและพนักงาน'); return; }
    const { error } = await supabase.from('training_plans').insert({
      course_id: courseId,
      user_id: userId,
      due_date: dueDate || null,
    });
    if (error) { notify('error', 'มอบหมายไม่สำเร็จ: ' + error.message); return; }
    notify('success', 'มอบหมายแผนฝึกอบรมเรียบร้อย');
    setCourseId(''); setUserId(''); setDueDate('');
    onChanged();
  }

  async function removePlan(id: string) {
    if (!confirm('ยืนยันการลบแผนฝึกอบรมนี้?')) return;
    const { error } = await supabase.from('training_plans').delete().eq('id', id);
    if (error) { notify('error', 'ลบไม่สำเร็จ'); return; }
    notify('success', 'ลบแผนฝึกอบรมเรียบร้อย');
    onChanged();
  }

  return (
    <div className="space-y-4">
      <div className="card p-6 space-y-4">
        <h3 className="font-semibold text-slate-800">มอบหมายแผนฝึกอบรม</h3>
        <div className="grid md:grid-cols-3 gap-3">
          <div>
            <label className="form-label">หลักสูตร</label>
            <select value={courseId} onChange={(e) => setCourseId(e.target.value)} className="form-input">
              <option value="">— เลือกหลักสูตร —</option>
              {courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label">พนักงาน</label>
            <select value={userId} onChange={(e) => setUserId(e.target.value)} className="form-input">
              <option value="">— เลือกพนักงาน —</option>
              {profiles.map((p) => <option key={p.id} value={p.id}>{p.full_name} ({p.employee_id})</option>)}
            </select>
          </div>
          <div>
            <label className="form-label">กำหนดส่ง (ไม่บังคับ)</label>
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="form-input" />
          </div>
        </div>
        <button onClick={assign} className="btn-primary"><Plus className="w-4 h-4" /> มอบหมาย</button>
      </div>

      {/* View toggle */}
      <div className="flex gap-1 bg-slate-100 rounded-lg p-1 w-fit">
        <button
          onClick={() => setPlanView('table')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
            planView === 'table' ? 'bg-white text-cyan-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <Users className="w-4 h-4" /> ตาราง
        </button>
        <button
          onClick={() => setPlanView('calendar')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
            planView === 'calendar' ? 'bg-white text-cyan-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <CalendarDays className="w-4 h-4" /> ปฏิทิน
        </button>
      </div>

      {/* Roadmap modal */}
      {roadmapPlanId && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 sticky top-0 bg-white z-10">
              <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
                <MapIcon className="w-5 h-5 text-cyan-600" />
                Training Roadmap
              </h3>
              <button onClick={() => setRoadmapPlanId(null)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6">
              {roadmapSteps.length === 0 ? (
                <p className="text-center text-slate-400 py-8">หลักสูตรนี้ยังไม่มีขั้นตอน</p>
              ) : (
                <div className="space-y-0">
                  {roadmapSteps.map((s, i) => {
                    const status = roadmapProgress[s.id] ?? 'not_started';
                    return (
                      <div key={s.id} className="flex items-start gap-4">
                        {/* Vertical line + circle */}
                        <div className="flex flex-col items-center">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
                            status === 'completed' ? 'bg-emerald-100 text-emerald-600' :
                            status === 'in_progress' ? 'bg-amber-100 text-amber-600' :
                            'bg-slate-100 text-slate-400'
                          }`}>
                            {status === 'completed' ? <CheckCircle2 className="w-5 h-5" /> : i + 1}
                          </div>
                          {i < roadmapSteps.length - 1 && (
                            <div className={`w-0.5 h-12 ${roadmapProgress[s.id] === 'completed' ? 'bg-emerald-300' : 'bg-slate-200'}`} />
                          )}
                        </div>
                        {/* Content */}
                        <div className="flex-1 pb-4">
                          <div className="font-medium text-slate-800">{s.title}</div>
                          {s.description && <div className="text-sm text-slate-500 mt-0.5">{s.description}</div>}
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs text-slate-400">{contentTypeLabel(s.content_type)}</span>
                            {s.exam_id && <span className="text-xs text-cyan-500">· มีข้อสอบ</span>}
                            <span className={`text-xs px-2 py-0.5 rounded-full ${
                              status === 'completed' ? 'bg-emerald-100 text-emerald-600' :
                              status === 'in_progress' ? 'bg-amber-100 text-amber-600' :
                              'bg-slate-100 text-slate-500'
                            }`}>
                              {status === 'completed' ? 'เสร็จสิ้น' : status === 'in_progress' ? 'กำลังเรียน' : 'ยังไม่เริ่ม'}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {planView === 'calendar' ? (
        <PlanCalendar plans={plans} onPlanClick={showRoadmap} />
      ) : plans.length === 0 ? (
        <div className="card p-8 text-center text-slate-400">ยังไม่มีแผนฝึกอบรม</div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600 text-xs uppercase tracking-wider">
              <tr>
                <th className="text-left px-4 py-3 font-semibold">หลักสูตร</th>
                <th className="text-left px-4 py-3 font-semibold">พนักงาน</th>
                <th className="text-left px-4 py-3 font-semibold">สถานะ</th>
                <th className="text-left px-4 py-3 font-semibold">กำหนดส่ง</th>
                <th className="text-left px-4 py-3 font-semibold">Roadmap</th>
                <th className="text-left px-4 py-3 font-semibold">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {plans.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-800">{p.course_title ?? '-'}</td>
                  <td className="px-4 py-3 text-slate-600">{p.user_name ?? '-'}</td>
                  <td className="px-4 py-3">
                    {p.status === 'completed' ? (
                      <span className="badge bg-emerald-100 text-emerald-700"><CheckCircle2 className="w-3 h-3" /> เสร็จสิ้น</span>
                    ) : p.status === 'in_progress' ? (
                      <span className="badge bg-amber-100 text-amber-700"><Clock className="w-3 h-3" /> กำลังเรียน</span>
                    ) : (
                      <span className="badge bg-slate-100 text-slate-600">ยังไม่เริ่ม</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-500">{p.due_date ? formatDate(p.due_date) : '-'}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => showRoadmap(p.id, p.course_id)}
                      className="p-1.5 text-cyan-500 hover:bg-cyan-50 rounded-lg"
                      title="ดู Roadmap"
                    >
                      <MapIcon className="w-4 h-4" />
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => removePlan(p.id)} className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// =================== Results Viewer ===================

function ResultsViewer({
  results, exams, notify,
}: {
  results: TrainingExamResult[];
  exams: TrainingExam[];
  notify: (type: 'success' | 'error' | 'info', msg: string) => void;
}) {
  function exportCSV() {
    const headers = ['พนักงาน', 'ข้อสอบ', 'คะแนน (%)', 'ถูก/รวม', 'ผล', 'วันที่สอบ'];
    const rows = results.map((r) => {
      const exam = exams.find((e) => e.id === r.exam_id);
      return [
        r.user_name,
        exam?.title ?? '-',
        String(r.score),
        `${r.correct_count}/${r.total_questions}`,
        r.passed ? 'ผ่าน' : 'ไม่ผ่าน',
        formatDate(r.created_at),
      ];
    });
    const csv = [headers, ...rows]
      .map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `exam-results-${todayISO()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    notify('success', 'ดาวน์โหลดผลสอบเรียบร้อย');
  }

  function exportResume() {
    const byUser: Record<string, TrainingExamResult[]> = {};
    results.forEach((r) => {
      byUser[r.user_name] = byUser[r.user_name] ?? [];
      byUser[r.user_name].push(r);
    });

    const passed = results.filter((r) => r.passed).length;
    const failed = results.filter((r) => !r.passed).length;

    const userSections = Object.entries(byUser).map(([name, userResults]) => {
      const userPassed = userResults.filter((r) => r.passed).length;
      const avgScore = Math.round(userResults.reduce((sum, r) => sum + r.score, 0) / userResults.length);
      const examRows = userResults.map((r, i) => {
        const exam = exams.find((e) => e.id === r.exam_id);
        const answerDetail = r.answers && Object.keys(r.answers).length > 0
          ? `<details class="mt-2"><summary class="cursor-pointer text-xs text-slate-400">ดูคำตอบ</summary><div class="mt-1 space-y-0.5">${Object.entries(r.answers).map(([qId, ans], j) => `<div class="text-xs text-slate-500">ข้อ ${j + 1}: ${ans}</div>`).join('')}</div></details>`
          : '';
        return `
          <tr>
            <td class="px-3 py-2 text-center text-slate-400">${i + 1}</td>
            <td class="px-3 py-2 font-medium text-slate-700">${exam?.title ?? '-'}</td>
            <td class="px-3 py-2 text-center font-bold ${r.passed ? 'text-emerald-600' : 'text-red-500'}">${r.score}%</td>
            <td class="px-3 py-2 text-center text-slate-600">${r.correct_count}/${r.total_questions}</td>
            <td class="px-3 py-2 text-center">${r.passed ? '<span class="text-emerald-600 font-medium">ผ่าน</span>' : '<span class="text-red-500 font-medium">ไม่ผ่าน</span>'}</td>
            <td class="px-3 py-2 text-center text-slate-500 text-sm">${formatDate(r.created_at)}</td>
          </tr>${answerDetail}`;
      }).join('');

      return `
        <div class="mb-6 break-inside-avoid">
          <div class="flex items-center justify-between mb-3 pb-2 border-b border-slate-200">
            <h3 class="text-lg font-bold text-slate-800">${name}</h3>
            <div class="flex gap-3 text-sm">
              <span class="text-slate-500">สอบ ${userResults.length} ครั้ง</span>
              <span class="text-emerald-600 font-medium">ผ่าน ${userPassed}</span>
              <span class="text-slate-500">คะแนนเฉลี่ย ${avgScore}%</span>
            </div>
          </div>
          <table class="w-full text-sm border-collapse">
            <thead>
              <tr class="bg-slate-50 text-xs text-slate-500 uppercase">
                <th class="px-3 py-2 text-left">#</th>
                <th class="px-3 py-2 text-left">ข้อสอบ</th>
                <th class="px-3 py-2 text-center">คะแนน</th>
                <th class="px-3 py-2 text-center">ถูก/รวม</th>
                <th class="px-3 py-2 text-center">ผล</th>
                <th class="px-3 py-2 text-center">วันที่</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">${examRows}</tbody>
          </table>
        </div>`;
    }).join('');

    const html = `<!DOCTYPE html>
<html lang="th">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>สรุปผลการสอบ - Resume</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Sarabun', 'Segoe UI', sans-serif; color: #334155; padding: 40px; max-width: 900px; margin: 0 auto; }
  .header { text-align: center; margin-bottom: 32px; padding-bottom: 20px; border-bottom: 3px solid #0891b2; }
  .header h1 { font-size: 28px; color: #0f172a; margin-bottom: 4px; }
  .header .subtitle { color: #64748b; font-size: 14px; }
  .summary { display: flex; gap: 16px; margin-bottom: 32px; }
  .summary-card { flex: 1; background: #f8fafc; border-radius: 12px; padding: 16px; text-align: center; }
  .summary-card .num { font-size: 32px; font-weight: 700; }
  .summary-card .label { font-size: 12px; color: #64748b; margin-top: 4px; }
  table { border-collapse: collapse; width: 100%; }
  th, td { text-align: left; }
  @media print { body { padding: 20px; } .summary { flex-wrap: wrap; } }
</style>
</head>
<body>
  <div class="header">
    <h1>สรุปผลการสอบ (Resume)</h1>
    <div class="subtitle">พิมพ์เมื่อ ${formatDate(new Date().toISOString())}</div>
  </div>
  <div class="summary">
    <div class="summary-card"><div class="num text-slate-700">${results.length}</div><div class="label">การสอบทั้งหมด</div></div>
    <div class="summary-card"><div class="num text-emerald-600">${passed}</div><div class="label">ผ่าน</div></div>
    <div class="summary-card"><div class="num text-red-500">${failed}</div><div class="label">ไม่ผ่าน</div></div>
    <div class="summary-card"><div class="num text-cyan-600">${Object.keys(byUser).length}</div><div class="label">พนักงาน</div></div>
  </div>
  ${userSections}
</body>
</html>`;

    const blob = new Blob([html], { type: 'text/html;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `exam-resume-${todayISO()}.html`;
    link.click();
    URL.revokeObjectURL(url);
    notify('success', 'ดาวน์โหลด Resume เรียบร้อย');
  }

  if (results.length === 0) {
    return <div className="card p-8 text-center text-slate-400">ยังไม่มีผลสอบ</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end gap-2">
        <button onClick={exportCSV} className="btn-secondary">
          <FileSpreadsheet className="w-4 h-4" /> ดาวน์โหลด Excel
        </button>
        <button onClick={exportResume} className="btn-secondary">
          <FileDown className="w-4 h-4" /> ดาวน์โหลด Resume
        </button>
      </div>
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600 text-xs uppercase tracking-wider">
            <tr>
              <th className="text-left px-4 py-3 font-semibold">พนักงาน</th>
              <th className="text-left px-4 py-3 font-semibold">ข้อสอบ</th>
              <th className="text-left px-4 py-3 font-semibold">คะแนน</th>
              <th className="text-left px-4 py-3 font-semibold">ผล</th>
              <th className="text-left px-4 py-3 font-semibold">วันที่</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {results.map((r) => {
              const exam = exams.find((e) => e.id === r.exam_id);
              return (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-800">{r.user_name}</td>
                  <td className="px-4 py-3 text-slate-600">{exam?.title ?? '-'}</td>
                  <td className="px-4 py-3">
                    <span className={`font-bold ${r.passed ? 'text-emerald-600' : 'text-red-500'}`}>
                      {r.score}% ({r.correct_count}/{r.total_questions})
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {r.passed ? (
                      <span className="badge bg-emerald-100 text-emerald-700"><CheckCircle2 className="w-3 h-3" /> ผ่าน</span>
                    ) : (
                      <span className="badge bg-red-100 text-red-700"><AlertCircle className="w-3 h-3" /> ไม่ผ่าน</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-500">{formatDate(r.created_at)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
