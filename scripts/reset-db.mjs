// 로컬 JSON DB를 시드 상태로 초기화하는 스크립트
// 사용: npm run seed:reset
import { rmSync, existsSync } from "fs";
import { join } from "path";

const dbPath = join(process.cwd(), "data", "db.json");
if (existsSync(dbPath)) {
  rmSync(dbPath);
  console.log("✅ data/db.json 삭제 완료. 다음 실행 시 시드가 자동 생성됩니다.");
} else {
  console.log("ℹ️  data/db.json 이 없습니다. 다음 실행 시 시드가 생성됩니다.");
}
