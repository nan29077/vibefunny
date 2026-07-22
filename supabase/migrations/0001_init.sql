-- ===========================================================================
-- VIBEFUNNY - Supabase/PostgreSQL 스키마 (요구사항 6)
-- 모든 금액은 정수(원, KRW). [TODO] 운영 전환 시 DATA_DRIVER=supabase 와 함께 사용.
-- ===========================================================================

create extension if not exists "pgcrypto";

-- ENUM 타입 ----------------------------------------------------------------
create type role as enum ('admin','creator','buyer','advertiser');
create type advertiser_type as enum ('execution_company','agency');
create type user_status as enum ('pending','active','suspended','withdrawn');
create type platform as enum ('youtube','instagram','tiktok');
create type commission_basis as enum ('agency_charge','agency_spend','campaign_completed');
create type payment_type as enum ('signup_fee','subscription','video_purchase','custom_video_order','point_charge');
create type payment_status as enum ('pending','paid','failed','cancelled','refunded');
create type wallet_tx_type as enum ('video_sale','custom_video','campaign_reward','signup_referral','advertiser_commission','payout','adjustment');
create type wallet_tx_status as enum ('pending','available','requested','paid','cancelled');
create type point_tx_type as enum ('charge','spend','refund','adjustment');
create type video_status as enum ('draft','pending_review','available','sold','rejected','hidden');
create type video_purchase_status as enum ('pending','paid','completed','refunded');
create type request_status as enum ('draft','payment_pending','paid','open','assigned','in_progress','submitted','revision_requested','approved','completed','cancelled','refunded');
create type application_status as enum ('applied','accepted','rejected','cancelled');
create type delivery_status as enum ('submitted','revision_requested','approved','rejected');
create type campaign_type as enum ('create_and_distribute','distribute_own_video','distribute_existing_video','create_only');
create type campaign_status as enum ('draft','point_pending','paid','admin_review','published','recruiting','in_progress','submitted','completed','rejected','cancelled','refunded');
create type campaign_app_status as enum ('applied','approved','rejected','cancelled');
create type campaign_delivery_status as enum ('submitted','approved','rejected','revision_requested');
create type verified_status as enum ('unverified','pending','verified');
create type payout_status as enum ('requested','approved','rejected','paid');

-- 6.1 profiles -------------------------------------------------------------
create table profiles (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users(id) on delete cascade,
  email text unique not null,
  name text not null,
  phone text,
  role role not null,
  advertiser_type advertiser_type,
  parent_advertiser_id uuid references profiles(id),
  referral_code text unique not null,
  referred_by_user_id uuid references profiles(id),
  status user_status not null default 'pending',
  avatar_url text,
  subscription_active_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 6.2 app_settings (key-value) --------------------------------------------
create table app_settings (
  id uuid primary key default gen_random_uuid(),
  key text unique not null,
  value_json jsonb not null,
  description text,
  updated_by uuid references profiles(id),
  updated_at timestamptz not null default now()
);

-- 6.3 fee_settings ---------------------------------------------------------
create table fee_settings (
  id uuid primary key default gen_random_uuid(),
  target_role role not null unique,
  signup_fee_enabled boolean not null default false,
  signup_fee_amount integer not null default 0,
  referral_commission_rate integer not null default 0,
  subscription_enabled boolean not null default false,
  subscription_amount integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 6.4 referral_relations ---------------------------------------------------
create table referral_relations (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references profiles(id),
  referee_id uuid not null references profiles(id),
  referral_type text not null check (referral_type in ('signup','advertiser_hierarchy')),
  created_at timestamptz not null default now()
);

-- 6.5 wallets --------------------------------------------------------------
create table wallets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references profiles(id) on delete cascade,
  pending_balance integer not null default 0,
  available_balance integer not null default 0,
  paid_balance integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 6.6 wallet_transactions --------------------------------------------------
create table wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  type wallet_tx_type not null,
  amount integer not null,
  status wallet_tx_status not null,
  related_table text,
  related_id uuid,
  memo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 6.7 advertiser_point_wallets ---------------------------------------------
create table advertiser_point_wallets (
  id uuid primary key default gen_random_uuid(),
  advertiser_id uuid not null unique references profiles(id) on delete cascade,
  point_balance integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 6.8 point_transactions ---------------------------------------------------
create table point_transactions (
  id uuid primary key default gen_random_uuid(),
  advertiser_id uuid not null references profiles(id) on delete cascade,
  type point_tx_type not null,
  amount integer not null,
  balance_after integer not null,
  payment_id uuid,
  campaign_id uuid,
  memo text,
  created_at timestamptz not null default now()
);

-- 6.9 payments -------------------------------------------------------------
create table payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  payment_type payment_type not null,
  amount integer not null,
  status payment_status not null default 'pending',
  provider text not null default 'mock',
  provider_payment_id text,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  paid_at timestamptz
);

-- 6.10 categories ----------------------------------------------------------
create table categories (
  id uuid primary key default gen_random_uuid(),
  platform platform not null,
  name text not null,
  slug text not null,
  parent_id uuid references categories(id),
  sort_order integer not null default 0,
  is_active boolean not null default true
);

-- 6.11 videos --------------------------------------------------------------
create table videos (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references profiles(id) on delete cascade,
  title text not null,
  description text default '',
  platform platform not null,
  category_id uuid references categories(id),
  tags text[] not null default '{}',
  duration_seconds integer not null,
  price integer not null,
  original_video_url text not null,
  preview_video_url text,
  thumbnail_url text,
  status video_status not null default 'pending_review',
  copyright_confirmed boolean not null default false,
  sold_to_user_id uuid references profiles(id),
  sold_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 6.12 video_purchases -----------------------------------------------------
create table video_purchases (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references profiles(id) on delete cascade,
  video_id uuid not null references videos(id),
  payment_id uuid references payments(id),
  amount integer not null,
  status video_purchase_status not null default 'pending',
  download_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 6.13 custom_video_requests -----------------------------------------------
create table custom_video_requests (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references profiles(id) on delete cascade,
  assigned_creator_id uuid references profiles(id),
  title text not null,
  requirements text not null,
  reference_links text,
  platform platform not null,
  category_id uuid references categories(id),
  duration_seconds integer not null,
  budget integer not null,
  due_date date,
  attachment_urls text[] not null default '{}',
  is_public boolean not null default true,
  designated_creator_id uuid references profiles(id),
  status request_status not null default 'draft',
  payment_id uuid references payments(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 6.14 custom_video_applications -------------------------------------------
create table custom_video_applications (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references custom_video_requests(id) on delete cascade,
  creator_id uuid not null references profiles(id),
  proposal_message text,
  proposed_price integer,
  status application_status not null default 'applied',
  created_at timestamptz not null default now()
);

-- 6.15 custom_video_deliveries ---------------------------------------------
create table custom_video_deliveries (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references custom_video_requests(id) on delete cascade,
  creator_id uuid not null references profiles(id),
  video_url text not null,
  message text,
  status delivery_status not null default 'submitted',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 6.16 ad_campaigns --------------------------------------------------------
create table ad_campaigns (
  id uuid primary key default gen_random_uuid(),
  advertiser_id uuid not null references profiles(id) on delete cascade,
  title text not null,
  description text default '',
  campaign_type campaign_type not null,
  platforms platform[] not null default '{}',
  category_id uuid references categories(id),
  video_required boolean not null default false,
  uploaded_video_url text,
  distribution_count integer not null default 0,
  target_keywords text,
  reference_links text,
  start_date date,
  end_date date,
  total_cost integer not null default 0,
  point_spent integer not null default 0,
  status campaign_status not null default 'draft',
  admin_memo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  approved_at timestamptz,
  published_at timestamptz
);

-- 6.17 campaign_applications -----------------------------------------------
create table campaign_applications (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references ad_campaigns(id) on delete cascade,
  creator_id uuid not null references profiles(id),
  status campaign_app_status not null default 'applied',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 6.18 campaign_deliveries -------------------------------------------------
create table campaign_deliveries (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references ad_campaigns(id) on delete cascade,
  creator_id uuid not null references profiles(id),
  platform platform not null,
  post_url text not null,
  proof_image_url text,
  submitted_video_url text,
  description text,
  status campaign_delivery_status not null default 'submitted',
  reward_amount integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 6.19 social_accounts (비밀번호 절대 저장 안함) ----------------------------
create table social_accounts (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references profiles(id) on delete cascade,
  platform platform not null,
  account_name text not null,
  channel_url text not null,
  follower_count integer not null default 0,
  verified_status verified_status not null default 'unverified',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 6.20 payout_requests -----------------------------------------------------
create table payout_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  amount integer not null,
  bank_name text not null,
  bank_account_number text not null,
  account_holder text not null,
  status payout_status not null default 'requested',
  admin_memo text,
  requested_at timestamptz not null default now(),
  processed_at timestamptz
);

-- 6.21 audit_logs ----------------------------------------------------------
create table audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references profiles(id),
  action text not null,
  target_table text,
  target_id uuid,
  before_json jsonb,
  after_json jsonb,
  created_at timestamptz not null default now()
);

-- 인덱스 -------------------------------------------------------------------
create index idx_videos_status on videos(status);
create index idx_videos_creator on videos(creator_id);
create index idx_campaigns_status on ad_campaigns(status);
create index idx_wallet_tx_user on wallet_transactions(user_id);
create index idx_point_tx_advertiser on point_transactions(advertiser_id);
create index idx_payments_user on payments(user_id);
