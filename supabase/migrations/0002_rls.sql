-- ===========================================================================
-- Row Level Security (요구사항 10). 운영 전환 시 적용.
-- 핵심 원칙: ADMIN 전체 접근 / 그 외 본인 데이터 + 공개 데이터만 접근.
-- 모든 금액 변경(지갑/포인트)은 service_role 또는 SECURITY DEFINER 함수에서만.
-- ===========================================================================

-- 현재 사용자의 profiles.id 반환
create or replace function current_profile_id() returns uuid
language sql stable as $$
  select id from profiles where auth_user_id = auth.uid()
$$;

create or replace function is_admin() returns boolean
language sql stable as $$
  select exists(select 1 from profiles where auth_user_id = auth.uid() and role = 'admin')
$$;

-- RLS 활성화
alter table profiles enable row level security;
alter table fee_settings enable row level security;
alter table app_settings enable row level security;
alter table referral_relations enable row level security;
alter table wallets enable row level security;
alter table wallet_transactions enable row level security;
alter table advertiser_point_wallets enable row level security;
alter table point_transactions enable row level security;
alter table payments enable row level security;
alter table categories enable row level security;
alter table videos enable row level security;
alter table video_purchases enable row level security;
alter table custom_video_requests enable row level security;
alter table custom_video_applications enable row level security;
alter table custom_video_deliveries enable row level security;
alter table ad_campaigns enable row level security;
alter table campaign_applications enable row level security;
alter table campaign_deliveries enable row level security;
alter table social_accounts enable row level security;
alter table payout_requests enable row level security;
alter table audit_logs enable row level security;

-- profiles: 본인 조회/수정, 관리자 전체
create policy profiles_admin_all on profiles for all using (is_admin()) with check (is_admin());
create policy profiles_self_select on profiles for select using (auth_user_id = auth.uid());
create policy profiles_self_update on profiles for update using (auth_user_id = auth.uid());

-- 설정: 누구나 읽기, 관리자만 쓰기
create policy fee_read on fee_settings for select using (true);
create policy fee_admin on fee_settings for all using (is_admin()) with check (is_admin());
create policy appset_read on app_settings for select using (true);
create policy appset_admin on app_settings for all using (is_admin()) with check (is_admin());
create policy cat_read on categories for select using (true);
create policy cat_admin on categories for all using (is_admin()) with check (is_admin());

-- 지갑/포인트/원장: 본인 읽기 + 관리자. 쓰기는 service_role(RLS 우회)로만.
create policy wallet_self on wallets for select using (user_id = current_profile_id() or is_admin());
create policy wallet_tx_self on wallet_transactions for select using (user_id = current_profile_id() or is_admin());
create policy pointwallet_self on advertiser_point_wallets for select using (advertiser_id = current_profile_id() or is_admin());
create policy pointtx_self on point_transactions for select using (advertiser_id = current_profile_id() or is_admin());
create policy payments_self on payments for select using (user_id = current_profile_id() or is_admin());

-- 추천 관계: 본인 관련(추천인/피추천인) + 관리자
create policy referral_self on referral_relations for select
  using (referrer_id = current_profile_id() or referee_id = current_profile_id() or is_admin());

-- videos: 판매중은 모두 조회 / 본인 것은 전체 / 관리자 전체
create policy videos_public_read on videos for select using (status = 'available' or creator_id = current_profile_id() or is_admin());
create policy videos_creator_write on videos for all
  using (creator_id = current_profile_id() or is_admin())
  with check (creator_id = current_profile_id() or is_admin());

-- video_purchases: 본인(구매자) + 영상 판매자 + 관리자
create policy purchases_self on video_purchases for select
  using (buyer_id = current_profile_id() or is_admin()
         or exists(select 1 from videos v where v.id = video_id and v.creator_id = current_profile_id()));
create policy purchases_buyer_write on video_purchases for insert with check (buyer_id = current_profile_id());

-- custom_video_requests: 의뢰자/배정작업자/공개 + 관리자
create policy requests_read on custom_video_requests for select
  using (buyer_id = current_profile_id() or assigned_creator_id = current_profile_id()
         or (is_public and status = 'open') or designated_creator_id = current_profile_id() or is_admin());
create policy requests_buyer_write on custom_video_requests for all
  using (buyer_id = current_profile_id() or is_admin())
  with check (buyer_id = current_profile_id() or is_admin());

-- custom_video_applications: 신청자(creator) + 의뢰자 + 관리자
create policy reqapp_read on custom_video_applications for select
  using (creator_id = current_profile_id() or is_admin()
         or exists(select 1 from custom_video_requests r where r.id = request_id and r.buyer_id = current_profile_id()));
create policy reqapp_creator_write on custom_video_applications for insert with check (creator_id = current_profile_id());

-- custom_video_deliveries: 배정 creator + 의뢰자 + 관리자
create policy reqdel_read on custom_video_deliveries for select
  using (creator_id = current_profile_id() or is_admin()
         or exists(select 1 from custom_video_requests r where r.id = request_id and r.buyer_id = current_profile_id()));
create policy reqdel_creator_write on custom_video_deliveries for insert with check (creator_id = current_profile_id());

-- ad_campaigns: 광고주 본인 + 노출중은 creator 조회 가능 + 관리자
create policy campaign_read on ad_campaigns for select
  using (advertiser_id = current_profile_id() or is_admin()
         or status in ('recruiting','published','in_progress','submitted'));
create policy campaign_owner_write on ad_campaigns for all
  using (advertiser_id = current_profile_id() or is_admin())
  with check (advertiser_id = current_profile_id() or is_admin());

-- campaign_applications: creator 본인 + 캠페인 광고주 + 관리자
create policy campapp_read on campaign_applications for select
  using (creator_id = current_profile_id() or is_admin()
         or exists(select 1 from ad_campaigns c where c.id = campaign_id and c.advertiser_id = current_profile_id()));
create policy campapp_creator_write on campaign_applications for insert with check (creator_id = current_profile_id());

-- campaign_deliveries: creator 본인 + 캠페인 광고주 + 관리자
create policy campdel_read on campaign_deliveries for select
  using (creator_id = current_profile_id() or is_admin()
         or exists(select 1 from ad_campaigns c where c.id = campaign_id and c.advertiser_id = current_profile_id()));
create policy campdel_creator_write on campaign_deliveries for insert with check (creator_id = current_profile_id());

-- social_accounts: 본인 + 관리자
create policy social_self on social_accounts for all
  using (creator_id = current_profile_id() or is_admin())
  with check (creator_id = current_profile_id() or is_admin());

-- payout_requests: 본인 + 관리자
create policy payout_self_read on payout_requests for select using (user_id = current_profile_id() or is_admin());
create policy payout_self_insert on payout_requests for insert with check (user_id = current_profile_id());
create policy payout_admin_update on payout_requests for update using (is_admin());

-- audit_logs: 관리자만
create policy audit_admin on audit_logs for select using (is_admin());

-- 실행사: 본인이 추천한 대행사 조회 (profiles 정책 보강)
create policy profiles_exec_view_agencies on profiles for select
  using (parent_advertiser_id = current_profile_id());
