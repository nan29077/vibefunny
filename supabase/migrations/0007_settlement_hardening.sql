-- ===========================================================================
-- 0007: 정산·분쟁 보강 (2026-10-31 역할별 시뮬레이션 점검 반영)
-- ---------------------------------------------------------------------------
-- - ad_campaigns.advertiser_rate_snapshot: 등록 시점 광고주 청구 단가 (정산·환불 계산 고정)
-- - campaign_participations.disputed_by: 분쟁을 신청한 회원 역할 (크리에이터·광고주 각각 참여당 1회)
-- - 실행사 수수료 회수는 포인트 잔액이 마이너스가 될 수 있음 (point_balance 에 음수 금지 제약을 두지 않는다)
-- - app_settings 키: min_payout_amount(최소 출금액), support_weekdays_only(평일만 문의 접수)
-- ===========================================================================

alter table ad_campaigns add column if not exists advertiser_rate_snapshot jsonb;
alter table campaign_participations add column if not exists disputed_by text[] not null default '{}';

insert into app_settings (key, value_json, description)
values
  ('min_payout_amount', '10000'::jsonb, '크리에이터 최소 출금 신청 금액(원)'),
  ('support_weekdays_only', 'true'::jsonb, '평일에만 고객 문의 접수')
on conflict (key) do nothing;
