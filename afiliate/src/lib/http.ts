import { requireIdentity, getIdentity } from "../../cursor/identity";

export function json(data: unknown, status = 200): Response {
  return Response.json(data, {
    status,
    headers: { "cache-control": "private, no-store" },
  });
}

export async function requireViewer(request: Request) {
  const identity = await requireIdentity(request);
  if (identity instanceof Response) {
    identity.headers.set("cache-control", "private, no-store");
    return identity;
  }
  return identity;
}

export async function optionalViewer(request: Request) {
  return getIdentity(request);
}

const BLOCKED_HOSTS = new Set([
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "::1",
  "metadata.google.internal",
]);

export function isPrivateHostname(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.+$/, "");
  if (BLOCKED_HOSTS.has(host)) return true;
  if (host.endsWith(".localhost") || host.endsWith(".internal")) return true;
  if (/^10\.\d+\.\d+\.\d+$/.test(host)) return true;
  if (/^127\.\d+\.\d+\.\d+$/.test(host)) return true;
  if (/^192\.168\.\d+\.\d+$/.test(host)) return true;
  if (/^169\.254\.\d+\.\d+$/.test(host)) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+$/.test(host)) return true;
  return false;
}

export function hostAllowed(hostname: string, suffixes: string[]): boolean {
  const host = hostname.toLowerCase().replace(/\.+$/, "");
  if (isPrivateHostname(host)) return false;
  return suffixes.some((suffix) => host === suffix || host.endsWith(`.${suffix}`));
}

export async function resolveRedirects(input: string, suffixes: string[]): Promise<URL> {
  let current = new URL(input);
  for (let hop = 0; hop < 5; hop += 1) {
    if (current.protocol !== "https:") throw new Error("ต้องเป็นลิงก์ https เท่านั้น");
    if (!hostAllowed(current.hostname, suffixes)) {
      throw new Error("ลิงก์นี้ไม่อยู่ในรายการร้านที่อนุญาต");
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);
    try {
      const response = await fetch(current, {
        method: "GET",
        redirect: "manual",
        signal: controller.signal,
        headers: { range: "bytes=0-0" },
      });
      await response.body?.cancel().catch(() => undefined);
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        if (!location) return current;
        current = new URL(location, current);
        continue;
      }
      return current;
    } finally {
      clearTimeout(timer);
    }
  }
  return current;
}

export async function fetchAllowed(
  input: string,
  suffixes: string[],
  init: RequestInit & { maxBytes?: number; timeoutMs?: number } = {},
): Promise<{ url: URL; buffer: Buffer; contentType: string }> {
  const timeoutMs = init.timeoutMs ?? 12_000;
  const maxBytes = init.maxBytes ?? 2_000_000;
  let current = new URL(input);
  for (let hop = 0; hop < 4; hop += 1) {
    if (current.protocol !== "https:" && current.protocol !== "http:") {
      throw new Error("โปรโตคอลลิงก์ไม่รองรับ");
    }
    if (current.protocol !== "https:") {
      throw new Error("ต้องเป็นลิงก์ https เท่านั้น");
    }
    if (!hostAllowed(current.hostname, suffixes)) {
      throw new Error("ลิงก์นี้ไม่อยู่ในรายการร้านที่อนุญาต");
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const headers = new Headers(init.headers);
      if (!headers.has("user-agent")) {
        headers.set(
          "user-agent",
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        );
      }
      if (!headers.has("accept-language")) {
        headers.set("accept-language", "th-TH,th;q=0.9,en-US;q=0.8,en;q=0.7");
      }
      const response = await fetch(current, {
        method: init.method ?? "GET",
        headers,
        body: init.body,
        redirect: "manual",
        signal: controller.signal,
      });
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        if (!location) throw new Error("ลิงก์เปลี่ยนที่อยู่แล้วตามไม่ได้");
        current = new URL(location, current);
        continue;
      }
      if (!response.ok) {
        throw new Error(`ดึงข้อมูลไม่สำเร็จ (${response.status})`);
      }
      const length = Number(response.headers.get("content-length") ?? "0");
      if (length > maxBytes) throw new Error("ไฟล์ใหญ่เกินไป");
      const buffer = Buffer.from(await response.arrayBuffer());
      if (buffer.length > maxBytes) throw new Error("ไฟล์ใหญ่เกินไป");
      return {
        url: current,
        buffer,
        contentType: response.headers.get("content-type") ?? "",
      };
    } finally {
      clearTimeout(timer);
    }
  }
  throw new Error("ลิงก์เปลี่ยนที่อยู่หลายครั้งเกินไป");
}
