// ===========================================================================
// 운영 비밀키 강도 확인
// .env.example 의 예시 값(change-me…)이나 짧은 값을 그대로 운영에 쓰면 세션 위조·암호화 무력화가 가능하므로
// 운영 모드에서는 서버 시작 자체를 거부한다.
// ===========================================================================
const PLACEHOLDER = /change-?me|example|placeholder|dev-secret|your-|^secret$|^password$/i;

/** 32자 미만이거나 예시 값이면 약한 키 */
export function isWeakSecret(value: string | undefined | null): boolean {
  const v = (value ?? "").trim();
  return v.length < 32 || PLACEHOLDER.test(v);
}

/** 운영 모드에서 필수 비밀키를 점검한다. 문제가 있으면 이유 목록을 돌려준다. */
export function productionSecretProblems(env: NodeJS.ProcessEnv = process.env): string[] {
  const problems: string[] = [];
  if (isWeakSecret(env.SESSION_SECRET)) problems.push("SESSION_SECRET");
  if (isWeakSecret(env.DATA_ENCRYPTION_KEY)) problems.push("DATA_ENCRYPTION_KEY");
  // 이메일 인증 해시 키는 따로 두지 않으면 SESSION_SECRET 을 쓴다 — 따로 둔 경우에만 검사
  if (env.EMAIL_VERIFICATION_HASH_SECRET && isWeakSecret(env.EMAIL_VERIFICATION_HASH_SECRET)) problems.push("EMAIL_VERIFICATION_HASH_SECRET");
  return problems;
}

/** 운영 모드에서 약한 키가 있으면 예외를 던진다 */
export function assertProductionSecrets(): void {
  if (process.env.NODE_ENV !== "production") return;
  const problems = productionSecretProblems();
  if (problems.length > 0) {
    throw new Error(
      `[보안] 운영 비밀키가 비어 있거나 예시 값/32자 미만입니다: ${problems.join(", ")}. ` +
      "openssl rand -base64 48 등으로 만든 무작위 값을 .env 에 넣은 뒤 다시 시작하세요."
    );
  }
}
