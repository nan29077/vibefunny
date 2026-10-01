"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge, Button, Card, Input, Select, Textarea } from "@/components/ui";
import type { ProjectView } from "@/lib/ai/projects";
import type { AiCapability, ShortsShot } from "@/lib/schema";

// ===========================================================================
// AI 숏츠 편집기 (크리에이터)
// 1 대본 → 2 컷 이미지 → 3 내레이션 → 4 영상 클립(선택) → 5 배경음악(선택) → 6 합성
// - AI 작업 전에는 항상 서버가 계산한 예상 퍼니를 보여 주고 확인을 받는다
// - 작업이 진행 중이면 2.5초마다 상태를 새로 고친다 (편집 중인 내용은 덮어쓰지 않음)
// ===========================================================================

type Wallet = { paid: number; bonus: number; held: number; available: number };
type Access = { open: boolean; reason: string };
type Caps = Record<AiCapability, { ready: boolean; model: string | null; maxSeconds: number | null }>;
type View = ProjectView & { wallet: Wallet; access: Access; capabilities: Caps };
type Action = "script" | "images" | "tts" | "videos" | "music" | "compose";
type Estimate = { lines: Array<{ label: string; funny: number; model: string | null }>; total: number; wallet: Wallet };
type JobBrief = NonNullable<View["composeJob"]>;

const funny = (n: number) => `${Math.round(n).toLocaleString("ko-KR")}퍼니`;
const media = (id: string | null | undefined, download = false) => (id ? `/api/ai-shorts/media/${id}${download ? "?download=1" : ""}` : "");
const editableShot = (s: ShortsShot) => ({ id: s.id, narration: s.narration, caption: s.caption, visual: s.visual, camera_move: s.camera_move, seconds: s.seconds, use_video: s.use_video });
type DraftShot = ReturnType<typeof editableShot>;
type Draft = { title: string; topic: string; template: string; tone: string; target_seconds: number; voice: string; bgm_prompt: string; bgm_volume: number; subtitle_position: "bottom" | "middle" | "top"; description: string; hashtags: string; shots: DraftShot[] };
const toDraft = (v: View): Draft => ({
  title: v.project.title,
  topic: v.project.topic,
  template: v.project.template,
  tone: v.project.tone,
  target_seconds: v.project.target_seconds,
  voice: v.project.voice,
  bgm_prompt: v.project.bgm_prompt,
  bgm_volume: v.project.bgm_volume,
  subtitle_position: v.project.subtitle_position,
  description: v.project.description,
  hashtags: v.project.hashtags.join(" "),
  shots: v.project.shots.map(editableShot),
});

function JobState({ job, label }: { job: JobBrief | null | undefined; label: string }) {
  if (!job) return null;
  if (job.status === "queued" || job.status === "running") {
    return <span className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600"><span className="h-2 w-2 animate-pulse rounded-full bg-blue-500" />{label} 만드는 중{job.progress > 0 && job.progress < 1 ? ` ${Math.round(job.progress * 100)}%` : ""}</span>;
  }
  if (job.status === "failed" || job.status === "cancelled") return <span className="text-xs text-red-600">{job.error}</span>;
  return null;
}

export function ShortsEditor({
  initial,
  templates,
  tones,
  cameraMoves,
  voices,
}: {
  initial: View;
  templates: Array<{ id: string; label: string }>;
  tones: string[];
  cameraMoves: string[];
  voices: Array<{ id: string; label: string }>;
}) {
  const router = useRouter();
  const [view, setView] = useState<View>(initial);
  const [draft, setDraft] = useState<Draft>(() => toDraft(initial));
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [confirm, setConfirm] = useState<{ action: Action; shotIds?: string[]; title: string; estimate: Estimate; key: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const dirtyRef = useRef(false);
  dirtyRef.current = dirty;
  const readOnly = !view.access.open;
  const p = view.project;

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/ai-shorts/projects/${p.id}`, { cache: "no-store" });
    if (!res.ok) return;
    const next = (await res.json()) as View;
    setView(next);
    // 편집 중이 아니면 서버 내용으로 맞추고, 편집 중이면 새로 생긴/사라진 컷만 반영하지 않는다
    if (!dirtyRef.current) setDraft(toDraft(next));
  }, [p.id]);

  // 진행 중인 작업이 있으면 2.5초마다 새로 고침
  useEffect(() => {
    if (view.activeCount === 0) return;
    const t = setInterval(() => void refresh(), 2500);
    return () => clearInterval(t);
  }, [view.activeCount, refresh]);

  // 저장 안 한 편집이 있으면 나가기 전에 경고
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!dirtyRef.current) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  const shotById = useMemo(() => new Map(p.shots.map((s) => [s.id, s])), [p.shots]);
  const totalSeconds = draft.shots.reduce((a, s) => a + (Number(s.seconds) || 0), 0);

  function edit<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
    setDirty(true);
  }
  function editShot(i: number, patch: Partial<DraftShot>) {
    setDraft((d) => ({ ...d, shots: d.shots.map((s, k) => (k === i ? { ...s, ...patch } : s)) }));
    setDirty(true);
  }
  function moveShot(i: number, dir: -1 | 1) {
    setDraft((d) => {
      const shots = [...d.shots];
      const j = i + dir;
      if (j < 0 || j >= shots.length) return d;
      [shots[i], shots[j]] = [shots[j], shots[i]];
      return { ...d, shots };
    });
    setDirty(true);
  }
  function removeShot(i: number) {
    const s = draft.shots[i];
    const server = s.id ? shotById.get(s.id) : undefined;
    if (server && (server.image_file_id || server.audio_file_id || server.video_file_id) && !window.confirm("이 컷과 컷에서 만든 이미지·음성·영상을 삭제할까요? (사용한 퍼니는 돌아오지 않습니다)")) return;
    setDraft((d) => ({ ...d, shots: d.shots.filter((_, k) => k !== i) }));
    setDirty(true);
  }
  function addShot() {
    if (draft.shots.length >= 12) return;
    setDraft((d) => ({ ...d, shots: [...d.shots, { id: "", narration: "", caption: "", visual: "", camera_move: cameraMoves[0], seconds: 4, use_video: false }] }));
    setDirty(true);
  }

  async function save(silent = false): Promise<boolean> {
    if (!dirty) return true;
    setSaving(true);
    try {
      const res = await fetch(`/api/ai-shorts/projects/${p.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: draft.title,
          topic: draft.topic,
          template: draft.template,
          tone: draft.tone,
          target_seconds: draft.target_seconds,
          voice: draft.voice,
          bgm_prompt: draft.bgm_prompt,
          bgm_volume: draft.bgm_volume,
          subtitle_position: draft.subtitle_position,
          description: draft.description,
          hashtags: draft.hashtags.split(/[\s,]+/).filter(Boolean),
          shots: draft.shots.map((s) => ({ ...s, id: s.id || undefined, seconds: Number(s.seconds) || 4 })),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "저장하지 못했습니다.");
      setDirty(false);
      dirtyRef.current = false;
      await refresh();
      if (!silent) setNotice({ ok: true, text: "저장했습니다." });
      return true;
    } catch (err) {
      setNotice({ ok: false, text: (err as Error).message });
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function ask(action: Action, title: string, shotIds?: string[]) {
    setNotice(null);
    if (!(await save(true))) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/ai-shorts/projects/${p.id}/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, shotIds, estimateOnly: true }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "견적을 계산하지 못했습니다.");
      setConfirm({ action, shotIds, title, estimate: data as Estimate, key: `${action}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}` });
    } catch (err) {
      setNotice({ ok: false, text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  }

  async function run() {
    if (!confirm) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/ai-shorts/projects/${p.id}/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: confirm.action, shotIds: confirm.shotIds, idempotencyKey: confirm.key }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "시작하지 못했습니다.");
      setConfirm(null);
      setNotice({ ok: true, text: data.held > 0 ? `${funny(data.held)}를 예약하고 시작했습니다. 완료되면 실제 사용량만 차감됩니다.` : "시작했습니다." });
      await refresh();
    } catch (err) {
      setNotice({ ok: false, text: (err as Error).message });
      setConfirm(null);
    } finally {
      setBusy(false);
    }
  }

  async function cancelJob(jobId: string) {
    const res = await fetch(`/api/ai-shorts/jobs/${jobId}/cancel`, { method: "POST" });
    const data = await res.json().catch(() => ({}));
    setNotice(res.ok ? { ok: true, text: "작업을 취소하고 퍼니를 돌려드렸습니다." } : { ok: false, text: data.error || "취소하지 못했습니다." });
    await refresh();
  }

  async function removeProject() {
    if (!window.confirm("이 숏츠와 만든 결과물을 모두 삭제할까요? 되돌릴 수 없습니다.")) return;
    const res = await fetch(`/api/ai-shorts/projects/${p.id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return setNotice({ ok: false, text: data.error || "삭제하지 못했습니다." });
    dirtyRef.current = false;
    router.push("/creator/ai-shorts");
    router.refresh();
  }

  const hasShots = p.shots.length > 0;
  const missingImages = p.shots.filter((s) => !s.image_file_id).length;
  const missingAudio = p.shots.filter((s) => !s.audio_file_id && s.narration.trim()).length;
  const caps = view.capabilities;
  const composing = view.composeJob && (view.composeJob.status === "queued" || view.composeJob.status === "running");
  const steps = [
    { n: 1, label: "대본", done: hasShots },
    { n: 2, label: "컷 이미지", done: hasShots && missingImages === 0 },
    { n: 3, label: "내레이션", done: hasShots && missingAudio === 0 },
    { n: 4, label: "영상 클립", done: p.shots.some((s) => s.video_file_id), optional: true },
    { n: 5, label: "배경음악", done: !!p.bgm_file_id, optional: true },
    { n: 6, label: "합성", done: !!p.output_file_id },
  ];

  return (
    <div className="space-y-5 pb-24">
      {/* 머리 */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <Link href="/creator/ai-shorts" className="text-xs text-gray-500 hover:underline">← 내 숏츠</Link>
          <input
            aria-label="숏츠 제목"
            value={draft.title}
            onChange={(e) => edit("title", e.target.value)}
            placeholder={p.topic}
            disabled={readOnly}
            maxLength={80}
            className="mt-1 w-full truncate bg-transparent text-2xl font-extrabold text-gray-900 outline-none placeholder:text-gray-400 focus:rounded-lg focus:ring-2 focus:ring-brand-purple/30"
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-purple-50 px-3 py-1.5 text-sm font-bold text-brand-purple" title={`보너스 ${funny(view.wallet.bonus)} 포함 · 예약 ${funny(view.wallet.held)}`}>{funny(view.wallet.available)}</span>
          <Link href="/creator/funny" className="text-xs font-semibold text-brand-purple hover:underline">충전</Link>
        </div>
      </div>

      {readOnly && (
        <Card className="border-yellow-200 bg-yellow-50 text-sm text-yellow-900">
          {view.access.reason} 지금은 보기·다운로드와 합성(무료)만 할 수 있습니다. 진행 중이던 작업은 끝까지 처리됩니다.
        </Card>
      )}
      {notice && (
        <div role="status" className={`rounded-xl px-3 py-2 text-sm ${notice.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
          {notice.text}
        </div>
      )}

      {/* 단계 */}
      <ol className="flex flex-wrap gap-2">
        {steps.map((s) => (
          <li key={s.n} className={`rounded-full px-3 py-1 text-xs font-semibold ${s.done ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
            {s.done ? "✓" : s.n} {s.label}{s.optional ? " (선택)" : ""}
          </li>
        ))}
      </ol>

      {/* 1. 대본 */}
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-bold">1. 주제와 대본</h2>
          <JobState job={view.scriptJob} label="대본" />
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-4">
          <label className="sm:col-span-4">
            <span className="mb-1 block text-sm font-medium text-gray-700">주제</span>
            <Textarea value={draft.topic} onChange={(e) => edit("topic", e.target.value)} disabled={readOnly} maxLength={300} className="min-h-[60px]" />
          </label>
          <label>
            <span className="mb-1 block text-sm font-medium text-gray-700">형식</span>
            <Select value={draft.template} onChange={(e) => edit("template", e.target.value)} disabled={readOnly}>
              {templates.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
            </Select>
          </label>
          <label>
            <span className="mb-1 block text-sm font-medium text-gray-700">말투</span>
            <Select value={draft.tone} onChange={(e) => edit("tone", e.target.value)} disabled={readOnly}>
              {tones.map((t) => <option key={t} value={t}>{t}</option>)}
            </Select>
          </label>
          <label>
            <span className="mb-1 block text-sm font-medium text-gray-700">목표 길이</span>
            <Select value={String(draft.target_seconds)} onChange={(e) => edit("target_seconds", Number(e.target.value))} disabled={readOnly}>
              {[15, 30, 45, 60].map((n) => <option key={n} value={n}>{n}초</option>)}
            </Select>
          </label>
          <label>
            <span className="mb-1 block text-sm font-medium text-gray-700">목소리</span>
            <Select value={draft.voice} onChange={(e) => edit("voice", e.target.value)} disabled={readOnly}>
              {voices.length === 0 && <option value="">기본 목소리</option>}
              {voices.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}
            </Select>
          </label>
        </div>
        {!readOnly && (
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              onClick={() => {
                if (hasShots && !window.confirm("대본을 다시 만들면 지금 컷과 컷에서 만든 이미지·음성·영상이 모두 새 대본으로 바뀝니다. 계속할까요?")) return;
                void ask("script", hasShots ? "대본 다시 만들기" : "대본 만들기");
              }}
              disabled={busy || !caps.text.ready || !!(view.scriptJob && ["queued", "running"].includes(view.scriptJob.status))}
            >
              {hasShots ? "대본 다시 만들기" : "AI로 대본 만들기"}
            </Button>
            {!caps.text.ready && <span className="self-center text-xs text-red-600">대본 AI가 준비되지 않았습니다.</span>}
          </div>
        )}
        {p.hook && <p className="mt-3 rounded-xl bg-gray-50 px-3 py-2 text-sm text-gray-700"><b>훅</b> {p.hook}</p>}
      </Card>

      {/* 2~4. 컷 */}
      {draft.shots.length > 0 && (
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-bold">2~4. 컷 ({draft.shots.length}개 · 약 {totalSeconds}초)</h2>
            {!readOnly && (
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" disabled={busy || !caps.image.ready || missingImages === 0} onClick={() => void ask("images", "빈 컷 이미지 모두 만들기")}>
                  이미지 모두 만들기{missingImages ? ` (${missingImages})` : ""}
                </Button>
                <Button size="sm" variant="outline" disabled={busy || !caps.tts.ready || missingAudio === 0} onClick={() => void ask("tts", "빈 내레이션 모두 만들기")}>
                  내레이션 모두 만들기{missingAudio ? ` (${missingAudio})` : ""}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy || !caps.video.ready || p.shots.every((s) => !s.image_file_id || s.video_file_id)}
                  onClick={() => void ask("videos", "이미지가 있는 컷을 AI 영상 클립으로 만들기")}
                  title="이미지를 움직이는 AI 영상으로 바꿉니다. 비용이 큰 작업입니다."
                >
                  영상 클립 모두 만들기
                </Button>
              </div>
            )}
          </div>
          {!caps.video.ready && <p className="mt-1 text-xs text-gray-400">AI 영상 클립은 관리자가 준비하면 쓸 수 있습니다. 영상 클립 없이도 이미지에 카메라 움직임을 넣어 합성됩니다.</p>}

          <div className="mt-4 space-y-4">
            {draft.shots.map((s, i) => {
              const server = s.id ? shotById.get(s.id) : undefined;
              const jobs = s.id ? view.shotJobs[s.id] : undefined;
              const stale = server?.audio_file_id && server.audio_text !== undefined && server.audio_text !== null && server.audio_text !== s.narration;
              return (
                <div key={s.id || `new-${i}`} className="rounded-2xl border border-gray-200 p-3 sm:p-4">
                  <div className="flex flex-col gap-4 sm:flex-row">
                    {/* 미리보기 */}
                    <div className="w-full shrink-0 sm:w-36">
                      <div className="relative aspect-[9/16] w-full max-w-[160px] overflow-hidden rounded-xl bg-gray-100">
                        {server?.use_video && server.video_file_id ? (
                          <video src={media(server.video_file_id)} className="h-full w-full object-cover" muted loop playsInline controls preload="metadata" />
                        ) : server?.image_file_id ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={media(server.image_file_id)} alt={`${i + 1}번 컷 이미지`} className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full items-center justify-center px-2 text-center text-xs text-gray-400">이미지 없음</div>
                        )}
                        <span className="absolute left-1.5 top-1.5 rounded-md bg-black/60 px-1.5 py-0.5 text-[11px] font-bold text-white">{i + 1}</span>
                      </div>
                      {server?.audio_file_id && <audio src={media(server.audio_file_id)} controls preload="none" className="mt-2 w-full max-w-[160px]" />}
                    </div>
                    {/* 편집 */}
                    <div className="min-w-0 flex-1 space-y-2">
                      <label className="block">
                        <span className="text-xs font-medium text-gray-600">내레이션 (음성으로 읽을 문장)</span>
                        <Textarea value={s.narration} onChange={(e) => editShot(i, { narration: e.target.value })} disabled={readOnly} maxLength={200} className="min-h-[56px]" />
                        {stale && <span className="text-[11px] text-orange-600">내레이션이 바뀌었습니다. 음성을 다시 만들어 주세요.</span>}
                      </label>
                      <div className="grid gap-2 sm:grid-cols-3">
                        <label className="sm:col-span-2">
                          <span className="text-xs font-medium text-gray-600">화면 자막 (18자 내외)</span>
                          <Input value={s.caption} onChange={(e) => editShot(i, { caption: e.target.value })} disabled={readOnly} maxLength={40} />
                        </label>
                        <label>
                          <span className="text-xs font-medium text-gray-600">길이(초)</span>
                          <Input type="number" min={2} max={10} value={s.seconds} onChange={(e) => editShot(i, { seconds: Math.max(2, Math.min(10, Number(e.target.value) || 2)) })} disabled={readOnly} />
                        </label>
                      </div>
                      <label className="block">
                        <span className="text-xs font-medium text-gray-600">장면 묘사 (이미지·영상 AI에 전달, 영어 권장)</span>
                        <Textarea value={s.visual} onChange={(e) => editShot(i, { visual: e.target.value })} disabled={readOnly} maxLength={800} className="min-h-[56px] text-xs" />
                      </label>
                      <div className="flex flex-wrap items-end gap-2">
                        <label>
                          <span className="text-xs font-medium text-gray-600">카메라 움직임</span>
                          <Select value={s.camera_move} onChange={(e) => editShot(i, { camera_move: e.target.value })} disabled={readOnly} className="py-1.5">
                            {cameraMoves.map((m) => <option key={m} value={m}>{m}</option>)}
                          </Select>
                        </label>
                        {server?.video_file_id && (
                          <label className="flex items-center gap-1.5 pb-2 text-xs text-gray-700">
                            <input type="checkbox" checked={s.use_video} onChange={(e) => editShot(i, { use_video: e.target.checked })} disabled={readOnly} className="h-4 w-4" />
                            합성에 AI 영상 클립 사용
                          </label>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        {!readOnly && s.id && (
                          <>
                            <Button size="sm" variant="secondary" disabled={busy || !caps.image.ready || isActive(jobs?.image)} onClick={() => void ask("images", `${i + 1}번 컷 이미지 ${server?.image_file_id ? "다시 " : ""}만들기`, [s.id])}>
                              {server?.image_file_id ? "이미지 다시" : "이미지 만들기"}
                            </Button>
                            <Button size="sm" variant="secondary" disabled={busy || !caps.tts.ready || !s.narration.trim() || isActive(jobs?.tts)} onClick={() => void ask("tts", `${i + 1}번 컷 내레이션 ${server?.audio_file_id ? "다시 " : ""}만들기`, [s.id])}>
                              {server?.audio_file_id ? "음성 다시" : "음성 만들기"}
                            </Button>
                            <Button size="sm" variant="outline" disabled={busy || !caps.video.ready || !server?.image_file_id || isActive(jobs?.video)} onClick={() => void ask("videos", `${i + 1}번 컷 AI 영상 클립 만들기`, [s.id])}>
                              {server?.video_file_id ? "영상 다시" : "영상 클립"}
                            </Button>
                          </>
                        )}
                        {!readOnly && !s.id && <span className="text-xs text-gray-400">저장하면 이 컷에서 AI 생성을 쓸 수 있습니다.</span>}
                        {!readOnly && (
                          <span className="ml-auto flex gap-1">
                            <Button size="sm" variant="ghost" aria-label="위로" disabled={i === 0} onClick={() => moveShot(i, -1)}>↑</Button>
                            <Button size="sm" variant="ghost" aria-label="아래로" disabled={i === draft.shots.length - 1} onClick={() => moveShot(i, 1)}>↓</Button>
                            <Button size="sm" variant="ghost" aria-label="컷 삭제" onClick={() => removeShot(i)}>삭제</Button>
                          </span>
                        )}
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <JobState job={jobs?.image} label="이미지" />
                        <JobState job={jobs?.tts} label="음성" />
                        <JobState job={jobs?.video} label="영상 클립" />
                        {[jobs?.image, jobs?.tts, jobs?.video].filter((j) => j?.canCancel).map((j) => (
                          <button key={j!.id} type="button" onClick={() => void cancelJob(j!.id)} className="w-fit text-[11px] text-gray-500 underline">대기 중인 작업 취소</button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          {!readOnly && draft.shots.length < 12 && (
            <Button variant="ghost" size="sm" className="mt-3" onClick={addShot}>+ 컷 추가</Button>
          )}
        </Card>
      )}

      {/* 5. 배경음악 · 자막 */}
      {hasShots && (
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-bold">5. 배경음악 · 자막 (선택)</h2>
            <JobState job={view.musicJob} label="배경음악" />
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <label className="sm:col-span-2">
              <span className="mb-1 block text-sm font-medium text-gray-700">배경음악 분위기 (영어 권장)</span>
              <Input value={draft.bgm_prompt} onChange={(e) => edit("bgm_prompt", e.target.value)} disabled={readOnly} maxLength={300} placeholder="upbeat, cheerful, instrumental" />
            </label>
            <label>
              <span className="mb-1 block text-sm font-medium text-gray-700">자막 위치</span>
              <Select value={draft.subtitle_position} onChange={(e) => edit("subtitle_position", e.target.value as Draft["subtitle_position"])} disabled={readOnly}>
                <option value="bottom">아래</option>
                <option value="middle">가운데</option>
                <option value="top">위</option>
              </Select>
            </label>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            {p.bgm_file_id && <audio src={media(p.bgm_file_id)} controls preload="none" className="max-w-full" />}
            <label className="flex items-center gap-2 text-xs text-gray-600">
              음악 크기
              <input type="range" min={0} max={1} step={0.05} value={draft.bgm_volume} onChange={(e) => edit("bgm_volume", Number(e.target.value))} disabled={readOnly} />
              {Math.round(draft.bgm_volume * 100)}%
            </label>
          </div>
          {!readOnly && (
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" variant="outline" disabled={busy || !caps.music.ready || isActive(view.musicJob)} onClick={() => void ask("music", p.bgm_file_id ? "배경음악 다시 만들기" : "배경음악 만들기")}>
                {p.bgm_file_id ? "배경음악 다시 만들기" : "AI 배경음악 만들기"}
              </Button>
              {!caps.music.ready && <span className="self-center text-xs text-gray-400">배경음악 AI는 관리자가 준비하면 쓸 수 있습니다.</span>}
            </div>
          )}
        </Card>
      )}

      {/* 6. 합성 */}
      {hasShots && (
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-bold">6. 합성 · 완성 (무료)</h2>
            <JobState job={view.composeJob} label="합성" />
          </div>
          <p className="mt-1 text-xs text-gray-500">컷 이미지(또는 영상 클립) + 내레이션 + 자막 + 배경음악을 세로 720×1280 MP4로 합칩니다. 퍼니가 들지 않습니다.</p>
          {p.compose_error && !composing && <p className="mt-2 text-sm text-red-600">{p.compose_error}</p>}
          <div className="mt-3 flex flex-wrap gap-2">
            <Button disabled={busy || !!composing || missingImages > 0} onClick={() => void ask("compose", p.output_file_id ? "다시 합성하기" : "숏츠 합성하기")}>
              {composing ? "합성 중..." : p.output_file_id ? "다시 합성하기" : "숏츠 합성하기"}
            </Button>
            {missingImages > 0 && <span className="self-center text-xs text-orange-600">이미지가 없는 컷 {missingImages}개를 먼저 만들어 주세요.</span>}
          </div>
          {p.output_file_id && (
            <div className="mt-4 flex flex-col gap-4 sm:flex-row">
              <video src={media(p.output_file_id)} controls playsInline preload="metadata" className="aspect-[9/16] w-full max-w-[260px] rounded-2xl bg-black" />
              <div className="min-w-0 flex-1 space-y-3">
                <a href={media(p.output_file_id, true)} className="inline-flex h-10 items-center rounded-xl bg-gradient-to-r from-brand-purple to-brand-pink px-4 text-sm font-semibold text-white">MP4 내려받기{p.output_seconds ? ` (${p.output_seconds}초)` : ""}</a>
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-gray-700">업로드 설명</span>
                  <Textarea value={draft.description} onChange={(e) => edit("description", e.target.value)} disabled={readOnly} maxLength={1000} />
                </label>
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-gray-700">해시태그</span>
                  <Input value={draft.hashtags} onChange={(e) => edit("hashtags", e.target.value)} disabled={readOnly} placeholder="쇼츠 꿀팁" />
                </label>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const text = `${draft.title || p.topic}\n\n${draft.description}\n\n${draft.hashtags.split(/[\s,]+/).filter(Boolean).map((h) => "#" + h.replace(/^#/, "")).join(" ")}`;
                    void navigator.clipboard?.writeText(text).then(() => setNotice({ ok: true, text: "제목·설명·해시태그를 복사했습니다." }));
                  }}
                >
                  제목·설명·해시태그 복사
                </Button>
                <p className="text-xs text-gray-400">AI로 만든 영상임을 업로드 플랫폼 정책에 맞게 표시해 주세요. 실존 인물·브랜드를 사실과 다르게 표현하지 마세요.</p>
              </div>
            </div>
          )}
        </Card>
      )}

      <div className="flex justify-between">
        <span className="text-xs text-gray-400">이 숏츠에 사용한 퍼니: {funny(view.spent)}</span>
        <button type="button" onClick={() => void removeProject()} className="text-xs text-red-500 underline">숏츠 삭제</button>
      </div>

      {/* 저장 막대 */}
      {dirty && !readOnly && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-gray-200 bg-white/95 px-4 py-3 backdrop-blur">
          <div className="mx-auto flex max-w-4xl items-center justify-between gap-3">
            <span className="text-sm text-gray-600">저장하지 않은 변경이 있습니다.</span>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => { setDraft(toDraft(view)); setDirty(false); }}>되돌리기</Button>
              <Button size="sm" disabled={saving} onClick={() => void save()}>{saving ? "저장 중..." : "저장"}</Button>
            </div>
          </div>
        </div>
      )}

      {/* 퍼니 확인 창 */}
      {confirm && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 p-4 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="funny-confirm-title">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
            <h3 id="funny-confirm-title" className="text-lg font-bold">{confirm.title}</h3>
            {confirm.estimate.total === 0 ? (
              <p className="mt-2 text-sm text-gray-600">이 작업은 퍼니가 들지 않습니다.</p>
            ) : (
              <>
                <ul className="mt-3 max-h-52 space-y-1 overflow-y-auto text-sm">
                  {confirm.estimate.lines.map((l, k) => (
                    <li key={k} className="flex justify-between gap-2"><span className="truncate text-gray-600">{l.label}{l.model ? ` · ${l.model}` : ""}</span><span className="shrink-0 font-semibold">{funny(l.funny)}</span></li>
                  ))}
                </ul>
                <div className="mt-3 flex justify-between border-t pt-3 text-sm"><span className="font-bold">예상 합계</span><span className="font-extrabold text-brand-purple">{funny(confirm.estimate.total)}</span></div>
                <div className="mt-1 flex justify-between text-xs text-gray-500"><span>사용 가능</span><span>{funny(confirm.estimate.wallet.available)}</span></div>
                <p className="mt-2 text-xs text-gray-500">예상 퍼니를 먼저 예약하고, 완료되면 실제 사용량만 차감합니다. 실패하면 전액 돌려드립니다.</p>
              </>
            )}
            {confirm.estimate.total > confirm.estimate.wallet.available ? (
              <div className="mt-4 flex gap-2">
                <Button variant="ghost" className="flex-1" onClick={() => setConfirm(null)}>닫기</Button>
                <Link href="/creator/funny" className="flex h-10 flex-1 items-center justify-center rounded-xl bg-gradient-to-r from-brand-purple to-brand-pink text-sm font-semibold text-white">퍼니 충전하기</Link>
              </div>
            ) : (
              <div className="mt-4 flex gap-2">
                <Button variant="ghost" className="flex-1" onClick={() => setConfirm(null)} disabled={busy}>취소</Button>
                <Button className="flex-1" onClick={() => void run()} disabled={busy}>{busy ? "시작 중..." : confirm.estimate.total ? `${funny(confirm.estimate.total)} 사용하기` : "시작하기"}</Button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function isActive(job: JobBrief | null | undefined) {
  return !!job && (job.status === "queued" || job.status === "running");
}
