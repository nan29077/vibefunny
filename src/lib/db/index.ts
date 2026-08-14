// ===========================================================================
// DB 레이어 진입점
// ---------------------------------------------------------------------------
// DATABASE_TYPE=json      → json-provider (현재 기본값, /data/db.json 파일)
// DATABASE_TYPE=postgres  → 추후 prisma-provider 연결 예정
//
// 기존 코드의 import 경로 "@/lib/db" 는 변경하지 않아도 된다.
// (src/lib/db.ts 가 이 파일을 배럴 re-export 함)
// ===========================================================================

export { getDb, saveDb, tx } from "./json-provider";

// TODO: DATABASE_TYPE=postgres 전환 시 아래와 같이 교체
// import { config } from "../config";
// if (config.database.type === "postgres") {
//   export { getDb, saveDb, tx } from "./prisma-provider";
// } else {
//   export { getDb, saveDb, tx } from "./json-provider";
// }
