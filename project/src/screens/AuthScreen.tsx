import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { ShieldCheck, ClipboardCheck, MessageSquareWarning, History, BarChart3 } from 'lucide-react';

export default function AuthScreen() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    if (mode === 'login') {
      const { error } = await signIn(email, password);
      if (error) setError(error);
    } else {
      if (!employeeId.trim() || !fullName.trim()) {
        setError('กรุณากรอกรหัสพนักงานและชื่อ-นามสกุล');
        setBusy(false);
        return;
      }
      const { error } = await signUp(email, password, employeeId, fullName);
      if (error) setError(error);
    }
    setBusy(false);
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 relative overflow-hidden">
      {/* background accents */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-cyan-500/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-teal-500/5 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-5xl grid lg:grid-cols-2 gap-8 items-center">
        {/* Left: branding */}
        <div className="hidden lg:flex flex-col gap-6 text-white">
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/30">
              <ShieldCheck className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">QC System</h1>
              <p className="text-slate-400 text-sm">Quality Control & Dashboard</p>
            </div>
          </div>
          <p className="text-slate-300 text-lg leading-relaxed">
            ระบบควบคุมคุณภาพครบวงจร บันทึกการตรวจสอบ ตัดสินใจออนไลน์ และประวัติปัญหา พร้อมแดชบอร์ดสรุปผลรายเดือน
          </p>
          <div className="grid grid-cols-2 gap-4 mt-4">
            {[
              { icon: ClipboardCheck, label: 'บันทึกการตรวจสอบ', color: 'text-cyan-400' },
              { icon: MessageSquareWarning, label: 'ตัดสินใจออนไลน์', color: 'text-blue-400' },
              { icon: History, label: 'ประวัติปัญหา', color: 'text-teal-400' },
              { icon: BarChart3, label: 'แดชบอร์ด', color: 'text-sky-400' },
            ].map((f) => (
              <div key={f.label} className="flex items-center gap-3 bg-white/5 rounded-xl px-4 py-3 border border-white/10">
                <f.icon className={`w-5 h-5 ${f.color}`} />
                <span className="text-sm text-slate-200">{f.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right: form */}
        <div className="bg-white/5 backdrop-blur-xl rounded-3xl border border-white/10 p-8 shadow-2xl">
          <div className="lg:hidden flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center">
              <ShieldCheck className="w-7 h-7 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white">QC System</h1>
          </div>

          <div className="flex gap-2 p-1 bg-slate-800/50 rounded-xl mb-6">
            <button
              onClick={() => setMode('login')}
              className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${
                mode === 'login' ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'
              }`}
            >
              เข้าสู่ระบบ
            </button>
            <button
              onClick={() => setMode('register')}
              className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${
                mode === 'register' ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'
              }`}
            >
              ลงทะเบียน
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (
              <>
                <Field label="รหัสพนักงาน" >
                  <input
                    type="text"
                    value={employeeId}
                    onChange={(e) => setEmployeeId(e.target.value)}
                    className="auth-input"
                    placeholder="เช่น QC001"
                    required
                  />
                </Field>
                <Field label="ชื่อ - นามสกุล">
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="auth-input"
                    placeholder="ชื่อเต็ม"
                    required
                  />
                </Field>
              </>
            )}
            <Field label="อีเมล">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="auth-input"
                placeholder="you@company.com"
                required
              />
            </Field>
            <Field label="รหัสผ่าน">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="auth-input"
                placeholder="••••••••"
                required
                minLength={6}
              />
            </Field>

            {error && (
              <div className="bg-red-500/10 border border-red-500/30 text-red-300 text-sm rounded-lg px-4 py-3">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={busy}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-semibold shadow-lg shadow-cyan-500/30 hover:shadow-cyan-500/50 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {busy ? 'กำลังดำเนินการ...' : mode === 'login' ? 'เข้าสู่ระบบ' : 'สมัครสมาชิก'}
            </button>
          </form>

          <p className="text-center text-xs text-slate-500 mt-6">
            ผู้ลงทะเบียนใหม่จะได้สิทธิ์เป็น User · Admin สามารถเปลี่ยนบทบาทได้ภายหลัง
          </p>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-sm text-slate-300 mb-1.5 font-medium">{label}</span>
      {children}
    </label>
  );
}
