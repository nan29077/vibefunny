"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { tx } from "../db";
import { requireRole, getCurrentUser } from "../auth";
import { genId } from "../crypto";
import { addWalletTx, audit, createPayment } from "../services";
import type { CustomVideoRequest, Platform } from "../schema";
import type { ActionState } from "@/components/form";

const now = () => new Date().toISOString();

// === BUYER: 제작 의뢰 등록 (5.3) -> 결제 ==============================
const reqSchema = z.object({
  title: z.string().min(1, "제목을 입력하세요."),
  requirements: z.string().min(1, "상세 요구사항을 입력하세요."),
  reference_links: z.string().optional(),
  platform: z.enum(["youtube", "instagram", "tiktok"]),
  category_id: z.string().optional(),
  duration_seconds: z.coerce.number().int().min(1),
  budget: z.coerce.number().int().min(1, "예산을 입력하세요."),
  due_date: z.string().optional(),
  designated_creator_id: z.string().optional(),
  is_public: z.string().optional(),
});

export async function createRequestAction(
  _prev: ActionState,
  fd: FormData
): Promise<ActionState> {
  const user = requireRole("creator");
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
export async function applyRequestAction(fd: FormData): Promise<void> {
  const user = requireRole("creator");
  const requestId = String(fd.get("request_id") || "");
  const message = String(fd.get("proposal_message") || "");
  const proposed = fd.get("proposed_price") ? Math.floor(Number(fd.get("proposed_price"))) : null;
  tx((db) => {
    const req = db.custom_video_requests.find((r) => r.id === requestId);
    if (!req || req.status !== "open") return;
    if (db.custom_video_applications.some((a) => a.request_id === requestId && a.creator_id === user.id)) return;
    db.custom_video_applications.push({
      id: genId(),
      request_id: requestId,
      creator_id: user.id,
      proposal_message: message,
      proposed_price: proposed,
      status: "applied",
      created_at: now(),
    });
  });
  revalidatePath(`/creator/requests`);
  revalidatePath(`/creator/requests/${requestId}`);
}

// === BUYER: 작업자 선정 ===============================================
export async function acceptApplicationAction(fd: FormData): Promise<void> {
  const user = requireRole("creator");
  const appId = String(fd.get("application_id") || "");
  tx((db) => {
    const app = db.custom_video_applications.find((a) => a.id === appId);
    if (!app) return;
    const req = db.custom_video_requests.find((r) => r.id === app.request_id);
    if (!req || req.buyer_id !== user.id || req.status !== "open") return;
    app.status = "accepted";
    db.custom_video_applications
      .filter((a) => a.request_id === req.id && a.id !== appId)
      .forEach((a) => (a.status = "rejected"));
    req.assigned_creator_id = app.creator_id;
    req.status = "in_progress";
    req.updated_at = now();
    audit(db, { actorId: user.id, action: "accept_application", targetTable: "custom_video_requests", targetId: req.id });
  });
  revalidatePath(`/creator/requests`);
}

// === CREATOR: 결과물 제출 =============================================
export async function deliverRequestAction(fd: FormData): Promise<void> {
  const user = requireRole("creator");
  const requestId = String(fd.get("request_id") || "");
  const videoUrl = String(fd.get("video_url") || "");
  const message = String(fd.get("message") || "");
  if (!videoUrl) return;
  tx((db) => {
    const req = db.custom_video_requests.find((r) => r.id === requestId);
    if (!req || req.assigned_creator_id !== user.id) return;
    if (!["in_progress", "revision_requested"].includes(req.status)) return;
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
    req.status = "submitted";
    req.updated_at = now();
  });
  revalidatePath(`/creator/requests`);
}

// === BUYER/ADMIN: 결과물 검수 (승인/수정요청) =========================
export async function reviewDeliveryAction(fd: FormData): Promise<void> {
  const user = getCurrentUser();
  if (!user || (user.role !== "creator" && user.role !== "admin")) return;
  const deliveryId = String(fd.get("delivery_id") || "");
  const decision = String(fd.get("decision") || ""); // approve | revision

  tx((db) => {
    const del = db.custom_video_deliveries.find((d) => d.id === deliveryId);
    if (!del) return;
    const req = db.custom_video_requests.find((r) => r.id === del.request_id);
    if (!req) return;
    if (user.role === "creator" && req.buyer_id !== user.id) return;

    if (decision === "approve" && req.status === "submitted") {
      del.status = "approved";
      req.status = "completed";
      req.updated_at = now();
      // 작업 최종 승인 -> CREATOR 정산 가능 금액 지급 (escrow 정산)
      const accepted = db.custom_video_applications.find(
        (a) => a.request_id === req.id && a.status === "accepted"
      );
      const payout = accepted?.proposed_price ?? req.budget;
      addWalletTx(db, {
        userId: req.assigned_creator_id!,
        type: "custom_video",
        amount: payout,
        status: "available",
        relatedTable: "custom_video_requests",
        relatedId: req.id,
        memo: `제작 의뢰 완료 정산: ${req.title}`,
      });
      audit(db, { actorId: user.id, action: "approve_delivery", targetTable: "custom_video_requests", targetId: req.id });
    } else if (decision === "revision" && req.status === "submitted") {
      del.status = "revision_requested";
      req.status = "revision_requested";
      req.updated_at = now();
    }
  });
  revalidatePath(`/creator/requests`);
  revalidatePath(`/admin/requests`);
}
