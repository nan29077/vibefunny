"use client";

import { useEffect, useState } from "react";
import { formatDate } from "@/lib/date";
import { IconFilm, IconLink, IconUsers, IconTag, IconClock } from "@/components/icons";

// ─── 타입 ──────────────────────────────────────────────────────────────────

interface VideoRow {
  id: string;
  title: string;
  creator_name: string;
  platform: string;
  price: number;
  vibeporter_price?: number;
  vibeporter_enabled: boolean;
  vibeporter_approved: boolean;
  vibeporter_approved_at?: string;
  thumbnail_url?: string | null;
  created_at: string;
}

interface RequestRow {
  id: string;
  title: string;
  description: string;
  budget: number;
  platform: string[];
  status: string;
  buyer_name: string;
  buyer_id: string;
  accepted_creator_id?: string;
  accepted_at?: string;
  created_at: string;
}

// ─── 헬퍼 ──────────────────────────────────────────────────────────────────

function formatKRW(n: number) {
  return n.toLocaleString("ko-KR") + "원";
}

const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  open:        { label: "모집중",    cls: "bg-blue-100 text-blue-700" },
  in_progress: { label: "진행중",    cls: "bg-amber-100 text-amber-800" },
  completed:   { label: "완료",      cls: "bg-green-100 text-green-700" },
  cancelled:   { label: "취소됨",    cls: "bg-gray-100 text-gray-500" },
};

const PLATFORM_LABELS: Record<string, string> = {
  youtube: "YouTube",
  instagram: "Instagram",
  tiktok: "TikTok",
  facebook: "Facebook",
};

// ─── 컴포넌트 ──────────────────────────────────────────────────────────────

export default function AdminVibeporterPage() {
  const [pendingVideos, setPendingVideos] = useState<VideoRow[]>([]);
  const [approvedVideos, setApprovedVideos] = useState<VideoRow[]>([]);
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"pending" | "approved" | "requests">("pending");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      const res = await fetch("/api/admin/vibeporter/status");
      if (res.ok) {
        const data = await res.json();
        setPendingVideos(data.pendingVideos ?? []);
        setApprovedVideos(data.approvedVideos ?? []);
        setRequests(data.requests ?? []);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleAction = async (videoId: string, action: "approve" | "reject") => {
    setActionLoading(videoId + action);
    await fetch("/api/admin/vibeporter/approve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ video_id: videoId, action }),
    });
    await fetchData();
    setActionLoading(null);
  };

  const tabBtn = (key: typeof tab, label: string, count: number) => (
    <button
      key={key}
      onClick={() => setTab(key)}
      className={[
        "flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-semibold transition-colors",
        tab === key
          ? "bg-amber-500 text-white shadow"
          : "bg-gray-100 text-gray-600 hover:bg-gray-200",
      ].join(" ")}
    >
      {label}
      <span className={[
        "rounded-full px-1.5 py-0.5 text-xs font-bold",
        tab === key ? "bg-white/30 text-white" : "bg-gray-200 text-gray-600",
      ].join(" ")}>{count}</span>
    </button>
  );

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100">
          <IconLink size={20} className="text-amber-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">바이브포터 연동 관리</h1>
          <p className="text-sm text-gray-500">영상 판매 노출 승인 및 의뢰 현황을 관리합니다.</p>
        </div>
      </div>

      {/* 요약 카드 */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "승인 대기", value: pendingVideos.length, cls: "text-yellow-600" },
          { label: "판매 중", value: approvedVideos.length, cls: "text-green-600" },
          { label: "의뢰 현황", value: requests.length, cls: "text-blue-600" },
        ].map((item) => (
          <div key={item.label} className="rounded-2xl border border-gray-200 bg-white p-4">
            <p className="text-xs text-gray-500">{item.label}</p>
            <p className={`mt-1 text-2xl font-bold ${item.cls}`}>{item.value}건</p>
          </div>
        ))}
      </div>

      {/* 탭 */}
      <div className="flex gap-2">
        {tabBtn("pending", "승인 대기", pendingVideos.length)}
        {tabBtn("approved", "판매 중 영상", approvedVideos.length)}
        {tabBtn("requests", "바이브포터 의뢰", requests.length)}
      </div>

      {/* 탭 콘텐츠 */}
      {loading ? (
        <div className="py-20 text-center text-sm text-gray-400">로딩 중...</div>
      ) : (
        <>
          {/* 승인 대기 */}
          {tab === "pending" && (
            <div>
              {pendingVideos.length === 0 ? (
                <div className="rounded-2xl border border-gray-200 bg-white py-16 text-center text-sm text-gray-400">
                  승인 대기 중인 영상이 없습니다.
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {pendingVideos.map((v) => (
                    <div key={v.id} className="flex flex-col rounded-2xl border border-yellow-200 bg-white p-4 gap-3">
                      {/* 썸네일 */}
                      <div className="aspect-video w-full overflow-hidden rounded-xl bg-gray-100 flex items-center justify-center">
                        {v.thumbnail_url ? (
                          <img src={v.thumbnail_url} alt={v.title} loading="lazy" decoding="async" className="h-full w-full object-cover" />
                        ) : (
                          <IconFilm size={28} className="text-gray-300" />
                        )}
                      </div>
                      <div>
                        <h3 className="font-bold text-gray-900 truncate">{v.title}</h3>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {PLATFORM_LABELS[v.platform] ?? v.platform} · {v.creator_name}
                        </p>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-semibold text-brand-purple">{formatKRW(v.price)}</span>
                        {v.vibeporter_price && (
                          <span className="text-xs text-amber-600">바이브포터가 {formatKRW(v.vibeporter_price)}</span>
                        )}
                      </div>
                      <div className="flex gap-2 border-t border-gray-100 pt-3">
                        <button
                          onClick={() => handleAction(v.id, "approve")}
                          disabled={actionLoading === v.id + "approve"}
                          className="flex-1 rounded-xl bg-amber-500 py-2 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-50"
                        >
                          ✓ 승인
                        </button>
                        <button
                          onClick={() => handleAction(v.id, "reject")}
                          disabled={actionLoading === v.id + "reject"}
                          className="flex-1 rounded-xl bg-red-50 py-2 text-sm font-semibold text-red-600 hover:bg-red-100 disabled:opacity-50"
                        >
                          ✕ 거절
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 승인된 판매 중 영상 */}
          {tab === "approved" && (
            <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
              {approvedVideos.length === 0 ? (
                <div className="py-16 text-center text-sm text-gray-400">바이브포터 판매 중인 영상이 없습니다.</div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-left text-xs font-bold text-gray-500">
                    <tr>
                      <th className="px-4 py-3">제목</th>
                      <th className="px-4 py-3">크리에이터</th>
                      <th className="px-4 py-3">플랫폼</th>
                      <th className="px-4 py-3">가격</th>
                      <th className="px-4 py-3">승인일</th>
                      <th className="px-4 py-3">관리</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {approvedVideos.map((v) => (
                      <tr key={v.id} className="hover:bg-gray-50/50">
                        <td className="px-4 py-3 font-medium text-gray-900 max-w-[160px] truncate">{v.title}</td>
                        <td className="px-4 py-3 text-gray-600">{v.creator_name}</td>
                        <td className="px-4 py-3 text-gray-500">{PLATFORM_LABELS[v.platform] ?? v.platform}</td>
                        <td className="px-4 py-3 font-semibold text-brand-purple">{formatKRW(v.vibeporter_price ?? v.price)}</td>
                        <td className="px-4 py-3 text-xs text-gray-400">{v.vibeporter_approved_at ? formatDate(v.vibeporter_approved_at) : "-"}</td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => handleAction(v.id, "reject")}
                            disabled={actionLoading === v.id + "reject"}
                            className="rounded-lg bg-red-50 px-2 py-1 text-xs font-semibold text-red-600 hover:bg-red-100 disabled:opacity-50"
                          >
                            노출 해제
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* 바이브포터 의뢰 */}
          {tab === "requests" && (
            <div className="space-y-3">
              {requests.length === 0 ? (
                <div className="rounded-2xl border border-gray-200 bg-white py-16 text-center text-sm text-gray-400">
                  바이브포터 의뢰가 없습니다.
                </div>
              ) : (
                requests.map((r) => {
                  const st = STATUS_MAP[r.status] ?? { label: r.status, cls: "bg-gray-100 text-gray-500" };
                  return (
                    <div key={r.id} className="rounded-2xl border border-gray-200 bg-white p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="font-bold text-gray-900 truncate">{r.title}</h3>
                            <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${st.cls}`}>
                              {st.label}
                            </span>
                          </div>
                          <p className="mt-1 text-sm text-gray-500 line-clamp-2">{r.description}</p>
                        </div>
                        <span className="shrink-0 font-bold text-amber-600">{formatKRW(r.budget)}</span>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <IconUsers size={11} />
                          구매자: {r.buyer_name} ({r.buyer_id})
                        </span>
                        <span className="flex items-center gap-1">
                          <IconTag size={11} />
                          {r.platform.map((p) => PLATFORM_LABELS[p] ?? p).join(", ")}
                        </span>
                        <span className="flex items-center gap-1">
                          <IconClock size={11} />
                          {formatDate(r.created_at)}
                        </span>
                        {r.accepted_creator_id && (
                          <span className="text-amber-600 font-semibold">
                            수락 크리에이터 ID: {r.accepted_creator_id}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
