-- ===========================================================================
-- VIBEFUNNY 초기 시드 (요구사항 11). 운영 전환 시 참고.
-- 관리자 계정은 Supabase Auth(이메일 admin@vibefunny.com / Admin1234!)로 먼저
-- 생성한 뒤, 해당 auth.users.id 를 profiles.auth_user_id 에 연결하세요.
-- ===========================================================================

-- 기본 설정 (fee_settings)
insert into fee_settings (target_role, signup_fee_enabled, signup_fee_amount, referral_commission_rate, subscription_enabled, subscription_amount) values
  ('creator', false, 0, 10, false, 30000),
  ('buyer', false, 0, 10, false, 0),
  ('advertiser', false, 0, 10, false, 0),
  ('admin', false, 0, 0, false, 0);

-- app_settings (단가/수수료 묶음)
insert into app_settings (key, value_json, description) values
  ('video_pricing_tiers', '[
    {"key":"15s","label":"15초 이하","max_seconds":15,"amount":30000},
    {"key":"30s","label":"30초 이하","max_seconds":30,"amount":50000},
    {"key":"60s","label":"60초 이하","max_seconds":60,"amount":100000},
    {"key":"90s","label":"90초 이하","max_seconds":90,"amount":150000},
    {"key":"custom","label":"직접 입력","max_seconds":null,"amount":0}
  ]'::jsonb, '영상 제작 단가'),
  ('distribution_rates', '[
    {"platform":"youtube","label":"YouTube Shorts","creator_payout":10000,"advertiser_charge":15000},
    {"platform":"instagram","label":"Instagram Reels","creator_payout":10000,"advertiser_charge":15000},
    {"platform":"tiktok","label":"TikTok","creator_payout":10000,"advertiser_charge":15000}
  ]'::jsonb, '배포 단가'),
  ('video_sale_platform_fee_rate', '20'::jsonb, '영상 판매 플랫폼 수수료(%)'),
  ('video_auto_approve', 'false'::jsonb, '영상 자동 승인 여부'),
  ('advertiser_commission_rate', '5'::jsonb, '실행사 수수료율(%)'),
  ('advertiser_commission_basis', '"agency_spend"'::jsonb, '실행사 수수료 기준'),
  ('extra_creation_fee', '20000'::jsonb, '제작 포함 추가 비용(1건)');

-- 카테고리
insert into categories (platform, name, slug, sort_order) values
  ('youtube','유머','youtube-0',0),('youtube','뷰티','youtube-1',1),('youtube','맛집','youtube-2',2),
  ('youtube','여행','youtube-3',3),('youtube','제품리뷰','youtube-4',4),('youtube','생활꿀팁','youtube-5',5),
  ('youtube','반려동물','youtube-6',6),('youtube','교육','youtube-7',7),('youtube','게임','youtube-8',8),
  ('youtube','패션','youtube-9',9),
  ('instagram','뷰티','instagram-0',0),('instagram','패션','instagram-1',1),('instagram','감성','instagram-2',2),
  ('instagram','맛집','instagram-3',3),('instagram','여행','instagram-4',4),('instagram','제품홍보','instagram-5',5),
  ('instagram','라이프스타일','instagram-6',6),
  ('tiktok','유머','tiktok-0',0),('tiktok','챌린지','tiktok-1',1),('tiktok','댄스','tiktok-2',2),
  ('tiktok','제품리뷰','tiktok-3',3),('tiktok','밈','tiktok-4',4),('tiktok','숏드라마','tiktok-5',5),
  ('tiktok','정보성 콘텐츠','tiktok-6',6);
