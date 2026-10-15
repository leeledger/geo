/**
 * 모션 영상 한 편을 한 줄로: 음악 → 프레임 렌더 → 유튜브.
 *
 *   node motion-pipeline.mjs homepage-hype --sec 45 --music hype \
 *        --title "…" --desc-file d.txt [--vis public] [--thumb t.png] [--no-upload]
 *
 * 순서
 *   1. 음악   --music hype → motion-music-hype.mjs (128BPM, 컷에 쿵)
 *             --music calm → motion-music.mjs (--cuts 를 넘긴다)
 *             --music none → 무음
 *   2. 렌더   motion-render.mjs — 2560×1440 · 60fps, 음악까지 합쳐 mp4
 *   3. 올리기 .yt-secret/token.json 이 있으면 API(yt-api.mjs), 없으면 스튜디오 화면(yt-upload.mjs).
 *             API 로 올렸는데 감사 전이라 비공개로 잠기면 스튜디오에서 공개로 돌린다.
 *   기록은 yt-uploads.jsonl 에 한 줄씩 남는다.
 */
import { execFileSync } from "node:child_process";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(HERE, "../academy/public/youtube/motion/out");
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const name = args[0];
const SEC = opt("--sec", "45");
const MUSIC = opt("--music", "hype");
const run = (file, a) => execFileSync("node", [path.join(HERE, file), ...a], { stdio: "inherit", cwd: HERE });

if (!name || name.startsWith("--")) { console.log("사용법: node motion-pipeline.mjs <이름> --sec 45 --music hype --title … --desc-file …"); process.exit(1); }

// 1. 음악
let audio = null;
if (MUSIC !== "none") {
  const raw = path.join(OUT, `${name}-raw.wav`);
  audio = path.join(OUT, `${name}.wav`);
  if (MUSIC === "hype") run("motion-music-hype.mjs", [raw, "--sec", SEC]);
  else run("motion-music.mjs", [raw, "--sec", SEC, "--cuts", opt("--cuts", "5.5,14,21.5,29.5,34.5")]);
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", raw, "-af",
    `aecho=0.8:0.5:45|95:0.18|0.1,acompressor=threshold=-14dB:ratio=3:attack=5:release=120,afade=t=out:st=${Number(SEC) - 2}:d=2,loudnorm=I=-13:TP=-1:LRA=9`,
    "-ar", "48000", audio], { stdio: "inherit" });
}

// 2. 렌더
run("motion-render.mjs", [name, "--sec", SEC, "--fps", opt("--fps", "60"), "--h", opt("--h", "1440"), ...(audio ? ["--audio", audio] : [])]);
const video = path.join(OUT, `${name}.mp4`);
if (args.includes("--no-upload")) { console.log(`\n올리지 않음: ${video}`); process.exit(0); }

// 3. 올리기
const title = opt("--title");
const desc = opt("--desc-file");
if (!title || !desc) { console.log("--title 과 --desc-file 이 있어야 올립니다. 영상은 " + video); process.exit(1); }
const vis = opt("--vis", "public");
const thumb = opt("--thumb");
if (fs.existsSync(path.join(HERE, ".yt-secret", "token.json")) || process.env.YT_REFRESH_TOKEN) {
  run("yt-api.mjs", ["upload", video, "--title", title, "--desc-file", desc, "--vis", vis, "--studio-public", ...(thumb ? ["--thumb", thumb] : [])]);
} else {
  console.log("API 열쇠가 아직 없어 스튜디오 화면으로 올립니다 (yt-api.mjs 맨 위 「열쇠」 참고).");
  run("yt-upload.mjs", [video, "--title", title, "--desc-file", desc, "--vis", vis.toUpperCase()]);
}
