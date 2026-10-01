import { randomUUID } from "crypto";
import { copyFile, mkdir, readFile, rm, writeFile } from "fs/promises";
import { existsSync } from "fs";
import { tmpdir } from "os";
import path from "path";
import { fontDir, probeMedia, runFfmpeg, MediaError } from "./media";

// ===========================================================================
// 숏츠 합성 (AI 미사용 · 무료) — 숏핑 compose.mjs 를 숏츠용으로 단순화
//   컷마다: AI 영상 클립(선택 시) 또는 컷 이미지를 카메라 움직임으로 움직인 화면 + 내레이션 음성
//   → 이어 붙이기 → 한글 자막을 영상에 직접 새김(번인) → 배경음악(내레이션 나올 때 자동으로 줄임)
//   출력: 720×1280 세로 H.264/AAC MP4
// ===========================================================================

export const OUT_W = 720;
export const OUT_H = 1280;

export interface ComposeShot {
  seconds: number;
  caption: string;
  narration: string;
  camera_move: string;
  image?: Buffer | null;
  imageExt?: string;
  video?: Buffer | null;
  audio?: Buffer | null;
  audioExt?: string;
}

/** 정지 이미지를 카메라 움직임처럼 움직인다 (프레임 수 N) */
export function stillMotion(move: string, W: number, H: number, N: number): string {
  const zp = (z: string, x: string, y: string) => `zoompan=z='${z}':x='${x}':y='${y}':d=1:s=${W}x${H}:fps=30`;
  const cx = "iw/2-(iw/zoom/2)";
  const cy = "ih/2-(ih/zoom/2)";
  switch (move) {
    case "고정":
      return zp("1.02", cx, cy);
    case "천천히 멀어지기":
      return zp(`max(1.2-0.2*on/${N},1)`, cx, cy);
    case "왼쪽으로 패닝":
      return zp("1.18", `(iw-iw/zoom)*(1-on/${N})`, cy);
    case "오른쪽으로 패닝":
      return zp("1.18", `(iw-iw/zoom)*on/${N}`, cy);
    case "위로 틸트":
      return zp("1.18", cx, `(ih-ih/zoom)*(1-on/${N})`);
    case "아래로 틸트":
      return zp("1.18", cx, `(ih-ih/zoom)*on/${N}`);
    case "핸드헬드":
      return zp("1.08", `${cx}+sin(on/7)*6`, `${cy}+cos(on/9)*5`);
    case "천천히 다가가기":
    default:
      return zp(`min(1+0.2*on/${N},1.2)`, cx, cy);
  }
}

const assTime = (t: number) => {
  const cs = Math.max(0, Math.round(t * 100));
  const h = Math.floor(cs / 360000);
  const m = Math.floor((cs % 360000) / 6000);
  const s = Math.floor((cs % 6000) / 100);
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(cs % 100).padStart(2, "0")}`;
};
const assText = (s: string) =>
  String(s || "")
    .replace(/[{}\\]/g, "")
    .replace(/\s*\r?\n\s*/g, " ")
    .trim();

/** 자막 ASS 파일 (한글 굵은 글씨 + 검은 외곽선, 쇼츠 UI 를 피해 아래쪽 여백 확보) */
export function buildAss(cues: Array<{ start: number; end: number; text: string }>, position: "bottom" | "middle" | "top" = "bottom"): string {
  const align = position === "top" ? 8 : position === "middle" ? 5 : 2;
  const marginV = position === "bottom" ? 300 : position === "top" ? 180 : 0;
  const header = [
    "[Script Info]",
    "ScriptType: v4.00+",
    `PlayResX: ${OUT_W}`,
    `PlayResY: ${OUT_H}`,
    "WrapStyle: 0",
    "ScaledBorderAndShadow: yes",
    "",
    "[V4+ Styles]",
    "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
    `Style: Default,Noto Sans KR,58,&H00FFFFFF,&H00FFFFFF,&H00000000,&H64000000,-1,0,0,0,100,100,0,0,1,5,2,${align},60,60,${marginV},1`,
    "",
    "[Events]",
    "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text",
  ];
  const events = cues
    .filter((c) => assText(c.text))
    .map((c) => `Dialogue: 0,${assTime(c.start)},${assTime(c.end)},Default,,0,0,0,,${assText(c.text)}`);
  return [...header, ...events, ""].join("\n");
}

export async function composeShorts(opts: {
  shots: ComposeShot[];
  bgm?: Buffer | null;
  bgmVolume?: number;
  subtitlePosition?: "bottom" | "middle" | "top";
  onProgress?: (p: number) => void;
}): Promise<{ buffer: Buffer; seconds: number }> {
  const { shots } = opts;
  if (!shots.length) throw new MediaError("컷이 없습니다. 대본을 먼저 만들어 주세요.", 400);
  const missing = shots.findIndex((s) => !s.video && !s.image);
  if (missing >= 0) throw new MediaError(`${missing + 1}번째 컷에 이미지가 없습니다. 컷 이미지를 먼저 만들어 주세요.`, 400);
  const work = path.join(tmpdir(), "vibefunny-compose", randomUUID());
  await mkdir(work, { recursive: true });
  const W = OUT_W;
  const H = OUT_H;
  const encodeV = ["-c:v", "libx264", "-preset", "veryfast", "-crf", "23", "-r", "30", "-pix_fmt", "yuv420p"];
  const encodeA = ["-c:a", "aac", "-b:a", "128k", "-ar", "44100", "-ac", "2"];
  const steps = shots.length + 2;
  let done = 0;
  const tick = () => opts.onProgress?.(Math.min(0.99, ++done / steps));
  try {
    const parts: string[] = [];
    const cues: Array<{ start: number; end: number; text: string }> = [];
    let t = 0;
    for (let i = 0; i < shots.length; i++) {
      const shot = shots[i];
      const n = String(i).padStart(3, "0");
      let clip: string | null = null;
      let still: string | null = null;
      if (shot.video) {
        clip = path.join(work, `clip-${n}.mp4`);
        await writeFile(clip, shot.video);
      } else if (shot.image) {
        still = path.join(work, `still-${n}.${shot.imageExt || "jpg"}`);
        await writeFile(still, shot.image);
      }
      let voice: string | null = null;
      let voiceLen = 0;
      if (shot.audio) {
        voice = path.join(work, `voice-${n}.${shot.audioExt || "mp3"}`);
        await writeFile(voice, shot.audio);
        voiceLen = (await probeMedia(voice)).duration;
      }
      // 내레이션이 컷보다 길면 컷을 늘려 말이 잘리지 않게 한다 (최대 15초)
      const d = Math.max(1.5, Math.min(15, Math.max(Number(shot.seconds) || 4, voiceLen ? voiceLen + 0.3 : 0)));
      const base = `scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H}`;
      const fade = i === 0 ? "" : ",fade=t=in:st=0:d=0.2";
      const vf = clip
        ? `${base},fps=30,tpad=stop_mode=clone:stop_duration=${d},trim=duration=${d},setpts=PTS-STARTPTS${fade},format=yuv420p`
        : `${base},${stillMotion(shot.camera_move, W, H, Math.max(1, Math.round(d * 30)))},trim=duration=${d},setpts=PTS-STARTPTS${fade},format=yuv420p`;
      const inputs = clip ? ["-i", clip] : ["-framerate", "30", "-loop", "1", "-t", String(d), "-i", still as string];
      const norm = `aresample=44100,aformat=channel_layouts=stereo,apad,atrim=duration=${d},asetpts=PTS-STARTPTS`;
      const extra: string[] = [];
      let af: string;
      if (voice) {
        extra.push("-i", voice);
        af = `[1:a]${norm}[a]`;
      } else {
        extra.push("-f", "lavfi", "-t", String(d), "-i", "anullsrc=r=44100:cl=stereo");
        af = `[1:a]${norm}[a]`;
      }
      const out = path.join(work, `part-${n}.mp4`);
      await runFfmpeg([...inputs, ...extra, "-filter_complex", `[0:v]${vf}[v];${af}`, "-map", "[v]", "-map", "[a]", ...encodeV, ...encodeA, "-t", String(d), out], 240_000);
      parts.push(out);
      const text = shot.caption?.trim() ? shot.caption : shot.narration;
      if (text?.trim()) cues.push({ start: t + 0.05, end: t + d - 0.05, text });
      t += d;
      tick();
    }
    const list = path.join(work, "list.txt");
    await writeFile(list, parts.map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join("\n"));
    const joined = path.join(work, "joined.mp4");
    await runFfmpeg(["-f", "concat", "-safe", "0", "-i", list, "-c", "copy", joined], 240_000);
    tick();

    // 자막 번인: 상대 경로로 넘겨 Windows 드라이브 경로(C:\…)의 필터 이스케이프 문제를 피한다
    await writeFile(path.join(work, "subs.ass"), buildAss(cues, opts.subtitlePosition ?? "bottom"), "utf8");
    const fonts = path.join(work, "fonts");
    await mkdir(fonts, { recursive: true });
    const fontFile = path.join(fontDir(), "NotoSansKR-Bold.otf");
    if (existsSync(fontFile)) await copyFile(fontFile, path.join(fonts, "NotoSansKR-Bold.otf"));
    const subFilter = "subtitles=subs.ass:fontsdir=fonts";

    const output = path.join(work, "output.mp4");
    const vol = Math.max(0, Math.min(1, Number(opts.bgmVolume ?? 0.2)));
    if (opts.bgm && vol > 0) {
      const bgm = path.join(work, "bgm.audio");
      await writeFile(bgm, opts.bgm);
      // 배경음악은 영상 길이만큼 반복하고, 내레이션이 나오면 자동으로 줄였다가(덕킹) 끝에서 서서히 줄인다
      await runFfmpeg(
        [
          "-i", "joined.mp4", "-stream_loop", "-1", "-i", "bgm.audio",
          "-filter_complex",
          `[0:v]${subFilter}[v];` +
            `[1:a]aresample=44100,aformat=channel_layouts=stereo,volume=${vol},atrim=duration=${t},afade=t=out:st=${Math.max(0, t - 1.5)}:d=1.5[b];` +
            `[0:a]asplit=2[main][key];[b][key]sidechaincompress=threshold=0.02:ratio=8:attack=20:release=400[duck];` +
            `[main][duck]amix=inputs=2:duration=first:normalize=0[a]`,
          "-map", "[v]", "-map", "[a]", ...encodeV, ...encodeA, "-t", String(t), "-movflags", "+faststart", "output.mp4",
        ],
        300_000,
        work
      );
    } else {
      await runFfmpeg(["-i", "joined.mp4", "-vf", subFilter, ...encodeV, "-c:a", "copy", "-movflags", "+faststart", "output.mp4"], 300_000, work);
    }
    const meta = await probeMedia(output);
    tick();
    return { buffer: await readFile(output), seconds: Math.max(1, Math.round(meta.duration)) };
  } finally {
    await rm(work, { recursive: true, force: true }).catch(() => {});
  }
}
