import { useState, useEffect, useCallback } from 'react';
import { supabase, type ProblemHistory } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { todayISO, formatDate, createSignedAttachmentUrl } from '@/lib/utils';
import { exportProblemHistoryCSV, exportProblemHistoryPDF } from '@/lib/export';
import {
  History, Plus, X, Save, FileText, Download, Search, Edit3, Trash2,
  FileEdit, Send, FileSpreadsheet, FileDown,
} from 'lucide-react';

type DraftFilter = 'all' | 'published' | 'draft';

export default function ProblemHistoryTab() {
  const { profile } = useAuth();
  const { notify } = useToast();
  const isAdmin = profile?.role === 'admin';

  const [records, setRecords] = useState<ProblemHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingRecord, setEditingRecord] = useState<ProblemHistory | null>(null);
  const [search, setSearch] = useState('');
  const [draftFilter, setDraftFilter] = useState<DraftFilter>('all');

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('problem_history')
      .select('*')
      .order('record_date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(100);
    setRecords((data as ProblemHistory[]) ?? []);
  }, []);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  const filtered = records.filter((r) => {
    if (draftFilter === 'published' && r.status !== 'published') return false;
    if (draftFilter === 'draft' && r.status !== 'draft') return false;
    if (!search) return true;
    return (
      r.part_no.toLowerCase().includes(search.toLowerCase()) ||
      r.part_name.toLowerCase().includes(search.toLowerCase()) ||
      r.problem.toLowerCase().includes(search.toLowerCase()) ||
      r.customer.toLowerCase().includes(search.toLowerCase())
    );
  });

  async function handleDelete(recId: string) {
    if (!confirm('ยืนยันการลบประวัติปัญหานี้? ไม่สามารถกู้คืนได้')) return;
    const { error } = await supabase.from('problem_history').delete().eq('id', recId);
    if (error) {
      notify('error', 'ลบไม่สำเร็จ: ' + error.message);
      return;
    }
    notify('success', 'ลบประวัติปัญหาเรียบร้อย');
    load();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <History className="w-6 h-6 text-teal-600" />
            ประวัติปัญหา
          </h2>
          <p className="text-slate-500 text-sm mt-1">บันทึกประวัติปัญหาที่เกิดขึ้น พร้อมไฟล์แนบ</p>
        </div>
        <button onClick={() => { setEditingRecord(null); setShowForm(true); }} className="btn-primary">
          <Plus className="w-4 h-4" /> เพิ่มประวัติปัญหา
        </button>
      </div>

      {/* Search + filter + download */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="form-input pl-9"
            placeholder="ค้นหาด้วย Part No, ชื่อ, ปัญหา, ลูกค้า..."
          />
        </div>
        <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
          {(['all', 'published', 'draft'] as DraftFilter[]).map((f) => (
            <button
              key={f}
              onClick={() => setDraftFilter(f)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                draftFilter === f
                  ? 'bg-white text-cyan-600 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {f === 'all' ? 'ทั้งหมด' : f === 'published' ? 'เผยแพร่' : 'ฉบับร่าง'}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => { exportProblemHistoryCSV(filtered); notify('success', 'ดาวน์โหลดไฟล์ Excel เรียบร้อย'); }}
            disabled={filtered.length === 0}
            className="btn-secondary"
            title="ดาวน์โหลด Excel"
          >
            <FileSpreadsheet className="w-4 h-4" /> Excel
          </button>
          <button
            onClick={() => exportProblemHistoryPDF(filtered)}
            disabled={filtered.length === 0}
            className="btn-secondary"
            title="ดาวน์โหลด PDF"
          >
            <FileDown className="w-4 h-4" /> PDF
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-400">กำลังโหลด...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-slate-400">ยังไม่มีประวัติปัญหา</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-600 text-xs uppercase tracking-wider">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold">วันที่</th>
                  <th className="text-left px-4 py-3 font-semibold">Part No</th>
                  <th className="text-left px-4 py-3 font-semibold">Part Name</th>
                  <th className="text-left px-4 py-3 font-semibold">ลูกค้า</th>
                  <th className="text-left px-4 py-3 font-semibold">ปัญหา</th>
                  <th className="text-left px-4 py-3 font-semibold">รายละเอียด</th>
                  <th className="text-left px-4 py-3 font-semibold">การแก้ไข</th>
                  <th className="text-left px-4 py-3 font-semibold">ไฟล์</th>
                  <th className="text-left px-4 py-3 font-semibold">ผู้บันทึก</th>
                  <th className="text-left px-4 py-3 font-semibold">สถานะ</th>
                  <th className="text-left px-4 py-3 font-semibold">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((r) => (
                  <ProblemRow
                    key={r.id}
                    record={r}
                    canEdit={isAdmin || r.user_id === profile?.id}
                    canDelete={isAdmin || r.user_id === profile?.id}
                    onEdit={() => { setEditingRecord(r); setShowForm(true); }}
                    onDelete={() => handleDelete(r.id)}
                    onExportCSV={() => { exportProblemHistoryCSV([r]); notify('success', 'ดาวน์โหลดไฟล์ Excel เรียบร้อย'); }}
                    onExportPDF={() => exportProblemHistoryPDF([r])}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showForm && (
        <ProblemForm
          onClose={() => { setShowForm(false); setEditingRecord(null); }}
          onSaved={() => {
            setShowForm(false);
            setEditingRecord(null);
            load();
          }}
          profile={profile!}
          editingRecord={editingRecord}
        />
      )}
    </div>
  );
}

function ProblemRow({
  record,
  canEdit,
  canDelete,
  onEdit,
  onDelete,
  onExportCSV,
  onExportPDF,
}: {
  record: ProblemHistory;
  canEdit: boolean;
  canDelete: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onExportCSV: () => void;
  onExportPDF: () => void;
}) {
  const [urls, setUrls] = useState<string[]>([]);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      const result: string[] = [];
      for (const p of record.file_paths ?? []) {
        const u = await createSignedAttachmentUrl(p);
        if (u && active) result.push(u);
      }
      if (active) setUrls(result);
    })();
    return () => { active = false; };
  }, [record.file_paths]);

  return (
    <tr className="hover:bg-slate-50">
      <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{formatDate(record.record_date)}</td>
      <td className="px-4 py-3 font-medium text-slate-800">{record.part_no}</td>
      <td className="px-4 py-3 text-slate-600">{record.part_name}</td>
      <td className="px-4 py-3 text-slate-600">{record.customer}</td>
      <td className="px-4 py-3 text-slate-700 max-w-[200px] truncate">{record.problem}</td>
      <td className="px-4 py-3 text-slate-500 max-w-[200px]">
        {record.problem_detail && (
          <>
            <span className={expanded ? '' : 'truncate block'}>{record.problem_detail}</span>
            <button onClick={() => setExpanded(!expanded)} className="text-xs text-cyan-600 hover:underline">
              {expanded ? 'ย่อ' : 'อ่านเพิ่ม'}
            </button>
          </>
        )}
      </td>
      <td className="px-4 py-3 text-slate-500 max-w-[200px] truncate">{record.correction ?? '-'}</td>
      <td className="px-4 py-3">
        {urls.length > 0 ? (
          <div className="flex gap-1">
            {urls.map((u, i) => (
              <a key={i} href={u} target="_blank" rel="noreferrer" className="text-cyan-600 hover:text-cyan-700">
                <FileText className="w-4 h-4" />
              </a>
            ))}
          </div>
        ) : (
          <span className="text-slate-300">-</span>
        )}
      </td>
      <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{record.user_name}</td>
      <td className="px-4 py-3">
        {record.status === 'draft' ? (
          <span className="badge bg-amber-100 text-amber-700">ฉบับร่าง</span>
        ) : (
          <span className="badge bg-emerald-100 text-emerald-700">เผยแพร่</span>
        )}
      </td>
      <td className="px-4 py-3">
        <div className="flex gap-1">
          {canEdit && (
            <button
              onClick={onEdit}
              className="p-1.5 text-cyan-500 hover:text-cyan-700 hover:bg-cyan-50 rounded-lg transition-colors"
              title="แก้ไข"
            >
              <Edit3 className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={onExportCSV}
            className="p-1.5 text-emerald-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors"
            title="ดาวน์โหลด Excel รายการนี้"
          >
            <FileSpreadsheet className="w-4 h-4" />
          </button>
          <button
            onClick={onExportPDF}
            className="p-1.5 text-cyan-500 hover:text-cyan-700 hover:bg-cyan-50 rounded-lg transition-colors"
            title="ดาวน์โหลด PDF รายการนี้"
          >
            <FileDown className="w-4 h-4" />
          </button>
          {canDelete && (
            <button
              onClick={onDelete}
              className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              title="ลบ"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

function ProblemForm({
  onClose,
  onSaved,
  profile,
  editingRecord,
}: {
  onClose: () => void;
  onSaved: () => void;
  profile: { id: string; full_name: string };
  editingRecord: ProblemHistory | null;
}) {
  const { notify } = useToast();
  const [date, setDate] = useState(editingRecord?.record_date ?? todayISO());
  const [partName, setPartName] = useState(editingRecord?.part_name ?? '');
  const [partNo, setPartNo] = useState(editingRecord?.part_no ?? '');
  const [customer, setCustomer] = useState(editingRecord?.customer ?? '');
  const [problem, setProblem] = useState(editingRecord?.problem ?? '');
  const [problemDetail, setProblemDetail] = useState(editingRecord?.problem_detail ?? '');
  const [correction, setCorrection] = useState(editingRecord?.correction ?? '');
  const [files, setFiles] = useState<File[]>([]);
  const [existingFilePaths, setExistingFilePaths] = useState<string[]>(editingRecord?.file_paths ?? []);
  const [saving, setSaving] = useState(false);

  async function handleSave(publish: boolean) {
    if (publish && (!partNo.trim() || !partName.trim() || !customer.trim() || !problem.trim())) {
      notify('error', 'กรุณากรอกข้อมูลให้ครบ (Part No, Part Name, ลูกค้า, ปัญหา)');
      return;
    }
    setSaving(true);

    let filePaths = [...existingFilePaths];

    // Upload new files
    for (const f of files) {
      const ext = f.name.split('.').pop();
      const path = `${profile.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error } = await supabase.storage.from('attachments').upload(path, f);
      if (error) {
        notify('error', 'อัปโหลดไฟล์ไม่สำเร็จ: ' + error.message);
        setSaving(false);
        return;
      }
      filePaths.push(path);
    }

    const status = publish ? 'published' : 'draft';

    if (editingRecord) {
      // Update existing record
      const { error } = await supabase
        .from('problem_history')
        .update({
          record_date: date,
          part_name: partName.trim() || null,
          part_no: partNo.trim() || null,
          customer: customer.trim() || null,
          problem: problem.trim() || null,
          problem_detail: problemDetail.trim() || null,
          correction: correction.trim() || null,
          file_paths: filePaths,
          status,
        })
        .eq('id', editingRecord.id);
      if (error) {
        notify('error', 'บันทึกไม่สำเร็จ: ' + error.message);
        setSaving(false);
        return;
      }
      notify('success', publish ? 'บันทึกและเผยแพร่เรียบร้อย' : 'บันทึกเป็นฉบับร่างเรียบร้อย');
      onSaved();
    } else {
      // Insert new record
      const { error } = await supabase.from('problem_history').insert({
        record_date: date,
        part_name: partName.trim() || null,
        part_no: partNo.trim() || null,
        customer: customer.trim() || null,
        problem: problem.trim() || null,
        problem_detail: problemDetail.trim() || null,
        correction: correction.trim() || null,
        file_paths: filePaths,
        user_id: profile.id,
        user_name: profile.full_name,
        status,
      });
      if (error) {
        notify('error', 'บันทึกไม่สำเร็จ: ' + error.message);
        setSaving(false);
        return;
      }
      notify('success', publish ? 'บันทึกและเผยแพร่เรียบร้อย' : 'บันทึกเป็นฉบับร่างเรียบร้อย');
      onSaved();
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 sticky top-0 bg-white z-10">
          <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
            {editingRecord ? <FileEdit className="w-5 h-5 text-teal-600" /> : <Plus className="w-5 h-5 text-teal-600" />}
            {editingRecord ? 'แก้ไขประวัติปัญหา' : 'เพิ่มประวัติปัญหา'}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-6 space-y-4">
          {editingRecord?.status === 'draft' && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-2.5 text-sm text-amber-700">
              นี่คือฉบับร่าง กรุณากรอกข้อมูลให้ครบและกด "เผยแพร่" เพื่อบันทึกขั้นต่ำ
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="form-label">วันที่</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="form-input" />
            </div>
            <div>
              <label className="form-label">ลูกค้า</label>
              <input type="text" value={customer} onChange={(e) => setCustomer(e.target.value)} className="form-input" />
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
            <label className="form-label">ปัญหา</label>
            <input type="text" value={problem} onChange={(e) => setProblem(e.target.value)} className="form-input" placeholder="สรุปปัญหา" />
          </div>
          <div>
            <label className="form-label">รายละเอียดปัญหา</label>
            <textarea value={problemDetail} onChange={(e) => setProblemDetail(e.target.value)} className="form-input min-h-[80px]" />
          </div>
          <div>
            <label className="form-label">การแก้ไข</label>
            <textarea value={correction} onChange={(e) => setCorrection(e.target.value)} className="form-input min-h-[80px]" />
          </div>
          <div>
            <label className="form-label">แนบไฟล์</label>
            <div className="flex items-center gap-2 flex-wrap">
              {existingFilePaths.length > 0 && (
                <div className="text-xs text-slate-500 mb-1 w-full">
                  ไฟล์ที่แนบแล้ว: {existingFilePaths.length} ไฟล์
                </div>
              )}
              {files.map((f, i) => (
                <div key={i} className="flex items-center gap-1.5 bg-slate-100 rounded-lg px-3 py-1.5 text-sm text-slate-600">
                  <FileText className="w-4 h-4 text-slate-400" />
                  <span className="max-w-[120px] truncate">{f.name}</span>
                  <button onClick={() => setFiles((prev) => prev.filter((_, idx) => idx !== i))} className="text-red-400 hover:text-red-600">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
              <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border-2 border-dashed border-slate-300 cursor-pointer hover:border-cyan-500 transition-colors text-sm text-slate-500">
                <Download className="w-4 h-4" /> เพิ่มไฟล์
                <input
                  type="file"
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
          <button
            onClick={() => handleSave(false)}
            disabled={saving}
            className="btn-secondary !bg-amber-100 !text-amber-700 !border-amber-300 hover:!bg-amber-200"
          >
            <FileEdit className="w-4 h-4" />
            {saving ? 'กำลังบันทึก...' : 'บันทึกฉบับร่าง'}
          </button>
          <button onClick={() => handleSave(true)} disabled={saving} className="btn-primary">
            <Send className="w-4 h-4" />
            {saving ? 'กำลังบันทึก...' : 'เผยแพร่'}
          </button>
        </div>
      </div>
    </div>
  );
}
