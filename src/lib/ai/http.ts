import { lookup } from "dns/promises";
import net from "net";

// ===========================================================================
// AI 공급사 호출 공통 도우미 (숏핑 server/ai/http.mjs 이식)
// - 시간 제한, 오류 메시지 정리, 결과 파일 내려받기(크기 제한)
// - 리다이렉트를 직접 따라가며 다른 곳으로 넘어가면 API 키 헤더를 제거
// - 결과 주소는 https + 공인 IP 만 허용 (내부망 접근 차단)
// ===========================================================================

export class VendorError extends Error {
  status: number;
  retryable: boolean;
  /** 일시적 연결·과부하 오류(시간 초과, 429, 5xx) */
  transient: boolean;
  /** 요청이 공급사에 도달했는지 알 수 없는 경우(시간 초과 등) — 영상처럼 비싼 작업은 다시 보내지 않는다 */
  unknownDelivery: boolean;
  constructor(message: string, opts: { status?: number; retryable?: boolean; transient?: boolean; unknownDelivery?: boolean } = {}) {
    super(message);
    this.status = opts.status ?? 502;
    this.retryable = opts.retryable ?? true;
    this.transient = opts.transient ?? false;
    this.unknownDelivery = opts.unknownDelivery ?? false;
  }
}

const snippet = (text: unknown) => String(text || "").replace(/\s+/g, " ").slice(0, 300);
const MAX_DOWNLOAD = 400 * 1024 * 1024;
const MAX_REDIRECTS = 5;

export function privateIp(ip: string): boolean {
  let a = String(ip || "").toLowerCase().replace(/^\[|\]$/g, "");
  const mapped = /^(?:0*:)*:?ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(a) || /^::(\d+\.\d+\.\d+\.\d+)$/.exec(a);
  if (mapped) a = mapped[1];
  const hexMapped = /^(?:0*:)*:?ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(a);
  if (hexMapped) {
    const hi = parseInt(hexMapped[1], 16);
    const lo = parseInt(hexMapped[2], 16);
    a = [hi >> 8, hi & 255, lo >> 8, lo & 255].join(".");
  }
  if (net.isIPv4(a)) return /^(127\.|10\.|0\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.|22[4-9]\.|2[3-5]\d\.)/.test(a);
  if (net.isIPv6(a)) return /^(::1?$|::$|f[cd]|fe[89ab]|ff|0:0:0:0:0:0:0:[01]$)/.test(a) || /^[0:]+$/.test(a) || a === "::";
  return false;
}
const privateName = (host: string) => /^(localhost|.*\.localhost|.*\.local|.*\.internal)$/i.test(host);

export async function safeUrl(url: string): Promise<boolean> {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return false;
  }
  const host = u.hostname.replace(/\.$/, "").replace(/^\[|\]$/g, "");
  if (u.protocol !== "https:" || !host || privateName(host) || privateIp(host)) return false;
  if (net.isIP(host)) return true;
  try {
    const addrs = await lookup(host, { all: true, verbatim: true });
    return addrs.length > 0 && addrs.every((r) => !privateIp(r.address));
  } catch {
    return false;
  }
}

async function readLimited(res: Response, limit: number): Promise<Buffer> {
  const declared = Number(res.headers.get("content-length") || 0);
  if (declared > limit) throw new VendorError("결과 파일이 너무 큽니다.", { retryable: false });
  if (!res.body) return Buffer.alloc(0);
  const reader = res.body.getReader();
  const chunks: Buffer[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > limit) {
      await reader.cancel().catch(() => {});
      throw new VendorError("결과 파일이 너무 큽니다.", { retryable: false });
    }
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks, total);
}

export interface CallOptions {
  method?: string;
  headers?: Record<string, string>;
  json?: unknown;
  body?: BodyInit;
  timeout?: number;
  raw?: boolean;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function call(url: string, opts: CallOptions = {}): Promise<any> {
  const { method = "POST", headers = {}, json, body, timeout = 120_000, raw = false } = opts;
  let res: Response;
  let current = url;
  let sendHeaders: Record<string, string> = json !== undefined ? { "Content-Type": "application/json", ...headers } : headers;
  for (let hop = 0; ; hop++) {
    try {
      res = await fetch(current, {
        method,
        headers: sendHeaders,
        body: json !== undefined ? JSON.stringify(json) : body,
        signal: AbortSignal.timeout(timeout),
        redirect: "manual",
      });
    } catch (e) {
      const err = e as Error;
      const timedOut = err.name === "TimeoutError";
      throw new VendorError("AI 공급사에 연결하지 못했습니다: " + (timedOut ? "시간 초과" : err.message), {
        transient: true,
        // 시간 초과는 요청이 이미 접수됐을 수 있다
        unknownDelivery: timedOut,
      });
    }
    if (![301, 302, 303, 307, 308].includes(res.status)) break;
    const location = res.headers.get("location");
    if (!location || hop >= MAX_REDIRECTS) throw new VendorError("AI 공급사 주소가 너무 여러 번 바뀌었습니다.", { retryable: false });
    const next = new URL(location, current).toString();
    if (new URL(next).origin !== new URL(current).origin) {
      if (!(await safeUrl(next))) throw new VendorError("안전하지 않은 공급사 주소입니다.", { retryable: false });
      sendHeaders = json !== undefined ? { "Content-Type": "application/json" } : {};
    }
    current = next;
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    let message: unknown = text;
    try {
      const data = JSON.parse(text);
      message = data.error?.message || data.error || data.message || data.detail || text;
      if (typeof message !== "string") message = JSON.stringify(message);
    } catch {
      /* 텍스트 그대로 */
    }
    throw new VendorError(`AI 공급사 오류(${res.status}): ${snippet(message)}`, {
      status: res.status === 401 ? 401 : res.status === 403 ? 403 : res.status === 400 || res.status === 422 ? 400 : 502,
      retryable: res.status === 429 || res.status >= 500,
      transient: res.status === 429 || res.status >= 500,
    });
  }
  const payload = await readLimited(res, raw ? MAX_DOWNLOAD : 64 * 1024 * 1024);
  if (raw) return payload;
  const text = payload.toString("utf8");
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    throw new VendorError("AI 공급사 응답을 읽지 못했습니다: " + snippet(text));
  }
}

export async function download(url: string, headers: Record<string, string> = {}): Promise<Buffer> {
  if (url.startsWith("data:")) {
    const m = url.match(/^data:([^,]*),(.*)$/s);
    if (!m) throw new VendorError("결과 파일을 읽지 못했습니다.");
    const buffer = m[1].includes(";base64") ? Buffer.from(m[2], "base64") : Buffer.from(decodeURIComponent(m[2]));
    if (buffer.length > MAX_DOWNLOAD) throw new VendorError("결과 파일이 너무 큽니다.", { retryable: false });
    return buffer;
  }
  let current = url;
  let sendHeaders = headers;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    if (!(await safeUrl(current))) throw new VendorError("안전하지 않은 결과 주소입니다.", { retryable: false });
    let res: Response;
    try {
      res = await fetch(current, { headers: sendHeaders, signal: AbortSignal.timeout(300_000), redirect: "manual" });
    } catch (e) {
      throw new VendorError("결과 파일을 내려받지 못했습니다: " + (e as Error).message, { transient: true });
    }
    if ([301, 302, 303, 307, 308].includes(res.status)) {
      const location = res.headers.get("location");
      if (!location) throw new VendorError("결과 파일을 내려받지 못했습니다(주소 없음).");
      const next = new URL(location, current).toString();
      if (new URL(next).origin !== new URL(current).origin) sendHeaders = {};
      current = next;
      continue;
    }
    if (!res.ok) throw new VendorError(`결과 파일을 내려받지 못했습니다(${res.status}).`, { transient: res.status >= 500 });
    return readLimited(res, MAX_DOWNLOAD);
  }
  throw new VendorError("결과 주소가 너무 여러 번 바뀌었습니다.", { retryable: false });
}

export const dataUri = (buffer: Buffer, mime: string) => `data:${mime};base64,${buffer.toString("base64")}`;

/** Gemini TTS 는 24kHz 16bit 모노 PCM 을 돌려준다 → WAV 로 감싼다 */
export function pcmToWav(pcm: Buffer, rate = 24000, channels = 1, bits = 16): Buffer {
  const header = Buffer.alloc(44);
  const byteRate = (rate * channels * bits) / 8;
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(rate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE((channels * bits) / 8, 32);
  header.writeUInt16LE(bits, 34);
  header.write("data", 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}
