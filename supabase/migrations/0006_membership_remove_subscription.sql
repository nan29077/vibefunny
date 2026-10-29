-- ===========================================================================
-- 0006: 구독료 제거 + 크리에이터 회원 등급(일반회원 / 바이브회원)
-- ---------------------------------------------------------------------------
-- - 크리에이터는 가입 즉시 활성(일반회원), 가입비를 결제하면 바이브회원(vibe_member_at 기록)
-- - 월 구독료 제도 삭제 (fee_settings.subscription_*, profiles.subscription_active_until)
-- - vibe_member_at 은 본인이 바꿀 수 없도록 0004 의 보호 트리거에 포함
-- ===========================================================================

alter table profiles add column if not exists vibe_member_at timestamptz;

-- 기존 활성 크리에이터는 바이브회원으로, 결제 대기 크리에이터는 활성 일반회원으로
update profiles set vibe_member_at = coalesce(vibe_member_at, created_at)
  where role = 'creator' and status in ('active', 'suspended');
update profiles set status = 'active', vibe_member_at = null
  where role = 'creator' and status = 'pending';

create or replace function profiles_block_privileged_self_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(current_setting('request.jwt.claim.role', true), '') = 'service_role' or is_admin() then
    return new;
  end if;

  if new.role is distinct from old.role
     or new.status is distinct from old.status
     or new.advertiser_type is distinct from old.advertiser_type
     or new.parent_advertiser_id is distinct from old.parent_advertiser_id
     or new.referred_by_user_id is distinct from old.referred_by_user_id
     or new.referral_code is distinct from old.referral_code
     or new.vibe_member_at is distinct from old.vibe_member_at
     or new.email is distinct from old.email
     or new.auth_user_id is distinct from old.auth_user_id then
    raise exception '본인 프로필에서 변경할 수 없는 항목입니다.' using errcode = '42501';
  end if;

  return new;
end;
$$;

alter table profiles drop column if exists subscription_active_until;
alter table fee_settings drop column if exists subscription_enabled;
alter table fee_settings drop column if exists subscription_amount;
-- 참고: payment_type enum 의 'subscription' 값은 PostgreSQL 에서 안전하게 지울 수 없어 남겨 둔다(사용하지 않음).
