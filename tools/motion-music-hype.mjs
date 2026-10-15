/**
 * 박진감 판 음악 — 128 BPM, 마디 머리마다 장면이 바뀌는 영상(homepage-hype.html)용.
 *
 * motion-music.mjs 가 잔잔한 깔개라면 이건 쌓고 터뜨린다:
 *   인트로(심장박동) → 4박 북·박수 → 아르페지오 → 16분 하이햇 → 스네어 롤·상승음 → 드롭 → 브레이크다운 → 마지막 한 방
 * 소리는 전부 수식으로 만든다(저작권 걱정 없음). 펌핑(사이드체인)으로 북이 칠 때 나머지가 눌린다.
 *
 *   node motion-music-hype.mjs out.wav [--sec 45]
 *
 * 구간(마디 = 1.875초):
 *   0–1 인트로 · 2–4 북 · 5–8 +아르페지오 · 9–12 +16분 햇 · 13–15 전부 · 16 롤
 *   17–19 드롭(31.875) · 20–21 브레이크(37.5) · 22–23 끝(41.25)
 * 쿵(임팩트): 3.75 · 9.375 · 16.875 · 24.375 · 31.875 · 37.5 · 41.25 — 영상 컷과 같다
 */
import fs from "node:fs";

const args = process.argv.slice(2);
const out = args.find((a) => a.endsWith(".wav")) || "hype.wav";
const si = args.indexOf("--sec");
const SEC = si >= 0 ? Number(args[si + 1]) : 45;
// --transpose N: 같은 구성을 다른 조로(영상마다 소리가 겹치지 않게). 사이티드 홍보는 +2
const ti = args.indexOf("--transpose");
const TR = ti >= 0 ? Number(args[ti + 1]) : 0;

const SR = 44100, N = Math.floor(SR * SEC);
const L = new Float32Array(N), R = new Float32Array(N);
const BEAT = 60 / 128, BAR = BEAT * 4;
const HITS = [3.75, 9.375, 16.875, 24.375, 31.875, 37.5, 41.25];
const hz = (m) => 440 * 2 ** ((m + TR - 69) / 12);
const bar = (t) => Math.floor(t / BAR + 1e-9);

// Am – F – C – G, 한 마디에 한 화음
const CH = [[57, 60, 64, 69], [53, 57, 60, 65], [55, 60, 64, 67], [55, 59, 62, 67]];
const BASS = [33, 29, 36, 31];
const chord = (t) => bar(t) % 4;

let seed = 11;
const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff) * 2 - 1;
const add = (i, l, r) => { if (i >= 0 && i < N) { L[i] += l; R[i] += r; } };

// 구간 판정
const sec = (t) => {
  const b = bar(t);
  return {
    intro: b <= 1, drums: b >= 2 && b <= 19 && !(b === 16 && t % BAR > BEAT * 2),
    arp: b >= 5 && b <= 21, hat16: b >= 9 && b <= 19, roll: b === 16,
    drop: b >= 17 && b <= 19, brk: b >= 20 && b <= 21, end: b >= 22,
  };
};

// ── 펌핑: 북이 칠 때마다 나머지를 눌렀다 놓는다 ──
const kicks = [];
for (let k = 0; k * BEAT < SEC; k++) {
  const t = k * BEAT, s = sec(t);
  if (s.drums || (s.intro && k % 4 === 0) || (s.brk && k % 4 === 0)) kicks.push(t);
}
const duck = new Float32Array(N).fill(1);
for (const t of kicks) {
  const s0 = Math.floor(t * SR);
  for (let j = 0; j < SR * 0.3; j++) {
    const v = 1 - 0.75 * Math.exp(-j / SR / 0.07);
    if (s0 + j < N) duck[s0 + j] = Math.min(duck[s0 + j], v);
  }
}

// ── 패드 ──
{
  let a = 0, b = 0;
  for (let i = 0; i < N; i++) {
    const t = i / SR, s = sec(t), c = chord(t);
    let l = 0, r = 0;
    for (const m of CH[c]) {
      const f = hz(m);
      for (const [dt, p] of [[-0.1, 0.85], [0.1, 0.15], [0, 0.5]]) {
        const v = 2 * ((t * f * 2 ** (dt / 12)) % 1) - 1;
        l += v * (1 - p); r += v * p;
      }
    }
    // 필터: 인트로는 닫혀 있고, 롤에서 열리며, 드롭에서 활짝
    let cut = s.intro ? 0.012 + 0.02 * (t / (BAR * 2)) : s.drop ? 0.14 : s.brk || s.end ? 0.05 : 0.045;
    if (s.roll) cut = 0.04 + 0.1 * ((t % BAR) / BAR);
    a += (l - a) * cut; b += (r - b) * cut;
    const g = (s.drop ? 0.05 : 0.04) * (s.drums ? duck[i] : 1) * Math.min(1, t / 1.5) * Math.min(1, (SEC - t) / 2.5);
    add(i, a * g, b * g);
  }
}

// ── 베이스: 8분 톱니, 펌핑 ──
{
  let lp = 0;
  for (let i = 0; i < N; i++) {
    const t = i / SR, s = sec(t);
    if (!(s.drums)) { lp *= 0.999; continue; }
    const f = hz(BASS[chord(t)] + ((Math.floor(t / (BEAT / 2)) % 2) ? 12 : 0));
    const v = 2 * ((t * f) % 1) - 1;
    lp += (v - lp) * (s.drop ? 0.09 : 0.06);
    const e = Math.exp(-((t % (BEAT / 2)) / 0.16));
    const g = 0.22 * e * duck[i];
    add(i, Math.tanh(lp * 2) * g, Math.tanh(lp * 2) * g);
  }
}

// ── 북 ──
for (const t of kicks) {
  const s0 = Math.floor(t * SR), big = sec(t).drop ? 1.15 : 1;
  let ph = 0;
  for (let j = 0; j < SR * 0.45; j++) {
    const tt = j / SR, f = 46 + 140 * Math.exp(-tt * 28);
    ph += 2 * Math.PI * f / SR;
    const v = (Math.tanh(Math.sin(ph) * 2.2) * Math.exp(-tt * 7.5) + (j < 90 ? rnd() * 0.3 * (1 - j / 90) : 0)) * 0.5 * big;
    add(s0 + j, v, v);
  }
}

// ── 박수(2·4박) · 스네어 롤 ──
const clap = (t, g) => {
  const s0 = Math.floor(t * SR);
  let a = 0, b = 0;
  for (let j = 0; j < SR * 0.22; j++) {
    const tt = j / SR, n = rnd();
    a += (n - a) * 0.5; b += (a - b) * 0.08;     // 대역통과 비슷하게
    const bp = a - b;
    const env = (tt < 0.03 ? (Math.floor(tt / 0.01) % 2 ? 0.6 : 1) : 1) * Math.exp(-tt * 18);
    add(s0 + j, bp * env * g * 0.9, bp * env * g);
  }
};
for (let k = 0; k * BEAT < SEC; k++) {
  const t = k * BEAT, s = sec(t);
  if (s.drums && !s.roll && k % 2 === 1) clap(t, s.drop ? 0.55 : 0.45);
}
{ // 롤: 16분 → 32분, 점점 크게
  const b0 = 16 * BAR;
  for (let t = b0; t < b0 + BAR - 1e-6;) {
    const p = (t - b0) / BAR;
    clap(t, 0.15 + 0.45 * p);
    t += p < 0.5 ? BEAT / 4 : BEAT / 8;
  }
}

// ── 하이햇 ──
const hat = (t, g, open) => {
  const s0 = Math.floor(t * SR);
  let prev = 0;
  for (let j = 0; j < SR * (open ? 0.18 : 0.05); j++) {
    const n = rnd(), hp = n - prev; prev = n;
    const v = hp * Math.exp(-j / SR * (open ? 16 : 70)) * g;
    add(s0 + j, v * 0.8, v);
  }
};
for (let k = 0; k * BEAT / 4 < SEC; k++) {
  const t = k * BEAT / 4, s = sec(t);
  if (s.intro && k % 2 === 0) hat(t, 0.025, false);
  if (s.drums && k % 4 === 2) hat(t, 0.06, true);
  if (s.hat16 && k % 4 !== 2) hat(t, k % 2 ? 0.03 : 0.045, false);
}

// ── 아르페지오: 16분, 드롭에서 한 옥타브 위 ──
for (let k = 0; k * BEAT / 4 < SEC; k++) {
  const t = k * BEAT / 4, s = sec(t);
  if (!s.arp) continue;
  if (s.brk && k % 2) continue;
  const notes = CH[chord(t)];
  const m = notes[[0, 2, 1, 3, 2, 1, 3, 2][k % 8]] + 12 + (s.drop ? 12 : 0);
  const f = hz(m), g = (k % 4 === 0 ? 0.09 : 0.06) * (s.brk ? 0.6 : 1);
  const s0 = Math.floor(t * SR), p = 0.5 + 0.4 * Math.sin(k * 1.3);
  for (let j = 0; j < SR * 0.22; j++) {
    const tt = j / SR, e = Math.exp(-tt * 22) * Math.min(1, j / 30);
    const v = (Math.sign(Math.sin(2 * Math.PI * f * tt)) * 0.35 + Math.sin(2 * Math.PI * f * tt)) * e * g * duck[Math.min(N - 1, s0 + j)];
    add(s0 + j, v * (1 - p), v * p);
    add(s0 + j + Math.floor(SR * BEAT * 0.75), v * p * 0.3, v * (1 - p) * 0.3);
  }
}

// ── 상승음: 쿵 앞에서 잡음이 차오른다. 드롭 앞은 한 마디 통째로 ──
for (const h of HITS) {
  const len = h === 31.875 ? BAR : h === 3.75 ? BAR * 1.2 : BEAT * 2;
  const s0 = Math.floor((h - len) * SR), n = Math.floor(len * SR);
  let lp = 0, ph = 0;
  for (let j = 0; j < n; j++) {
    const p = j / n;
    lp += (rnd() - lp) * (0.01 + 0.6 * p * p);
    ph += 2 * Math.PI * (200 + 1400 * p * p) / SR;
    const v = (lp * 0.9 + Math.sin(ph) * 0.12) * p * p * (h === 31.875 ? 0.32 : 0.2);
    add(s0 + j, v * (1 - p * 0.4), v * (0.6 + p * 0.4));
  }
}

// ── 쿵: 서브 낙하 + 터지는 잡음(크래시) ──
for (const h of HITS) {
  const s0 = Math.floor(h * SR), big = h === 31.875 || h === 37.5 ? 1.3 : 1;
  let ph = 0, prev = 0;
  for (let j = 0; j < SR * 2.2; j++) {
    const tt = j / SR, f = 32 + 90 * Math.exp(-tt * 10);
    ph += 2 * Math.PI * f / SR;
    const sub = Math.tanh(Math.sin(ph) * 1.8) * Math.exp(-tt * 1.8) * 0.55 * big;
    const n = rnd(), hp = n - prev; prev = n;
    const crash = hp * Math.exp(-tt * 2.6) * 0.16 * big;
    add(s0 + j, sub + crash * 0.9, sub + crash);
  }
}

// ── 정규화 · 16비트 WAV ──
let peak = 0;
for (let i = 0; i < N; i++) peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
const g = 0.89 / (peak || 1);
const buf = Buffer.alloc(44 + N * 4);
buf.write("RIFF", 0); buf.writeUInt32LE(36 + N * 4, 4); buf.write("WAVE", 8);
buf.write("fmt ", 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22);
buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34);
buf.write("data", 36); buf.writeUInt32LE(N * 4, 40);
for (let i = 0; i < N; i++) {
  buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, L[i] * g)) * 32767), 44 + i * 4);
  buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, R[i] * g)) * 32767), 46 + i * 4);
}
fs.writeFileSync(out, buf);
console.log(`  ${out}  ${SEC}초 · 128BPM · 쿵 ${HITS.join(" / ")} · 피크 ${peak.toFixed(2)}`);
