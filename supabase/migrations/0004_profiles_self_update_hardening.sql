-- ===========================================================================
-- 0004: profiles 본인 수정 정책 강화 (권한 상승 차단)
-- ---------------------------------------------------------------------------
-- 기존 profiles_self_update 는 수정 가능한 컬럼 제한과 with check 가 없어,
-- 로그인한 회원이 자기 행의 role 을 'admin' 으로, status 를 'active' 로 바꿀 수 있었다.
-- 1) with check 로 "수정 후에도 본인 행"임을 강제하고
-- 2) 트리거로 민감 컬럼(역할·상태·추천/상위 관계·구독·이메일·추천코드) 변경을 막는다.
--    (관리자 is_admin() 과 service_role(서버) 경로는 예외)
-- ===========================================================================

drop policy if exists profiles_self_update on profiles;
create policy profiles_self_update on profiles
  for update
  using (auth_user_id = auth.uid())
  with check (auth_user_id = auth.uid());

create or replace function profiles_block_privileged_self_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- 서버(service_role) 와 관리자는 제한하지 않는다
  if coalesce(current_setting('request.jwt.claim.role', true), '') = 'service_role' or is_admin() then
    return new;
  end if;

  if new.role is distinct from old.role
     or new.status is distinct from old.status
     or new.advertiser_type is distinct from old.advertiser_type
     or new.parent_advertiser_id is distinct from old.parent_advertiser_id
     or new.referred_by_user_id is distinct from old.referred_by_user_id
     or new.referral_code is distinct from old.referral_code
     or new.subscription_active_until is distinct from old.subscription_active_until
     or new.email is distinct from old.email
     or new.auth_user_id is distinct from old.auth_user_id then
    raise exception '본인 프로필에서 변경할 수 없는 항목입니다.' using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_block_privileged_self_update on profiles;
create trigger profiles_block_privileged_self_update
  before update on profiles
  for each row
  execute function profiles_block_privileged_self_update();
