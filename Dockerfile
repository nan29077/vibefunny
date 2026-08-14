# ===========================================================================
# VIBEFUNNY — Docker 이미지 (Next.js standalone 빌드)
# ---------------------------------------------------------------------------
# 빌드:  docker build -t vibefunny .
# 실행:  docker run -p 3000:3000 --env-file .env.production vibefunny
#
# 필수 환경변수 (.env.production 또는 ECS Task Definition):
#   SESSION_SECRET, DATA_ENCRYPTION_KEY, EMAIL_VERIFICATION_HASH_SECRET
#   RESEND_API_KEY, STORAGE_TYPE, DATABASE_TYPE
#   NEXT_PUBLIC_APP_URL
#
# 주의: STORAGE_TYPE=local 시 /app/data 볼륨 마운트가 필요합니다.
#   docker run -v vibefunny-data:/app/data ...
#   db.json 과 private-uploads/ 는 컨테이너 재시작 사이에 유지돼야 합니다.
# ===========================================================================

# ── 1단계: 의존성 설치 ────────────────────────────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

# ── 2단계: 빌드 ───────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

# 빌드용 의존성 (devDependencies 포함)
COPY package.json package-lock.json* ./
RUN npm ci

COPY . .

# 표준 .next 경로 사용 → standalone 출력 경로가 예측 가능해짐
ENV VF_NEXT_DIST_DIR=.next
ENV NODE_ENV=production

# 빌드 타임 환경변수 (NEXT_PUBLIC_* 는 번들에 포함됨)
# 실제 값은 docker build --build-arg 또는 CI 시크릿으로 주입
ARG NEXT_PUBLIC_APP_URL=https://vibefunny.com
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
ARG NEXT_PUBLIC_SITE_URL=https://vibefunny.com
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL

RUN npm run build

# ── 3단계: 런타임 이미지 (최소화) ─────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# 보안: 루트가 아닌 일반 사용자로 실행
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# standalone 빌드 복사
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# data/ 디렉토리 생성 (볼륨 마운트 포인트)
# STORAGE_TYPE=local 시 db.json, private-uploads/ 이 여기에 저장됨
RUN mkdir -p /app/data/private-uploads && \
    chown -R nextjs:nodejs /app/data

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# standalone 서버 진입점
CMD ["node", "server.js"]
