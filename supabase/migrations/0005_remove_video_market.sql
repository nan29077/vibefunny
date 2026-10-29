-- 0005: 회원 영상판매(마켓) 기능 종료
-- 크리에이터 판매용 영상 등록·구매 기능을 제거한다. (과거 wallet_transactions 의 'video_sale' 적립 내역은 보존)
drop policy if exists purchases_buyer_write on video_purchases;
drop policy if exists purchases_self on video_purchases;
drop policy if exists videos_creator_write on videos;
drop policy if exists videos_public_read on videos;
drop table if exists video_purchases;
drop table if exists videos;
drop type if exists video_purchase_status;
drop type if exists video_status;

delete from app_settings where key in ('video_sale_platform_fee_rate', 'video_auto_approve', 'member_video_sale_price_tiers');
