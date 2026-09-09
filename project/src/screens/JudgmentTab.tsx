import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase, type Judgment, type JudgmentMessage } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { todayISO, formatDateTime, createSignedAttachmentUrl } from '@/lib/utils';
import {
  MessageSquareWarning, Send, Plus, X, Image as ImageIcon, CheckCircle2,
  XCircle, RefreshCw, Clock, ChevronLeft, Paperclip,
} from 'lucide-react';

export default function JudgmentTab() {
  const { profile } = useAuth();
  const { notify } = useToast();
  const isAdmin = profile?.role === 'admin';

  const [judgments, setJudgments] = useState<Judgment[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const loadJudgments = useCallback(async () => {
    const { data } = await supabase
      .from('judgments')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);
    setJudgments((data as Judgment[]) ?? []);
  }, []);

  useEffect(() => {
    loadJudgments().finally(() => setLoading(false));
  }, [loadJudgments]);

  const selected = judgments.find((j) => j.id === selectedId) ?? null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <MessageSquareWarning className="w-6 h-6 text-blue-600" />
            ระบบตัดสินใจออนไลน์
          </h2>
          <p className="text-slate-500 text-sm mt-1">แจ้งปัญหาและตอบกลับแบบสนทนา ผู้ดูแลตัดสินใจ OK / NG / Rework</p>
        </div>
        <button onClick={() => setShowForm(true)} className="btn-primary">
          <Plus className="w-4 h-4" /> แจ้งปัญหาใหม่
        </button>
      </div>

      <div className="grid lg:grid-cols-3 gap-4 h-[calc(100vh-220px)] min-h-[500px]">
        {/* List */}
        <div className={`${selectedId ? 'hidden lg:block' : ''} card overflow-hidden flex flex-col`}>
          <div className="px-4 py-3 border-b border-slate-100 font-semibold text-slate-700 text-sm">รายการแจ้งปัญหา</div>
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
            {loading ? (
              <div className="p-4 text-center text-slate-400 text-sm">กำลังโหลด...</div>
            ) : judgments.length === 0 ? (
              <div className="p-4 text-center text-slate-400 text-sm">ยังไม่มีการแจ้งปัญหา</div>
            ) : (
              judgments.map((j) => (
                <button
                  key={j.id}
                  onClick={() => setSelectedId(j.id)}
                  className={`w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors ${
                    selectedId === j.id ? 'bg-cyan-50 border-l-4 border-cyan-500' : ''
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-slate-800 text-sm truncate">{j.part_no}</span>
                    {j.status === 'pending' ? (
                      <span className="badge bg-amber-100 text-amber-700 flex-shrink-0">
                        <Clock className="w-3 h-3" /> รอ
                      </span>
                    ) : j.decision === 'OK' ? (
                      <span className="badge bg-emerald-100 text-emerald-700 flex-shrink-0">
                        <CheckCircle2 className="w-3 h-3" /> {j.decision}
                      </span>
                    ) : (
                      <span className="badge bg-red-100 text-red-700 flex-shrink-0">
                        <XCircle className="w-3 h-3" /> {j.decision}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-500 truncate mt-0.5">{j.detail}</div>
                  <div className="text-xs text-slate-400 mt-1">{formatDateTime(j.created_at)} · {j.reporter}</div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Chat / detail */}
        <div className={`${selectedId ? '' : 'hidden lg:block'} lg:col-span-2 card overflow-hidden flex flex-col`}>
          {selected ? (
            <ChatPanel
              judgment={selected}
              isAdmin={isAdmin}
              profile={profile!}
              onBack={() => setSelectedId(null)}
              onUpdated={loadJudgments}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center text-slate-400">
              <div className="text-center">
                <MessageSquareWarning className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                <p className="text-sm">เลือกรายการเพื่อดูรายละเอียดและตอบกลับ</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {showForm && (
        <JudgmentForm
          onClose={() => setShowForm(false)}
          onCreated={(id) => {
            setShowForm(false);
            loadJudgments();
            setSelectedId(id);
          }}
          profile={profile!}
        />
      )}
    </div>
  );
}

function ChatPanel({
  judgment,
  isAdmin,
  profile,
  onBack,
  onUpdated,
}: {
  judgment: Judgment;
  isAdmin: boolean;
  profile: { id: string; full_name: string };
  onBack: () => void;
  onUpdated: () => void;
}) {
  const { notify } = useToast();
  const [messages, setMessages] = useState<JudgmentMessage[]>([]);
  const [text, setText] = useState('');
  const [decisionNote, setDecisionNote] = useState('');
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase
      .from('judgment_messages')
      .select('*')
      .eq('judgment_id', judgment.id)
      .order('created_at', { ascending: true })
      .then(({ data }) => setMessages((data as JudgmentMessage[]) ?? []));

    // realtime
    const channel = supabase
      .channel(`judgment-${judgment.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'judgment_messages', filter: `judgment_id=eq.${judgment.id}` },
        (payload) => {
          setMessages((prev) => [...prev, payload.new as JudgmentMessage]);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [judgment.id]);

  useEffect(() => {
    // load signed urls for images
    let active = true;
    (async () => {
      const urls: string[] = [];
      for (const p of judgment.image_paths ?? []) {
        const u = await createSignedAttachmentUrl(p);
        if (u && active) urls.push(u);
      }
      if (active) setImageUrls(urls);
    })();
    return () => { active = false; };
  }, [judgment.image_paths]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  async function sendMessage() {
    if (!text.trim()) return;
    const { data, error } = await supabase
      .from('judgment_messages')
      .insert({
        judgment_id: judgment.id,
        user_id: profile.id,
        sender_name: profile.full_name,
        is_admin: isAdmin,
        message: text.trim(),
      })
      .select()
      .single();
    if (error) {
      notify('error', 'ส่งข้อความไม่สำเร็จ: ' + error.message);
      return;
    }
    setMessages((prev) => [...prev, data as JudgmentMessage]);
    setText('');
  }

  async function makeDecision(decision: 'OK' | 'NG' | 'Rework') {
    const { error } = await supabase
      .from('judgments')
      .update({
        decision,
        decision_note: decisionNote.trim() || null,
        decided_by: profile.id,
        decided_at: new Date().toISOString(),
        status: 'decided',
      })
      .eq('id', judgment.id);
    if (error) {
      notify('error', 'บันทึกการตัดสินใจไม่สำเร็จ: ' + error.message);
      return;
    }
    notify('success', `ตัดสินใจ: ${decision} แล้ว`);
    onUpdated();
  }

  return (
    <>
      {/* header */}
      <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-3">
        <button onClick={onBack} className="lg:hidden text-slate-400 hover:text-slate-600">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-slate-800 text-sm">{judgment.part_no} — {judgment.part_name}</div>
          <div className="text-xs text-slate-500">{judgment.area} · {judgment.reporter} · {formatDateTime(judgment.record_date)}</div>
        </div>
        {judgment.status === 'decided' && judgment.decision && (
          <span className={`badge ${judgment.decision === 'OK' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
            {judgment.decision}
          </span>
        )}
      </div>

      {/* problem detail */}
      <div className="px-4 py-3 bg-slate-50 border-b border-slate-100">
        <div className="text-sm text-slate-700">{judgment.detail}</div>
        {imageUrls.length > 0 && (
          <div className="flex gap-2 mt-2 flex-wrap">
            {imageUrls.map((url, i) => (
              <a key={i} href={url} target="_blank" rel="noreferrer">
                <img src={url} alt="" className="w-20 h-20 object-cover rounded-lg border border-slate-200" />
              </a>
            ))}
          </div>
        )}
      </div>

      {/* admin decision bar */}
      {isAdmin && judgment.status === 'pending' && (
        <div className="px-4 py-3 bg-amber-50 border-b border-amber-200">
          <input
            type="text"
            value={decisionNote}
            onChange={(e) => setDecisionNote(e.target.value)}
            className="form-input mb-2"
            placeholder="หมายเหตุการตัดสินใจ..."
          />
          <div className="flex gap-2">
            <button onClick={() => makeDecision('OK')} className="flex-1 py-2 rounded-lg bg-emerald-500 text-white text-sm font-medium hover:bg-emerald-600 transition-all">
              <CheckCircle2 className="w-4 h-4 inline mr-1" /> OK
            </button>
            <button onClick={() => makeDecision('NG')} className="flex-1 py-2 rounded-lg bg-red-500 text-white text-sm font-medium hover:bg-red-600 transition-all">
              <XCircle className="w-4 h-4 inline mr-1" /> NG
            </button>
            <button onClick={() => makeDecision('Rework')} className="flex-1 py-2 rounded-lg bg-amber-500 text-white text-sm font-medium hover:bg-amber-600 transition-all">
              <RefreshCw className="w-4 h-4 inline mr-1" /> Rework
            </button>
          </div>
        </div>
      )}
      {judgment.status === 'decided' && judgment.decision_note && (
        <div className="px-4 py-2 bg-slate-50 border-b border-slate-100 text-sm text-slate-600">
          <span className="font-medium">หมายเหตุ:</span> {judgment.decision_note}
        </div>
      )}

      {/* messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-2 bg-slate-50/50">
        {messages.length === 0 && (
          <div className="text-center text-slate-400 text-sm py-8">ยังไม่มีข้อความ พิมพ์เพื่อเริ่มสนทนา</div>
        )}
        {messages.map((m) => {
          const mine = m.user_id === profile.id;
          return (
            <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[75%] rounded-2xl px-4 py-2 ${mine ? 'bg-cyan-500 text-white rounded-br-sm' : 'bg-white border border-slate-200 text-slate-800 rounded-bl-sm'}`}>
                {!mine && <div className={`text-xs font-medium mb-0.5 ${m.is_admin ? 'text-blue-500' : 'text-slate-400'}`}>{m.is_admin ? 'Admin' : m.sender_name}</div>}
                <div className="text-sm whitespace-pre-wrap">{m.message}</div>
                <div className={`text-xs mt-0.5 ${mine ? 'text-cyan-100' : 'text-slate-400'}`}>{formatDateTime(m.created_at)}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* input */}
      <div className="px-4 py-3 border-t border-slate-100 flex items-center gap-2">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
          className="form-input flex-1"
          placeholder="พิมพ์ข้อความ..."
        />
        <button onClick={sendMessage} className="btn-primary !p-2.5">
          <Send className="w-4 h-4" />
        </button>
      </div>
    </>
  );
}

function JudgmentForm({
  onClose,
  onCreated,
  profile,
}: {
  onClose: () => void;
  onCreated: (id: string) => void;
  profile: { id: string; full_name: string };
}) {
  const { notify } = useToast();
  const [date, setDate] = useState(todayISO());
  const [partNo, setPartNo] = useState('');
  const [partName, setPartName] = useState('');
  const [area, setArea] = useState('');
  const [reporter, setReporter] = useState(profile.full_name);
  const [detail, setDetail] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!partNo.trim() || !partName.trim() || !area.trim() || !detail.trim()) {
      notify('error', 'กรุณากรอกข้อมูลให้ครบ');
      return;
    }
    setSaving(true);

    // upload images
    const imagePaths: string[] = [];
    for (const f of files) {
      const ext = f.name.split('.').pop();
      const path = `${profile.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error } = await supabase.storage.from('attachments').upload(path, f);
      if (error) {
        notify('error', 'อัปโหลดรูปไม่สำเร็จ: ' + error.message);
        setSaving(false);
        return;
      }
      imagePaths.push(path);
    }

    const { data, error } = await supabase
      .from('judgments')
      .insert({
        record_date: date,
        part_no: partNo.trim(),
        part_name: partName.trim(),
        area: area.trim(),
        reporter: reporter.trim(),
        user_id: profile.id,
        detail: detail.trim(),
        image_paths: imagePaths,
      })
      .select()
      .single();
    if (error) {
      notify('error', 'บันทึกไม่สำเร็จ: ' + error.message);
      setSaving(false);
      return;
    }
    notify('success', 'แจ้งปัญหาเรียบร้อยแล้ว');
    onCreated(data.id);
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 sticky top-0 bg-white">
          <h3 className="font-bold text-slate-800 text-lg">แจ้งปัญหาใหม่</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="form-label">วันที่</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="form-input" />
            </div>
            <div>
              <label className="form-label">ผู้แจ้ง</label>
              <input type="text" value={reporter} onChange={(e) => setReporter(e.target.value)} className="form-input" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="form-label">Part No</label>
              <input type="text" value={partNo} onChange={(e) => setPartNo(e.target.value)} className="form-input" />
            </div>
            <div>
              <label className="form-label">Part Name</label>
              <input type="text" value={partName} onChange={(e) => setPartName(e.target.value)} className="form-input" />
            </div>
          </div>
          <div>
            <label className="form-label">พื้นที่พบปัญหา</label>
            <input type="text" value={area} onChange={(e) => setArea(e.target.value)} className="form-input" placeholder="เช่น จุดต่อ, สี, มิติ..." />
          </div>
          <div>
            <label className="form-label">รายละเอียดปัญหา</label>
            <textarea value={detail} onChange={(e) => setDetail(e.target.value)} className="form-input min-h-[100px]" placeholder="อธิบายปัญหาที่พบ..." />
          </div>
          <div>
            <label className="form-label">แนบรูป (ถ้ามี)</label>
            <div className="flex items-center gap-2 flex-wrap">
              {files.map((f, i) => (
                <div key={i} className="relative">
                  <img src={URL.createObjectURL(f)} alt="" className="w-16 h-16 object-cover rounded-lg border border-slate-200" />
                  <button
                    onClick={() => setFiles((prev) => prev.filter((_, idx) => idx !== i))}
                    className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
              <label className="w-16 h-16 rounded-lg border-2 border-dashed border-slate-300 flex items-center justify-center cursor-pointer hover:border-cyan-500 transition-colors">
                <ImageIcon className="w-5 h-5 text-slate-400" />
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    const newFiles = Array.from(e.target.files ?? []);
                    setFiles((prev) => [...prev, ...newFiles]);
                  }}
                />
              </label>
            </div>
          </div>
        </div>
        <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-2 sticky bottom-0 bg-white">
          <button onClick={onClose} className="btn-secondary">ยกเลิก</button>
          <button onClick={handleSave} disabled={saving} className="btn-primary">
            {saving ? 'กำลังบันทึก...' : 'บันทึกข้อมูล'}
          </button>
        </div>
      </div>
    </div>
  );
}
