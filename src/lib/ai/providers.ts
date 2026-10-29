import { call, dataUri, hostIn, pcmToWav, safeUrl, VendorError } from "./http";
import type { AiCapability, AiModel, AiProvider, AiProviderKind } from "../schema";

// ===========================================================================
// AI 공급사 어댑터 (숏핑 server/ai/providers.mjs 에서 숏츠에 꼭 필요한 4곳만 이식)
//   Google Gemini · OpenAI · fal.ai · ElevenLabs  (+ 개발용 가짜 AI)
// 모든 어댑터는 같은 약속을 지킨다.
//   run({ provider, model, capability, input, key })  → { status:'done', result } | { status:'pending', ref }
//   poll({ provider, model, capability, ref, key })    → 위와 같음 (영상처럼 오래 걸리는 작업)
//   test({ provider, key })                            → 비용이 들지 않는 연결 확인
// 결과: text → { text, usage:{input,output} } / 이미지·음성·영상 → { data:Buffer, mime } 또는 { url, headers }
// ===========================================================================

export interface MediaRef {
  buffer: Buffer;
  mime: string;
}
export interface AiInput {
  system?: string;
  prompt?: string;
  text?: string;
  maxTokens?: number;
  json?: boolean;
  aspect?: string;
  voice?: string;
  speed?: number;
  seconds?: number;
  image?: MediaRef;
}
export interface AiResult {
  text?: string;
  usage?: { input: number; output: number };
  data?: Buffer;
  mime?: string;
  url?: string;
  headers?: Record<string, string>;
}
export type RunOutcome = { status: "done"; result: AiResult } | { status: "pending"; ref: string };
export interface AdapterArgs {
  provider: Pick<AiProvider, "base_url" | "kind">;
  model: Pick<AiModel, "model_id" | "capability">;
  capability: AiCapability;
  input: AiInput;
  key: string;
}
export interface Adapter {
  label: string;
  capabilities: AiCapability[];
  base: string;
  run(args: AdapterArgs): Promise<RunOutcome>;
  poll?(args: Omit<AdapterArgs, "input"> & { ref: string }): Promise<RunOutcome>;
  test(args: { provider: Pick<AiProvider, "base_url">; key: string }): Promise<string>;
}

const trimBase = (url: string | undefined, fallback: string) => String(url || fallback).replace(/\/+$/, "");
const bearer = (key: string) => ({ Authorization: `Bearer ${key}` });
const ok = (result: AiResult): RunOutcome => ({ status: "done", result });
const pending = (ref: string): RunOutcome => ({ status: "pending", ref });
const aspectSize: Record<string, string> = { "9:16": "1024x1536", "1:1": "1024x1024", "16:9": "1536x1024" };

/** 모델마다 만들 수 있는 영상 길이가 정해져 있다 → 요청 길이 이상 중 가장 짧은 값 (과금도 이 길이로) */
export function videoSeconds(modelId: string, seconds: number | undefined): number {
  const id = String(modelId || "").toLowerCase();
  const want = Math.max(1, Number(seconds) || 5);
  const pick = (list: number[]) => list.find((v) => v >= want - 0.25) ?? list[list.length - 1];
  if (/veo/.test(id)) return pick([4, 6, 8]);
  if (/sora/.test(id)) return pick([4, 8, 12]);
  if (/hailuo|minimax/.test(id)) return pick([6, 10]);
  if (/kling|seedance/.test(id)) return pick([5, 10]);
  if (/wan/.test(id)) return 5;
  return Math.min(10, Math.max(2, Math.round(want)));
}

// ── OpenAI ────────────────────────────────────────────────────────────────
const openai: Adapter = {
  label: "OpenAI (대본 · 이미지 · 음성)",
  capabilities: ["text", "image", "tts", "video"],
  base: "https://api.openai.com/v1",
  async run({ provider, model, capability, input, key }) {
    const base = trimBase(provider.base_url, this.base);
    if (capability === "text") {
      const data = await call(`${base}/chat/completions`, {
        headers: bearer(key),
        timeout: 180_000,
        json: {
          model: model.model_id,
          messages: [...(input.system ? [{ role: "system", content: input.system }] : []), { role: "user", content: input.prompt }],
          max_completion_tokens: input.maxTokens || 4000,
          ...(input.json ? { response_format: { type: "json_object" } } : {}),
        },
      });
      const choice = data.choices?.[0];
      const text = choice?.message?.content;
      if (!text) {
        // 안전 정책 거절(refusal·content_filter)이나 빈 응답은 다시 보내도 같다 → 재시도·장애 집계 안 함
        const blocked = !!choice?.message?.refusal || choice?.finish_reason === "content_filter";
        throw new VendorError(blocked ? "AI가 안전 정책으로 요청을 거절했습니다. 주제나 요청을 바꿔 다시 시도해 주세요." : "AI가 빈 응답을 돌려줬습니다.", { contentIssue: true });
      }
      return ok({ text, usage: { input: data.usage?.prompt_tokens || 0, output: data.usage?.completion_tokens || 0 } });
    }
    if (capability === "image") {
      const data = await call(`${base}/images/generations`, {
        headers: bearer(key),
        timeout: 180_000,
        json: { model: model.model_id, prompt: input.prompt, size: aspectSize[input.aspect || "9:16"] || "1024x1536", n: 1 },
      });
      const item = data.data?.[0];
      if (item?.b64_json) return ok({ data: Buffer.from(item.b64_json, "base64"), mime: "image/png" });
      if (item?.url) return ok({ url: item.url });
      throw new VendorError("이미지 결과가 없습니다(안전 정책으로 걸러졌을 수 있습니다).", { contentIssue: true });
    }
    if (capability === "tts") {
      const data = await call(`${base}/audio/speech`, {
        headers: bearer(key),
        raw: true,
        json: { model: model.model_id, voice: input.voice || "alloy", input: input.text, response_format: "mp3", instructions: "한국어로 또렷하고 자연스럽게 말하기" },
      });
      return ok({ data, mime: "audio/mpeg" });
    }
    if (capability === "video") {
      // OpenAI 영상은 Sora 길이(4/8/12초)만 받는다 — 가격 계산(pricing.unitsFor)도 같은 규칙을 쓴다
      const seconds = String(videoSeconds("sora", input.seconds));
      let body: FormData | undefined;
      let json: unknown;
      if (input.image) {
        body = new FormData();
        body.set("model", model.model_id);
        body.set("prompt", input.prompt || "");
        body.set("seconds", seconds);
        body.set("size", "720x1280");
        body.set("input_reference", new Blob([new Uint8Array(input.image.buffer)], { type: input.image.mime }), "frame.jpg");
      } else json = { model: model.model_id, prompt: input.prompt, seconds, size: "720x1280" };
      const data = await call(`${base}/videos`, { headers: bearer(key), json, body });
      if (!data.id) throw new VendorError("영상 작업 번호를 받지 못했습니다.");
      return pending(String(data.id));
    }
    throw new VendorError("지원하지 않는 작업입니다.", { retryable: false });
  },
  async poll({ provider, ref, key }) {
    const base = trimBase(provider.base_url, this.base);
    const data = await call(`${base}/videos/${encodeURIComponent(ref)}`, { method: "GET", headers: bearer(key) });
    if (data.status === "completed") return ok({ url: `${base}/videos/${encodeURIComponent(ref)}/content`, headers: bearer(key) });
    if (data.status === "failed") throw new VendorError("영상 생성 실패: " + (data.error?.message || "원인 미상"), { retryable: false });
    return pending(ref);
  },
  async test({ provider, key }) {
    await call(`${trimBase(provider.base_url, this.base)}/models`, { method: "GET", headers: bearer(key), timeout: 20_000 });
    return "모델 목록 조회 성공";
  },
};

// ── Google Gemini · Veo ───────────────────────────────────────────────────
const geminiHeaders = (key: string) => ({ "x-goog-api-key": key });
/** Gemini 키(x-goog-api-key)를 실어 보내도 되는 Google 도메인 */
const GOOGLE_DOMAINS = ["googleapis.com", "google.com", "googleusercontent.com"];
const gemini: Adapter = {
  label: "Google Gemini · Veo (대본 · 이미지 · 음성 · 영상 — 키 1개로 전 과정)",
  capabilities: ["text", "image", "tts", "video"],
  base: "https://generativelanguage.googleapis.com/v1beta",
  async run({ provider, model, capability, input, key }) {
    const base = trimBase(provider.base_url, this.base);
    const headers = geminiHeaders(key);
    if (capability === "video") {
      const instance: Record<string, unknown> = { prompt: input.prompt };
      if (input.image) instance.image = { bytesBase64Encoded: input.image.buffer.toString("base64"), mimeType: input.image.mime };
      const data = await call(`${base}/models/${model.model_id}:predictLongRunning`, {
        headers,
        json: { instances: [instance], parameters: { aspectRatio: input.aspect || "9:16", durationSeconds: videoSeconds(model.model_id, input.seconds) } },
      });
      if (!data.name) throw new VendorError("영상 작업 번호를 받지 못했습니다.");
      return pending(String(data.name));
    }
    const spoken = capability === "tts" ? input.text || "" : input.prompt || "";
    const generationConfig =
      capability === "image"
        ? { responseModalities: ["IMAGE"], imageConfig: { aspectRatio: input.aspect || "9:16" } }
        : capability === "tts"
          ? { responseModalities: ["AUDIO"], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: input.voice || "Kore" } } } }
          : { maxOutputTokens: input.maxTokens || 4000, ...(input.json ? { responseMimeType: "application/json" } : {}) };
    const data = await call(`${base}/models/${model.model_id}:generateContent`, {
      headers,
      timeout: 240_000,
      json: {
        ...(input.system && capability === "text" ? { systemInstruction: { parts: [{ text: input.system }] } } : {}),
        contents: [{ role: "user", parts: [{ text: spoken }] }],
        generationConfig,
      },
    });
    const parts: Array<{ text?: string; inlineData?: { data: string; mimeType?: string } }> = data.candidates?.[0]?.content?.parts || [];
    if (capability === "text") {
      const text = parts.map((p) => p.text || "").join("");
      if (!text) {
        const blocked = !!data.promptFeedback?.blockReason || /SAFETY|PROHIBITED|BLOCKLIST|RECITATION/.test(String(data.candidates?.[0]?.finishReason || ""));
        throw new VendorError(blocked ? "AI가 안전 정책으로 요청을 거절했습니다. 주제나 요청을 바꿔 다시 시도해 주세요." : "AI가 빈 응답을 돌려줬습니다.", { contentIssue: true });
      }
      return ok({ text, usage: { input: data.usageMetadata?.promptTokenCount || 0, output: data.usageMetadata?.candidatesTokenCount || 0 } });
    }
    const inline = parts.find((p) => p.inlineData)?.inlineData;
    if (!inline) throw new VendorError(capability === "tts" ? "음성 결과가 없습니다." : "이미지 결과가 없습니다(안전 정책으로 걸러졌을 수 있습니다).", { contentIssue: true });
    const buffer = Buffer.from(inline.data, "base64");
    if (capability === "tts") {
      const rate = Number(/rate=(\d+)/.exec(inline.mimeType || "")?.[1] || 24000);
      return ok({ data: /wav/.test(inline.mimeType || "") ? buffer : pcmToWav(buffer, rate), mime: "audio/wav" });
    }
    return ok({ data: buffer, mime: inline.mimeType || "image/png" });
  },
  async poll({ provider, ref, key }) {
    const base = trimBase(provider.base_url, this.base);
    // 작업 번호(operations/...)는 공급사 응답 값 → 경로 조작(../, //, ?, #, 스킴)을 막고, 키를 Google 도메인으로만 보낸다
    if (!/^[\w./-]{1,500}$/.test(ref) || ref.includes("..") || ref.startsWith("/")) throw new VendorError("안전하지 않은 작업 확인 주소입니다.", { retryable: false, billed: false });
    const pollUrl = `${base}/${ref}`;
    if (!hostIn(pollUrl, GOOGLE_DOMAINS)) throw new VendorError("안전하지 않은 작업 확인 주소입니다.", { retryable: false, billed: false });
    const data = await call(pollUrl, { method: "GET", headers: geminiHeaders(key) });
    if (!data.done) return pending(ref);
    if (data.error) throw new VendorError("영상 생성 실패: " + (data.error.message || "원인 미상"), { retryable: false });
    const sample = data.response?.generateVideoResponse?.generatedSamples?.[0] || data.response?.generatedVideos?.[0];
    const uri = sample?.video?.uri;
    if (!uri) throw new VendorError("영상 결과가 없습니다(안전 정책으로 걸러졌을 수 있습니다).", { contentIssue: true });
    // 결과 주소에도 API 키를 붙여 내려받으므로 Google 도메인(+ https·공인 IP)만 허용
    if (typeof uri !== "string" || !hostIn(uri, GOOGLE_DOMAINS) || !(await safeUrl(uri))) throw new VendorError("안전하지 않은 결과 주소입니다.", { retryable: false });
    return ok({ url: uri, headers: geminiHeaders(key) });
  },
  async test({ provider, key }) {
    await call(`${trimBase(provider.base_url, this.base)}/models?pageSize=1`, { method: "GET", headers: geminiHeaders(key), timeout: 20_000 });
    return "모델 목록 조회 성공";
  },
};

// ── fal.ai (Kling · Hailuo · Seedance 영상, FLUX · Seedream 이미지, 음악) ──
function falInput(capability: AiCapability, input: AiInput, modelId: string) {
  const id = modelId.toLowerCase();
  if (capability === "video")
    return {
      prompt: input.prompt,
      duration: String(videoSeconds(modelId, input.seconds)),
      aspect_ratio: input.aspect || "9:16",
      ...(input.image ? { image_url: dataUri(input.image.buffer, input.image.mime) } : {}),
    };
  if (capability === "image")
    return { prompt: input.prompt, aspect_ratio: input.aspect || "9:16", image_size: input.aspect === "16:9" ? "landscape_16_9" : input.aspect === "1:1" ? "square_hd" : "portrait_16_9" };
  if (capability === "music") {
    const s = Math.max(5, Math.min(180, Math.round(Number(input.seconds) || 30)));
    if (/elevenlabs/.test(id)) return { prompt: input.prompt, music_length_ms: s * 1000, force_instrumental: true };
    if (/stable-audio/.test(id)) return { prompt: input.prompt, seconds_total: s };
    return { prompt: input.prompt, ...(/lyria/.test(id) ? {} : { duration: s }) };
  }
  if (capability === "tts") return { text: input.text, ...(input.voice ? { voice: input.voice } : {}) };
  return { prompt: input.prompt };
}
function falOutput(out: Record<string, unknown>): AiResult {
  const o = out as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  const candidates = [o.video, o.videos?.[0], o.images?.[0], o.image, o.audio, o.audio_file, o.output];
  for (const c of candidates) {
    if (!c) continue;
    if (typeof c === "string" && /^(https?:|data:)/.test(c)) return { url: c };
    if (typeof c === "object" && typeof c.url === "string") return { url: c.url };
  }
  if (typeof o.audio_url === "string") return { url: o.audio_url };
  throw new VendorError("결과 파일 주소를 찾지 못했습니다.");
}
const falHeaders = (key: string) => ({ Authorization: `Key ${key}` });
const fal: Adapter = {
  label: "fal.ai (저가 영상 Kling·Hailuo · 이미지 FLUX · 배경음악)",
  capabilities: ["image", "video", "tts", "music"],
  base: "https://queue.fal.run",
  async run({ provider, model, capability, input, key }) {
    const data = await call(`${trimBase(provider.base_url, this.base)}/${model.model_id}`, {
      headers: falHeaders(key),
      json: falInput(capability, input, model.model_id),
    });
    if (!data.request_id) throw new VendorError("작업 번호를 받지 못했습니다.");
    return pending(JSON.stringify({ status: data.status_url, response: data.response_url }));
  },
  async poll({ ref, key }) {
    const { status, response } = JSON.parse(ref) as { status: string; response: string };
    // fal 키가 실려 나가므로 fal 자체 도메인만 허용 (DNS 재바인딩 등으로 내부망에 키가 전송되는 것 방지)
    const falHost = (u: string) => { try { const h = new URL(u).hostname.toLowerCase(); return h === "fal.run" || h.endsWith(".fal.run") || h === "fal.ai" || h.endsWith(".fal.ai") || h.endsWith(".fal.media"); } catch { return false; } };
    if (!falHost(status) || !falHost(response) || !(await safeUrl(status)) || !(await safeUrl(response))) throw new VendorError("안전하지 않은 작업 확인 주소입니다.", { retryable: false });
    const s = await call(status, { method: "GET", headers: falHeaders(key) });
    if (s.status === "COMPLETED") {
      const out = await call(response, { method: "GET", headers: falHeaders(key) });
      if (out.detail && !out.video && !out.images && !out.audio) throw new VendorError("생성 실패: " + JSON.stringify(out.detail).slice(0, 200), { retryable: false });
      return ok(falOutput(out));
    }
    if (s.status === "FAILED" || s.error) throw new VendorError("생성 실패: " + (s.error || "원인 미상"), { retryable: false });
    return pending(ref);
  },
  async test({ provider, key }) {
    try {
      await call(`${trimBase(provider.base_url, this.base)}/fal-ai/flux/requests/00000000-0000-0000-0000-000000000000/status`, { method: "GET", headers: falHeaders(key), timeout: 20_000 });
    } catch (e) {
      const err = e as VendorError;
      if (err.status === 401 || err.status === 403) throw e;
    }
    return "키 확인 완료";
  },
};

// ── ElevenLabs (한국어 음성 · 배경음악) ───────────────────────────────────
const elevenlabs: Adapter = {
  label: "ElevenLabs (고품질 한국어 음성 · 배경음악)",
  capabilities: ["tts", "music"],
  base: "https://api.elevenlabs.io/v1",
  async run({ provider, model, capability, input, key }) {
    const base = trimBase(provider.base_url, this.base);
    if (capability === "music") {
      const data = await call(`${base}/music?output_format=mp3_44100_128`, {
        headers: { "xi-api-key": key },
        raw: true,
        timeout: 300_000,
        json: { prompt: input.prompt, music_length_ms: Math.max(3000, Math.min(600_000, Math.round((Number(input.seconds) || 30) * 1000))), model_id: model.model_id || "music_v1", force_instrumental: true },
      });
      return ok({ data, mime: "audio/mpeg" });
    }
    const voice = input.voice || "JBFqnCBsd6RMkjVDRZzb";
    const speed = Math.max(0.7, Math.min(1.2, Number(input.speed) || 1));
    const data = await call(`${base}/text-to-speech/${encodeURIComponent(voice)}?output_format=mp3_44100_128`, {
      headers: { "xi-api-key": key },
      raw: true,
      json: { text: input.text, model_id: model.model_id, ...(speed !== 1 ? { voice_settings: { speed } } : {}) },
    });
    return ok({ data, mime: "audio/mpeg" });
  },
  async test({ provider, key }) {
    await call(`${trimBase(provider.base_url, this.base)}/models`, { method: "GET", headers: { "xi-api-key": key }, timeout: 20_000 });
    return "모델 목록 조회 성공";
  },
};

export const ADAPTERS: Record<Exclude<AiProviderKind, "mock">, Adapter> = { gemini, openai, fal, elevenlabs };

/** 개발용 가짜 AI 허용 여부 (운영에서는 AI_ALLOW_MOCK=1 일 때만) */
export function mockAllowed(): boolean {
  return process.env.NODE_ENV !== "production" || process.env.AI_ALLOW_MOCK === "1";
}

// ── 공급사·모델 프리셋 (2026년 7월 공개 가격 참고값, 관리자 화면에서 수정 가능) ──
type PresetModel = { capability: AiCapability; model_id: string; label: string; cost_usd: number; max_seconds?: number; active?: boolean };
export const PRESETS: Record<AiProviderKind, { name: string; base_url: string; models: PresetModel[] }> = {
  gemini: {
    name: "Google Gemini · Veo",
    base_url: gemini.base,
    models: [
      { capability: "text", model_id: "gemini-2.5-flash", label: "Gemini 2.5 Flash (대본, 저렴)", cost_usd: 0.0012 },
      { capability: "text", model_id: "gemini-2.5-pro", label: "Gemini 2.5 Pro (대본, 고품질)", cost_usd: 0.006, active: false },
      { capability: "image", model_id: "gemini-2.5-flash-image", label: "Gemini 이미지", cost_usd: 0.039 },
      { capability: "tts", model_id: "gemini-2.5-flash-preview-tts", label: "Gemini 음성", cost_usd: 0.01 },
      { capability: "video", model_id: "veo-3.1-fast-generate-preview", label: "Veo 3.1 Fast (영상)", cost_usd: 0.15, max_seconds: 8 },
      { capability: "video", model_id: "veo-3.1-generate-preview", label: "Veo 3.1 (영상, 고가)", cost_usd: 0.75, max_seconds: 8, active: false },
    ],
  },
  openai: {
    name: "OpenAI",
    base_url: openai.base,
    models: [
      { capability: "text", model_id: "gpt-5-mini", label: "GPT-5 mini (대본)", cost_usd: 0.0012 },
      { capability: "text", model_id: "gpt-5", label: "GPT-5 (대본, 고품질)", cost_usd: 0.006, active: false },
      { capability: "image", model_id: "gpt-image-1", label: "GPT Image", cost_usd: 0.04 },
      { capability: "tts", model_id: "gpt-4o-mini-tts", label: "OpenAI 음성", cost_usd: 0.015 },
      { capability: "video", model_id: "sora-2", label: "Sora 2 (영상, 공급 여부 확인 필요)", cost_usd: 0.1, max_seconds: 12, active: false },
    ],
  },
  fal: {
    name: "fal.ai",
    base_url: fal.base,
    models: [
      { capability: "video", model_id: "fal-ai/kling-video/v2.5-turbo/pro/image-to-video", label: "Kling 2.5 Turbo (영상, 가성비)", cost_usd: 0.07, max_seconds: 10 },
      { capability: "video", model_id: "fal-ai/minimax/hailuo-02/standard/image-to-video", label: "Hailuo 02 (영상, 저가)", cost_usd: 0.045, max_seconds: 10 },
      { capability: "video", model_id: "fal-ai/bytedance/seedance/v1/pro/image-to-video", label: "Seedance Pro (영상)", cost_usd: 0.1, max_seconds: 10, active: false },
      { capability: "image", model_id: "fal-ai/flux/dev", label: "FLUX dev (이미지, 저가)", cost_usd: 0.025 },
      { capability: "image", model_id: "fal-ai/bytedance/seedream/v4/text-to-image", label: "Seedream 4 (이미지)", cost_usd: 0.03, active: false },
      { capability: "music", model_id: "fal-ai/lyria2", label: "Lyria 2 (배경음악)", cost_usd: 0.003, max_seconds: 30 },
      { capability: "music", model_id: "fal-ai/elevenlabs/music", label: "Eleven Music (배경음악)", cost_usd: 0.01, max_seconds: 180, active: false },
    ],
  },
  elevenlabs: {
    name: "ElevenLabs",
    base_url: elevenlabs.base,
    models: [
      { capability: "tts", model_id: "eleven_multilingual_v2", label: "ElevenLabs 다국어 v2 (고품질 음성)", cost_usd: 0.1 },
      { capability: "tts", model_id: "eleven_flash_v2_5", label: "ElevenLabs Flash (음성, 빠름)", cost_usd: 0.05, active: false },
      { capability: "music", model_id: "music_v1", label: "Eleven Music (배경음악)", cost_usd: 0.01, max_seconds: 180, active: false },
    ],
  },
  mock: {
    name: "개발용 가짜 AI",
    base_url: "",
    models: [
      { capability: "text", model_id: "mock-writer", label: "가짜 작가 (테스트)", cost_usd: 0.004 },
      { capability: "image", model_id: "mock-image", label: "가짜 이미지 (테스트)", cost_usd: 0.012 },
      { capability: "tts", model_id: "mock-voice", label: "가짜 음성 (테스트)", cost_usd: 0.08 },
      { capability: "video", model_id: "mock-video", label: "가짜 영상 (테스트)", cost_usd: 0.02, max_seconds: 10 },
      { capability: "music", model_id: "mock-music", label: "가짜 배경음악 (테스트)", cost_usd: 0.001, max_seconds: 60 },
    ],
  },
};

export const KIND_LABELS: Record<AiProviderKind, string> = {
  gemini: gemini.label,
  openai: openai.label,
  fal: fal.label,
  elevenlabs: elevenlabs.label,
  mock: "개발용 가짜 AI (키 없이 전체 흐름 확인 · 운영에서는 사용 불가)",
};

/** 목소리 선택지 (공급사별 기본) */
export const VOICES: Record<AiProviderKind, Array<{ id: string; label: string }>> = {
  gemini: [
    { id: "Kore", label: "여성 · 단단한" },
    { id: "Aoede", label: "여성 · 산뜻한" },
    { id: "Leda", label: "여성 · 젊은" },
    { id: "Puck", label: "남성 · 밝은" },
    { id: "Charon", label: "남성 · 차분한" },
    { id: "Fenrir", label: "남성 · 힘있는" },
  ],
  openai: [
    { id: "nova", label: "여성 · 밝은" },
    { id: "shimmer", label: "여성 · 부드러운" },
    { id: "coral", label: "여성 · 따뜻한" },
    { id: "alloy", label: "중성 · 담백한" },
    { id: "onyx", label: "남성 · 낮은" },
    { id: "echo", label: "남성 · 차분한" },
  ],
  elevenlabs: [
    { id: "JBFqnCBsd6RMkjVDRZzb", label: "George · 남성 내레이션" },
    { id: "EXAVITQu4vr4xnSDxMaL", label: "Sarah · 여성 내레이션" },
    { id: "pFZP5JQG7iQjIQuC4Bku", label: "Lily · 여성 차분한" },
    { id: "TX3LPaxmHKxFdv7VOQHJ", label: "Liam · 남성 젊은" },
  ],
  fal: [{ id: "", label: "기본 목소리" }],
  mock: [
    { id: "mock-a", label: "테스트 목소리 A" },
    { id: "mock-b", label: "테스트 목소리 B" },
  ],
};
