import { useState, useEffect, useCallback } from 'react';
import { supabase, type Part, type InspectionItem, type InspectionRecord } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { getStandardImageUrl, todayISO, formatDate } from '@/lib/utils';
import { exportInspectionCSV, exportInspectionPDF, exportSingleInspectionCSV, exportSingleInspectionPDF, type InspectionResultRow } from '@/lib/export';
import {
  ClipboardCheck, Plus, Trash2, Search, CheckCircle2, Clock, Image as ImageIcon,
  X, Save, FileText, ChevronDown, ChevronRight, Settings, ScanLine,
  FileSpreadsheet, FileDown, AlertTriangle, Download, CalendarDays,
} from 'lucide-react';
import InspectionItemManager from '@/components/InspectionItemManager';
import BarcodeScanner from '@/components/BarcodeScanner';

type ResultMap = Record<string, string>;

export default function InspectionTab() {
  const { profile } = useAuth();
  const { notify } = useToast();
  const isAdmin = profile?.role === 'admin';

  const [parts, setParts] = useState<Part[]>([]);
  const [records, setRecords] = useState<InspectionRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // form state
  const [date, setDate] = useState(todayISO());
  const [partQuery, setPartQuery] = useState('');
  const [selectedPart, setSelectedPart] = useState<Part | null>(null);
  const [items, setItems] = useState<InspectionItem[]>([]);
  const [results, setResults] = useState<ResultMap>({});
  const [saving, setSaving] = useState(false);
  const [showPartDropdown, setShowPartDropdown] = useState(false);
  const [showItemManager, setShowItemManager] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [expandedRecord, setExpandedRecord] = useState<string | null>(null);
  const [recordResults, setRecordResults] = useState<Record<string, InspectionResultRow[]>>({});
  const [exporting, setExporting] = useState(false);
  const [rangeFrom, setRangeFrom] = useState(todayISO());
  const [rangeTo, setRangeTo] = useState(todayISO());
  const [exportingRange, setExportingRange] = useState(false);

  const loadParts = useCallback(async () => {
    const { data } = await supabase.from('parts').select('*').order('part_no');
    setParts((data as Part[]) ?? []);
  }, []);

  const loadRecords = useCallback(async () => {
    const { data } = await supabase
      .from('inspection_records')
      .select('*')
      .order('record_date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(100);
    setRecords((data as InspectionRecord[]) ?? []);
  }, []);

  useEffect(() => {
    Promise.all([loadParts(), loadRecords()]).finally(() => setLoading(false));
  }, [loadParts, loadRecords]);

  // when part selected, load items
  useEffect(() => {
    if (!selectedPart) {
      setItems([]);
      return;
    }
    supabase
      .from('inspection_items')
      .select('*')
      .eq('part_id', selectedPart.id)
      .order('sort_order')
      .then(({ data }) => setItems((data as InspectionItem[]) ?? []));
    setResults({});
  }, [selectedPart]);

  const filteredParts = partQuery
    ? parts.filter(
        (p) =>
          p.part_no.toLowerCase().includes(partQuery.toLowerCase()) ||
          p.part_name.toLowerCase().includes(partQuery.toLowerCase())
      )
    : parts;

  function handleScanResult(scanned: string) {
    setShowScanner(false);
    setPartQuery(scanned);
    setShowPartDropdown(true);
    // Try to auto-match the scanned value to a part
    const matched = parts.find(
      (p) => p.part_no.toLowerCase() === scanned.toLowerCase() || p.part_name.toLowerCase() === scanned.toLowerCase()
    );
    if (matched) {
      setSelectedPart(matched);
      setPartQuery(`${matched.part_no} — ${matched.part_name}`);
      setShowPartDropdown(false);
      notify('success', `พบชิ้นงาน: ${matched.part_no}`);
    } else {
      notify('info', `ไม่พบชิ้นงานที่ตรงกับ "${scanned}" กรุณาเลือกจากรายการ`);
    }
  }

  async function handleSave() {
    if (!selectedPart) {
      notify('error', 'กรุณาเลือกชิ้นงาน');
      return;
    }
    if (items.length === 0) {
      notify('error', 'ยังไม่มีหัวข้อการตรวจสอบสำหรับชิ้นงานนี้ โปรดติดต่อ Admin เพื่อเพิ่มหัวข้อ');
      return;
    }
    const missing = items.find((it) => !results[it.id] || results[it.id].trim() === '');
    if (missing) {
      notify('error', `กรุณากรอกผลการตรวจสอบ: ${missing.label}`);
      return;
    }

    setSaving(true);
    const { data: rec, error: recErr } = await supabase
      .from('inspection_records')
      .insert({
        record_date: date,
        part_id: selectedPart.id,
        part_no: selectedPart.part_no,
        part_name: selectedPart.part_name,
        user_id: profile!.id,
        user_name: profile!.full_name,
      })
      .select()
      .single();
    if (recErr) {
      notify('error', 'บันทึกไม่สำเร็จ: ' + recErr.message);
      setSaving(false);
      return;
    }

    const resultRows = items.map((it) => ({
      record_id: rec.id,
      item_id: it.id,
      item_label: it.label,
      value: results[it.id],
    }));
    const { error: resErr } = await supabase.from('inspection_results').insert(resultRows);
    if (resErr) {
      notify('error', 'บันทึกผลการตรวจไม่สำเร็จ: ' + resErr.message);
      setSaving(false);
      return;
    }

    notify('success', 'บันทึกข้อมูลการตรวจสอบเรียบร้อยแล้ว');
    setResults({});
    setSaving(false);
    loadRecords();
  }

  async function handleApprove(recId: string) {
    const { error } = await supabase
      .from('inspection_records')
      .update({ approved: true, approved_by: profile!.id, approved_at: new Date().toISOString() })
      .eq('id', recId);
    if (error) {
      notify('error', 'อนุมัติไม่สำเร็จ: ' + error.message);
      return;
    }
    notify('success', 'อนุมัติการตรวจสอบเรียบร้อย');
    loadRecords();
  }

  async function handleSetSummary(recId: string, summary: 'OK' | 'NG') {
    const { error } = await supabase
      .from('inspection_records')
      .update({ result_summary: summary })
      .eq('id', recId);
    if (error) {
      notify('error', 'บันทึกสรุปผลไม่สำเร็จ: ' + error.message);
      return;
    }
    notify('success', `สรุปผลการตรวจสอบ: ${summary}`);
    loadRecords();
  }

  async function handleDelete(recId: string) {
    if (!confirm('ยืนยันการลบผลการตรวจสอบนี้? ไม่สามารถกู้คืนได้')) return;
    const { error } = await supabase.from('inspection_records').delete().eq('id', recId);
    if (error) {
      notify('error', 'ลบไม่สำเร็จ: ' + error.message);
      return;
    }
    notify('success', 'ลบผลการตรวจสอบเรียบร้อย');
    loadRecords();
  }

  async function toggleExpand(recId: string) {
    if (expandedRecord === recId) {
      setExpandedRecord(null);
      return;
    }
    setExpandedRecord(recId);
    if (!recordResults[recId]) {
      const { data } = await supabase
        .from('inspection_results')
        .select('item_label, value')
        .eq('record_id', recId);
      setRecordResults((prev) => ({ ...prev, [recId]: (data as InspectionResultRow[]) ?? [] }));
    }
  }

  async function handleExportCSV() {
    setExporting(true);
    // Load all results for current records
    const allResults: Record<string, InspectionResultRow[]> = {};
    for (const rec of records) {
      if (!recordResults[rec.id]) {
        const { data } = await supabase
          .from('inspection_results')
          .select('item_label, value')
          .eq('record_id', rec.id);
        allResults[rec.id] = (data as InspectionResultRow[]) ?? [];
      } else {
        allResults[rec.id] = recordResults[rec.id];
      }
    }
    setRecordResults((prev) => ({ ...prev, ...allResults }));
    exportInspectionCSV(records, allResults);
    setExporting(false);
    notify('success', 'ดาวน์โหลดไฟล์ Excel เรียบร้อย');
  }

  async function handleExportPDF() {
    setExporting(true);
    const allResults: Record<string, InspectionResultRow[]> = {};
    for (const rec of records) {
      if (!recordResults[rec.id]) {
        const { data } = await supabase
          .from('inspection_results')
          .select('item_label, value')
          .eq('record_id', rec.id);
        allResults[rec.id] = (data as InspectionResultRow[]) ?? [];
      } else {
        allResults[rec.id] = recordResults[rec.id];
      }
    }
    setRecordResults((prev) => ({ ...prev, ...allResults }));
    exportInspectionPDF(records, allResults);
    setExporting(false);
  }

  async function handleExportSingleCSV(rec: InspectionRecord) {
    let results = recordResults[rec.id];
    if (!results) {
      const { data } = await supabase
        .from('inspection_results')
        .select('item_label, value')
        .eq('record_id', rec.id);
      results = (data as InspectionResultRow[]) ?? [];
      setRecordResults((prev) => ({ ...prev, [rec.id]: results! }));
    }
    exportSingleInspectionCSV(rec, results ?? []);
    notify('success', 'ดาวน์โหลดไฟล์ Excel เรียบร้อย');
  }

  async function handleExportSinglePDF(rec: InspectionRecord) {
    let results = recordResults[rec.id];
    if (!results) {
      const { data } = await supabase
        .from('inspection_results')
        .select('item_label, value')
        .eq('record_id', rec.id);
      results = (data as InspectionResultRow[]) ?? [];
      setRecordResults((prev) => ({ ...prev, [rec.id]: results! }));
    }
    exportSingleInspectionPDF(rec, results ?? []);
  }

  function setPresetRange(preset: 'today' | 'month' | 'year') {
    const now = new Date();
    if (preset === 'today') {
      const t = todayISO();
      setRangeFrom(t);
      setRangeTo(t);
    } else if (preset === 'month') {
      const first = new Date(now.getFullYear(), now.getMonth(), 1);
      const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      setRangeFrom(first.toISOString().slice(0, 10));
      setRangeTo(last.toISOString().slice(0, 10));
    } else {
      setRangeFrom(`${now.getFullYear()}-01-01`);
      setRangeTo(`${now.getFullYear()}-12-31`);
    }
  }

  async function loadRecordsByRange(from: string, to: string): Promise<InspectionRecord[]> {
    const { data } = await supabase
      .from('inspection_records')
      .select('*')
      .gte('record_date', from)
      .lte('record_date', to)
      .order('record_date', { ascending: false })
      .order('created_at', { ascending: false });
    return (data as InspectionRecord[]) ?? [];
  }

  async function handleExportRangeCSV() {
    if (rangeFrom > rangeTo) {
      notify('error', 'วันที่เริ่มต้นต้องไม่หลังวันที่สิ้นสุด');
      return;
    }
    setExportingRange(true);
    const rangeRecords = await loadRecordsByRange(rangeFrom, rangeTo);
    if (rangeRecords.length === 0) {
      notify('info', 'ไม่พบข้อมูลในช่วงเวลาที่เลือก');
      setExportingRange(false);
      return;
    }
    const allResults: Record<string, InspectionResultRow[]> = {};
    for (const rec of rangeRecords) {
      const { data } = await supabase
        .from('inspection_results')
        .select('item_label, value')
        .eq('record_id', rec.id);
      allResults[rec.id] = (data as InspectionResultRow[]) ?? [];
    }
    exportInspectionCSV(rangeRecords, allResults);
    setExportingRange(false);
    notify('success', `ดาวน์โหลด ${rangeRecords.length} รายการ เรียบร้อย`);
  }

  async function handleExportRangePDF() {
    if (rangeFrom > rangeTo) {
      notify('error', 'วันที่เริ่มต้นต้องไม่หลังวันที่สิ้นสุด');
      return;
    }
    setExportingRange(true);
    const rangeRecords = await loadRecordsByRange(rangeFrom, rangeTo);
    if (rangeRecords.length === 0) {
      notify('info', 'ไม่พบข้อมูลในช่วงเวลาที่เลือก');
      setExportingRange(false);
      return;
    }
    const allResults: Record<string, InspectionResultRow[]> = {};
    for (const rec of rangeRecords) {
      const { data } = await supabase
        .from('inspection_results')
        .select('item_label, value')
        .eq('record_id', rec.id);
      allResults[rec.id] = (data as InspectionResultRow[]) ?? [];
    }
    exportInspectionPDF(rangeRecords, allResults);
    setExportingRange(false);
  }

  const stdImg = getStandardImageUrl(selectedPart?.standard_image_path ?? null);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <ClipboardCheck className="w-6 h-6 text-cyan-600" />
            บันทึกการตรวจสอบชิ้นงาน
          </h2>
          <p className="text-slate-500 text-sm mt-1">บันทึกผลการตรวจสอบรายวัน พร้อมรูปมาตรฐานอัตโนมัติ</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCSV}
            disabled={exporting || records.length === 0}
            className="btn-secondary"
            title="ดาวน์โหลด Excel"
          >
            <FileSpreadsheet className="w-4 h-4" /> Excel
          </button>
          <button
            onClick={handleExportPDF}
            disabled={exporting || records.length === 0}
            className="btn-secondary"
            title="ดาวน์โหลด PDF"
          >
            <FileDown className="w-4 h-4" /> PDF
          </button>
          {isAdmin && (
            <button onClick={() => setShowItemManager(true)} className="btn-secondary">
              <Settings className="w-4 h-4" /> จัดการหัวข้อตรวจสอบ
            </button>
          )}
        </div>
      </div>

      {/* Download by date range */}
      <div className="card p-5">
        <div className="flex items-center gap-2 mb-4">
          <CalendarDays className="w-5 h-5 text-cyan-600" />
          <h3 className="font-semibold text-slate-800">ดาวน์โหลดตามช่วงเวลา</h3>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex gap-2">
            <button onClick={() => setPresetRange('today')} className="btn-secondary !py-1.5 text-sm">วันนี้</button>
            <button onClick={() => setPresetRange('month')} className="btn-secondary !py-1.5 text-sm">เดือนนี้</button>
            <button onClick={() => setPresetRange('year')} className="btn-secondary !py-1.5 text-sm">ปีนี้</button>
          </div>
          <div className="flex items-center gap-2">
            <div>
              <label className="text-xs text-slate-500 block mb-1">จากวันที่</label>
              <input type="date" value={rangeFrom} onChange={(e) => setRangeFrom(e.target.value)} className="form-input !py-1.5" />
            </div>
            <span className="text-slate-400 pb-1.5">—</span>
            <div>
              <label className="text-xs text-slate-500 block mb-1">ถึงวันที่</label>
              <input type="date" value={rangeTo} onChange={(e) => setRangeTo(e.target.value)} className="form-input !py-1.5" />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleExportRangeCSV}
              disabled={exportingRange}
              className="btn-secondary"
              title="ดาวน์โหลด Excel ตามช่วงเวลา"
            >
              <FileSpreadsheet className="w-4 h-4" /> Excel
            </button>
            <button
              onClick={handleExportRangePDF}
              disabled={exportingRange}
              className="btn-secondary"
              title="ดาวน์โหลด PDF ตามช่วงเวลา"
            >
              <FileDown className="w-4 h-4" /> PDF
            </button>
          </div>
        </div>
      </div>

      {/* Form */}
      <div className="card p-6">
        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div>
              <label className="form-label">วันที่ตรวจสอบ</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="form-input" />
            </div>

            {/* Part search + dropdown + scanner */}
            <div className="relative">
              <label className="form-label">Part No / Part Name</label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    value={partQuery}
                    onChange={(e) => {
                      setPartQuery(e.target.value);
                      setShowPartDropdown(true);
                    }}
                    onFocus={() => setShowPartDropdown(true)}
                    className="form-input pl-9"
                    placeholder="พิมพ์เพื่อค้นหา Part No..."
                  />
                </div>
                <button
                  onClick={() => setShowScanner(true)}
                  className="btn-secondary !px-3"
                  title="สแกน Barcode / QR Code"
                >
                  <ScanLine className="w-5 h-5 text-cyan-600" />
                </button>
              </div>
              {showPartDropdown && (
                <div className="absolute z-20 mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-lg max-h-60 overflow-y-auto">
                  {filteredParts.length === 0 && (
                    <div className="px-4 py-3 text-sm text-slate-400">ไม่พบชิ้นงาน</div>
                  )}
                  {filteredParts.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => {
                        setSelectedPart(p);
                        setPartQuery(`${p.part_no} — ${p.part_name}`);
                        setShowPartDropdown(false);
                      }}
                      className="w-full text-left px-4 py-2.5 hover:bg-cyan-50 border-b border-slate-100 last:border-0 transition-colors"
                    >
                      <div className="font-medium text-slate-800 text-sm">{p.part_no}</div>
                      <div className="text-xs text-slate-500">{p.part_name}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {selectedPart && (
              <div className="flex items-center gap-2 text-sm">
                <span className="badge bg-cyan-100 text-cyan-700">เลือกแล้ว</span>
                <span className="text-slate-600">{selectedPart.part_no} — {selectedPart.part_name}</span>
              </div>
            )}
          </div>

          {/* Standard image */}
          <div>
            <label className="form-label">รูปมาตรฐาน (Standard)</label>
            <div className="rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 aspect-video flex items-center justify-center overflow-hidden">
              {stdImg ? (
                <img src={stdImg} alt="Standard" className="w-full h-full object-contain" />
              ) : (
                <div className="text-center text-slate-400">
                  <ImageIcon className="w-10 h-10 mx-auto mb-2" />
                  <p className="text-sm">{selectedPart ? 'ยังไม่มีรูปมาตรฐานสำหรับชิ้นงานนี้' : 'เลือก Part No เพื่อแสดงรูป'}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Inspection items */}
        {selectedPart && (
          <div className="mt-6">
            <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
              <FileText className="w-4 h-4 text-cyan-600" />
              หัวข้อการตรวจสอบ ({items.length})
            </h3>
            {items.length === 0 ? (
              <div className="text-center py-8 bg-slate-50 rounded-xl border border-slate-200">
                <p className="text-slate-400 text-sm">
                  ยังไม่มีหัวข้อการตรวจสอบ {isAdmin ? 'เพิ่มหัวข้อได้จากปุ่ม "จัดการหัวข้อตรวจสอบ"' : 'โปรดติดต่อ Admin'}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {items.map((item) => (
                  <div key={item.id} className="grid md:grid-cols-3 gap-3 items-start">
                    <div className="md:col-span-1">
                      <label className="text-sm font-medium text-slate-700">{item.label}</label>
                      <span className="block text-xs text-slate-400 mt-0.5">
                        {inputTypeLabel(item.input_type)}
                        {item.options.length > 0 && `: ${item.options.join(', ')}`}
                      </span>
                    </div>
                    <div className="md:col-span-2">
                      <ItemInput item={item} value={results[item.id] ?? ''} onChange={(v) => setResults((prev) => ({ ...prev, [item.id]: v }))} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="mt-6 flex justify-end">
          <button onClick={handleSave} disabled={saving} className="btn-primary">
            <Save className="w-4 h-4" />
            {saving ? 'กำลังบันทึก...' : 'บันทึกข้อมูล'}
          </button>
        </div>
      </div>

      {/* Records list */}
      <div className="card overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100">
          <h3 className="font-semibold text-slate-800">ประวัติการตรวจสอบล่าสุด</h3>
        </div>
        {loading ? (
          <div className="p-8 text-center text-slate-400">กำลังโหลด...</div>
        ) : records.length === 0 ? (
          <div className="p-8 text-center text-slate-400">ยังไม่มีบันทึกการตรวจสอบ</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {records.map((rec) => (
              <div key={rec.id}>
                <div className="flex items-center gap-3 px-6 py-3 hover:bg-slate-50 transition-colors flex-wrap">
                  <button onClick={() => toggleExpand(rec.id)} className="text-slate-400 hover:text-cyan-600">
                    {expandedRecord === rec.id ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-slate-800 text-sm">{rec.part_no}</span>
                      <span className="text-slate-400 text-sm">— {rec.part_name}</span>
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      {formatDate(rec.record_date)} · โดย {rec.user_name}
                    </div>
                  </div>

                  {/* Result summary badge */}
                  {rec.result_summary && (
                    <span
                      className={`badge ${
                        rec.result_summary === 'OK'
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {rec.result_summary}
                    </span>
                  )}

                  {rec.approved ? (
                    <span className="badge bg-emerald-100 text-emerald-700">
                      <CheckCircle2 className="w-3 h-3" /> อนุมัติแล้ว
                    </span>
                  ) : (
                    <span className="badge bg-amber-100 text-amber-700">
                      <Clock className="w-3 h-3" /> รออนุมัติ
                    </span>
                  )}

                  {/* OK / NG summary buttons */}
                  <div className="flex gap-1">
                    <button
                      onClick={() => handleSetSummary(rec.id, 'OK')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-all ${
                        rec.result_summary === 'OK'
                          ? 'bg-emerald-500 text-white border-emerald-500'
                          : 'bg-white text-emerald-600 border-emerald-200 hover:bg-emerald-50'
                      }`}
                    >
                      OK
                    </button>
                    <button
                      onClick={() => handleSetSummary(rec.id, 'NG')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-all ${
                        rec.result_summary === 'NG'
                          ? 'bg-red-500 text-white border-red-500'
                          : 'bg-white text-red-600 border-red-200 hover:bg-red-50'
                      }`}
                    >
                      NG
                    </button>
                  </div>

                  {isAdmin && !rec.approved && (
                    <button onClick={() => handleApprove(rec.id)} className="btn-primary !py-1.5 !px-3 text-sm">
                      Approve
                    </button>
                  )}

                  {isAdmin && (
                    <button
                      onClick={() => handleDelete(rec.id)}
                      className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="ลบผลการตรวจสอบ"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}

                  {/* Per-record download buttons */}
                  <div className="flex gap-1">
                    <button
                      onClick={() => handleExportSingleCSV(rec)}
                      className="p-1.5 text-emerald-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors"
                      title="ดาวน์โหลด Excel รายการนี้"
                    >
                      <FileSpreadsheet className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleExportSinglePDF(rec)}
                      className="p-1.5 text-cyan-500 hover:text-cyan-700 hover:bg-cyan-50 rounded-lg transition-colors"
                      title="ดาวน์โหลด PDF รายการนี้"
                    >
                      <FileDown className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                {expandedRecord === rec.id && recordResults[rec.id] && (
                  <div className="px-6 pb-4 pl-12">
                    <div className="bg-slate-50 rounded-xl p-4 space-y-2">
                      {recordResults[rec.id].map((r, i) => (
                        <div key={i} className="flex gap-2 text-sm">
                          <span className="text-slate-500 min-w-[160px]">{r.item_label}:</span>
                          <span className="font-medium text-slate-800">{r.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {showItemManager && (
        <InspectionItemManager parts={parts} onClose={() => { setShowItemManager(false); loadParts(); }} />
      )}

      {showScanner && (
        <BarcodeScanner onScan={handleScanResult} onClose={() => setShowScanner(false)} />
      )}
    </div>
  );
}

function inputTypeLabel(t: string): string {
  const map: Record<string, string> = {
    text: 'กรอกข้อความ',
    number: 'กรอกตัวเลข',
    pass_fail: 'Pass / Fail',
    ok_ng: 'OK / NG',
    option: 'เลือกจากตัวเลือก',
  };
  return map[t] ?? t;
}

function ItemInput({
  item,
  value,
  onChange,
}: {
  item: InspectionItem;
  value: string;
  onChange: (v: string) => void;
}) {
  if (item.input_type === 'pass_fail') {
    return (
      <div className="flex gap-2">
        {['Pass', 'Fail'].map((opt) => (
          <button
            key={opt}
            onClick={() => onChange(opt)}
            className={`px-4 py-2 rounded-lg text-sm font-medium border transition-all ${
              value === opt
                ? opt === 'Pass'
                  ? 'bg-emerald-500 text-white border-emerald-500'
                  : 'bg-red-500 text-white border-red-500'
                : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
            }`}
          >
            {opt}
          </button>
        ))}
      </div>
    );
  }
  if (item.input_type === 'ok_ng') {
    return (
      <div className="flex gap-2">
        {['OK', 'NG'].map((opt) => (
          <button
            key={opt}
            onClick={() => onChange(opt)}
            className={`px-4 py-2 rounded-lg text-sm font-medium border transition-all ${
              value === opt
                ? opt === 'OK'
                  ? 'bg-emerald-500 text-white border-emerald-500'
                  : 'bg-red-500 text-white border-red-500'
                : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
            }`}
          >
            {opt}
          </button>
        ))}
      </div>
    );
  }
  if (item.input_type === 'option') {
    return (
      <select value={value} onChange={(e) => onChange(e.target.value)} className="form-input">
        <option value="">— เลือก —</option>
        {item.options.map((opt) => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
    );
  }
  return (
    <input
      type={item.input_type === 'number' ? 'number' : 'text'}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="form-input"
      placeholder={inputTypeLabel(item.input_type)}
    />
  );
}
