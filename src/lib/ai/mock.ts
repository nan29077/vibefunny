import { createHash, randomUUID } from "crypto";
import { mkdir, readFile, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import path from "path";
import { runFfmpeg } from "./media";
import { VendorError } from "./http";
import type { Adapter, AiInput } from "./providers";

// ===========================================================================
// 개발용 가짜 AI — API 키 없이 숏츠 제작 전 과정을 끝까지 돌려 보기 위한 것.
// 운영(NODE_ENV=production)에서는 AI_ALLOW_MOCK=1 이 아니면 사용할 수 없다.
// 프롬프트에 MOCK_FAIL 이 들어 있으면 일부러 실패한다(환불 흐름 점검용).
// ===========================================================================

const hash = (s: string) => parseInt(createHash("md5").update(String(s)).digest("hex").slice(0, 8), 16);
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function temp(ext: string) {
  const dir = path.join(tmpdir(), "vibefunny-mock");
  await mkdir(dir, { recursive: true });
  return path.join(dir, randomUUID() + ext);
}

function mockScript(input: AiInput) {
  let ctx: { topic?: string; target_seconds?: number; template?: string } = {};
  try {
    ctx = JSON.parse(/<context>([\s\S]*)<\/context>/.exec(input.prompt || "")?.[1] || "{}");
  } catch {
    /* 기본값 */
  }
  const topic = ctx.topic || "오늘의 꿀팁";
  const total = Math.max(15, Math.min(60, Number(ctx.target_seconds) || 30));
  const count = Math.max(3, Math.min(8, Math.round(total / 5)));
  const per = Math.max(3, Math.round(total / count));
  const lines = [
    `잠깐! ${topic}, 이거 모르면 손해예요.`,
    `첫째, 생각보다 간단합니다.`,
    `둘째, 딱 1분이면 충분해요.`,
    `셋째, 꾸준히 하는 게 핵심입니다.`,
    `실제로 해 보면 차이가 확실히 느껴져요.`,
    `주변에도 꼭 알려 주세요.`,
    `한 번 더 정리하면, 간단하게 시작하세요.`,
    `도움이 됐다면 구독과 좋아요 부탁드려요!`,
  ];
  const moves = ["천천히 다가가기", "왼쪽으로 패닝", "고정", "천천히 멀어지기", "위로 틸트", "오른쪽으로 패닝"];
  const shots = Array.from({ length: count }, (_, i) => {
    const narration = i === count - 1 ? lines[lines.length - 1] : lines[i % (lines.length - 1)];
    return {
      narration,
      caption: narration.length > 18 ? narration.slice(0, 18) + "…" : narration,
      visual: `Vertical 9:16 photo, scene ${i + 1} about "${topic}", bright clean lighting, Korean lifestyle`,
      camera_move: moves[i % moves.length],
      seconds: per,
    };
  });
  return {
    title: `${topic} 1분 정리`,
    hook: shots[0].narration,
    description: `${topic}에 대해 ${total}초 안에 핵심만 정리했습니다.`,
    hashtags: ["쇼츠", "꿀팁", topic.replace(/\s+/g, "").slice(0, 10)],
    bgm_prompt: "upbeat light background music, positive, no vocals",
    shots,
  };
}

export const mockAdapter: Adapter = {
  label: "개발용 가짜 AI",
  capabilities: ["text", "image", "tts", "video", "music"],
  base: "",
  async run({ capability, input }) {
    const delay = Number(process.env.AI_MOCK_DELAY_MS || 0);
    if (delay) await wait(delay);
    const probe = `${input.prompt || ""} ${input.text || ""}`;
    if (/MOCK_FAIL/.test(probe)) throw new VendorError("가짜 AI가 일부러 실패했습니다.", { retryable: false });
    if (capability === "text") {
      const out = JSON.stringify(/MOCK_BADJSON/.test(probe) ? { oops: true } : mockScript(input));
      const text = /MOCK_BADJSON/.test(probe) ? out.slice(0, 5) : out;
      return { status: "done", result: { text, usage: { input: Math.ceil(String(input.prompt || "").length / 2), output: Math.ceil(out.length / 2) } } };
    }
    if (capability === "video") {
      return { status: "pending", ref: JSON.stringify({ seconds: input.seconds || 5, seed: input.prompt || "", image: input.image ? input.image.buffer.toString("base64") : "" }) };
    }
    if (capability === "image") {
      const out = await temp(".jpg");
      await runFfmpeg(["-f", "lavfi", "-i", "testsrc2=s=720x1280:d=1", "-vf", `hue=h=${hash(input.prompt || "") % 360}:s=0.7,boxblur=8`, "-frames:v", "1", "-q:v", "5", out]);
      const data = await readFile(out);
      await rm(out, { force: true });
      return { status: "done", result: { data, mime: "image/jpeg" } };
    }
    if (capability === "tts") {
      const seconds = Math.min(15, Math.max(1, String(input.text || "").length / 7));
      const out = await temp(".mp3");
      await runFfmpeg(["-f", "lavfi", "-i", `sine=frequency=${200 + (hash(input.voice || "") % 200)}:duration=${seconds.toFixed(2)}`, "-af", "volume=0.05", "-c:a", "libmp3lame", "-b:a", "64k", out]);
      const data = await readFile(out);
      await rm(out, { force: true });
      return { status: "done", result: { data, mime: "audio/mpeg" } };
    }
    if (capability === "music") {
      const seconds = Math.max(3, Math.min(60, Number(input.seconds) || 20));
      const out = await temp(".mp3");
      await runFfmpeg(["-f", "lavfi", "-i", `sine=frequency=${110 + (hash(input.prompt || "") % 60)}:duration=${seconds}`, "-af", "volume=0.08", "-c:a", "libmp3lame", "-b:a", "96k", out]);
      const data = await readFile(out);
      await rm(out, { force: true });
      return { status: "done", result: { data, mime: "audio/mpeg" } };
    }
    throw new VendorError("지원하지 않는 작업입니다.", { retryable: false });
  },
  async poll({ ref }) {
    const { seconds, seed, image } = JSON.parse(ref) as { seconds: number; seed: string; image: string };
    const out = await temp(".mp4");
    const src = image ? await temp(".jpg") : "";
    if (image) await writeFile(src, Buffer.from(image, "base64"));
    const input = image ? ["-framerate", "30", "-loop", "1", "-t", String(seconds), "-i", src] : ["-f", "lavfi", "-i", `testsrc2=s=720x1280:d=${seconds}:r=30`];
    await runFfmpeg(
      [
        ...input,
        "-vf",
        `scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280,hue=h=${hash(seed) % 360},zoompan=z='min(zoom+0.0015,1.25)':d=1:s=720x1280:fps=30,format=yuv420p`,
        "-t", String(seconds), "-r", "30", "-c:v", "libx264", "-preset", "veryfast", "-crf", "30", "-an", "-movflags", "+faststart", out,
      ],
      180_000
    );
    const data = await readFile(out);
    await rm(out, { force: true });
    if (src) await rm(src, { force: true });
    return { status: "done", result: { data, mime: "video/mp4" } };
  },
  async test() {
    return "개발용 가짜 AI는 항상 연결되어 있습니다.";
  },
};
