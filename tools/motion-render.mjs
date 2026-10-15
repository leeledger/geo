/**
 * 모션 페이지를 프레임 단위로 구워 고화질 영상으로 만든다.
 *
 * motion-record.mjs(화면 녹화)와 다른 점:
 *   녹화는 VP8 저비트레이트(41초 4MB)라 글자가 뭉개지고, 시작 시점이 0.1~0.3초 흔들려 음악과 어긋난다.
 *   여기서는 모든 CSS 애니메이션을 멈춘 뒤 시각을 한 프레임씩 직접 맞추고 찍는다.
 *   그래서 프레임 하나 안 빠지고, 음악 박자와 프레임 단위로 맞는다.
 *
 * 기본 2560×1440 · 60fps. 유튜브는 1080p 보다 큰 원본에 더 좋은 코덱(VP9)을 줘서
 * 1080 으로 봐도 1080 원본보다 선명하다.
 *
 *   node motion-render.mjs homepage-hype --sec 45 [--fps 60] [--h 1440] [--audio music.wav] [--from 30 --to 32]
 *   --from/--to 는 구간만 빠르게 확인할 때. --still 12.5 는 그 시각 한 장만 PNG 로.
 *
 * JS 로 그리는 게 있으면 페이지에 window.seek(초) 를 두면 프레임마다 불러 준다.
 */
import { chromium } from "playwright";
import path from "node:path";
import fs from "node:fs";
import { spawn } from "node:child_process";
import { pathToFileURL } from "node:url";

const SRC = path.resolve("../academy/public/youtube/motion");
const OUT = path.resolve("../academy/public/youtube/motion/out");
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const name = args.find((a) => !a.startsWith("--") && !/^[\d.]+$/.test(a) && !/\.(wav|mp3|m4a)$/i.test(a));
const SEC = Number(opt("--sec", 10));
const FPS = Number(opt("--fps", 60));
const H = Number(opt("--h", 1440));
const FROM = Number(opt("--from", 0));
const TO = Number(opt("--to", SEC));
const STILL = opt("--still");
const AUDIO = opt("--audio");

if (!name || !fs.existsSync(path.join(SRC, `${name}.html`))) {
  console.log("사용법: node motion-render.mjs <이름> --sec 45 [--audio a.wav]   (motion/<이름>.html)");
  process.exit(1);
}
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: H / 1080 });
await page.goto(pathToFileURL(path.join(SRC, `${name}.html`)).href, { waitUntil: "networkidle" });
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(500);
// 시계를 멈춘다. 이후 시각은 seek 로만 움직인다
await page.evaluate(() => document.getAnimations().forEach((a) => a.pause()));
const seek = (t) => page.evaluate((ms) => {
  for (const a of document.getAnimations()) a.currentTime = ms;
  if (typeof window.seek === "function") window.seek(ms / 1000);
}, t * 1000);

if (STILL) {
  await seek(Number(STILL));
  const f = path.join(OUT, `${name}-${STILL}s.png`);
  await page.screenshot({ path: f });
  console.log("  " + f);
  await browser.close();
  process.exit(0);
}

const video = path.join(OUT, `${name}${FROM || TO !== SEC ? `-${FROM}-${TO}` : ""}.mp4`);
const ff = spawn("ffmpeg", [
  "-y", "-loglevel", "error",
  "-f", "image2pipe", "-framerate", String(FPS), "-c:v", "mjpeg", "-i", "-",
  ...(AUDIO ? ["-ss", String(FROM), "-t", String(TO - FROM), "-i", AUDIO] : []),
  "-c:v", "libx264", "-preset", "slow", "-crf", "14", "-pix_fmt", "yuv420p",
  "-profile:v", "high", "-r", String(FPS), "-g", String(FPS / 2), "-bf", "2",
  ...(AUDIO ? ["-c:a", "aac", "-b:a", "320k", "-shortest"] : []),
  "-movflags", "+faststart", video,
], { stdio: ["pipe", "inherit", "inherit"] });

const total = Math.round((TO - FROM) * FPS);
const t0 = Date.now();
for (let i = 0; i < total; i++) {
  await seek(FROM + i / FPS);
  const buf = await page.screenshot({ type: "jpeg", quality: 96 });
  if (!ff.stdin.write(buf)) await new Promise((ok) => ff.stdin.once("drain", ok));
  if (i % (FPS * 5) === 0) {
    const el = (Date.now() - t0) / 1000;
    console.log(`  ${(FROM + i / FPS).toFixed(1)}s / ${TO}s  (${el.toFixed(0)}초 경과)`);
  }
}
ff.stdin.end();
await new Promise((ok) => ff.on("close", ok));
await browser.close();
const mb = (fs.statSync(video).size / 1024 / 1024).toFixed(1);
console.log(`✓ ${video}  ${Math.round(1920 * H / 1080)}×${H} · ${FPS}fps · ${(TO - FROM)}초 · ${mb}MB${AUDIO ? " · 음악 포함" : ""}`);
