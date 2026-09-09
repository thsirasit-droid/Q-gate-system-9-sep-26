import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import AuthScreen from '@/screens/AuthScreen';
import InspectionTab from '@/screens/InspectionTab';
import JudgmentTab from '@/screens/JudgmentTab';
import ProblemHistoryTab from '@/screens/ProblemHistoryTab';
import DashboardTab from '@/screens/DashboardTab';
import TrainingTab from '@/screens/TrainingTab';
import {
  ClipboardCheck, MessageSquareWarning, History, BarChart3,
  ShieldCheck, LogOut, Menu, X, GraduationCap, Monitor, Smartphone,
} from 'lucide-react';

type Tab = 'dashboard' | 'inspection' | 'judgment' | 'history' | 'training';
type ViewMode = 'auto' | 'phone' | 'pc';

export default function App() {
  const { user, profile, loading, signOut } = useAuth();
  const [tab, setTab] = useState<Tab>('dashboard');
  const [mobileNav, setMobileNav] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    return (localStorage.getItem('qc-view-mode') as ViewMode) || 'auto';
  });

  useEffect(() => {
    localStorage.setItem('qc-view-mode', viewMode);
  }, [viewMode]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="text-slate-400 flex items-center gap-2">
          <div className="w-5 h-5 border-2 border-slate-300 border-t-cyan-500 rounded-full animate-spin" />
          กำลังโหลด...
        </div>
      </div>
    );
  }

  if (!user || !profile) return <AuthScreen />;

  const isAdmin = profile.role === 'admin';

  const tabs: { id: Tab; label: string; icon: typeof ClipboardCheck }[] = [
    { id: 'dashboard', label: 'แดชบอร์ด', icon: BarChart3 },
    { id: 'inspection', label: 'บันทึกการตรวจสอบ', icon: ClipboardCheck },
    { id: 'judgment', label: 'ตัดสินใจออนไลน์', icon: MessageSquareWarning },
    { id: 'history', label: 'ประวัติปัญหา', icon: History },
    { id: 'training', label: 'ฝึกอบรมออนไลน์', icon: GraduationCap },
  ];

  // Determine effective layout: phone view forces narrow, pc view forces wide, auto = natural
  const isPhoneForced = viewMode === 'phone';
  const isPcForced = viewMode === 'pc';

  const containerClass = isPhoneForced
    ? 'max-w-[430px] mx-auto px-4'
    : isPcForced
    ? 'max-w-[1600px] mx-auto px-4 sm:px-6'
    : 'max-w-7xl mx-auto px-4 sm:px-6';

  return (
    <div className={`min-h-screen bg-slate-100 ${isPhoneForced ? 'max-w-[430px] mx-auto border-x border-slate-200 min-h-screen' : ''}`}>
      {/* Top bar */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className={containerClass}>
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-md shadow-cyan-500/20">
                <ShieldCheck className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="font-bold text-slate-800 text-lg leading-none">QC System</h1>
                <p className="text-xs text-slate-400 mt-0.5">Quality Control & Training</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* View mode selector */}
              <div className="hidden sm:flex items-center gap-1 bg-slate-100 rounded-lg p-1">
                <button
                  onClick={() => setViewMode('auto')}
                  className={`p-1.5 rounded-md transition-colors ${viewMode === 'auto' ? 'bg-white text-cyan-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                  title="มุมมองอัตโนมัติ"
                >
                  <Monitor className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode('phone')}
                  className={`p-1.5 rounded-md transition-colors ${viewMode === 'phone' ? 'bg-white text-cyan-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                  title="มุมมองโทรศัพท์"
                >
                  <Smartphone className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode('pc')}
                  className={`p-1.5 rounded-md transition-colors ${viewMode === 'pc' ? 'bg-white text-cyan-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                  title="มุมมองพีซี"
                >
                  <Monitor className="w-4 h-4" />
                </button>
              </div>

              {/* Mobile view mode selector (compact) */}
              <div className="sm:hidden flex items-center gap-1 bg-slate-100 rounded-lg p-1">
                <button
                  onClick={() => setViewMode('phone')}
                  className={`p-1.5 rounded-md transition-colors ${viewMode === 'phone' ? 'bg-white text-cyan-600 shadow-sm' : 'text-slate-400'}`}
                  title="มุมมองโทรศัพท์"
                >
                  <Smartphone className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode('auto')}
                  className={`p-1.5 rounded-md transition-colors ${viewMode === 'auto' ? 'bg-white text-cyan-600 shadow-sm' : 'text-slate-400'}`}
                  title="มุมมองอัตโนมัติ"
                >
                  <Monitor className="w-4 h-4" />
                </button>
              </div>

              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-slate-100 rounded-lg">
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white text-xs font-bold">
                  {profile.full_name.charAt(0).toUpperCase()}
                </div>
                <div className="text-sm">
                  <div className="font-medium text-slate-700 leading-none">{profile.full_name}</div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    {profile.employee_id} · {isAdmin ? 'Admin' : 'User'}
                  </div>
                </div>
              </div>
              <button
                onClick={signOut}
                className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                title="ออกจากระบบ"
              >
                <LogOut className="w-5 h-5" />
              </button>
              <button
                onClick={() => setMobileNav(!mobileNav)}
                className="lg:hidden p-2 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                {mobileNav ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {/* Desktop tabs */}
          <nav className="hidden lg:flex gap-1 -mb-px">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-all ${
                  tab === t.id
                    ? 'border-cyan-500 text-cyan-600'
                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                }`}
              >
                <t.icon className="w-4 h-4" />
                {t.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Mobile tabs */}
        {mobileNav && (
          <nav className="lg:hidden border-t border-slate-100 px-4 py-2 space-y-1">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => {
                  setTab(t.id);
                  setMobileNav(false);
                }}
                className={`w-full flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  tab === t.id ? 'bg-cyan-50 text-cyan-600' : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <t.icon className="w-4 h-4" />
                {t.label}
              </button>
            ))}
          </nav>
        )}
      </header>

      {/* Content */}
      <main className={`${containerClass} py-6`}>
        {tab === 'dashboard' && <DashboardTab />}
        {tab === 'inspection' && <InspectionTab />}
        {tab === 'judgment' && <JudgmentTab />}
        {tab === 'history' && <ProblemHistoryTab />}
        {tab === 'training' && <TrainingTab />}
      </main>
    </div>
  );
}
