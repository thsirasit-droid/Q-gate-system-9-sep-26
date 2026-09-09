import { useState, useEffect, useCallback } from 'react';
import { supabase, type TrainingPlan, type TrainingStep, type TrainingExam, type TrainingQuestion, type TrainingExamResult } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { formatDate } from '@/lib/utils';
import {
  GraduationCap, BookOpen, CheckCircle2, Clock, Play, Award,
  FileText, ClipboardList, ArrowLeft, ArrowRight,
  AlertCircle, Map as MapIcon, X, CalendarDays, ChevronLeft,
} from 'lucide-react';

export default function TrainingUserTab() {
  const { profile } = useAuth();
  const { notify } = useToast();
  const [plans, setPlans] = useState<(TrainingPlan & { course_title?: string; course_desc?: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [activePlan, setActivePlan] = useState<string | null>(null);
  const [userView, setUserView] = useState<'cards' | 'calendar'>('cards');
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

  const load = useCallback(async () => {
    if (!profile) return;
    const { data } = await supabase
      .from('training_plans')
      .select('*, course:training_courses(title, description)')
      .eq('user_id', profile.id)
      .order('created_at', { ascending: false });
    const planData = ((data ?? []) as any[]).map((row) => ({
      ...row,
      course_title: row.course?.title,
      course_desc: row.course?.description,
    })) as (TrainingPlan & { course_title?: string; course_desc?: string })[];
    setPlans(planData);
    setLoading(false);
  }, [profile]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return <div className="p-8 text-center text-slate-400">กำลังโหลด...</div>;
  }

  if (activePlan) {
    return <CoursePlayer planId={activePlan} onBack={() => setActivePlan(null)} onChanged={load} notify={notify} />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <GraduationCap className="w-6 h-6 text-cyan-600" />
          การฝึกอบรมของฉัน
        </h2>
        <p className="text-slate-500 text-sm mt-1">เรียนตามขั้นตอนที่กำหนด สามารถหยุดแล้วกลับมาเรียนต่อได้</p>
      </div>

      {/* View toggle */}
      <div className="flex gap-1 bg-slate-100 rounded-lg p-1 w-fit">
        <button
          onClick={() => setUserView('cards')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
            userView === 'cards' ? 'bg-white text-cyan-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <BookOpen className="w-4 h-4" /> การ์ด
        </button>
        <button
          onClick={() => setUserView('calendar')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
            userView === 'calendar' ? 'bg-white text-cyan-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <CalendarDays className="w-4 h-4" /> ปฏิทิน
        </button>
      </div>

      {userView === 'calendar' ? (
        <UserPlanCalendar plans={plans} onPlanClick={showRoadmap} />
      ) : plans.length === 0 ? (
        <div className="card p-8 text-center text-slate-400">ยังไม่มีหลักสูตรที่มอบหมายให้คุณ</div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {plans.map((p) => (
            <div key={p.id} className="card p-5 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-slate-800">{p.course_title ?? '-'}</h3>
                  {p.course_desc && <p className="text-sm text-slate-500 mt-1">{p.course_desc}</p>}
                </div>
                {p.status === 'completed' ? (
                  <span className="badge bg-emerald-100 text-emerald-700"><CheckCircle2 className="w-3 h-3" /> เสร็จสิ้น</span>
                ) : p.status === 'in_progress' ? (
                  <span className="badge bg-amber-100 text-amber-700"><Clock className="w-3 h-3" /> กำลังเรียน</span>
                ) : (
                  <span className="badge bg-slate-100 text-slate-600">ยังไม่เริ่ม</span>
                )}
              </div>
              {p.due_date && (
                <p className="text-xs text-slate-400 mb-3">กำหนดส่ง: {formatDate(p.due_date)}</p>
              )}
              <div className="flex gap-2">
                <button
                  onClick={() => setActivePlan(p.id)}
                  className="btn-primary flex-1"
                >
                  <Play className="w-4 h-4" />
                  {p.status === 'completed' ? 'ดูซ้ำ' : p.status === 'in_progress' ? 'เรียนต่อ' : 'เริ่มเรียน'}
                </button>
                <button
                  onClick={() => showRoadmap(p.id, p.course_id)}
                  className="btn-secondary"
                  title="ดู Roadmap"
                >
                  <MapIcon className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

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

function UserPlanCalendar({ plans, onPlanClick }: {
  plans: (TrainingPlan & { course_title?: string; course_desc?: string })[];
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

  const todayKey = new Date().toISOString().slice(0, 10);

  const cells: (number | null)[] = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div className="card p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
          <CalendarDays className="w-5 h-5 text-cyan-600" />
          ปฏิทินการฝึกอบรมของฉัน
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
                    title={p.course_title ?? ''}
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

// =================== Course Player ===================

function CoursePlayer({
  planId, onBack, onChanged, notify,
}: {
  planId: string;
  onBack: () => void;
  onChanged: () => void;
  notify: (type: 'success' | 'error' | 'info', msg: string) => void;
}) {
  const { profile } = useAuth();
  const [steps, setSteps] = useState<TrainingStep[]>([]);
  const [progress, setProgress] = useState<Map<string, string>>(new Map());
  const [currentStepIdx, setCurrentStepIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showExam, setShowExam] = useState(false);

  const load = useCallback(async () => {
    const [stepRes, progRes] = await Promise.all([
      supabase.from('training_steps').select('*').eq('course_id', (
        await supabase.from('training_plans').select('course_id').eq('id', planId).maybeSingle()
      ).data?.course_id).order('sort_order'),
      supabase.from('training_progress').select('*').eq('plan_id', planId),
    ]);

    const stepData = (stepRes.data as TrainingStep[]) ?? [];
    setSteps(stepData);

    const progMap = new Map<string, string>();
    ((progRes.data as any[]) ?? []).forEach((p) => {
      progMap.set(p.step_id, p.status);
    });
    setProgress(progMap);

    // Find first non-completed step
    const firstIncomplete = stepData.findIndex((s) => progMap.get(s.id) !== 'completed');
    setCurrentStepIdx(firstIncomplete >= 0 ? firstIncomplete : 0);
    setLoading(false);
  }, [planId]);

  useEffect(() => { load(); }, [load]);

  async function markStepStatus(stepId: string, status: 'in_progress' | 'completed') {
    if (!profile) return;
    const existing = progress.get(stepId);
    if (existing === status) return;

    if (existing) {
      await supabase
        .from('training_progress')
        .update({
          status,
          started_at: status === 'in_progress' ? new Date().toISOString() : undefined,
          completed_at: status === 'completed' ? new Date().toISOString() : null,
        })
        .eq('plan_id', planId)
        .eq('step_id', stepId);
    } else {
      await supabase.from('training_progress').insert({
        plan_id: planId,
        step_id: stepId,
        user_id: profile.id,
        status,
        started_at: new Date().toISOString(),
        completed_at: status === 'completed' ? new Date().toISOString() : null,
      });
    }
    setProgress((prev) => { const m = new Map(prev); m.set(stepId, status); return m; });
  }

  async function checkAndCompletePlan() {
    const allDone = steps.every((s) => progress.get(s.id) === 'completed' || s.id === steps[currentStepIdx]?.id);
    if (allDone) {
      await supabase.from('training_plans').update({ status: 'completed' }).eq('id', planId);
      notify('success', 'ยินดีกับคุณ! คุณเรียนจบหลักสูตรนี้แล้ว');
      onChanged();
    }
  }

  if (loading) return <div className="p-8 text-center text-slate-400">กำลังโหลด...</div>;

  if (steps.length === 0) {
    return (
      <div className="space-y-4">
        <button onClick={onBack} className="btn-secondary"><ArrowLeft className="w-4 h-4" /> กลับ</button>
        <div className="card p-8 text-center text-slate-400">หลักสูตรนี้ยังไม่มีขั้นตอน</div>
      </div>
    );
  }

  const currentStep = steps[currentStepIdx];
  const fileUrl = currentStep?.file_path
    ? supabase.storage.from('training').getPublicUrl(currentStep.file_path).data.publicUrl
    : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="btn-secondary"><ArrowLeft className="w-4 h-4" /> กลับ</button>
        <div className="text-sm text-slate-500">
          ขั้นตอนที่ {currentStepIdx + 1} / {steps.length}
        </div>
      </div>

      {/* Progress bar */}
      <div className="card p-4">
        <div className="flex items-center gap-2 mb-2">
          {steps.map((s, i) => (
            <button
              key={s.id}
              onClick={() => setCurrentStepIdx(i)}
              className={`flex-1 h-2 rounded-full transition-all ${
                i === currentStepIdx ? 'bg-cyan-500' :
                progress.get(s.id) === 'completed' ? 'bg-emerald-400' : 'bg-slate-200'
              }`}
              title={s.title}
            />
          ))}
        </div>
        <div className="flex gap-1 flex-wrap">
          {steps.map((s, i) => (
            <button
              key={s.id}
              onClick={() => setCurrentStepIdx(i)}
              className={`text-xs px-2 py-1 rounded-md transition-colors ${
                i === currentStepIdx ? 'bg-cyan-100 text-cyan-700 font-medium' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              {progress.get(s.id) === 'completed' && <CheckCircle2 className="w-3 h-3 inline mr-1" />}
              {i + 1}
            </button>
          ))}
        </div>
      </div>

      {/* Step content */}
      <div className="card p-6">
        <div className="flex items-center gap-2 mb-4">
          <span className="w-8 h-8 rounded-full bg-cyan-100 text-cyan-600 flex items-center justify-center text-sm font-bold">
            {currentStepIdx + 1}
          </span>
          <h3 className="font-semibold text-slate-800 text-lg">{currentStep.title}</h3>
        </div>

        {currentStep.description && (
          <p className="text-slate-600 text-sm mb-4">{currentStep.description}</p>
        )}

        {/* Content viewer */}
        {fileUrl ? (
          <div className="rounded-xl border border-slate-200 overflow-hidden mb-4">
            {currentStep.content_type === 'video' ? (
              <video src={fileUrl} controls className="w-full" />
            ) : currentStep.content_type === 'pdf' ? (
              <iframe src={fileUrl} className="w-full h-[500px]" title={currentStep.title} />
            ) : (
              <div className="p-8 text-center">
                <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <a href={fileUrl} target="_blank" rel="noreferrer" className="btn-secondary">
                  เปิดไฟล์ดูเนื้อหา
                </a>
              </div>
            )}
          </div>
        ) : (
          <div className="p-8 text-center text-slate-400 bg-slate-50 rounded-xl mb-4">
            <BookOpen className="w-10 h-10 mx-auto mb-2 text-slate-300" />
            ขั้นตอนนี้ยังไม่มีไฟล์เนื้อหา
          </div>
        )}

        {/* Exam button */}
        {currentStep.exam_id && (
          <div className="bg-cyan-50 border border-cyan-200 rounded-xl p-4 mb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ClipboardList className="w-5 h-5 text-cyan-600" />
                <span className="text-sm font-medium text-cyan-800">มีข้อสอบสำหรับขั้นตอนนี้</span>
              </div>
              <button
                onClick={() => { setShowExam(true); markStepStatus(currentStep.id, 'in_progress'); }}
                className="btn-primary !py-2"
              >
                <Award className="w-4 h-4" /> ทำข้อสอบ
              </button>
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between mt-4">
          <button
            onClick={() => setCurrentStepIdx(Math.max(0, currentStepIdx - 1))}
            disabled={currentStepIdx === 0}
            className="btn-secondary disabled:opacity-50"
          >
            <ArrowLeft className="w-4 h-4" /> ก่อนหน้า
          </button>
          <button
            onClick={async () => {
              await markStepStatus(currentStep.id, 'completed');
              if (currentStepIdx < steps.length - 1) {
                setCurrentStepIdx(currentStepIdx + 1);
              } else {
                checkAndCompletePlan();
              }
            }}
            className="btn-primary"
          >
            {currentStepIdx < steps.length - 1 ? (
              <>ขั้นตอนต่อไป <ArrowRight className="w-4 h-4" /></>
            ) : (
              <><CheckCircle2 className="w-4 h-4" /> เสร็จสิ้นหลักสูตร</>
            )}
          </button>
        </div>
      </div>

      {/* Exam modal */}
      {showExam && currentStep.exam_id && (
        <ExamPlayer
          examId={currentStep.exam_id}
          planId={planId}
          onClose={() => setShowExam(false)}
          onPass={async () => {
            await markStepStatus(currentStep.id, 'completed');
            setShowExam(false);
            if (currentStepIdx < steps.length - 1) {
              setCurrentStepIdx(currentStepIdx + 1);
            } else {
              checkAndCompletePlan();
            }
          }}
          notify={notify}
        />
      )}
    </div>
  );
}

// =================== Exam Player ===================

function ExamPlayer({
  examId, planId, onClose, onPass, notify,
}: {
  examId: string;
  planId: string;
  onClose: () => void;
  onPass: () => void;
  notify: (type: 'success' | 'error' | 'info', msg: string) => void;
}) {
  const { profile } = useAuth();
  const [exam, setExam] = useState<TrainingExam | null>(null);
  const [questions, setQuestions] = useState<TrainingQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      supabase.from('training_exams').select('*').eq('id', examId).maybeSingle(),
      supabase.from('training_questions').select('*').eq('exam_id', examId).order('sort_order'),
    ]).then(([e, q]) => {
      setExam(e.data as TrainingExam | null);
      setQuestions((q.data as TrainingQuestion[]) ?? []);
      setLoading(false);
    });
  }, [examId]);

  function handleSubmit() {
    if (!exam || !profile) return;
    const unanswered = questions.filter((q) => !answers[q.id]?.trim());
    if (unanswered.length > 0) {
      notify('error', `ยังตอบไม่ครบ (เหลือ ${unanswered.length} ข้อ)`);
      return;
    }

    let correct = 0;
    let totalPoints = 0;
    let earnedPoints = 0;
    questions.forEach((q) => {
      totalPoints += q.points;
      const userAnswer = (answers[q.id] ?? '').trim();
      if (q.question_type === 'short_answer') {
        if (userAnswer.toLowerCase() === q.correct_answer.toLowerCase()) {
          correct++;
          earnedPoints += q.points;
        }
      } else {
        if (userAnswer === q.correct_answer) {
          correct++;
          earnedPoints += q.points;
        }
      }
    });

    const pct = totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 100) : 0;
    const passed = pct >= exam.passing_score;

    setScore(pct);
    setCorrectCount(correct);
    setSubmitted(true);

    supabase.from('training_exam_results').insert({
      exam_id: examId,
      user_id: profile.id,
      user_name: profile.full_name,
      plan_id: planId,
      score: pct,
      total_questions: questions.length,
      correct_count: correct,
      answers,
      passed,
    }).then(({ error }) => {
      if (error) notify('error', 'บันทึกผลสอบไม่สำเร็จ: ' + error.message);
    });

    if (passed) {
      notify('success', `สอบผ่าน! คะแนน ${pct}%`);
    } else {
      notify('error', `สอบไม่ผ่าน คะแนน ${pct}% (ต้องการ ${exam.passing_score}%)`);
    }
  }

  if (loading) return <div className="p-8 text-center text-slate-400">กำลังโหลดข้อสอบ...</div>;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 sticky top-0 bg-white z-10">
          <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-cyan-600" />
            {exam?.title ?? 'ข้อสอบ'}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">X</button>
        </div>

        {submitted ? (
          <div className="p-6 text-center">
            <div className={`w-20 h-20 rounded-full mx-auto mb-4 flex items-center justify-center ${
              score >= (exam?.passing_score ?? 60) ? 'bg-emerald-100' : 'bg-red-100'
            }`}>
              {score >= (exam?.passing_score ?? 60) ? (
                <CheckCircle2 className="w-10 h-10 text-emerald-600" />
              ) : (
                <AlertCircle className="w-10 h-10 text-red-500" />
              )}
            </div>
            <h4 className={`text-2xl font-bold mb-2 ${score >= (exam?.passing_score ?? 60) ? 'text-emerald-600' : 'text-red-500'}`}>
              {score >= (exam?.passing_score ?? 60) ? 'สอบผ่าน!' : 'สอบไม่ผ่าน'}
            </h4>
            <p className="text-slate-600 mb-2">คะแนน: <span className="font-bold">{score}%</span></p>
            <p className="text-slate-500 text-sm">ถูก {correctCount} / {questions.length} ข้อ</p>
            <p className="text-slate-400 text-sm mt-2">คะแนนผ่าน: {exam?.passing_score}%</p>
            <div className="flex gap-2 justify-center mt-6">
              {score >= (exam?.passing_score ?? 60) ? (
                <button onClick={onPass} className="btn-primary">ดำเนินการต่อ</button>
              ) : (
                <button
                  onClick={() => { setSubmitted(false); setAnswers({}); }}
                  className="btn-primary"
                >ทำใหม่</button>
              )}
              <button onClick={onClose} className="btn-secondary">ปิด</button>
            </div>
          </div>
        ) : (
          <div className="p-6 space-y-4">
            {exam?.description && (
              <p className="text-sm text-slate-500 bg-slate-50 rounded-lg p-3">{exam.description}</p>
            )}
            <p className="text-xs text-slate-400">คะแนนผ่าน: {exam?.passing_score}% · จำนวน {questions.length} ข้อ</p>

            {questions.map((q, i) => (
              <div key={q.id} className="border border-slate-200 rounded-xl p-4">
                <div className="flex items-start gap-2 mb-3">
                  <span className="text-sm font-bold text-slate-400">Q{i + 1}</span>
                  <div className="flex-1">
                    <p className="text-sm text-slate-800 font-medium">{q.question_text}</p>
                    <span className="text-xs text-slate-400">{questionTypeLabel(q.question_type)} · {q.points} คะแนน</span>
                  </div>
                </div>
                {q.question_type === 'multiple_choice' && (
                  <div className="space-y-2">
                    {q.options.map((opt) => (
                      <label key={opt} className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 rounded-lg p-2">
                        <input
                          type="radio"
                          name={q.id}
                          value={opt}
                          checked={answers[q.id] === opt}
                          onChange={(e) => setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
                          className="text-cyan-500"
                        />
                        <span className="text-sm text-slate-700">{opt}</span>
                      </label>
                    ))}
                  </div>
                )}
                {q.question_type === 'true_false' && (
                  <div className="flex gap-3">
                    {['ถูก', 'ผิด'].map((opt) => (
                      <label key={opt} className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 rounded-lg p-2 flex-1">
                        <input
                          type="radio"
                          name={q.id}
                          value={opt}
                          checked={answers[q.id] === opt}
                          onChange={(e) => setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
                          className="text-cyan-500"
                        />
                        <span className="text-sm text-slate-700">{opt}</span>
                      </label>
                    ))}
                  </div>
                )}
                {q.question_type === 'short_answer' && (
                  <input
                    value={answers[q.id] ?? ''}
                    onChange={(e) => setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
                    className="form-input"
                    placeholder="พิมพ์คำตอบ..."
                  />
                )}
              </div>
            ))}

            <button onClick={handleSubmit} className="btn-primary w-full">
              <CheckCircle2 className="w-4 h-4" /> ส่งคำตอบ
            </button>
          </div>
        )}
      </div>
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
