import type { InspectionRecord, ProblemHistory } from '@/lib/supabase';

export type InspectionResultRow = {
  item_label: string;
  value: string;
};

/**
 * Export inspection records + results to CSV (opens in Excel).
 */
export function exportInspectionCSV(
  records: InspectionRecord[],
  resultsMap: Record<string, InspectionResultRow[]>,
) {
  const headers = [
    'วันที่',
    'Part No',
    'Part Name',
    'ผู้ตรวจสอบ',
    'สรุปผล',
    'สถานะ',
    'หัวข้อการตรวจสอบ',
    'ผลการตรวจสอบ',
  ];
  const rows: string[][] = [];

  for (const rec of records) {
    const results = resultsMap[rec.id] ?? [];
    if (results.length === 0) {
      rows.push([
        rec.record_date,
        rec.part_no,
        rec.part_name,
        rec.user_name,
        rec.result_summary ?? '-',
        rec.approved ? 'อนุมัติแล้ว' : 'รออนุมัติ',
        '-',
        '-',
      ]);
    } else {
      for (const r of results) {
        rows.push([
          rec.record_date,
          rec.part_no,
          rec.part_name,
          rec.user_name,
          rec.result_summary ?? '-',
          rec.approved ? 'อนุมัติแล้ว' : 'รออนุมัติ',
          r.item_label,
          r.value,
        ]);
      }
    }
  }

  const csvContent = [headers, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n');

  // Add BOM for Thai text in Excel
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `inspection-results-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * Export a single inspection record + results to CSV.
 */
export function exportSingleInspectionCSV(
  record: InspectionRecord,
  results: InspectionResultRow[],
) {
  exportInspectionCSV([record], { [record.id]: results });
}

/**
 * Export a single inspection record + results to PDF via browser print.
 */
export function exportSingleInspectionPDF(
  record: InspectionRecord,
  results: InspectionResultRow[],
) {
  exportInspectionPDF([record], { [record.id]: results });
}

/**
 * Export inspection records + results to PDF via browser print.
 */
export function exportInspectionPDF(
  records: InspectionRecord[],
  resultsMap: Record<string, InspectionResultRow[]>,
) {
  const win = window.open('', '_blank');
  if (!win) return;

  const rowsHtml = records
    .map((rec) => {
      const results = resultsMap[rec.id] ?? [];
      const resultRows =
        results.length > 0
          ? results
              .map(
                (r) =>
                  `<tr><td style="padding:4px 12px;border:1px solid #e2e8f0;">${r.item_label}</td><td style="padding:4px 12px;border:1px solid #e2e8f0;">${r.value}</td></tr>`,
              )
              .join('')
          : '<tr><td colspan="2" style="padding:4px 12px;color:#94a3b8;">ไม่มีผลการตรวจสอบ</td></tr>';

      const summaryColor = rec.result_summary === 'OK' ? '#16a34a' : rec.result_summary === 'NG' ? '#dc2626' : '#64748b';
      const statusText = rec.approved ? 'อนุมัติแล้ว' : 'รออนุมัติ';

      return `
        <div style="margin-bottom:24px;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
          <div style="background:#f1f5f9;padding:10px 16px;display:flex;justify-content:space-between;align-items:center;">
            <div>
              <strong style="font-size:14px;">${rec.part_no}</strong>
              <span style="color:#64748b;margin-left:8px;">${rec.part_name}</span>
            </div>
            <div style="display:flex;gap:8px;align-items:center;">
              <span style="background:${summaryColor};color:white;padding:2px 10px;border-radius:4px;font-size:12px;font-weight:bold;">${rec.result_summary ?? '-'}</span>
              <span style="color:#64748b;font-size:12px;">${statusText}</span>
            </div>
          </div>
          <div style="padding:8px 16px;font-size:12px;color:#64748b;">
            วันที่: ${rec.record_date} · ผู้ตรวจสอบ: ${rec.user_name}
          </div>
          <table style="width:100%;border-collapse:collapse;font-size:13px;">
            <thead>
              <tr style="background:#f8fafc;">
                <th style="padding:4px 12px;text-align:left;border:1px solid #e2e8f0;">หัวข้อการตรวจสอบ</th>
                <th style="padding:4px 12px;text-align:left;border:1px solid #e2e8f0;">ผลการตรวจสอบ</th>
              </tr>
            </thead>
            <tbody>${resultRows}</tbody>
          </table>
        </div>
      `;
    })
    .join('');

  win.document.write(`
    <!DOCTYPE html>
    <html lang="th">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>รายงานผลการตรวจสอบ</title>
      <style>
        * { font-family: 'Segoe UI', Tahoma, sans-serif; }
        body { padding: 24px; color: #1e293b; }
        h1 { font-size: 20px; margin-bottom: 4px; }
        .meta { color: #64748b; font-size: 13px; margin-bottom: 20px; }
        @media print { body { padding: 0; } }
      </style>
    </head>
    <body>
      <h1>รายงานผลการตรวจสอบชิ้นงาน</h1>
      <div class="meta">วันที่พิมพ์: ${new Date().toLocaleDateString('th-TH')} · จำนวน ${records.length} รายการ</div>
      ${rowsHtml}
      <script>
        window.onload = function() { window.print(); }
      </script>
    </body>
    </html>
  `);
  win.document.close();
}

/**
 * Export problem history records to CSV (opens in Excel).
 */
export function exportProblemHistoryCSV(records: ProblemHistory[]) {
  const headers = [
    'วันที่',
    'Part No',
    'Part Name',
    'ลูกค้า',
    'ปัญหา',
    'รายละเอียดปัญหา',
    'การแก้ไข',
    'จำนวนไฟล์แนบ',
    'ผู้บันทึก',
    'สถานะ',
  ];
  const rows = records.map((r) => [
    r.record_date,
    r.part_no,
    r.part_name,
    r.customer,
    r.problem,
    r.problem_detail ?? '-',
    r.correction ?? '-',
    String(r.file_paths?.length ?? 0),
    r.user_name,
    r.status === 'draft' ? 'ฉบับร่าง' : 'เผยแพร่',
  ]);

  const csvContent = [headers, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n');

  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `problem-history-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * Export problem history records to PDF via browser print.
 */
export function exportProblemHistoryPDF(records: ProblemHistory[]) {
  const win = window.open('', '_blank');
  if (!win) return;

  const rowsHtml = records
    .map((r) => {
      const statusBadge =
        r.status === 'draft'
          ? '<span style="background:#fef3c7;color:#92400e;padding:2px 10px;border-radius:4px;font-size:12px;font-weight:bold;">ฉบับร่าง</span>'
          : '<span style="background:#d1fae5;color:#065f46;padding:2px 10px;border-radius:4px;font-size:12px;font-weight:bold;">เผยแพร่</span>';

      return `
        <div style="margin-bottom:20px;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
          <div style="background:#f1f5f9;padding:10px 16px;display:flex;justify-content:space-between;align-items:center;">
            <div>
              <strong style="font-size:14px;">${r.part_no}</strong>
              <span style="color:#64748b;margin-left:8px;">${r.part_name}</span>
            </div>
            ${statusBadge}
          </div>
          <table style="width:100%;border-collapse:collapse;font-size:13px;">
            <tr>
              <td style="padding:4px 12px;border:1px solid #e2e8f0;width:120px;background:#f8fafc;font-weight:bold;">วันที่</td>
              <td style="padding:4px 12px;border:1px solid #e2e8f0;">${r.record_date}</td>
            </tr>
            <tr>
              <td style="padding:4px 12px;border:1px solid #e2e8f0;background:#f8fafc;font-weight:bold;">ลูกค้า</td>
              <td style="padding:4px 12px;border:1px solid #e2e8f0;">${r.customer}</td>
            </tr>
            <tr>
              <td style="padding:4px 12px;border:1px solid #e2e8f0;background:#f8fafc;font-weight:bold;">ปัญหา</td>
              <td style="padding:4px 12px;border:1px solid #e2e8f0;">${r.problem}</td>
            </tr>
            <tr>
              <td style="padding:4px 12px;border:1px solid #e2e8f0;background:#f8fafc;font-weight:bold;">รายละเอียด</td>
              <td style="padding:4px 12px;border:1px solid #e2e8f0;">${r.problem_detail ?? '-'}</td>
            </tr>
            <tr>
              <td style="padding:4px 12px;border:1px solid #e2e8f0;background:#f8fafc;font-weight:bold;">การแก้ไข</td>
              <td style="padding:4px 12px;border:1px solid #e2e8f0;">${r.correction ?? '-'}</td>
            </tr>
            <tr>
              <td style="padding:4px 12px;border:1px solid #e2e8f0;background:#f8fafc;font-weight:bold;">ไฟล์แนบ</td>
              <td style="padding:4px 12px;border:1px solid #e2e8f0;">${r.file_paths?.length ?? 0} ไฟล์</td>
            </tr>
            <tr>
              <td style="padding:4px 12px;border:1px solid #e2e8f0;background:#f8fafc;font-weight:bold;">ผู้บันทึก</td>
              <td style="padding:4px 12px;border:1px solid #e2e8f0;">${r.user_name}</td>
            </tr>
          </table>
        </div>
      `;
    })
    .join('');

  win.document.write(`
    <!DOCTYPE html>
    <html lang="th">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>รายงานประวัติปัญหา</title>
      <style>
        * { font-family: 'Segoe UI', Tahoma, sans-serif; }
        body { padding: 24px; color: #1e293b; }
        h1 { font-size: 20px; margin-bottom: 4px; }
        .meta { color: #64748b; font-size: 13px; margin-bottom: 20px; }
        @media print { body { padding: 0; } }
      </style>
    </head>
    <body>
      <h1>รายงานประวัติปัญหา</h1>
      <div class="meta">วันที่พิมพ์: ${new Date().toLocaleDateString('th-TH')} · จำนวน ${records.length} รายการ</div>
      ${rowsHtml}
      <script>
        window.onload = function() { window.print(); }
      </script>
    </body>
    </html>
  `);
  win.document.close();
}
