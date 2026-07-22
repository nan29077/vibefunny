"use client";

import { useRef, useState } from "react";
import { IconUpload, IconX, IconFilm, IconPlus } from "@/components/icons";

interface PoolItem {
  key: string;
  url: string;
  fileData: string;
  fileName: string;
  fileType: string;
}

interface Props {
  /** 배포 건수 N — 영상은 1~N개까지 등록 가능 */
  maxCount: number;
  /** 안내 문구 */
  hint?: string;
}

let __seq = 0;
const newKey = () => `pv_${Date.now()}_${__seq++}`;

/**
 * 광고주가 배포할 영상을 1~N개 직접 등록하는 입력.
 * 각 항목은 URL 또는 파일(Base64) 중 하나로 입력한다.
 * 폼 전송용 hidden input:
 *   pool_video_count
 *   pool_video_{i}_url / _file_data / _file_name / _file_type
 */
export function CampaignVideoPool({ maxCount, hint }: Props) {
  const [items, setItems] = useState<PoolItem[]>([
    { key: newKey(), url: "", fileData: "", fileName: "", fileType: "" },
  ]);
  const cap = Math.max(1, maxCount || 1);

  const update = (key: string, patch: Partial<PoolItem>) =>
    setItems((prev) => prev.map((it) => (it.key === key ? { ...it, ...patch } : it)));

  const add = () =>
    setItems((prev) =>
      prev.length >= cap
        ? prev
        : [...prev, { key: newKey(), url: "", fileData: "", fileName: "", fileType: "" }]
    );

  const remove = (key: string) =>
    setItems((prev) => (prev.length <= 1 ? prev : prev.filter((it) => it.key !== key)));

  // 유효(URL 또는 파일이 있는) 항목만 직렬화
  const valid = items.filter((it) => it.url.trim() || it.fileData);

  return (
    <div className="space-y-3">
      <input type="hidden" name="pool_video_count" value={valid.length} />
      {valid.map((it, i) => (
        <span key={`hid_${it.key}`}>
          <input type="hidden" name={`pool_video_${i}_url`} value={it.url.trim()} />
          <input type="hidden" name={`pool_video_${i}_file_data`} value={it.fileData} />
          <input type="hidden" name={`pool_video_${i}_file_name`} value={it.fileName} />
          <input type="hidden" name={`pool_video_${i}_file_type`} value={it.fileType} />
        </span>
      ))}

      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-700">
          배포할 영상 ({valid.length}/{cap})
        </span>
        <span className="text-xs text-gray-400">영상 1개당 크리에이터 1명에게 배타 분배됩니다</span>
      </div>

      {items.map((it, idx) => (
        <PoolRow
          key={it.key}
          index={idx}
          item={it}
          canRemove={items.length > 1}
          onChange={(patch) => update(it.key, patch)}
          onRemove={() => remove(it.key)}
        />
      ))}

      {items.length < cap && (
        <button
          type="button"
          onClick={add}
          className="flex items-center gap-1.5 rounded-xl border border-dashed border-brand-purple/50 px-3 py-2 text-sm font-medium text-brand-purple hover:bg-purple-50/40"
        >
          <IconPlus size={16} /> 영상 추가
        </button>
      )}
      {hint && <p className="text-xs text-gray-400">{hint}</p>}
    </div>
  );
}

function PoolRow({
  index,
  item,
  canRemove,
  onChange,
  onRemove,
}: {
  index: number;
  item: PoolItem;
  canRemove: boolean;
  onChange: (patch: Partial<PoolItem>) => void;
  onRemove: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = ev.target?.result;
      if (typeof result === "string") {
        onChange({ fileData: result, fileName: file.name, fileType: file.type });
      }
      setLoading(false);
    };
    reader.onerror = () => setLoading(false);
    reader.readAsDataURL(file);
  };

  const clearFile = () => {
    onChange({ fileData: "", fileName: "", fileType: "" });
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50/60 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-500">영상 #{index + 1}</span>
        {canRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="text-gray-400 hover:text-red-500"
            aria-label="영상 제거"
          >
            <IconX size={14} />
          </button>
        )}
      </div>

      <input
        type="url"
        value={item.url}
        onChange={(e) => onChange({ url: e.target.value })}
        placeholder="https://.../video.mp4 (영상 URL)"
        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-purple focus:outline-none"
      />

      {item.fileName ? (
        <div className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2">
          <IconFilm size={16} className="shrink-0 text-brand-purple" />
          <span className="flex-1 truncate text-sm text-gray-700">{item.fileName}</span>
          {loading && <span className="text-xs text-gray-400">처리 중...</span>}
          {!loading && (
            <button type="button" onClick={clearFile} className="text-gray-400 hover:text-red-500" aria-label="파일 제거">
              <IconX size={14} />
            </button>
          )}
        </div>
      ) : (
        <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-300 bg-white px-3 py-2 text-center hover:border-brand-purple">
          <IconUpload size={16} className="text-gray-400" />
          <span className="text-xs font-medium text-gray-500">또는 영상 파일 첨부</span>
          <input ref={inputRef} type="file" accept="video/*" onChange={handleFile} className="hidden" />
        </label>
      )}
    </div>
  );
}
