import { supabase } from '@/lib/supabase';

export function getStandardImageUrl(path: string | null): string | null {
  if (!path) return null;
  const { data } = supabase.storage.from('standards').getPublicUrl(path);
  return data.publicUrl;
}

export function getAttachmentUrl(path: string): string {
  // attachments bucket is private; create signed url on demand
  return path; // caller should use createSignedAttachmentUrl
}

export async function createSignedAttachmentUrl(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage.from('attachments').createSignedUrl(path, 3600);
  if (error) return null;
  return data.signedUrl;
}

export function formatDate(d: string | Date): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  return date.toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' });
}

export function formatDateTime(d: string | Date): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  return date.toLocaleString('th-TH', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function monthKey(d: string | Date): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export function monthLabel(key: string): string {
  const [y, m] = key.split('-');
  const date = new Date(Number(y), Number(m) - 1, 1);
  return date.toLocaleDateString('th-TH', { year: 'numeric', month: 'short' });
}
