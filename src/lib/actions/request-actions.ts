"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb, tx } from "../db";
import { requireRole, getCurrentUser } from "../auth";
import { genId } from "../crypto";
import { addWalletTxOnce, audit, createPayment, notifyUser } from "../services";
import { isHttpUrl } from "../url";
import { isOwnPrivateFileOrExternal, notifyAdmins } from "../campaign-workflow";
import type { CustomVideoRequest, Platform } from "../schema";
import type { ActionState } from "@/components/form";
import { vibeOnlyError } from "../membership";

const now = () => new Date().toISOString();

// === BUYER: 제작 의뢰 등록 (5.3) -> 결제 ==============================
const reqSchema = z.object({
  title: z.string().min(1, "제목을 입력하세요."),
  requirements: z.string().min(1, "상세 요구사항을 입력하세요."),
  reference_links: z.string().optional(),
  platform: z.enum(["youtube", "instagram", "tiktok"]),
  category_id: z.string().optional(),
  duration_seconds: z.coerce.number().int().min(1),
  budget: z.coerce.number().int().min(1, "예산을 입력하세요.").max(100_000_000, "예산은 1억 원 이하로 입력하세요."),
  due_date: z.string().optional(),
  designated_creator_id: z.string().optional(),
  is_public: z.string().optional(),
});

export async function createRequestAction(
  _prev: ActionState,
  fd: FormData
): Promise<ActionState> {
  const user = requireRole("creator");
  const vibeBlock = vibeOnlyError(getDb(), user);
  if (vibeBlock) return { ok: false, message: vibeBlock };
  const parsed = reqSchema.safeParse({
    title: fd.get("title"),
    requirements: fd.get("requirements"),
    reference_links: fd.get("reference_links") || undefined,
    platform: fd.get("platform"),
    category_id: fd.get("category_id") || undefined,
    duration_seconds: fd.get("duration_seconds"),
    budget: fd.get("budget"),
    due_date: fd.get("due_date") || undefined,
    designated_creator_id: fd.get("designated_creator_id") || undefined,
    is_public: fd.get("is_public") || undefined,
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const i of parsed.error.issues) fieldErrors[String(i.path[0])] = i.message;
    return { ok: false, message: "입력값을 확인하세요.", fieldErrors };
  }
  const d = parsed.data;

  let pid = "";
  tx((db) => {
    const req: CustomVideoRequest = {
      id: genId(),
      buyer_id: user.id,
      assigned_creator_id: null,
      title: d.title,
      requirements: d.requirements,
      reference_links: d.reference_links ?? null,
      platform: d.platform as Platform,
      category_id: d.category_id ?? null,
      duration_seconds: d.duration_seconds,
      budget: d.budget,
      due_date: d.due_date ?? null,
      attachment_urls: [],
      is_public: d.is_public ? true : !d.designated_creator_id,
      designated_creator_id: d.designated_creator_id ?? null,
      status: "payment_pending",
      payment_id: null,
      created_at: now(),
      updated_at: now(),
    };
    db.custom_video_requests.push(req);
    const payment = createPayment(db, {
      userId: user.id,
      paymentType: "custom_video_order",
      amount: d.budget,
      metadata: { request_id: req.id },
    });
    pid = payment.id;
    audit(db, { actorId: user.id, action: "create_request", targetTable: "custom_video_requests", targetId: req.id });
  });

  redirect(`/payment/${pid}?next=/creator/requests`);
}

// === CREATOR: 의뢰 참여 신청 ==========================================
export async function applyRequestAction(fd: FormData): Promise<{ ok: boolean; message: string }> {
  const user = requireRole("creator");
  if (user.status !== "active") return { ok: false, message: "활성화된 계정만 신청할 수 있습니다." };
  const requestId = String(fd.get("request_id") || "");
  const message = String(fd.get("proposal_message") || "").trim().slice(0, 2000);
  const proposed = fd.get("proposed_price") ? Math.floor(Number(fd.get("proposed_price"))) : null;
  const result = tx<{ ok: boolean; message: string }>((db) => {
    const vibeBlock = vibeOnlyError(db, user);
    if (vibeBlock) return { ok: false, message: vibeBlock };
    const req = db.custom_video_requests.find((r) => r.id === requestId);
    if (!req || req.status !== "open") return { ok: false, message: "모집 중인 의뢰가 아닙니다." };
    if (req.buyer_id === user.id) return { ok: false, message: "본인이 등록한 의뢰에는 신청할 수 없습니다." };
    if (db.custom_video_applications.some((a) => a.request_id === requestId && a.creator_id === user.id)) {
      return { ok: false, message: "이미 신청한 의뢰입니다." };
    }
    // 제안가는 1원 이상, 결제된 예산 이하만 허용 (예산 초과 정산 방지)
    if (proposed !== null && (!Number.isFinite(proposed) || proposed < 1 || proposed > req.budget)) {
      return { ok: false, message: `제안 금액은 1원 ~ ${req.budget.toLocaleString("ko-KR")}원 사이로 입력하세요.` };
    }
    // 지정 크리에이터 의뢰는 지정된 사람만 신청 가능
    if (!req.is_public && req.designated_creator_id && req.designated_creator_id !== user.id) {
      return { ok: false, message: "지정된 크리에이터만 신청할 수 있는 의뢰입니다." };
    }
    db.custom_video_applications.push({
      id: genId(),
      request_id: requestId,
      creator_id: user.id,
      proposal_message: message,
      proposed_price: proposed,
      status: "applied",
      created_at: now(),
    });
    // 작업자 선정은 관리자 화면(/admin/requests)에서 처리하므로 관리자에게 알린다
    notifyAdmins(db, { title: "제작 의뢰에 새 참여 신청이 있습니다", message: req.title, link: "/admin/requests" });
    return { ok: true, message: "참여 신청을 보냈습니다. 선정되면 알림으로 알려드려요." };
  });
  revalidatePath(`/creator/requests`);
  revalidatePath(`/admin/requests`);
  return result;
}

// === BUYER: 작업자 선정 ===============================================
export async function acceptApplicationAction(fd: FormData): Promise<void> {
  // 의뢰자 본인 또는 최고관리자가 작업자를 선정한다
  const user = getCurrentUser();
  if (!user || user.status !== "active" || (user.role !== "creator" && user.role !== "admin")) return;
  const appId = String(fd.get("application_id") || "");
  tx((db) => {
    const app = db.custom_video_applications.find((a) => a.id === appId);
    if (!app || app.status !== "applied") return;
    const req = db.custom_video_requests.find((r) => r.id === app.request_id);
    if (!req || req.status !== "open") return;
    if (user.role !== "admin" && req.buyer_id !== user.id) return;
    app.status = "accepted";
    db.custom_video_applications
      .filter((a) => a.request_id === req.id && a.id !== appId)
      .forEach((a) => (a.status = "rejected"));
    req.assigned_creator_id = app.creator_id;
    req.status = "in_progress";
    req.updated_at = now();
    audit(db, { actorId: user.id, action: "accept_application", targetTable: "custom_video_requests", targetId: req.id });
    notifyUser(db, { recipientId: app.creator_id, title: "제작 의뢰 작업자로 선정되었습니다", message: req.title, link: "/creator/requests" });
  });
  revalidatePath(`/creator/requests`);
  revalidatePath(`/admin/requests`);
}

// === ADMIN/BUYER: 의뢰 취소 + 환불 =====================================
// 결과물 승인(정산) 전까지만 가능. 결제된 예산 전액을 환불 처리한다.
export async function cancelRequestAction(fd: FormData): Promise<void> {
  const user = getCurrentUser();
  if (!user || user.status !== "active" || (user.role !== "creator" && user.role !== "admin")) return;
  const requestId = String(fd.get("request_id") || "");
  const reason = String(fd.get("reason") || "").trim().slice(0, 300);
  tx((db) => {
    const req = db.custom_video_requests.find((r) => r.id === requestId);
    if (!req) return;
    if (user.role !== "admin") {
      // 의뢰자는 작업자 선정 전(open)까지만 직접 취소 가능
      if (req.buyer_id !== user.id || req.status !== "open") return;
    }
    if (!["payment_pending", "open", "assigned", "in_progress", "submitted", "revision_requested"].includes(req.status)) return;
    const payment = req.payment_id ? db.payments.find((p) => p.id === req.payment_id) : null;
    if (payment && payment.status === "paid") {
      payment.status = "refunded";
      payment.metadata_json = { ...payment.metadata_json, refund_amount: payment.amount, refund_reason: reason || "제작 의뢰 취소", refunded_at: now() };
    } else if (!payment) {
      const pend = db.payments.find((p) => p.payment_type === "custom_video_order" && p.status === "pending" && p.metadata_json?.request_id === req.id);
      if (pend) { pend.status = "cancelled"; }
    }
    const wasPaid = payment?.status === "refunded";
    req.status = wasPaid ? "refunded" : "cancelled";
    req.updated_at = now();
    db.custom_video_applications
      .filter((a) => a.request_id === req.id && (a.status === "applied" || a.status === "accepted"))
      .forEach((a) => (a.status = "cancelled"));
    audit(db, { actorId: user.id, action: "cancel_request", targetTable: "custom_video_requests", targetId: req.id, after: { refunded: wasPaid, reason } });
    notifyUser(db, {
      recipientId: req.buyer_id,
      title: wasPaid ? "제작 의뢰가 취소되고 환불 처리되었습니다" : "제작 의뢰가 취소되었습니다",
      message: `${req.title}${wasPaid ? ` · 환불 ${req.budget.toLocaleString("ko-KR")}원` : ""}${reason ? ` · 사유: ${reason}` : ""}`,
      link: "/creator/requests",
    });
    if (req.assigned_creator_id) {
      notifyUser(db, { recipientId: req.assigned_creator_id, title: "배정된 제작 의뢰가 취소되었습니다", message: req.title, link: "/creator/requests" });
    }
  });
  revalidatePath(`/creator/requests`);
  revalidatePath(`/admin/requests`);
}

// === CREATOR: 결과물 제출 =============================================
export async function deliverRequestAction(fd: FormData): Promise<void> {
  const user = requireRole("creator");
  const requestId = String(fd.get("request_id") || "");
  const videoUrl = String(fd.get("video_url") || "");
  const message = String(fd.get("message") || "");
  if (!videoUrl) return;
  if (!isHttpUrl(videoUrl) && !/^\/api\/files\/[0-9a-f-]{36}$/.test(videoUrl)) return;
  tx((db) => {
    if (vibeOnlyError(db, user)) return;
    const req = db.custom_video_requests.find((r) => r.id === requestId);
    if (!req || req.assigned_creator_id !== user.id) return;
    if (!["in_progress", "revision_requested"].includes(req.status)) return;
    // 남의 비공개 파일을 결과물로 지정해 열람 권한을 얻는 것을 막는다
    if (!isOwnPrivateFileOrExternal(db, videoUrl, user.id)) return;
    db.custom_video_deliveries.push({
      id: genId(),
      request_id: requestId,
      creator_id: user.id,
      video_url: videoUrl,
      message: message || null,
      status: "submitted",
      created_at: now(),
      updated_at: now(),
    });
    req.submitted_video_url = videoUrl; // API 제출 경로와 같은 필드를 갱신
    req.status = "submitted";
    req.updated_at = now();
    notifyAdmins(db, { title: "제작 의뢰 결과물이 제출되었습니다", message: req.title, link: "/admin/requests" });
  });
  revalidatePath(`/creator/requests`);
  revalidatePath(`/admin/requests`);
}

// === BUYER/ADMIN: 결과물 검수 (승인/수정요청) =========================
export async function reviewDeliveryAction(fd: FormData): Promise<void> {
  const user = getCurrentUser();
  // 가입비 미결제(pending) 등 비활성 계정은 사용할 수 없음
  if (!user || user.status !== "active" || (user.role !== "creator" && user.role !== "admin")) return;
  const deliveryId = String(fd.get("delivery_id") || "");
  const decision = String(fd.get("decision") || ""); // approve | revision

  tx((db) => {
    const del = db.custom_video_deliveries.find((d) => d.id === deliveryId);
    if (!del) return;
    const req = db.custom_video_requests.find((r) => r.id === del.request_id);
    if (!req) return;
    if (user.role === "creator" && req.buyer_id !== user.id) return;

    // 검수 대상은 최근에 제출된(submitted) 결과물만 — 예전 결과물이 승인되는 것 방지
    const latest = db.custom_video_deliveries
      .filter((d) => d.request_id === req.id)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
    if (del.status !== "submitted" || latest?.id !== del.id) return;

    if (decision === "approve" && req.status === "submitted") {
      del.status = "approved";
      req.status = "completed";
      req.updated_at = now();
      // 작업 최종 승인 -> CREATOR 정산 가능 금액 지급 (escrow 정산)
      const accepted = db.custom_video_applications.find(
        (a) => a.request_id === req.id && a.status === "accepted"
      );
      // 정산액은 결제된 예산을 넘을 수 없다
      const payout = Math.min(req.budget, Math.max(0, accepted?.proposed_price ?? req.budget));
      addWalletTxOnce(db, {
        userId: req.assigned_creator_id!,
        type: "custom_video",
        amount: payout,
        status: "available",
        relatedTable: "custom_video_requests",
        relatedId: req.id,
        memo: `제작 의뢰 완료 정산: ${req.title}`,
      });
      audit(db, { actorId: user.id, action: "approve_delivery", targetTable: "custom_video_requests", targetId: req.id });
      // 선정된 제안가가 결제 예산보다 낮으면 차액을 의뢰자에게 환불 처리한다
      const diff = req.budget - payout;
      const payment = req.payment_id ? db.payments.find((p) => p.id === req.payment_id) : null;
      if (diff > 0 && payment && payment.status === "paid" && !payment.metadata_json?.partial_refund_amount) {
        payment.metadata_json = { ...payment.metadata_json, partial_refund_amount: diff, partial_refunded_at: now() };
        audit(db, { actorId: user.id, action: "request_partial_refund", targetTable: "payments", targetId: payment.id, after: { amount: diff } });
        notifyUser(db, { recipientId: req.buyer_id, title: "제작 의뢰 차액 환불 안내", message: `${req.title} · 선정 금액이 예산보다 낮아 차액 ${diff.toLocaleString("ko-KR")}원을 결제 부분 취소로 환불합니다.`, link: "/creator/requests" });
      }
      notifyUser(db, { recipientId: req.assigned_creator_id!, title: "제작 의뢰 결과물이 승인되었습니다", message: `${req.title} · 정산 ${payout.toLocaleString("ko-KR")}원`, link: "/creator/wallet" });
    } else if (decision === "revision" && req.status === "submitted") {
      del.status = "revision_requested";
      req.status = "revision_requested";
      req.updated_at = now();
      if (req.assigned_creator_id) notifyUser(db, { recipientId: req.assigned_creator_id, title: "제작 의뢰 결과물 수정 요청", message: req.title, link: "/creator/requests" });
    }
  });
  revalidatePath(`/creator/requests`);
  revalidatePath(`/admin/requests`);
}
