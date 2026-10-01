import { execFile } from "child_process";
import fs from "fs";
import path from "path";

// ===========================================================================
// ffmpeg 실행 도우미 (셸을 거치지 않고 인자 배열로 실행)
// 실행 파일 찾는 순서: FFMPEG_PATH 환경변수 → ffmpeg-static 패키지 → 시스템 ffmpeg
// ===========================================================================

declare const __non_webpack_require__: NodeRequire | undefined;
let cachedPath: string | null = null;

export function ffmpegPath(): string {
  if (cachedPath) return cachedPath;
  if (process.env.FFMPEG_PATH) return (cachedPath = process.env.FFMPEG_PATH);
  try {
    // 번들러(webpack)가 따라가지 않는 Node 기본 require 로 불러온다 (ffmpeg-static 은 실행 파일 경로를 돌려줌)
    const nodeRequire: NodeRequire =
      typeof __non_webpack_require__ !== "undefined" ? __non_webpack_require__ : eval("require");
    const p = nodeRequire("ffmpeg-static") as string | null;
    if (p && fs.existsSync(p)) return (cachedPath = p);
  } catch {
    /* 패키지가 없으면 시스템 ffmpeg */
  }
  return (cachedPath = "ffmpeg");
}

export class MediaError extends Error {
  status: number;
  detail?: string;
  constructor(message: string, status = 500, detail?: string) {
    super(message);
    this.status = status;
    this.detail = detail;
  }
}

function exec(args: string[], timeout: number, cwd?: string): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    execFile(ffmpegPath(), args, { timeout, maxBuffer: 16 * 1024 * 1024, windowsHide: true, cwd }, (error, stdout, stderr) => {
      if (error) {
        reject(Object.assign(error, { stdout: String(stdout), stderr: String(stderr) }));
        return;
      }
      resolve({ stdout: String(stdout), stderr: String(stderr) });
    });
  });
}

/** ffmpeg 실행. 실패 시 사용자에게는 정리된 문구, 원문은 detail(관리자 로그용) */
export async function runFfmpeg(args: string[], timeout = 180_000, cwd?: string) {
  try {
    return await exec(["-hide_banner", "-nostdin", "-y", ...args], timeout, cwd);
  } catch (error) {
    const e = error as NodeJS.ErrnoException & { stderr?: string };
    if (e.code === "ENOENT") throw new MediaError("영상 처리 도구(ffmpeg)가 준비되지 않았습니다. 관리자에게 문의하세요.", 503);
    throw new MediaError("영상 처리에 실패했습니다. 잠시 후 다시 시도해 주세요.", 500, String(e.stderr || e.message).slice(-1200));
  }
}

export interface ProbeResult {
  duration: number;
  width: number;
  height: number;
  hasAudio: boolean;
  hasVideo: boolean;
}

/** 길이·크기 확인 (출력 없이 -i 만 주면 ffmpeg 는 오류로 끝나지만 stderr 에 정보가 남는다) */
export async function probeMedia(file: string): Promise<ProbeResult> {
  let stderr = "";
  try {
    const r = await exec(["-hide_banner", "-nostdin", "-i", file], 30_000);
    stderr = r.stderr;
  } catch (error) {
    const e = error as NodeJS.ErrnoException & { stderr?: string };
    if (e.code === "ENOENT") throw new MediaError("영상 처리 도구(ffmpeg)가 준비되지 않았습니다.", 503);
    stderr = String(e.stderr || "");
  }
  const time = stderr.match(/Duration: (\d+):(\d+):([\d.]+)/);
  const duration = time ? Number(time[1]) * 3600 + Number(time[2]) * 60 + Number(time[3]) : 0;
  const video = stderr.split("\n").find((l) => /Stream #0:\d+[^\n]*Video:/.test(l)) || "";
  const size = video.match(/\b(\d{2,5})x(\d{2,5})\b/);
  if (!time && !size) throw new MediaError("생성된 파일을 읽을 수 없습니다.", 502);
  return {
    duration,
    width: size ? Number(size[1]) : 0,
    height: size ? Number(size[2]) : 0,
    hasAudio: /Stream #0:\d+[^\n]*Audio:/.test(stderr),
    hasVideo: !!video,
  };
}

/** 파일 앞부분(매직 넘버)로 실제 형식 확인 */
export function sniffMime(buf: Buffer): { mime: string; ext: string } | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { mime: "image/jpeg", ext: "jpg" };
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { mime: "image/png", ext: "png" };
  if (buf.subarray(0, 4).toString("ascii") === "RIFF" && buf.subarray(8, 12).toString("ascii") === "WEBP") return { mime: "image/webp", ext: "webp" };
  if (buf.subarray(0, 4).toString("ascii") === "RIFF" && buf.subarray(8, 12).toString("ascii") === "WAVE") return { mime: "audio/wav", ext: "wav" };
  if (buf.subarray(4, 8).toString("ascii") === "ftyp") return { mime: "video/mp4", ext: "mp4" };
  if (buf.subarray(0, 3).toString("ascii") === "ID3" || (buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0)) return { mime: "audio/mpeg", ext: "mp3" };
  if (buf.subarray(0, 4).toString("ascii") === "OggS") return { mime: "audio/ogg", ext: "ogg" };
  if (buf.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]))) return { mime: "video/webm", ext: "webm" };
  return null;
}

/** 한글 자막용 폰트 폴더 (assets/fonts) */
export function fontDir(): string {
  return path.join(process.cwd(), "assets", "fonts");
}
