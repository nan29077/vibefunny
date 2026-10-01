"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Field, Input, Select, Textarea } from "@/components/ui";

export function NewShortsForm({
  templates,
  tones,
  voices,
}: {
  templates: Array<{ id: string; label: string; desc: string }>;
  tones: string[];
  voices: Array<{ id: string; label: string }>;
}) {
  const router = useRouter();
  const [template, setTemplate] = useState(templates[0]?.id ?? "info");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    const fd = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/ai-shorts/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: String(fd.get("topic") || ""),
          template,
          tone: String(fd.get("tone") || tones[0]),
          target_seconds: Number(fd.get("target_seconds") || 30),
          voice: String(fd.get("voice") || ""),
          title: String(fd.get("title") || ""),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "만들지 못했습니다.");
      router.push(`/creator/ai-shorts/${data.id}`);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <Card>
      <h2 className="text-base font-bold">새 숏츠</h2>
      <form onSubmit={submit} className="mt-4 space-y-4">
        <div>
          <span className="mb-1 block text-sm font-medium text-gray-700">형식</span>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {templates.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTemplate(t.id)}
                aria-pressed={template === t.id}
                className={`rounded-xl border px-3 py-2.5 text-left transition ${template === t.id ? "border-brand-purple bg-purple-50" : "border-gray-200 hover:border-gray-300"}`}
              >
                <div className="text-sm font-bold text-gray-900">{t.label}</div>
                <div className="text-xs text-gray-500">{t.desc}</div>
              </button>
            ))}
          </div>
        </div>
        <Field label="주제" htmlFor="ns-topic" required hint="예: 아침 5분 스트레칭 효과, 신상 무선이어폰 장단점, 이번 주 화제의 IT 뉴스">
          <Textarea id="ns-topic" name="topic" required minLength={2} maxLength={300} placeholder="어떤 숏츠를 만들까요?" className="min-h-[70px]" />
        </Field>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="길이" htmlFor="ns-len">
            <Select id="ns-len" name="target_seconds" defaultValue="30">
              <option value="15">15초</option>
              <option value="30">30초</option>
              <option value="45">45초</option>
              <option value="60">60초</option>
            </Select>
          </Field>
          <Field label="말투" htmlFor="ns-tone">
            <Select id="ns-tone" name="tone" defaultValue={tones[0]}>
              {tones.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </Select>
          </Field>
          <Field label="내레이션 목소리" htmlFor="ns-voice">
            <Select id="ns-voice" name="voice" defaultValue={voices[0]?.id ?? ""}>
              {voices.length === 0 && <option value="">기본 목소리</option>}
              {voices.map((v) => (
                <option key={v.id} value={v.id}>{v.label}</option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="제목 (선택)" htmlFor="ns-title" hint="비워 두면 AI가 대본과 함께 제목을 지어 줍니다.">
          <Input id="ns-title" name="title" maxLength={80} />
        </Field>
        {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <Button type="submit" disabled={busy} className="w-full sm:w-auto">{busy ? "만드는 중..." : "숏츠 시작하기 (무료)"}</Button>
        <p className="text-xs text-gray-500">숏츠를 시작하는 것은 무료이며, 대본·이미지·음성·영상을 AI로 만들 때마다 예상 퍼니를 먼저 보여 드립니다.</p>
      </form>
    </Card>
  );
}
