# VIBEFUNNY — AWS 배포 설정 가이드

## 아키텍처 개요

```
사용자 → CloudFront → ALB → ECS Fargate (vibefunny 컨테이너)
                              └── EFS 볼륨 (/app/data) ← db.json, private-uploads/
```

> **MVP 단계**: EFS + db.json 구조로 시작하고, 트래픽 증가 시 RDS(PostgreSQL) + S3로 전환

---

## 1. 필수 환경변수

ECS Task Definition 또는 `.env.production` 에 아래 변수를 반드시 설정하세요.

### Auth / Session

| 변수 | 설명 | 예시 |
|------|------|------|
| `SESSION_SECRET` | 세션 쿠키 HMAC 서명 키 (32자 이상) | `openssl rand -hex 32` |
| `DATA_ENCRYPTION_KEY` | AES-256 데이터 암호화 키 (32자 이상) | `openssl rand -hex 32` |
| `EMAIL_VERIFICATION_HASH_SECRET` | 이메일 인증 코드 해시 키 | `openssl rand -hex 32` |

### Email

| 변수 | 설명 |
|------|------|
| `RESEND_API_KEY` | Resend API 키 (https://resend.com) |

### 파일 저장소

#### MVP — 로컬 디스크 + EFS 볼륨 (권장 시작점)

```env
STORAGE_TYPE=local
```

ECS Task Definition에서 EFS 볼륨을 `/app/data`에 마운트:
```json
{
  "volumes": [{
    "name": "vibefunny-data",
    "efsVolumeConfiguration": {
      "fileSystemId": "fs-xxxxxxxx",
      "rootDirectory": "/vibefunny"
    }
  }],
  "mountPoints": [{
    "sourceVolume": "vibefunny-data",
    "containerPath": "/app/data"
  }]
}
```

#### 스케일업 — AWS S3 전환

```env
STORAGE_TYPE=s3
AWS_S3_BUCKET=vibefunny-uploads
AWS_S3_REGION=ap-northeast-2
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
```

> S3 전환 시 `src/lib/storage.ts`의 `S3StorageProvider`를 구현해야 합니다.
> 필요 패키지: `npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner`

### 데이터베이스

#### MVP — JSON 파일 + EFS (위의 EFS 볼륨 동일 사용)

```env
DATABASE_TYPE=json
```

#### 스케일업 — PostgreSQL (Supabase 또는 RDS)

```env
DATABASE_TYPE=postgres
DATABASE_URL=postgresql://user:password@host:5432/vibefunny
```

> PostgreSQL 전환 시 `src/lib/db/prisma-provider.ts` 구현 및 Prisma 스키마 작성 필요.

### 앱

```env
NEXT_PUBLIC_APP_URL=https://vibefunny.com
NEXT_PUBLIC_SITE_URL=https://vibefunny.com
NODE_ENV=production
PAYMENT_PROVIDER=toss   # 운영 시 toss로 변경 (현재 mock)
VF_NEXT_DIST_DIR=.next  # Docker 빌드 시 반드시 설정
```

---

## 2. Docker 빌드 & 배포

```bash
# 이미지 빌드
docker build \
  --build-arg NEXT_PUBLIC_APP_URL=https://vibefunny.com \
  --build-arg NEXT_PUBLIC_SITE_URL=https://vibefunny.com \
  -t vibefunny:latest .

# ECR 푸시
aws ecr get-login-password --region ap-northeast-2 | \
  docker login --username AWS --password-stdin <account-id>.dkr.ecr.ap-northeast-2.amazonaws.com

docker tag vibefunny:latest <account-id>.dkr.ecr.ap-northeast-2.amazonaws.com/vibefunny:latest
docker push <account-id>.dkr.ecr.ap-northeast-2.amazonaws.com/vibefunny:latest
```

---

## 3. ECS 설정 요약

| 항목 | 권장 값 |
|------|---------|
| 런치 타입 | Fargate |
| CPU | 512 (0.5 vCPU) |
| Memory | 1024 MB |
| 포트 | 3000 |
| 헬스체크 | `GET /` → 200 |
| 최소 태스크 | 1 |

---

## 4. S3 버킷 정책 (STORAGE_TYPE=s3 전환 시)

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": { "AWS": "arn:aws:iam::<account-id>:role/vibefunny-ecs-task-role" },
    "Action": ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"],
    "Resource": "arn:aws:s3:::vibefunny-uploads/*"
  }]
}
```

---

## 5. 체크리스트

배포 전 확인 사항:

- [ ] SESSION_SECRET, DATA_ENCRYPTION_KEY 가 32자 이상 랜덤 값인지 확인
- [ ] PAYMENT_PROVIDER=toss 로 변경 및 Toss 키 설정
- [ ] RESEND_API_KEY 설정 및 발신 도메인 인증
- [ ] EFS 볼륨 마운트 확인 (`/app/data`)
- [ ] CloudFront 캐시 정책에서 `/api/*` 경로 캐시 비활성화
- [ ] ALB 헬스체크 경로 `/` 설정
- [ ] HTTPS 인증서 (ACM) 적용
- [ ] `NODE_ENV=production` 확인 (Mock 결제 차단, 세션 시크릿 강제)
