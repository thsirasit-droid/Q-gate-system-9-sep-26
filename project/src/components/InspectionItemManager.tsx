import { useState, useEffect } from 'react';
import { supabase, type Part, type InspectionItem } from '@/lib/supabase';
import { useToast } from '@/context/ToastContext';
import { getStandardImageUrl } from '@/lib/utils';
import { X, Plus, Trash2, Upload, GripVertical, Package } from 'lucide-react';

const INPUT_TYPES = [
  { value: 'text', label: 'กรอกข้อความ' },
  { value: 'number', label: 'กรอกตัวเลข' },
  { value: 'pass_fail', label: 'Pass / Fail' },
  { value: 'ok_ng', label: 'OK / NG' },
  { value: 'option', label: 'เลือกจากตัวเลือก' },
] as const;

export default function InspectionItemManager({
  parts,
  onClose,
}: {
  parts: Part[];
  onClose: () => void;
}) {
  const { notify } = useToast();
  const [tab, setTab] = useState<'items' | 'parts'>('items');
  const [selectedPartId, setSelectedPartId] = useState<string>(parts[0]?.id ?? '');
  const [items, setItems] = useState<InspectionItem[]>([]);
  const [loading, setLoading] = useState(false);

  // new item form
  const [newLabel, setNewLabel] = useState('');
  const [newType, setNewType] = useState<string>('text');
  const [newOptions, setNewOptions] = useState('');

  // new part form
  const [newPartNo, setNewPartNo] = useState('');
  const [newPartName, setNewPartName] = useState('');
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!selectedPartId) return;
    setLoading(true);
    supabase
      .from('inspection_items')
      .select('*')
      .eq('part_id', selectedPartId)
      .order('sort_order')
      .then(({ data }) => {
        setItems((data as InspectionItem[]) ?? []);
        setLoading(false);
      });
  }, [selectedPartId]);

  async function addItem() {
    if (!newLabel.trim()) {
      notify('error', 'กรุณากรอกชื่อหัวข้อ');
      return;
    }
    const opts =
      newType === 'option' && newOptions.trim()
        ? newOptions.split(',').map((s) => s.trim()).filter(Boolean)
        : [];
    const { data, error } = await supabase
      .from('inspection_items')
      .insert({
        part_id: selectedPartId,
        label: newLabel.trim(),
        input_type: newType,
        options: opts,
        sort_order: items.length,
      })
      .select()
      .single();
    if (error) {
      notify('error', 'เพิ่มหัวข้อไม่สำเร็จ: ' + error.message);
      return;
    }
    setItems((prev) => [...prev, data as InspectionItem]);
    setNewLabel('');
    setNewOptions('');
    notify('success', 'เพิ่มหัวข้อการตรวจสอบแล้ว');
  }

  async function deleteItem(id: string) {
    const { error } = await supabase.from('inspection_items').delete().eq('id', id);
    if (error) {
      notify('error', 'ลบไม่สำเร็จ: ' + error.message);
      return;
    }
    setItems((prev) => prev.filter((i) => i.id !== id));
    notify('success', 'ลบหัวข้อแล้ว');
  }

  async function addPart() {
    if (!newPartNo.trim() || !newPartName.trim()) {
      notify('error', 'กรุณากรอก Part No และ Part Name');
      return;
    }
    const { error } = await supabase.from('parts').insert({
      part_no: newPartNo.trim(),
      part_name: newPartName.trim(),
    });
    if (error) {
      notify('error', 'เพิ่มชิ้นงานไม่สำเร็จ: ' + error.message);
      return;
    }
    notify('success', 'เพิ่มชิ้นงานใหม่แล้ว');
    setNewPartNo('');
    setNewPartName('');
    // refresh parts via onClose reload? We'll just reload page parts through callback
    window.dispatchEvent(new Event('parts-updated'));
  }

  async function uploadStandard(part: Part, file: File) {
    setUploading(true);
    const ext = file.name.split('.').pop();
    const path = `${part.id}/standard.${ext}`;
    const { error: upErr } = await supabase.storage.from('standards').upload(path, file, { upsert: true });
    if (upErr) {
      notify('error', 'อัปโหลดรูปไม่สำเร็จ: ' + upErr.message);
      setUploading(false);
      return;
    }
    const { error: updErr } = await supabase.from('parts').update({ standard_image_path: path }).eq('id', part.id);
    if (updErr) {
      notify('error', 'บันทึก path ไม่สำเร็จ: ' + updErr.message);
      setUploading(false);
      return;
    }
    notify('success', 'อัปโหลดรูปมาตรฐานแล้ว');
    setUploading(false);
    window.dispatchEvent(new Event('parts-updated'));
  }

  const selectedPart = parts.find((p) => p.id === selectedPartId) ?? null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h3 className="font-bold text-slate-800 text-lg">จัดการหัวข้อตรวจสอบและชิ้นงาน</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex gap-2 px-6 pt-4">
          <button
            onClick={() => setTab('items')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === 'items' ? 'bg-cyan-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            หัวข้อการตรวจสอบ
          </button>
          <button
            onClick={() => setTab('parts')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === 'parts' ? 'bg-cyan-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            ชิ้นงาน + รูปมาตรฐาน
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {tab === 'items' && (
            <div className="space-y-4">
              <div>
                <label className="form-label">เลือกชิ้นงาน</label>
                <select
                  value={selectedPartId}
                  onChange={(e) => setSelectedPartId(e.target.value)}
                  className="form-input"
                >
                  <option value="">— เลือก —</option>
                  {parts.map((p) => (
                    <option key={p.id} value={p.id}>{p.part_no} — {p.part_name}</option>
                  ))}
                </select>
              </div>

              {selectedPartId && (
                <>
                  <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                    <h4 className="text-sm font-semibold text-slate-700 mb-3">เพิ่มหัวข้อใหม่</h4>
                    <div className="grid md:grid-cols-2 gap-3">
                      <input
                        type="text"
                        value={newLabel}
                        onChange={(e) => setNewLabel(e.target.value)}
                        className="form-input"
                        placeholder="ชื่อหัวข้อการตรวจสอบ"
                      />
                      <select value={newType} onChange={(e) => setNewType(e.target.value)} className="form-input">
                        {INPUT_TYPES.map((t) => (
                          <option key={t.value} value={t.value}>{t.label}</option>
                        ))}
                      </select>
                      {newType === 'option' && (
                        <input
                          type="text"
                          value={newOptions}
                          onChange={(e) => setNewOptions(e.target.value)}
                          className="form-input md:col-span-2"
                          placeholder="ตัวเลือกคั่นด้วยจุลภาค เช่น ดี, พอใช้, ไม่ดี"
                        />
                      )}
                    </div>
                    <button onClick={addItem} className="btn-primary mt-3 !py-2 text-sm">
                      <Plus className="w-4 h-4" /> เพิ่มหัวข้อ
                    </button>
                  </div>

                  {loading ? (
                    <p className="text-center text-slate-400 py-4">กำลังโหลด...</p>
                  ) : items.length === 0 ? (
                    <p className="text-center text-slate-400 py-4">ยังไม่มีหัวข้อการตรวจสอบ</p>
                  ) : (
                    <div className="space-y-2">
                      {items.map((item, idx) => (
                        <div key={item.id} className="flex items-center gap-3 bg-white border border-slate-200 rounded-xl px-4 py-2.5">
                          <GripVertical className="w-4 h-4 text-slate-300" />
                          <span className="text-xs text-slate-400 w-6">{idx + 1}</span>
                          <div className="flex-1">
                            <div className="text-sm font-medium text-slate-800">{item.label}</div>
                            <div className="text-xs text-slate-500">
                              {INPUT_TYPES.find((t) => t.value === item.input_type)?.label}
                              {item.options.length > 0 && ` · ${item.options.join(', ')}`}
                            </div>
                          </div>
                          <button onClick={() => deleteItem(item.id)} className="text-red-400 hover:text-red-600">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {tab === 'parts' && (
            <div className="space-y-4">
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                <h4 className="text-sm font-semibold text-slate-700 mb-3">เพิ่มชิ้นงานใหม่</h4>
                <div className="grid md:grid-cols-2 gap-3">
                  <input
                    type="text"
                    value={newPartNo}
                    onChange={(e) => setNewPartNo(e.target.value)}
                    className="form-input"
                    placeholder="Part No"
                  />
                  <input
                    type="text"
                    value={newPartName}
                    onChange={(e) => setNewPartName(e.target.value)}
                    className="form-input"
                    placeholder="Part Name"
                  />
                </div>
                <button onClick={addPart} className="btn-primary mt-3 !py-2 text-sm">
                  <Plus className="w-4 h-4" /> เพิ่มชิ้นงาน
                </button>
              </div>

              <div className="space-y-3">
                {parts.map((p) => {
                  const img = getStandardImageUrl(p.standard_image_path);
                  return (
                    <div key={p.id} className="flex items-start gap-4 bg-white border border-slate-200 rounded-xl p-4">
                      <div className="w-24 h-24 rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-center overflow-hidden flex-shrink-0">
                        {img ? (
                          <img src={img} alt={p.part_no} className="w-full h-full object-contain" />
                        ) : (
                          <Package className="w-8 h-8 text-slate-300" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-slate-800 text-sm">{p.part_no}</div>
                        <div className="text-xs text-slate-500 mb-2">{p.part_name}</div>
                        <label className="inline-flex items-center gap-1.5 text-xs text-cyan-600 cursor-pointer hover:text-cyan-700">
                          <Upload className="w-3.5 h-3.5" />
                          {uploading ? 'กำลังอัปโหลด...' : 'อัปโหลดรูปมาตรฐาน'}
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f) uploadStandard(p, f);
                            }}
                          />
                        </label>
                      </div>
                    </div>
                  );
                })}
                {parts.length === 0 && <p className="text-center text-slate-400 py-4">ยังไม่มีชิ้นงาน</p>}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
