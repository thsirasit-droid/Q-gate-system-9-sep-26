import { useState, useEffect, useMemo } from 'react';
import { supabase, type InspectionRecord, type Judgment, type ProblemHistory, type TrainingPlan, type TrainingExamResult } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line,
} from 'recharts';
import {
  BarChart3, ClipboardCheck, MessageSquareWarning, History,
  TrendingUp, CheckCircle2, XCircle, Clock, Users, GraduationCap, Award,
} from 'lucide-react';
import { monthLabel } from '@/lib/utils';

const PIE_COLORS = ['#10b981', '#ef4444', '#f59e0b', '#3b82f6'];

export default function DashboardTab() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';
  const [inspections, setInspections] = useState<InspectionRecord[]>([]);
  const [judgments, setJudgments] = useState<Judgment[]>([]);
  const [problems, setProblems] = useState<ProblemHistory[]>([]);
  const [trainingPlans, setTrainingPlans] = useState<TrainingPlan[]>([]);
  const [examResults, setExamResults] = useState<TrainingExamResult[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const queries = [
      supabase.from('inspection_records').select('*').order('record_date', { ascending: false }).limit(500),
      supabase.from('judgments').select('*').order('record_date', { ascending: false }).limit(500),
      supabase.from('problem_history').select('*').order('record_date', { ascending: false }).limit(500),
    ];
    if (isAdmin) {
      queries.push(
        supabase.from('training_plans').select('*').order('created_at', { ascending: false }).limit(500),
      );
      queries.push(
        supabase.from('training_exam_results').select('*').order('created_at', { ascending: false }).limit(500),
      );
    }
    Promise.all(queries).then((results) => {
      setInspections((results[0].data as InspectionRecord[]) ?? []);
      setJudgments((results[1].data as Judgment[]) ?? []);
      setProblems((results[2].data as ProblemHistory[]) ?? []);
      if (isAdmin && results[3] && results[4]) {
        setTrainingPlans((results[3].data as TrainingPlan[]) ?? []);
        setExamResults((results[4].data as TrainingExamResult[]) ?? []);
      }
      setLoading(false);
    });
  }, [isAdmin]);

  // monthly inspection counts
  const monthlyInspections = useMemo(() => {
    const map: Record<string, number> = {};
    inspections.forEach((r) => {
      const key = monthKey(r.record_date);
      map[key] = (map[key] ?? 0) + 1;
    });
    return Object.entries(map)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-6)
      .map(([key, count]) => ({ month: monthLabel(key), count }));
  }, [inspections]);

  // judgment decision distribution
  const judgmentDist = useMemo(() => {
    const counts: Record<string, number> = { OK: 0, NG: 0, Rework: 0, pending: 0 };
    judgments.forEach((j) => {
      if (j.status === 'pending') counts.pending++;
      else if (j.decision) counts[j.decision]++;
    });
    return [
      { name: 'OK', value: counts.OK },
      { name: 'NG', value: counts.NG },
      { name: 'Rework', value: counts.Rework },
      { name: 'รอตัดสินใจ', value: counts.pending },
    ].filter((d) => d.value > 0);
  }, [judgments]);

  // problems by type (for monitoring)
  const problemsByType = useMemo(() => {
    const map: Record<string, number> = {};
    problems.forEach((r) => {
      const key = r.problem || 'ไม่ระบุ';
      map[key] = (map[key] ?? 0) + 1;
    });
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([problem, count]) => ({ problem, count }));
  }, [problems]);

  // combined monthly chart
  const combinedMonthly = useMemo(() => {
    const map: Record<string, { inspections: number; judgments: number; problems: number }> = {};
    inspections.forEach((r) => {
      const k = monthKey(r.record_date);
      map[k] = map[k] ?? { inspections: 0, judgments: 0, problems: 0 };
      map[k].inspections++;
    });
    judgments.forEach((j) => {
      const k = monthKey(j.record_date);
      map[k] = map[k] ?? { inspections: 0, judgments: 0, problems: 0 };
      map[k].judgments++;
    });
    problems.forEach((p) => {
      const k = monthKey(p.record_date);
      map[k] = map[k] ?? { inspections: 0, judgments: 0, problems: 0 };
      map[k].problems++;
    });
    return Object.entries(map)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-6)
      .map(([key, v]) => ({ month: monthLabel(key), ...v }));
  }, [inspections, judgments, problems]);

  // top parts with problems
  const topProblemParts = useMemo(() => {
    const map: Record<string, number> = {};
    problems.forEach((p) => {
      map[p.part_no] = (map[p.part_no] ?? 0) + 1;
    });
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([part_no, count]) => ({ part_no, count }));
  }, [problems]);

  // unique inspectors
  const inspectorCount = useMemo(() => {
    const set = new Set(inspections.map((r) => r.user_id));
    return set.size;
  }, [inspections]);

  const approvedCount = inspections.filter((r) => r.approved).length;
  const pendingCount = inspections.length - approvedCount;

  // Training stats (admin only)
  const trainingCompleted = trainingPlans.filter((p) => p.status === 'completed').length;
  const trainingInProgress = trainingPlans.filter((p) => p.status === 'in_progress').length;
  const examPassed = examResults.filter((r) => r.passed).length;
  const examFailed = examResults.filter((r) => !r.passed).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-slate-400">กำลังโหลดแดชบอร์ด...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <BarChart3 className="w-6 h-6 text-cyan-600" />
          แดชบอร์ดสรุปการตรวจสอบ
        </h2>
        <p className="text-slate-500 text-sm mt-1">สรุปผลการตรวจสอบของผู้ใช้ทุกคน แสดงเป็นรายเดือน</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={ClipboardCheck} label="บันทึกการตรวจสอบ" value={inspections.length} color="from-cyan-500 to-blue-600" />
        <StatCard icon={MessageSquareWarning} label="การแจ้งปัญหา" value={judgments.length} color="from-blue-500 to-indigo-600" />
        <StatCard icon={History} label="ประวัติปัญหา" value={problems.length} color="from-teal-500 to-emerald-600" />
        <StatCard icon={Users} label="ผู้ตรวจสอบ" value={inspectorCount} color="from-sky-500 to-cyan-600" />
      </div>

      {/* Approval summary */}
      <div className="grid grid-cols-3 gap-4">
        <MiniStat icon={CheckCircle2} label="อนุมัติแล้ว" value={approvedCount} color="text-emerald-600 bg-emerald-50" />
        <MiniStat icon={Clock} label="รออนุมัติ" value={pendingCount} color="text-amber-600 bg-amber-50" />
        <MiniStat icon={XCircle} label="ตัดสินใจแล้ว" value={judgments.filter((j) => j.status === 'decided').length} color="text-blue-600 bg-blue-50" />
      </div>

      {/* Combined monthly chart */}
      <div className="card p-6">
        <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-cyan-600" />
          สรุปรายเดือน — ทุกระบบ
        </h3>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={combinedMonthly}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#64748b' }} />
            <YAxis tick={{ fontSize: 12, fill: '#64748b' }} allowDecimals={false} />
            <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0' }} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Line type="monotone" dataKey="inspections" name="การตรวจสอบ" stroke="#0891b2" strokeWidth={2} dot={{ r: 4 }} />
            <Line type="monotone" dataKey="judgments" name="การแจ้งปัญหา" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4 }} />
            <Line type="monotone" dataKey="problems" name="ประวัติปัญหา" stroke="#14b8a6" strokeWidth={2} dot={{ r: 4 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Monthly inspections bar */}
        <div className="card p-6">
          <h3 className="font-semibold text-slate-800 mb-4">การตรวจสอบรายเดือน</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={monthlyInspections}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#64748b' }} />
              <YAxis tick={{ fontSize: 12, fill: '#64748b' }} allowDecimals={false} />
              <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0' }} />
              <Bar dataKey="count" name="จำนวน" fill="#0891b2" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Judgment distribution pie */}
        <div className="card p-6">
          <h3 className="font-semibold text-slate-800 mb-4">การตัดสินใจ (OK / NG / Rework)</h3>
          {judgmentDist.length === 0 ? (
            <div className="flex items-center justify-center h-[260px] text-slate-400 text-sm">ยังไม่มีข้อมูล</div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={judgmentDist} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label>
                  {judgmentDist.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0' }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Problems by type bar */}
        <div className="card p-6">
          <h3 className="font-semibold text-slate-800 mb-4">ประวัติปัญหาแยกตามประเภท</h3>
          {problemsByType.length === 0 ? (
            <div className="flex items-center justify-center h-[260px] text-slate-400 text-sm">ยังไม่มีข้อมูล</div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={problemsByType} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis type="number" tick={{ fontSize: 12, fill: '#64748b' }} allowDecimals={false} />
                <YAxis type="category" dataKey="problem" tick={{ fontSize: 11, fill: '#64748b' }} width={120} />
                <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0' }} />
                <Bar dataKey="count" name="จำนวนครั้ง" fill="#14b8a6" radius={[0, 8, 8, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Top problem parts */}
        <div className="card p-6">
          <h3 className="font-semibold text-slate-800 mb-4">ชิ้นงานที่พบปัญหาบ่อย (Top 5)</h3>
          {topProblemParts.length === 0 ? (
            <div className="flex items-center justify-center h-[260px] text-slate-400 text-sm">ยังไม่มีข้อมูล</div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={topProblemParts} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis type="number" tick={{ fontSize: 12, fill: '#64748b' }} allowDecimals={false} />
                <YAxis type="category" dataKey="part_no" tick={{ fontSize: 11, fill: '#64748b' }} width={80} />
                <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0' }} />
                <Bar dataKey="count" name="จำนวนครั้ง" fill="#ef4444" radius={[0, 8, 8, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Training monitoring (admin only) */}
      {isAdmin && trainingPlans.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <GraduationCap className="w-5 h-5 text-cyan-600" />
            <h3 className="font-semibold text-slate-800">สถานะการฝึกอบรม</h3>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            <StatCard icon={GraduationCap} label="มอบหมายทั้งหมด" value={trainingPlans.length} color="from-cyan-500 to-blue-600" />
            <StatCard icon={CheckCircle2} label="เสร็จสิ้น" value={trainingCompleted} color="from-emerald-500 to-teal-600" />
            <StatCard icon={Clock} label="กำลังเรียน" value={trainingInProgress} color="from-amber-500 to-orange-600" />
            <StatCard icon={Award} label="สอบผ่าน" value={examPassed} color="from-green-500 to-emerald-600" />
            <StatCard icon={XCircle} label="สอบไม่ผ่าน" value={examFailed} color="from-red-500 to-rose-600" />
          </div>
        </div>
      )}
    </div>
  );
}

function monthKey(d: string | Date): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function StatCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: typeof ClipboardCheck;
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="card p-5">
      <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center mb-3 shadow-lg`}>
        <Icon className="w-6 h-6 text-white" />
      </div>
      <div className="text-2xl font-bold text-slate-800">{value}</div>
      <div className="text-sm text-slate-500">{label}</div>
    </div>
  );
}

function MiniStat({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: typeof ClipboardCheck;
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className={`rounded-xl px-4 py-3 flex items-center gap-3 ${color}`}>
      <Icon className="w-5 h-5" />
      <div>
        <div className="text-xl font-bold">{value}</div>
        <div className="text-xs opacity-80">{label}</div>
      </div>
    </div>
  );
}
