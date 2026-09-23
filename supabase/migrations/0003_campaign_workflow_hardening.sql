-- Campaign workflow, favorites, notifications, private file metadata and idempotency.

alter table profiles add column if not exists creator_gender text check (creator_gender in ('female','male','other'));
alter table profiles add column if not exists creator_age_group text check (creator_age_group in ('teens','20s','30s','40plus'));
alter table ad_campaigns add column if not exists video_production_count integer not null default 0 check (video_production_count >= 0);
alter table ad_campaigns add column if not exists platform_distributions jsonb;
alter table ad_campaigns add column if not exists participation_limit integer check (participation_limit is null or participation_limit > 0);
alter table ad_campaigns add column if not exists creator_min_followers text;
alter table ad_campaigns add column if not exists creator_gender text;
alter table ad_campaigns add column if not exists creator_age_group text;

create table if not exists campaign_participations (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references ad_campaigns(id) on delete cascade,
  creator_id uuid not null references profiles(id) on delete cascade,
  participation_type text not null check (participation_type in ('deploy','video_production')),
  status text not null default 'applied' check (status in (
    'applied','accepted','video_submitted','video_approved','video_rejected',
    'deploy_submitted','deploy_approved','deploy_rejected','revision_requested',
    'disputed','cancelled','completed'
  )),
  video_url text,
  video_note text,
  deploy_link text,
  deploy_note text,
  rejection_reason text,
  dispute_previous_status text,
  applied_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (campaign_id, creator_id, participation_type)
);

create table if not exists campaign_favorites (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references ad_campaigns(id) on delete cascade,
  creator_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (campaign_id, creator_id)
);

create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references profiles(id) on delete cascade,
  title text not null,
  message text not null,
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists private_files (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles(id) on delete cascade,
  storage_name text not null unique,
  original_name text not null,
  mime_type text not null,
  size bigint not null check (size > 0 and size <= 26214400),
  created_at timestamptz not null default now()
);

create unique index if not exists wallet_tx_business_once
  on wallet_transactions (user_id, type, related_table, related_id)
  where related_table is not null and related_id is not null and status <> 'cancelled';
create unique index if not exists point_refund_campaign_once
  on point_transactions (advertiser_id, type, campaign_id)
  where type = 'refund' and campaign_id is not null;
create index if not exists campaign_participations_campaign on campaign_participations(campaign_id, participation_type, status);
create index if not exists notifications_recipient on notifications(recipient_id, read_at, created_at desc);

alter table campaign_participations enable row level security;
alter table campaign_favorites enable row level security;
alter table notifications enable row level security;
alter table private_files enable row level security;

create policy participation_read on campaign_participations for select using (
  creator_id = current_profile_id() or is_admin() or exists (
    select 1 from ad_campaigns campaign where campaign.id = campaign_id and campaign.advertiser_id = current_profile_id()
  )
);
create policy participation_creator_insert on campaign_participations for insert with check (creator_id = current_profile_id());
create policy participation_creator_update on campaign_participations for update using (creator_id = current_profile_id());
create policy participation_campaign_owner_update on campaign_participations for update using (
  is_admin() or exists (select 1 from ad_campaigns campaign where campaign.id = campaign_id and campaign.advertiser_id = current_profile_id())
);
create policy favorites_self on campaign_favorites for all using (creator_id = current_profile_id()) with check (creator_id = current_profile_id());
create policy notifications_self_read on notifications for select using (recipient_id = current_profile_id() or is_admin());
create policy notifications_self_update on notifications for update using (recipient_id = current_profile_id() or is_admin());
create policy private_files_owner_read on private_files for select using (owner_id = current_profile_id() or is_admin());
