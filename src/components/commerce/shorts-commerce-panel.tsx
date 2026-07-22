"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useFormState } from "react-dom";
import { Card, Field, Input, Select, Textarea, Badge, Button, EmptyState } from "@/components/ui";
import { SubmitButton, FormMessage, initialActionState } from "@/components/form";
import { saveShortsLinkAction, deleteShortsLinkAction } from "@/lib/actions/commerce-actions";
import { recommendProducts } from "@/lib/recommend";
import { creatorCommission } from "@/lib/commerce";
import { formatKRW } from "@/lib/money";
import { IconFilm, IconShoppingBag, IconCheck } from "@/components/icons";
import type { Product, ProductCategory, CreatorYoutubeChannel, CreatorShortsLink } from "@/lib/schema";

export interface SourceVideo {
  id: string;
  title: string;
  url: string;
  thumbnail: string | null;
}

export function ShortsCommercePanel({
  products,
  categories,
  channels,
  links,
  vibeporterVideos,
}: {
  products: Product[];
  categories: ProductCategory[];
  channels: CreatorYoutubeChannel[];
  links: CreatorShortsLink[];
  vibeporterVideos: SourceVideo[];
}) {
  const [state, action] = useFormState(saveShortsLinkAction, initialActionState);

  const [editId, setEditId] = useState("");
  const [shortsUrl, setShortsUrl] = useState("");
  const [title, setTitle] = useState("");
  const [contentNote, setContentNote] = useState("");
  const [channelId, setChannelId] = useState("");
  const [videoSource, setVideoSource] = useState<"self" | "vibeporter">("self");
  const [sourceVideoId, setSourceVideoId] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [showAll, setShowAll] = useState(false);
  const [search, setSearch] = useState("");

  const productMap = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const vpMap = useMemo(() => new Map(vibeporterVideos.map((v) => [v.id, v])), [vibeporterVideos]);

  const recommended = useMemo(
    () => recommendProducts(products, categories, { title, content: contentNote, shortsUrl }, 6),
    [products, categories, title, contentNote, shortsUrl]
  );

  const allFiltered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (p) => p.name.toLowerCase().includes(q) || p.keywords.some((k) => k.toLowerCase().includes(q))
    );
  }, [products, search]);

  const prevOk = useRef(false);
  useEffect(() => {
    if (state.ok && !prevOk.current) {
      setEditId(""); setShortsUrl(""); setTitle(""); setContentNote("");
      setChannelId(""); setSelected([]); setShowAll(false); setSearch("");
      setVideoSource("self"); setSourceVideoId("");
    }
    prevOk.current = state.ok;
  }, [state.ok]);

  const toggle = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const startEdit = (link: CreatorShortsLink) => {
    setEditId(link.id);
    setShortsUrl(link.shorts_url);
    setTitle(link.title);
    setContentNote(link.content_note);
    setChannelId(link.channel_id ?? "");
    setVideoSource(link.video_source === "vibeporter" ? "vibeporter" : "self");
    setSourceVideoId(link.source_video_id ?? "");
    setSelected(link.linked_product_ids.filter((id) => productMap.has(id)));
    setShowAll(false);
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const onPickVibeporter = (id: string) => {
    setSourceVideoId(id);
    const v = vpMap.get(id);
    if (v && !title.trim()) setTitle(v.title);
    if (v && !contentNote.trim()) setContentNote(v.title);
  };

  const sourceVideoTitle = sourceVideoId ? (vpMap.get(sourceVideoId)?.title ?? "") : "";

  const ProductCard = ({ p, matched }: { p: Product; matched?: string[] }) => {
    const on = selected.includes(p.id);
    return (
      <button
        type="button"
        onClick={() => toggle(p.id)}
        className={
          "flex gap-3 rounded-xl border p-3 text-left transition " +
          (on ? "border-brand-purple bg-brand-purple/5 ring-2 ring-brand-purple/30" : "border-gray-200 hover:bg-gray-50")
        }
      >
        {p.main_image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.main_image_url} alt="" className="h-16 w-16 shrink-0 rounded-lg object-cover" />
        ) : (
          <div className="h-16 w-16 shrink-0 rounded-lg bg-gray-100" />
        )}
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold text-gray-900">{p.name}</div>
          <div className="mt-0.5 text-sm font-bold text-brand-purple">{formatKRW(p.price)}</div>
          <div className="text-xs text-gray-500">
            예상 수익 {formatKRW(creatorCommission(p))} <span className="text-gray-400">({p.commission_rate}%)</span>
          </div>
          {matched && matched.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
              {matched.slice(0, 4).map((m) => (
                <span key={m} className="rounded bg-brand-pink/10 px-1.5 py-0.5 text-[10px] font-medium text-brand-pink">#{m}</span>
              ))}
            </div>
          )}
        </div>
        <div className={"flex shrink-0 items-center gap-1 self-start text-xs font-bold " + (on ? "text-brand-purple" : "text-gray-300")}>
          {on ? (<><IconCheck size={14} /> 연동</>) : "선택"}
        </div>
      </button>
    );
  };

  return (
    <div className="space-y-6">
      <Card>
        <h2 className="text-base font-bold">{editId ? "쇼츠 수정" : "쇼츠 등록 & 상품 연동"}</h2>
        <p className="mt-1 mb-4 text-sm text-gray-500">
          운영 채널에 올린 쇼츠 영상의 링크를 입력하면, 영상 내용과 어울리는 상품을 추천해 드립니다. 추천 중 선택해 연동하세요.
        </p>

        {channels.length === 0 && (
          <div className="mb-4 rounded-xl bg-brand-yellow/10 px-3 py-2 text-sm text-gray-700">
            아직 운영 유튜브 채널이 없습니다. <a href="/creator/social" className="font-bold text-brand-purple underline">운영 채널 등록</a> 후 이용하면 더 편리합니다.
          </div>
        )}

        <form action={action} className="space-y-4">
          <input type="hidden" name="edit_id" value={editId} />
          <input type="hidden" name="product_ids" value={selected.join(",")} />
          <input type="hidden" name="video_source" value={videoSource} />
          <input type="hidden" name="source_video_id" value={videoSource === "vibeporter" ? sourceVideoId : ""} />
          <input type="hidden" name="source_video_title" value={videoSource === "vibeporter" ? sourceVideoTitle : ""} />

          {/* 영상 출처 */}
          <div>
            <div className="mb-1 block text-sm font-medium text-gray-700">영상 출처</div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => { setVideoSource("self"); setSourceVideoId(""); }}
                className={"inline-flex items-center gap-1.5 rounded-xl border px-4 py-2 text-sm font-semibold transition " +
                  (videoSource === "self" ? "border-brand-purple bg-brand-purple/5 text-brand-purple" : "border-gray-300 text-gray-600 hover:bg-gray-50")}
              >
                <IconFilm size={15} /> 직접 제작한 쇼츠
              </button>
              <button
                type="button"
                onClick={() => setVideoSource("vibeporter")}
                className={"inline-flex items-center gap-1.5 rounded-xl border px-4 py-2 text-sm font-semibold transition " +
                  (videoSource === "vibeporter" ? "border-brand-pink bg-brand-pink/5 text-brand-pink" : "border-gray-300 text-gray-600 hover:bg-gray-50")}
              >
                <IconShoppingBag size={15} /> 바이브포터 구매 영상
              </button>
            </div>
            {videoSource === "vibeporter" && (
              <div className="mt-3 rounded-xl border border-brand-pink/30 bg-brand-pink/5 p-3">
                <p className="mb-2 text-xs text-gray-600">
                  바이브포터 앱에서 크리에이터 할인가로 구매한 영상을 선택하세요. 구매한 영상으로 쇼츠를 운영할 수 있습니다.
                </p>
                {vibeporterVideos.length === 0 ? (
                  <p className="text-sm text-gray-400">구매/이용 가능한 바이브포터 영상이 없습니다.</p>
                ) : (
                  <Select value={sourceVideoId} onChange={(e) => onPickVibeporter(e.target.value)}>
                    <option value="">— 영상 선택 —</option>
                    {vibeporterVideos.map((v) => (
                      <option key={v.id} value={v.id}>{v.title}</option>
                    ))}
                  </Select>
                )}
              </div>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="운영 채널">
              <Select name="channel_id" value={channelId} onChange={(e) => setChannelId(e.target.value)}>
                <option value="">선택 안 함</option>
                {channels.map((c) => (
                  <option key={c.id} value={c.id}>{c.channel_name}</option>
                ))}
              </Select>
            </Field>
            <Field label="쇼츠 링크" required>
              <Input
                name="shorts_url" value={shortsUrl} onChange={(e) => setShortsUrl(e.target.value)}
                placeholder="https://youtube.com/shorts/..." required
              />
            </Field>
          </div>
          <Field label="영상 제목">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} name="title" placeholder="예: 여름 수분 세럼 발라봤더니" />
          </Field>
          <Field label="영상 내용 설명" hint="내용을 입력할수록 추천이 정확해집니다">
            <Textarea
              name="content_note" value={contentNote} onChange={(e) => setContentNote(e.target.value)}
              rows={3} placeholder="예: 끈적임 없는 수분 세럼을 바르고 메이크업까지 이어지는 데일리 뷰티 루틴 영상"
            />
          </Field>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-bold text-gray-800">
                추천 상품 <span className="text-gray-400">({selected.length}개 선택됨)</span>
              </h3>
              <button type="button" onClick={() => setShowAll((v) => !v)} className="text-xs font-semibold text-brand-purple">
                {showAll ? "추천만 보기" : "전체 상품에서 찾기"}
              </button>
            </div>

            {!showAll ? (
              recommended.length === 0 ? (
                <p className="rounded-xl bg-gray-50 px-3 py-4 text-center text-sm text-gray-400">등록된 상품이 없습니다.</p>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2">
                  {recommended.map((r) => (
                    <ProductCard key={r.product.id} p={r.product} matched={r.matched} />
                  ))}
                </div>
              )
            ) : (
              <div className="space-y-2">
                <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="상품명/키워드 검색" />
                <div className="grid max-h-80 gap-2 overflow-y-auto sm:grid-cols-2">
                  {allFiltered.map((p) => (
                    <ProductCard key={p.id} p={p} />
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            <SubmitButton>{editId ? "수정 저장" : "쇼츠 저장"}</SubmitButton>
            {editId && (
              <Button type="button" variant="outline" onClick={() => {
                setEditId(""); setShortsUrl(""); setTitle(""); setContentNote(""); setChannelId(""); setSelected([]); setVideoSource("self"); setSourceVideoId("");
              }}>취소</Button>
            )}
            <FormMessage state={state} />
          </div>
        </form>
      </Card>

      <Card>
        <h2 className="mb-3 text-base font-bold">내 쇼츠 ({links.length})</h2>
        {links.length === 0 ? (
          <EmptyState title="등록된 쇼츠가 없습니다" description="위에서 첫 쇼츠를 등록하고 상품을 연동해 보세요." />
        ) : (
          <div className="space-y-3">
            {[...links].sort((a, b) => (a.created_at < b.created_at ? 1 : -1)).map((link) => {
              const linkedProducts = link.linked_product_ids.map((id) => productMap.get(id)).filter(Boolean) as Product[];
              const ch = channels.find((c) => c.id === link.channel_id);
              const totalCommission = linkedProducts.reduce((s, p) => s + creatorCommission(p), 0);
              return (
                <div key={link.id} className="rounded-xl border border-gray-200 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone={link.status === "linked" ? "green" : "gray"}>
                          {link.status === "linked" ? "상품 연동됨" : "상품 미연동"}
                        </Badge>
                        {link.video_source === "vibeporter" && <Badge tone="purple">바이브포터 영상</Badge>}
                        {ch && <span className="text-xs text-gray-400">{ch.channel_name}</span>}
                      </div>
                      <div className="mt-1 font-semibold text-gray-900">{link.title || "(제목 없음)"}</div>
                      {link.video_source === "vibeporter" && link.source_video_title && (
                        <div className="flex items-center gap-1 text-xs text-brand-pink"><IconShoppingBag size={12} /> {link.source_video_title}</div>
                      )}
                      <a href={link.shorts_url} target="_blank" rel="noreferrer" className="text-xs text-brand-purple underline break-all">
                        {link.shorts_url}
                      </a>
                    </div>
                    <div className="flex gap-2">
                      <Button type="button" size="sm" variant="outline" onClick={() => startEdit(link)}>수정</Button>
                      <form action={deleteShortsLinkAction}>
                        <input type="hidden" name="id" value={link.id} />
                        <SubmitButton size="sm" variant="danger">삭제</SubmitButton>
                      </form>
                    </div>
                  </div>
                  {linkedProducts.length > 0 && (
                    <div className="mt-3 border-t border-gray-100 pt-3">
                      <div className="mb-2 text-xs font-semibold text-gray-500">
                        연동 상품 {linkedProducts.length}개 · 판매 시 예상 수익 합계 {formatKRW(totalCommission)}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {linkedProducts.map((p) => (
                          <span key={p.id} className="inline-flex items-center gap-1.5 rounded-lg bg-gray-50 px-2 py-1 text-xs">
                            {p.main_image_url && (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={p.main_image_url} alt="" className="h-5 w-5 rounded object-cover" />
                            )}
                            <span className="font-medium text-gray-800">{p.name}</span>
                            <span className="text-brand-purple">{formatKRW(p.price)}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
