"use server";

import { revalidatePath } from "next/cache";
import { tx } from "../db";
import { requireRole, getCurrentUser } from "../auth";
import { genId } from "../crypto";
import type { CampaignSubmission, SubmissionComment } from "../schema";
import type { ActionState } from "@/components/form";

const now = () => new Date().toISOString();

// === CREATOR: 제출(Submission) 생성 =====================================
export async function createSubmissionAction(
  _prev: ActionState,
  fd: FormData
): Promise<ActionState> {
  const user = requireRole("creator");
  const campaignId = String(fd.get("campaign_id") || "").trim();
  const description = String(fd.get("description") || "").trim();
  const fileData = fd.get("file_file_data") ? String(fd.get("file_file_data")) : null;
  const fileName = fd.get("file_file_name") ? String(fd.get("file_file_name")) : null;
  const fileType = fd.get("file_file_type") ? String(fd.get("file_file_type")) : null;

  if (!campaignId) return { ok: false, message: "캠페인 ID가 없습니다." };
  if (!description) return { ok: false, message: "설명을 입력하세요.", fieldErrors: { description: "설명을 입력하세요." } };

  let result: ActionState = { ok: false };
  tx((db) => {
    const campaign = db.ad_campaigns.find((c) => c.id === campaignId);
    if (!campaign) {
      result = { ok: false, message: "캠페인을 찾을 수 없습니다." };
      return;
    }
    const app = db.campaign_applications.find(
      (a) => a.campaign_id === campaignId && a.creator_id === user.id && a.status === "approved"
    );
    if (!app) {
      result = { ok: false, message: "승인된 참여자만 제출할 수 있습니다." };
      return;
    }
    const submission: CampaignSubmission = {
      id: genId(),
      campaign_id: campaignId,
      creator_id: user.id,
      description,
      file_data: fileData,
      file_name: fileName,
      file_type: fileType,
      status: "pending",
      reject_reason: null,
      created_at: now(),
      updated_at: now(),
    };
    db.campaign_submissions.push(submission);
    result = { ok: true, message: "제출이 완료되었습니다." };
  });
  if (result.ok) {
    revalidatePath("/creator/campaigns");
    revalidatePath("/advertiser/campaigns");
  }
  return result;
}

// === ADVERTISER: 제출 승인 =============================================
export async function approveSubmissionAction(fd: FormData): Promise<void> {
  const user = getCurrentUser();
  if (!user || (user.role !== "admin" && user.role !== "advertiser")) return;
  const submissionId = String(fd.get("submission_id") || "");
  tx((db) => {
    const sub = db.campaign_submissions.find((s) => s.id === submissionId);
    if (!sub || sub.status !== "pending") return;
    const campaign = db.ad_campaigns.find((c) => c.id === sub.campaign_id);
    if (!campaign) return;
    if (user.role === "advertiser" && campaign.advertiser_id !== user.id) return;
    sub.status = "approved";
    sub.updated_at = now();
  });
  revalidatePath("/advertiser/campaigns");
  revalidatePath("/creator/campaigns");
}

// === ADVERTISER: 제출 반려 =============================================
export async function rejectSubmissionAction(
  _prev: ActionState,
  fd: FormData
): Promise<ActionState> {
  const user = getCurrentUser();
  if (!user || (user.role !== "admin" && user.role !== "advertiser")) {
    return { ok: false, message: "권한이 없습니다." };
  }
  const submissionId = String(fd.get("submission_id") || "");
  const rejectReason = String(fd.get("reject_reason") || "").trim();

  if (!rejectReason) {
    return { ok: false, message: "반려 사유를 입력하세요.", fieldErrors: { reject_reason: "반려 사유를 입력하세요." } };
  }

  let result: ActionState = { ok: false };
  tx((db) => {
    const sub = db.campaign_submissions.find((s) => s.id === submissionId);
    if (!sub || sub.status !== "pending") {
      result = { ok: false, message: "처리할 수 없는 제출입니다." };
      return;
    }
    const campaign = db.ad_campaigns.find((c) => c.id === sub.campaign_id);
    if (!campaign) {
      result = { ok: false, message: "캠페인을 찾을 수 없습니다." };
      return;
    }
    if (user.role === "advertiser" && campaign.advertiser_id !== user.id) {
      result = { ok: false, message: "권한이 없습니다." };
      return;
    }
    sub.status = "rejected";
    sub.reject_reason = rejectReason;
    sub.updated_at = now();
    result = { ok: true, message: "반려 처리되었습니다." };
  });
  if (result.ok) {
    revalidatePath("/advertiser/campaigns");
    revalidatePath("/creator/campaigns");
  }
  return result;
}

// === BOTH: 댓글 작성 ===================================================
export async function addCommentAction(
  _prev: ActionState,
  fd: FormData
): Promise<ActionState> {
  const user = getCurrentUser();
  if (!user) return { ok: false, message: "로그인이 필요합니다." };
  const submissionId = String(fd.get("submission_id") || "").trim();
  const content = String(fd.get("content") || "").trim();

  if (!submissionId) return { ok: false, message: "제출 ID가 없습니다." };
  if (!content) return { ok: false, message: "댓글을 입력하세요.", fieldErrors: { content: "댓글을 입력하세요." } };

  let result: ActionState = { ok: false };
  tx((db) => {
    const sub = db.campaign_submissions.find((s) => s.id === submissionId);
    if (!sub) {
      result = { ok: false, message: "제출을 찾을 수 없습니다." };
      return;
    }
    // 광고주는 자신의 캠페인에만 댓글 가능
    if (user.role === "advertiser") {
      const campaign = db.ad_campaigns.find((c) => c.id === sub.campaign_id);
      if (!campaign || campaign.advertiser_id !== user.id) {
        result = { ok: false, message: "권한이 없습니다." };
        return;
      }
    }
    // 크리에이터는 자신의 제출에만 댓글 가능
    if (user.role === "creator" && sub.creator_id !== user.id) {
      result = { ok: false, message: "권한이 없습니다." };
      return;
    }
    const comment: SubmissionComment = {
      id: genId(),
      submission_id: submissionId,
      author_id: user.id,
      content,
      created_at: now(),
    };
    db.submission_comments.push(comment);
    result = { ok: true, message: "댓글이 등록되었습니다." };
  });
  if (result.ok) {
    revalidatePath("/advertiser/campaigns");
    revalidatePath("/creator/campaigns");
  }
  return result;
}
