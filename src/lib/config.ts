// ===========================================================================
// 중앙 설정 관리 — 모든 환경변수는 여기서 한 번에 읽는다.
// AWS 배포 시: .env.example 참고하여 실제 값 설정
// ===========================================================================

export const config = {
  /** 파일 저장소 설정 */
  storage: {
    /** "local" → /data/private-uploads 로컬 디스크 (기본값) | "s3" → AWS S3 */
    type: (process.env.STORAGE_TYPE || "local") as "local" | "s3",
    s3Bucket: process.env.AWS_S3_BUCKET || "",
    s3Region: process.env.AWS_S3_REGION || "ap-northeast-2",
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
  },

  /** 데이터베이스 설정 */
  database: {
    /** "json" → db.json 파일 기반 (기본값) | "postgres" → PostgreSQL (추후 구현) */
    type: (process.env.DATABASE_TYPE || "json") as "json" | "postgres",
    url: process.env.DATABASE_URL || "",
  },

  /** 앱 전반 설정 */
  app: {
    /** 공개 사이트 URL (레퍼럴 링크 생성 등) */
    url:
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.NEXT_PUBLIC_SITE_URL ||
      "http://localhost:3001",
  },

  /** 이메일 발송 설정 */
  email: {
    resendApiKey: process.env.RESEND_API_KEY || "",
    verificationHashSecret:
      process.env.EMAIL_VERIFICATION_HASH_SECRET ||
      process.env.SESSION_SECRET ||
      "",
  },

  /** 결제 설정 */
  payment: {
    provider: (process.env.PAYMENT_PROVIDER || "mock") as "mock" | "toss",
  },
} as const;
