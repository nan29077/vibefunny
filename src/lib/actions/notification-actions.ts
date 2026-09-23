"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "../auth";
import { tx } from "../db";

export async function markNotificationReadAction(formData: FormData): Promise<void> {
  const user = requireUser();
  const id = String(formData.get("id") || "");
  tx((db) => {
    const item = (db.notifications ?? []).find((notification) => notification.id === id && notification.recipient_id === user.id);
    if (item && !item.read_at) item.read_at = new Date().toISOString();
  });
  revalidatePath("/creator/notifications");
  revalidatePath("/advertiser/notifications");
  revalidatePath("/notifications");
  revalidatePath("/");
}

export async function markAllNotificationsReadAction(): Promise<void> {
  const user = requireUser();
  tx((db) => {
    const readAt = new Date().toISOString();
    for (const item of db.notifications ?? []) if (item.recipient_id === user.id && !item.read_at) item.read_at = readAt;
  });
  revalidatePath("/creator/notifications");
  revalidatePath("/advertiser/notifications");
  revalidatePath("/notifications");
  revalidatePath("/");
}

export async function openNotificationAction(formData: FormData): Promise<void> {
  const user = requireUser();
  const id = String(formData.get("id") || "");
  let href = "/notifications";
  tx((db) => {
    const item = (db.notifications ?? []).find((notification) => notification.id === id && notification.recipient_id === user.id);
    if (!item) return;
    if (!item.read_at) item.read_at = new Date().toISOString();
    if (item.link?.startsWith("/") && !item.link.startsWith("//") && !item.link.startsWith("/\\")) href = item.link;
  });
  revalidatePath("/notifications");
  revalidatePath("/creator/notifications");
  revalidatePath("/advertiser/notifications");
  revalidatePath("/");
  redirect(href);
}
