"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { tx } from "../db";
import { requireRole } from "../auth";
import { genId } from "../crypto";
import { audit, createPayment } from "../services";
import type { Platform, Video, VideoPurchase } from "../schema";
import type { ActionState } from "@/components/form";

const now = () => new Date().toISOString();

// === CREATOR: 판매용 영상 등록 (5.2) ===================================
const videoSchema = z.object({
  title: z.string().min(1, "제목을 입력하세요."),
  description: z.string().default(""),
  platform: z.enum(["youtube", "instagram", "tiktok"]),
  category_id: z.string().optional(),
  tags: z.string().optional(),
  duration_seconds: z.coerce.number().int().min(1, "영상 길이를 입력하세요."),
  price: z.coerce.number().int().min(0, "가격을 입력하세요."),
  thumbnail_url: z.string().optional(),
  original_video_url: z.string().min(1, "영상 파일(URL)을 입력하세요."),
  preview_video_url: z.string().optional(),
  copyright_confirmed: z.literal("on", {
    errorMap: () => ({ message: "저작권 보유 확인에 체크해야 합니다." }),
  }),
});

export async function createVideoAction(
  _prev: ActionState,
  fd: FormData
): Promise<ActionState> {
  const user = requireRole("creator");

  const parsed = videoSchema.safeParse({
    title: fd.get("title"),
    description: fd.get("description") ?? "",
    platform: fd.get("platform"),
    category_id: fd.get("category_id") || undefined,
    tags: fd.get("tags") || undefined,
    duration_seconds: fd.get("duration_seconds"),
    price: fd.get("price"),
    thumbnail_url: fd.get("thumbnail_url") || undefined,
    original_video_url: fd.get("original_video_url") || undefined,
    preview_video_url: fd.get("preview_video_url") || undefined,
    copyright_confirmed: fd.get("copyright_confirmed"),
  });

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const i of parsed.error.issues) fieldErrors[String(i.path[0])] = i.message;
    return { ok: false, message: "입력값을 확인하세요.", fieldErrors };
  }
  const d = parsed.data;

  const result = tx<ActionState>((db) => {
    // 구독료 활성 시 활성 구독자만 등록 가능 (비즈니스 규칙 4)
    const sub = db.settings.fees.creator;
    if (sub.subscription_enabled) {
      const active =
        user.subscription_active_until &&
        new Date(user.subscription_active_until) > new Date();
      if (!active) {
        return { ok: false, message: "구독이 활성화된 회원만 영상을 등록할 수 있습니다. 구독을 먼저 진행하세요." };
      }
    }

    const video: Video = {
      id: genId(),
      creator_id: user.id,
      title: d.title,
      description: d.description ?? "",
      platform: d.platform as Platform,
      category_id: d.category_id ?? null,
      tags: d.tags ? d.tags.split(",").map((t) => t.trim()).filter(Boolean) : [],
      duration_seconds: d.duration_seconds,
      price: d.price,
      original_video_url: d.original_video_url,
      preview_video_url: d.preview_video_url ?? null,
      thumbnail_url: d.thumbnail_url ?? null,
      // 관리자 자동승인 설정에 따라 즉시 판매 또는 승인 대기
      status: db.settings.video_auto_approve ? "available" : "pending_review",
      copyright_confirmed: true,
      sold_to_user_id: null,
      sold_at: null,
      created_at: now(),
      updated_at: now(),
    };
    db.videos.push(video);
    audit(db, { actorId: user.id, action: "create_video", targetTable: "videos", targetId: video.id });
    return { ok: true, message: "영상이 등록되었습니다." };
  });

  if (result.ok) {
    revalidatePath("/creator/videos");
    redirect("/creator/videos");
  }
  return result;
}

// === BUYER: 영상 구매 (5.2) -> Mock 결제로 이동 ========================
export async function purchaseVideoAction(fd: FormData): Promise<void> {
  const user = requireRole("creator");
  const videoId = String(fd.get("video_id") || "");

  let redirectTo = "/creator/videos";
  tx((db) => {
    const video = db.videos.find((v) => v.id === videoId);
    if (!video) {
      redirectTo = "/creator/videos";
      return;
    }
    // 1회 판매 제한 + 중복 구매 방지
    if (video.status !== "available") {
      redirectTo = `/creator/videos?error=sold`;
      return;
    }
    // 이미 결제 대기 중인 동일 구매가 있으면 그 결제로 이동
    const existing = db.video_purchases.find(
      (p) => p.video_id === videoId && p.buyer_id === user.id && p.status === "pending"
    );
    if (existing && existing.payment_id) {
      redirectTo = `/payment/${existing.payment_id}?next=/creator/videos`;
      return;
    }

    const payment = createPayment(db, {
      userId: user.id,
      paymentType: "video_purchase",
      amount: video.price,
      metadata: { video_id: video.id },
    });
    const purchase: VideoPurchase = {
      id: genId(),
      buyer_id: user.id,
      video_id: video.id,
      payment_id: payment.id,
      amount: video.price,
      status: "pending",
      download_count: 0,
      created_at: now(),
      updated_at: now(),
    };
    db.video_purchases.push(purchase);
    redirectTo = `/payment/${payment.id}?next=/creator/videos`;
  });

  redirect(redirectTo);
}

// === BUYER: 구매한 영상 다운로드 (signed URL 모사) ====================
export async function downloadVideoAction(fd: FormData): Promise<void> {
  const user = requireRole("creator");
  const videoId = String(fd.get("video_id") || "");
  tx((db) => {
    const purchase = db.video_purchases.find(
      (p) => p.video_id === videoId && p.buyer_id === user.id && p.status === "completed"
    );
    if (!purchase) return; // 결제 완료자만 다운로드 가능
    purchase.download_count += 1;
    purchase.updated_at = now();
    audit(db, { actorId: user.id, action: "download_video", targetTable: "videos", targetId: videoId });
  });
  revalidatePath("/creator/videos");
}

// === CREATOR: 바이브포터 판매 신청 / 취소 ================================
export async function toggleVibeporterAction(fd: FormData): Promise<void> {
  const user = requireRole("creator");
  const videoId = String(fd.get("video_id") || "");
  const enable = fd.get("enable") === "1";

  tx((db) => {
    const video = db.videos.find((v) => v.id === videoId && v.creator_id === user.id);
    if (!video) return;
    // 판매 승인(available) 상태 영상만 신청 가능
    if (enable && video.status !== "available") return;
    video.vibeporter_enabled = enable;
    // 취소 시 승인 상태도 초기화
    if (!enable) {
      video.vibeporter_approved = false;
      video.vibeporter_approved_at = undefined;
    }
    video.updated_at = now();
    audit(db, {
      actorId: user.id,
      action: enable ? "vibeporter_request" : "vibeporter_cancel",
      targetTable: "videos",
      targetId: video.id,
    });
  });
  revalidatePath("/creator/videos");
}

// === CREATOR: 구독료 결제 시작 ========================================
export async function startSubscriptionAction(): Promise<void> {
  const user = requireRole("creator");
  let pid = "";
  tx((db) => {
    const amount = db.settings.fees.creator.subscription_amount;
    const payment = createPayment(db, {
      userId: user.id,
      paymentType: "subscription",
      amount,
    });
    pid = payment.id;
  });
  redirect(`/payment/${pid}?next=/creator`);
}
