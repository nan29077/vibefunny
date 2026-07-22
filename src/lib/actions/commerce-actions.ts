"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { tx, getDb } from "../db";
import { requireRole } from "../auth";
import { genId } from "../crypto";
import { audit } from "../services";
import { cafe24CreateProduct } from "../cafe24";
import type {
  Product,
  ProductOption,
  ProductCategory,
  CreatorYoutubeChannel,
  CreatorShortsLink,
} from "../schema";
import type { ActionState } from "@/components/form";

const now = () => new Date().toISOString();

// ===========================================================================
// 최고관리자 — 상품 카테고리 관리
// ===========================================================================
export async function addProductCategoryAction(fd: FormData): Promise<void> {
  requireRole("admin");
  const name = String(fd.get("name") || "").trim();
  const parentId = String(fd.get("parent_id") || "").trim() || null;
  if (!name) return;
  tx((db) => {
    const siblings = db.product_categories.filter((c) => c.parent_id === parentId);
    const level = parentId
      ? ((db.product_categories.find((c) => c.id === parentId)?.level ?? 1) + 1)
      : 1;
    const cat: ProductCategory = {
      id: genId(),
      name,
      parent_id: parentId,
      level: Math.min(3, level) as 1 | 2 | 3,
      sort_order: siblings.length,
      is_active: true,
    };
    db.product_categories.push(cat);
  });
  revalidatePath("/admin/products/categories");
  revalidatePath("/admin/products/new");
}

export async function toggleProductCategoryAction(fd: FormData): Promise<void> {
  requireRole("admin");
  const id = String(fd.get("id") || "");
  tx((db) => {
    const cat = db.product_categories.find((c) => c.id === id);
    if (cat) cat.is_active = !cat.is_active;
  });
  revalidatePath("/admin/products/categories");
}

// ===========================================================================
// 최고관리자 — 카페24 연동 설정
// ===========================================================================
export async function saveCafe24SettingsAction(
  _prev: ActionState,
  fd: FormData
): Promise<ActionState> {
  const admin = requireRole("admin");
  tx((db) => {
    db.settings.cafe24 = {
      enabled: fd.get("enabled") === "on",
      mall_id: String(fd.get("mall_id") || "").trim(),
      client_id: String(fd.get("client_id") || "").trim(),
      client_secret: String(fd.get("client_secret") || "").trim(),
      access_token: String(fd.get("access_token") || "").trim(),
      refresh_token: String(fd.get("refresh_token") || "").trim(),
      api_version: String(fd.get("api_version") || "2024-06-01").trim(),
      shop_no: Math.max(1, Math.floor(Number(fd.get("shop_no") || 1))),
    };
    const rate = Math.max(0, Math.min(90, Math.floor(Number(fd.get("default_commission_rate") || 10))));
    db.settings.shorts_commerce_default_commission_rate = rate;
    db.settings.updated_at = now();
    db.settings.updated_by = admin.id;
  });
  revalidatePath("/admin/products/cafe24");
  return { ok: true, message: "카페24 연동 설정이 저장되었습니다." };
}

// ===========================================================================
// 최고관리자 — 상품 등록 (카페24 표준 폼)
// ===========================================================================
const productSchema = z.object({
  name: z.string().min(1, "상품명을 입력하세요."),
  product_code: z.string().optional(),
  category_id: z.string().optional(),
  retail_price: z.coerce.number().int().min(0).default(0),
  price: z.coerce.number().int().min(0, "판매가를 입력하세요."),
  supply_price: z.coerce.number().int().min(0).default(0),
  stock: z.coerce.number().int().min(0).default(0),
  summary: z.string().optional(),
  description: z.string().optional(),
  main_image_url: z.string().optional(),
  additional_image_urls: z.string().optional(),
  shipping_fee_type: z.enum(["free", "fixed", "conditional"]).default("conditional"),
  shipping_fee: z.coerce.number().int().min(0).default(0),
  shipping_info: z.string().optional(),
  brand: z.string().optional(),
  manufacturer: z.string().optional(),
  origin: z.string().optional(),
  model_name: z.string().optional(),
  keywords: z.string().optional(),
  option_name: z.string().optional(),
  option_values: z.string().optional(),
  commission_rate: z.coerce.number().int().min(0).max(90).optional(),
  display_status: z.enum(["displayed", "hidden"]).default("displayed"),
  sell_status: z.enum(["selling", "stopped", "soldout"]).default("selling"),
  sync_cafe24: z.string().optional(), // "on"이면 등록 즉시 카페24 동기화
});

export async function createProductAction(
  _prev: ActionState,
  fd: FormData
): Promise<ActionState> {
  const admin = requireRole("admin");
  const parsed = productSchema.safeParse({
    name: fd.get("name"),
    product_code: fd.get("product_code") || undefined,
    category_id: fd.get("category_id") || undefined,
    retail_price: fd.get("retail_price") || 0,
    price: fd.get("price"),
    supply_price: fd.get("supply_price") || 0,
    stock: fd.get("stock") || 0,
    summary: fd.get("summary") || undefined,
    description: fd.get("description") || undefined,
    main_image_url: fd.get("main_image_url") || undefined,
    additional_image_urls: fd.get("additional_image_urls") || undefined,
    shipping_fee_type: fd.get("shipping_fee_type") || "conditional",
    shipping_fee: fd.get("shipping_fee") || 0,
    shipping_info: fd.get("shipping_info") || undefined,
    brand: fd.get("brand") || undefined,
    manufacturer: fd.get("manufacturer") || undefined,
    origin: fd.get("origin") || undefined,
    model_name: fd.get("model_name") || undefined,
    keywords: fd.get("keywords") || undefined,
    option_name: fd.get("option_name") || undefined,
    option_values: fd.get("option_values") || undefined,
    commission_rate: fd.get("commission_rate") || undefined,
    display_status: fd.get("display_status") || "displayed",
    sell_status: fd.get("sell_status") || "selling",
    sync_cafe24: fd.get("sync_cafe24") || undefined,
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const i of parsed.error.issues) fieldErrors[String(i.path[0])] = i.message;
    return { ok: false, message: "입력값을 확인하세요.", fieldErrors };
  }
  const d = parsed.data;

  const options: ProductOption[] = [];
  if (d.option_name && d.option_values) {
    const values = d.option_values.split(",").map((v) => v.trim()).filter(Boolean);
    if (values.length > 0) options.push({ name: d.option_name, values });
  }
  const additional = (d.additional_image_urls || "")
    .split(/[\n,]/).map((u) => u.trim()).filter(Boolean);
  const keywords = (d.keywords || "")
    .split(/[\n,]/).map((k) => k.trim()).filter(Boolean);

  const productId = genId();
  const defaultRate = getDb().settings.shorts_commerce_default_commission_rate ?? 10;

  tx((db) => {
    const code = (d.product_code || "").trim() || `VF-${Date.now().toString().slice(-8)}`;
    const product: Product = {
      id: productId,
      product_code: code,
      cafe24_product_no: null,
      name: d.name,
      category_id: d.category_id ?? null,
      retail_price: d.retail_price,
      price: d.price,
      supply_price: d.supply_price,
      stock: d.stock,
      options,
      summary: d.summary ?? "",
      description: d.description ?? "",
      main_image_url: d.main_image_url ?? "",
      additional_image_urls: additional,
      shipping_fee_type: d.shipping_fee_type,
      shipping_fee: d.shipping_fee,
      shipping_info: d.shipping_info ?? "",
      brand: d.brand ?? null,
      manufacturer: d.manufacturer ?? null,
      origin: d.origin ?? null,
      model_name: d.model_name ?? null,
      keywords,
      display_status: d.display_status,
      sell_status: d.sell_status,
      commission_rate: d.commission_rate ?? defaultRate,
      cafe24_sync_status: "not_synced",
      cafe24_synced_at: null,
      cafe24_sync_error: null,
      cafe24_mode: null,
      created_at: now(),
      updated_at: now(),
      created_by: admin.id,
    };
    db.products.push(product);
    audit(db, { actorId: admin.id, action: "create_product", targetTable: "products", targetId: product.id });
  });

  // 등록 즉시 카페24 동기화 (옵션 체크 시)
  if (d.sync_cafe24 === "on") {
    await syncProductToCafe24(productId);
  }

  revalidatePath("/admin/products");
  redirect("/admin/products");
}

// 내부 동기화 헬퍼 (액션/직접 호출 공용)
async function syncProductToCafe24(productId: string): Promise<void> {
  const db = getDb();
  const product = db.products.find((p) => p.id === productId);
  if (!product) return;
  // 진행중 표시
  tx((d) => {
    const p = d.products.find((x) => x.id === productId);
    if (p) { p.cafe24_sync_status = "pending"; p.updated_at = now(); }
  });
  const result = await cafe24CreateProduct(db.settings.cafe24, product);
  tx((d) => {
    const p = d.products.find((x) => x.id === productId);
    if (!p) return;
    if (result.ok) {
      p.cafe24_sync_status = "synced";
      p.cafe24_product_no = result.cafe24_product_no;
      p.cafe24_synced_at = now();
      p.cafe24_sync_error = null;
      p.cafe24_mode = result.mode;
    } else {
      p.cafe24_sync_status = "failed";
      p.cafe24_sync_error = result.error;
      p.cafe24_mode = result.mode;
    }
    p.updated_at = now();
    audit(d, { actorId: null, action: "cafe24_sync", targetTable: "products", targetId: productId, after: { ok: result.ok, mode: result.mode } });
  });
}

export async function syncProductToCafe24Action(fd: FormData): Promise<void> {
  requireRole("admin");
  const id = String(fd.get("product_id") || "");
  if (id) await syncProductToCafe24(id);
  revalidatePath("/admin/products");
}

export async function toggleProductDisplayAction(fd: FormData): Promise<void> {
  requireRole("admin");
  const id = String(fd.get("product_id") || "");
  tx((db) => {
    const p = db.products.find((x) => x.id === id);
    if (p) { p.display_status = p.display_status === "displayed" ? "hidden" : "displayed"; p.updated_at = now(); }
  });
  revalidatePath("/admin/products");
}

export async function deleteProductAction(fd: FormData): Promise<void> {
  const admin = requireRole("admin");
  const id = String(fd.get("product_id") || "");
  tx((db) => {
    db.products = db.products.filter((p) => p.id !== id);
    // 연동된 쇼츠에서도 제거
    for (const s of db.creator_shorts_links) {
      s.linked_product_ids = s.linked_product_ids.filter((pid) => pid !== id);
    }
    audit(db, { actorId: admin.id, action: "delete_product", targetTable: "products", targetId: id });
  });
  revalidatePath("/admin/products");
}

// ===========================================================================
// 크리에이터 — 채널 운영용 유튜브 계정
// ===========================================================================
export async function addYoutubeChannelAction(fd: FormData): Promise<void> {
  const user = requireRole("creator");
  const channelName = String(fd.get("channel_name") || "").trim();
  const channelUrl = String(fd.get("channel_url") || "").trim();
  const handle = String(fd.get("channel_handle") || "").trim() || null;
  const subs = Math.max(0, Math.floor(Number(fd.get("subscriber_count") || 0)));
  const desc = String(fd.get("description") || "").trim() || null;
  if (!channelName || !channelUrl) return;
  tx((db) => {
    const ch: CreatorYoutubeChannel = {
      id: genId(),
      creator_id: user.id,
      channel_name: channelName,
      channel_url: channelUrl,
      channel_handle: handle,
      subscriber_count: subs,
      description: desc,
      verified_status: "unverified",
      created_at: now(),
      updated_at: now(),
    };
    db.creator_youtube_channels.push(ch);
  });
  revalidatePath("/creator/social");
  revalidatePath("/creator/shorts-commerce");
}

export async function deleteYoutubeChannelAction(fd: FormData): Promise<void> {
  const user = requireRole("creator");
  const id = String(fd.get("id") || "");
  tx((db) => {
    db.creator_youtube_channels = db.creator_youtube_channels.filter(
      (c) => !(c.id === id && c.creator_id === user.id)
    );
    for (const s of db.creator_shorts_links) {
      if (s.channel_id === id) s.channel_id = null;
    }
  });
  revalidatePath("/creator/social");
  revalidatePath("/creator/shorts-commerce");
}

// ===========================================================================
// 크리에이터 — 쇼츠 등록 + 상품 연동
// ===========================================================================
export async function saveShortsLinkAction(
  _prev: ActionState,
  fd: FormData
): Promise<ActionState> {
  const user = requireRole("creator");
  const editId = String(fd.get("edit_id") || "").trim();
  const shortsUrl = String(fd.get("shorts_url") || "").trim();
  const title = String(fd.get("title") || "").trim();
  const contentNote = String(fd.get("content_note") || "").trim();
  const channelId = String(fd.get("channel_id") || "").trim() || null;
  const videoSource = (String(fd.get("video_source") || "self").trim() === "vibeporter"
    ? "vibeporter" : "self") as "self" | "vibeporter";
  const sourceVideoId = String(fd.get("source_video_id") || "").trim() || null;
  const sourceVideoTitle = String(fd.get("source_video_title") || "").trim() || null;
  const productIds = String(fd.get("product_ids") || "")
    .split(",").map((s) => s.trim()).filter(Boolean);

  if (!shortsUrl) return { ok: false, message: "쇼츠 링크를 입력하세요." };
  if (!/youtu\.?be|youtube\.com/i.test(shortsUrl)) {
    return { ok: false, message: "유튜브 쇼츠 링크 형식이 아닙니다." };
  }

  tx((db) => {
    // 유효한 상품 id만 연동
    const validIds = productIds.filter((id) => db.products.some((p) => p.id === id));
    const status = validIds.length > 0 ? "linked" : "draft";
    if (editId) {
      const link = db.creator_shorts_links.find(
        (s) => s.id === editId && s.creator_id === user.id
      );
      if (link) {
        link.shorts_url = shortsUrl;
        link.title = title;
        link.content_note = contentNote;
        link.channel_id = channelId;
        link.linked_product_ids = validIds;
        link.status = status;
        link.video_source = videoSource;
        link.source_video_id = videoSource === "vibeporter" ? sourceVideoId : null;
        link.source_video_title = videoSource === "vibeporter" ? sourceVideoTitle : null;
        link.updated_at = now();
      }
    } else {
      const link: CreatorShortsLink = {
        id: genId(),
        creator_id: user.id,
        channel_id: channelId,
        shorts_url: shortsUrl,
        title,
        content_note: contentNote,
        linked_product_ids: validIds,
        status,
        video_source: videoSource,
        source_video_id: videoSource === "vibeporter" ? sourceVideoId : null,
        source_video_title: videoSource === "vibeporter" ? sourceVideoTitle : null,
        created_at: now(),
        updated_at: now(),
      };
      db.creator_shorts_links.push(link);
    }
  });
  revalidatePath("/creator/shorts-commerce");
  return { ok: true, message: "쇼츠가 저장되었습니다." };
}

export async function deleteShortsLinkAction(fd: FormData): Promise<void> {
  const user = requireRole("creator");
  const id = String(fd.get("id") || "");
  tx((db) => {
    db.creator_shorts_links = db.creator_shorts_links.filter(
      (s) => !(s.id === id && s.creator_id === user.id)
    );
  });
  revalidatePath("/creator/shorts-commerce");
}

// ===========================================================================
// 최고관리자 — 쇼츠 커머스 판매/발주/배송 관리
// ===========================================================================
export async function updateOrderShippingAction(fd: FormData): Promise<void> {
  const admin = requireRole("admin");
  const id = String(fd.get("order_id") || "");
  const courier = String(fd.get("courier") || "").trim();
  const trackingNo = String(fd.get("tracking_no") || "").trim();
  if (!courier || !trackingNo) return;
  tx((db) => {
    const o = db.product_orders.find((x) => x.id === id);
    if (!o) return;
    o.courier = courier;
    o.tracking_no = trackingNo;
    o.status = "shipped";
    o.shipped_at = now();
    o.updated_at = now();
    audit(db, { actorId: admin.id, action: "order_ship", targetTable: "product_orders", targetId: id });
  });
  revalidatePath("/admin/products/orders");
}

export async function setOrderStatusAction(fd: FormData): Promise<void> {
  requireRole("admin");
  const id = String(fd.get("order_id") || "");
  const status = String(fd.get("status") || "") as
    | "paid" | "preparing" | "shipped" | "delivered" | "cancelled";
  if (!["paid", "preparing", "shipped", "delivered", "cancelled"].includes(status)) return;
  tx((db) => {
    const o = db.product_orders.find((x) => x.id === id);
    if (!o) return;
    o.status = status;
    if (status === "delivered" && !o.shipped_at) o.shipped_at = now();
    o.updated_at = now();
  });
  revalidatePath("/admin/products/orders");
}

// ===========================================================================
// 최고관리자 — AI스토리(동화 제작 의뢰) 연동 설정
// ===========================================================================
export async function saveAiStorySettingsAction(
  _prev: ActionState,
  fd: FormData
): Promise<ActionState> {
  const admin = requireRole("admin");
  tx((db) => {
    db.settings.ai_story = {
      enabled: fd.get("enabled") === "on",
      api_base: String(fd.get("api_base") || "").trim(),
      api_key: String(fd.get("api_key") || "").trim(),
      webhook_secret: String(fd.get("webhook_secret") || "").trim(),
      auto_import: fd.get("auto_import") === "on",
    };
    db.settings.updated_at = now();
    db.settings.updated_by = admin.id;
  });
  revalidatePath("/admin/ai-story");
  return { ok: true, message: "AI스토리 연동 설정이 저장되었습니다." };
}
