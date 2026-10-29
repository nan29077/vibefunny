// ===========================================================================
// 파일 저장소 추상화 레이어
// ---------------------------------------------------------------------------
// STORAGE_TYPE=local  → LocalStorageProvider: /data/private-uploads 디스크 저장
// STORAGE_TYPE=s3     → S3StorageProvider: AWS S3 저장 (추후 구현)
//
// AWS 배포 전환 시:
//   1. npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
//   2. S3StorageProvider 구현 채우기
//   3. STORAGE_TYPE=s3 + AWS 환경변수 설정
// ===========================================================================

import { readFile, writeFile, mkdir, unlink } from "fs/promises";
import path from "path";
import { config } from "./config";

// ---------------------------------------------------------------------------
// 인터페이스
// ---------------------------------------------------------------------------

export interface StorageProvider {
  /**
   * 파일을 저장하고 storage key를 반환한다.
   * @param filename  저장할 파일명 (예: "uuid.mp4")
   * @param buffer    파일 바이너리 데이터
   * @param mimeType  MIME 타입
   * @returns         이후 get/delete/getSignedUrl 에 사용할 storage key
   */
  save(filename: string, buffer: Buffer, mimeType: string): Promise<string>;

  /**
   * storage key에 해당하는 파일 바이너리를 반환한다.
   */
  get(key: string): Promise<Buffer>;

  /**
   * storage key에 해당하는 파일을 삭제한다.
   */
  delete(key: string): Promise<void>;

  /**
   * 클라이언트가 직접 접근할 수 있는 URL을 반환한다.
   * - local: /api/files/{key}
   * - s3:    presigned URL
   */
  getSignedUrl(key: string, expiresInSeconds?: number): Promise<string>;
}

// ---------------------------------------------------------------------------
// Local Provider (현재 운영 중)
// ---------------------------------------------------------------------------

const UPLOAD_DIR = path.join(process.cwd(), "data", "private-uploads");

class LocalStorageProvider implements StorageProvider {
  async save(
    filename: string,
    buffer: Buffer,
    _mimeType: string
  ): Promise<string> {
    await mkdir(UPLOAD_DIR, { recursive: true });
    const dest = path.join(UPLOAD_DIR, filename);
    await writeFile(dest, buffer, { flag: "wx" });
    return filename; // storage key = filename
  }

  async get(key: string): Promise<Buffer> {
    const base = path.resolve(UPLOAD_DIR);
    const target = path.resolve(base, key);
    const rel = path.relative(base, target);
    if (!rel || rel.startsWith("..") || path.isAbsolute(rel)) {
      throw Object.assign(new Error("Forbidden"), { code: "FORBIDDEN" });
    }
    return readFile(target);
  }

  async delete(key: string): Promise<void> {
    const base = path.resolve(UPLOAD_DIR);
    const target = path.resolve(base, key);
    const rel = path.relative(base, target);
    if (!rel || rel.startsWith("..") || path.isAbsolute(rel)) {
      throw Object.assign(new Error("Forbidden"), { code: "FORBIDDEN" });
    }
    try {
      await unlink(target);
    } catch {
      // 이미 삭제됐거나 존재하지 않아도 무시
    }
  }

  async getSignedUrl(key: string, _expiresInSeconds?: number): Promise<string> {
    // 로컬 모드: 내부 API 라우트로 서빙
    return `/api/files/${key}`;
  }
}

// ---------------------------------------------------------------------------
// S3 Provider (추후 구현 — 스텁)
// ---------------------------------------------------------------------------

class S3StorageProvider implements StorageProvider {
  async save(
    _filename: string,
    _buffer: Buffer,
    _mimeType: string
  ): Promise<string> {
    throw new Error(
      "S3 스토리지가 아직 구현되지 않았습니다. " +
        "STORAGE_TYPE=local 을 사용하거나 AWS SDK 의존성을 추가하고 S3StorageProvider 를 구현하세요.\n" +
        "필요한 패키지: npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner"
    );
  }

  async get(_key: string): Promise<Buffer> {
    throw new Error("S3 스토리지가 아직 구현되지 않았습니다.");
  }

  async delete(_key: string): Promise<void> {
    throw new Error("S3 스토리지가 아직 구현되지 않았습니다.");
  }

  async getSignedUrl(_key: string, _expiresInSeconds?: number): Promise<string> {
    throw new Error("S3 스토리지가 아직 구현되지 않았습니다.");
  }
}

// ---------------------------------------------------------------------------
// 팩토리 & 싱글톤
// ---------------------------------------------------------------------------

export function getStorage(): StorageProvider {
  if (config.storage.type === "s3") {
    return new S3StorageProvider();
  }
  return new LocalStorageProvider();
}

/**
 * 앱 전체에서 사용하는 스토리지 싱글톤.
 * STORAGE_TYPE 환경변수로 local/s3 전환.
 *
 * @example
 *   import { storage } from "@/lib/storage";
 *   const key = await storage.save(filename, buffer, mimeType);
 *   const data = await storage.get(key);
 */
export const storage = getStorage();

// ---------------------------------------------------------------------------
// 업로드 파일 저장 방식
// ---------------------------------------------------------------------------
// 캠페인 첨부·배포 영상·결과물 제출 파일은 브라우저에서 /api/uploads 로 바로 올리고
// (src/lib/uploads.ts), DB 에는 /api/files/<id> 주소만 저장한다.
// 예전에 Base64 로 저장된 값(data: URL)은 그대로 표시만 되며 새로 저장되지 않는다.
