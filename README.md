# VIBEACTION 🎬

영상 제작 부업 · 숏폼 배포 광고 · 영상 판매 마켓플레이스 · 추천인 수당 · 광고주 포인트 결제 · 관리자 정산을 포함한 한국어 반응형 웹앱 MVP.

---

## 1. 기술 스택

| 영역 | 채택 | 비고 |
|---|---|---|
| Frontend | **Next.js 14 (App Router) + TypeScript** | 서버 컴포넌트 + Server Actions |
| UI | **TailwindCSS** + 경량 shadcn 스타일 프리미티브 | `src/components/ui` |
| 폼 검증 | **Zod** | 모든 폼 서버단 검증 |
| 데이터/인증 | **로컬 JSON 데이터 레이어 + Mock Auth** (기본) | 자격증명 없이 즉시 실행 |
| 결제 | **Mock Payment** (PaymentProvider 인터페이스로 분리) | Toss/Kakao/PG 교체 가능 |
| 금액 | **KRW 정수(원)** | 모든 계산은 서버에서만 |

> **로컬 모드란?** Supabase 자격증명 없이도 `npm run dev` 만으로 동작하도록, 동일한 도메인 모델을 `/data/db.json` 파일 기반 데이터 스토어와 쿠키 기반 Mock Auth로 구현했습니다. 운영 전환을 위해 **Supabase용 PostgreSQL 마이그레이션과 RLS 정책 SQL을 `supabase/` 에 함께 제공**합니다. 데이터 접근은 `src/lib/db.ts` 한 곳에 추상화되어 있어 Supabase 구현으로 교체하기 쉽습니다.

---

## 2. 빠른 시작

```bash
npm install
npm run dev
# http://localhost:3000
```

최초 실행 시 `/data/db.json` 이 자동 생성되며 시드 데이터(관리자/설정/카테고리)가 채워집니다.

### 기본 관리자 계정
```
이메일:    admin@vibeaction.com
비밀번호:  Admin1234!
```

### 기타 명령어
```bash
npm run build      # 프로덕션 빌드
npm run typecheck  # 타입 검사
npm run seed:reset # 로컬 DB를 시드 상태로 초기화
```

---

## 3. 환경변수 (`.env.example` 참고)

```env
DATA_DRIVER=local            # local | supabase (현재 local 구현)
SESSION_SECRET=change-me      # 세션 쿠키 서명 (운영 시 변경)
PAYMENT_PROVIDER=mock         # mock | toss (현재 mock 구현)
# Supabase / Toss 키는 운영 전환 시 주석 해제 (TODO)
```

로컬 모드에서는 위 값이 없어도 동작합니다.

---

## 4. 회원 역할

| 역할 | 코드 | 핵심 기능 |
|---|---|---|
| 최고관리자 | `admin` | 전 회원/정책/단가/수수료/승인/정산 관리 |
| VIBEACTION 회원 | `creator` | 영상 제작·판매, 제작 의뢰 참여, 캠페인 배포, 수익 출금 |
| 영상 구매 회원 | `buyer` | 영상 구매·다운로드, 제작 의뢰, 결과물 검수 |
| 광고주 회원 | `advertiser` | 포인트 충전, 캠페인 집행. **실행사**(상위) / **대행사**(하위)로 구분 |

---

## 5. 주요 플로우 (직접 체험 순서)

1. **회원가입/가입비** — `/signup` 에서 역할 선택 후 가입. 관리자 정책에서 가입비를 켜면 가입 후 Mock 결제→활성화, 추천인이 있으면 추천 수당(가입비의 %)이 pending 생성.
2. **관리자 정책** — `admin` 로그인 → `정책 설정` 에서 가입비/구독료/제작단가/판매수수료/배포단가/실행사 수수료를 즉시 변경.
3. **영상 마켓** — `creator` 가 `내 영상 → 등록`. 관리자 `영상 승인`(자동승인 옵션 가능) → `buyer` 가 `영상 마켓`에서 구매(Mock 결제) → **sold 처리(1회 한정)** → `구매 내역`에서 다운로드(서명 URL 모사). 판매자는 수수료 차감 후 정산.
4. **제작 의뢰** — `buyer` 가 의뢰+예산 결제(escrow) → `creator` 참여 신청 → `buyer` 작업자 선정 → `creator` 결과물 제출 → `buyer`/admin 승인 → creator 정산.
5. **광고 캠페인** — `advertiser` 가 `포인트` 충전 → `캠페인 만들기`(서버가 단가 기준 비용 계산, 포인트 차감) → admin `캠페인 승인/노출` → `creator` 참여→증빙 제출 → admin/advertiser 증빙 승인 → creator 수익 정산.
6. **실행사–대행사** — 실행사 `대행사/수수료` 의 추천 코드로 대행사가 가입 → 대행사 광고 집행 시 실행사 수수료가 자동 생성(기준: 관리자 설정).
7. **출금** — `creator` `수익/출금` 에서 출금 신청 → admin `정산/출금` 에서 승인→지급완료.

---

## 6. 아키텍처 / 폴더 구조

```
src/
  app/                 # 라우트 (admin / creator / buyer / advertiser / payment / 공통)
  components/          # UI 프리미티브, 레이아웃(사이드바+모바일 하단탭), 폼
  lib/
    schema.ts          # 21개 테이블 도메인 타입
    db.ts              # JSON 데이터 스토어 + tx() 트랜잭션 헬퍼  ← Supabase 교체 지점
    seed.ts            # 시드 데이터 (요구사항 11)
    auth.ts / session.ts  # Mock Auth (RBAC: requireRole/requireAdmin)
    services.ts        # 지갑/포인트 ledger, 추천수당, 실행사 수수료, 감사로그
    payment/
      provider.ts      # PaymentProvider 인터페이스 + MockPaymentProvider (+Toss TODO)
      effects.ts       # 결제 성공 시 비즈니스 효과(멱등)
    actions/           # Server Actions (auth/admin/video/request/campaign/point/payout/social)
    queries.ts         # 대시보드 통계, 캠페인 비용 계산
supabase/
  migrations/0001_init.sql   # PostgreSQL 스키마 (21 테이블 + ENUM + 인덱스)
  migrations/0002_rls.sql    # Row Level Security 정책 (요구사항 10)
  seed.sql                   # 설정/카테고리 시드
```

### 안전장치 (요구사항 15)
- 모든 금액 계산은 **서버에서만** 수행하고 클라이언트 입력 금액을 신뢰하지 않습니다.
- 포인트/수익은 **직접 수정 금지**, 반드시 `point_transactions` / `wallet_transactions` ledger 를 통해서만 변경.
- `db.tx()` 안에서 최신 상태를 재확인하여 **중복 결제/중복 구매**(특히 영상 1회 판매)를 방지합니다.
- 결제 효과(`applyPaymentEffects`)는 `status==='paid'` 전환 직후 **1회만** 적용(멱등).
- **SNS 비밀번호는 절대 저장하지 않음** — 플랫폼/계정명/채널 URL/인증 상태만 보관.
- 모든 관리자/주요 작업은 `audit_logs` 에 기록.

---

## 7. 완료 기준 대응표

| # | 완료 기준 | 구현 위치 |
|---|---|---|
| 1 | 역할별 회원가입 | `/signup`, `auth-actions.signupAction` |
| 2 | 관리자 정책 수정 | `/admin/settings`, `admin-actions` |
| 3 | 가입비 없음→무료 가입 | `signupAction` (needsSignupFee 분기) |
| 4 | 가입비 있음→결제 후 활성 | `/payment/activate`, `effects.signup_fee` |
| 5 | 추천인 코드→추천 수당 | `services.createSignupReferralReward` |
| 6 | 영상 업로드 | `/creator/videos/new`, `createVideoAction` |
| 7 | 구매 후 다운로드 | `effects.video_purchase`, `downloadVideoAction` |
| 8 | sold 재구매 불가 | `effects.video_purchase` (sold 가드) |
| 9~10 | 제작 의뢰/참여/제출 | `request-actions` |
| 11~13 | 포인트 충전/캠페인/차감 | `point-actions`, `campaign-actions` |
| 14~17 | 캠페인 승인/참여/증빙/정산 | `campaign-actions`, `/admin/campaigns` |
| 18~19 | 실행사-대행사/수수료 | `services.createAdvertiserCommission` |
| 20 | 출금 신청/지급 | `payout-actions`, `admin-actions.processPayoutAction` |
| 21 | PC/모바일 반응형 | `components/layout/app-shell` (사이드바+하단탭) |

자동 검증: `npm run build` 통과(35개 라우트), 핵심 ledger 로직 시나리오 테스트 통과(`docs/TEST_SCENARIOS.md`).

---

## 8. 운영 전환 TODO (배포 전 필수 검토)

- [ ] **Supabase 전환**: `DATA_DRIVER=supabase` 구현 추가, `supabase/migrations` 적용, Auth 연동.
- [ ] **실 PG 연동**: `PaymentProvider` 의 Toss/Kakao 구현 추가 (`PAYMENT_PROVIDER=toss`).
- [ ] **파일 업로드**: Supabase Storage 비공개 버킷 + 결제 검증 후 signed URL 발급(현재는 URL 입력/카운트 모사).
- [ ] **세금계산서 / 원천징수** 처리.
- [ ] **저작권 / 광고 표시 의무(뒷광고)** 검토.
- [ ] **개인정보 처리방침 / 약관** 및 결제 환불 정책.
- [ ] 동시성: 운영 DB에서는 JSON 파일 대신 트랜잭션/락으로 중복 방지 보장.

---

*본 저장소는 연구/데모용 MVP입니다.*
