// 2026-10 보안 마이그레이션: 평문으로 남아 있던 민감정보를 암호화한다.
//  - 출금 신청 계좌번호 / 주민번호
//  - 카페24 client_secret · access_token · refresh_token
// 앱과 같은 DATA_ENCRYPTION_KEY(.env)를 사용해야 합니다. 여러 번 실행해도 안전합니다(이미 암호화된 값은 건너뜀).
// 사용: npm run migrate:security
import { loadEnvFiles, withDb, encryptSensitive } from "./lib/env-db.mjs";

loadEnvFiles();
const PREFIX = "enc:v1:";
const { result, backup } = withDb((db) => {
  let n = 0;
  const enc = (obj, key) => {
    if (obj && typeof obj[key] === "string" && obj[key] && !obj[key].startsWith(PREFIX)) {
      obj[key] = encryptSensitive(obj[key]);
      n++;
    }
  };
  for (const p of db.payout_requests || []) {
    enc(p, "bank_account_number");
    enc(p, "resident_id_number");
  }
  for (const k of ["client_secret", "access_token", "refresh_token"]) enc(db.settings?.cafe24, k);
  return n;
});
console.log(`✅ 암호화한 항목: ${result}개`);
console.log(`   백업: ${backup}`);
