/**
 * 모션 영상에 깔 음악을 코드로 만든다.
 *
 * 남의 음원을 쓰면 저작권 확인이 따라붙는다(유튜브 Content ID 경고·수익 회수).
 * 여기서 직접 합성하면 그 걱정이 없다. 소리는 전부 수식에서 나온다.
 *
 * 구성: 패드(Am–F–C–G) + 아르페지오 + 베이스, 장면이 바뀌는 시각에 휙-쿵.
 * 북·하이햇은 장면이 넘어가며 하나씩 들어온다(쌓이는 느낌). 마지막 장면에서 빠진다.
 *
 *   node motion-music.mjs out.wav --sec 41 --cuts 5.5,14,21.5,29.5,34.5
 *
 * 그다음 ffmpeg 로 울림·음량을 맞춰 영상과 합친다(motion-mux 쪽 명령은 BUILD-LOG 참고).
 */
import fs from "node:fs";

const args = process.argv.slice(2);
const out = args.find((a) => a.endsWith(".wav")) || "music.wav";
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const SEC = Number(opt("--sec", 41));
const CUTS = opt("--cuts", "5.5,14,21.5,29.5,34.5").split(",").map(Number);

const SR = 44100, N = Math.floor(SR * SEC);
const L = new Float32Array(N), R = new Float32Array(N);
const BPM = 120, BEAT = 60 / BPM, BAR = BEAT * 4;
const hz = (m) => 440 * 2 ** ((m - 69) / 12);

// Am – F – C – G, 한 화음에 2마디(4초)
const CH = [[57, 60, 64], [53, 57, 60], [55, 60, 64], [55, 59, 62]];
const ROOT = [45, 41, 48, 43];
const chordAt = (t) => Math.floor(t / (BAR * 2)) % 4;

const END = CUTS[CUTS.length - 1];           // 마지막 장면: 북 빠지고 화음만 남는다
const drumsOn = (t) => t >= CUTS[0] && t < END;
const hatsOn = (t) => t >= CUTS[1] && t < END;

function add(i, l, r) { if (i >= 0 && i < N) { L[i] += l; R[i] += r; } }

// ── 패드: 톱니 셋을 조금씩 어긋나게, 한 극 저역통과로 둥글게 ──
{
  let lpL = 0, lpR = 0;
  for (let i = 0; i < N; i++) {
    const t = i / SR, c = t >= END ? 0 : chordAt(t);
    let sL = 0, sR = 0;
    for (const m of CH[c]) {
      const f = hz(m);
      for (const [dt, pan] of [[-0.12, 0.8], [0, 0.5], [0.12, 0.2]]) {
        const ph = (t * f * 2 ** (dt / 12)) % 1;
        const s = 2 * ph - 1;
        sL += s * (1 - pan); sR += s * pan;
      }
    }
    // 필터가 장면마다 조금씩 열린다
    const open = 0.02 + 0.05 * Math.min(1, t / END) + 0.015 * Math.sin(t * 0.7);
    lpL += (sL - lpL) * open; lpR += (sR - lpR) * open;
    const env = Math.min(1, t / 3) * Math.min(1, (SEC - t) / 4);
    add(i, lpL * 0.05 * env, lpR * 0.05 * env);
  }
}

// ── 아르페지오: 16분음표, 사인 + 배음 하나, 짧게 끊긴다 ──
{
  const sixteenth = BEAT / 4;
  for (let k = 0; k * sixteenth < SEC - 1; k++) {
    const t0 = k * sixteenth;
    if (t0 >= END + BAR) break;
    const c = chordAt(t0), notes = CH[c];
    const m = notes[[0, 1, 2, 1, 2, 0, 2, 1][k % 8]] + 12 + (k % 16 >= 8 ? 12 : 0);
    const f = hz(m), vel = (k % 4 === 0 ? 0.11 : 0.07) * Math.min(1, t0 / 2);
    const pan = 0.5 + 0.35 * Math.sin(k * 0.9);
    const len = Math.floor(SR * 0.35), s0 = Math.floor(t0 * SR);
    for (let j = 0; j < len; j++) {
      const tt = j / SR, e = Math.exp(-tt * 14) * Math.min(1, j / 40);
      const s = (Math.sin(2 * Math.PI * f * tt) + 0.3 * Math.sin(4 * Math.PI * f * tt)) * e * vel;
      add(s0 + j, s * (1 - pan), s * pan);
    }
    // 메아리 — 점 8분 뒤에 작게
    const d = Math.floor(SR * BEAT * 0.75);
    for (let j = 0; j < len; j++) {
      const tt = j / SR, e = Math.exp(-tt * 14);
      const s = Math.sin(2 * Math.PI * f * tt) * e * vel * 0.35;
      add(s0 + d + j, s * pan, s * (1 - pan));
    }
  }
}

// ── 베이스: 8분음표 근음 ──
for (let k = 0; k * BEAT / 2 < END; k++) {
  const t0 = k * BEAT / 2;
  if (t0 < CUTS[0]) continue;
  const f = hz(ROOT[chordAt(t0)]), s0 = Math.floor(t0 * SR), len = Math.floor(SR * BEAT / 2);
  for (let j = 0; j < len; j++) {
    const tt = j / SR, e = Math.exp(-tt * 5) * Math.min(1, j / 80);
    const s = Math.tanh(Math.sin(2 * Math.PI * f * tt) * 1.6) * e * 0.16;
    add(s0 + j, s, s);
  }
}

// ── 북 ──
for (let k = 0; k * BEAT < SEC; k++) {
  const t0 = k * BEAT;
  if (!drumsOn(t0)) continue;
  const s0 = Math.floor(t0 * SR), len = Math.floor(SR * 0.4);
  let ph = 0;
  for (let j = 0; j < len; j++) {
    const tt = j / SR, f = 48 + 110 * Math.exp(-tt * 30);
    ph += 2 * Math.PI * f / SR;
    const s = Math.sin(ph) * Math.exp(-tt * 9) * 0.28;
    add(s0 + j, s, s);
  }
}

// ── 하이햇: 엇박, 고역 잡음 ──
{
  let seed = 7;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff) * 2 - 1;
  for (let k = 0; k * BEAT / 2 < SEC; k++) {
    const t0 = k * BEAT / 2 + BEAT / 4 * (k % 2);
    if (!hatsOn(t0) || k % 2 === 0) continue;
    const s0 = Math.floor(t0 * SR), len = Math.floor(SR * 0.06);
    let prev = 0;
    for (let j = 0; j < len; j++) {
      const n = rnd(), hp = n - prev; prev = n;
      const s = hp * Math.exp(-j / SR * 60) * 0.035;
      add(s0 + j, s * 0.7, s * 1.0);
    }
  }
}

// ── 장면 전환: 0.8초 휙(잡음 상승) + 쿵 ──
{
  let seed = 3;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff) * 2 - 1;
  for (const cut of CUTS) {
    const rise = 0.8, s0 = Math.floor((cut - rise) * SR), len = Math.floor(rise * SR);
    let lp = 0;
    for (let j = 0; j < len; j++) {
      const p = j / len, n = rnd();
      lp += (n - lp) * (0.02 + 0.5 * p * p);
      const s = lp * p * p * 0.22;
      add(s0 + j, s * (1 - p * 0.5), s * (0.5 + p * 0.5));
    }
    const b0 = Math.floor(cut * SR), blen = Math.floor(SR * 1.2);
    let ph = 0;
    for (let j = 0; j < blen; j++) {
      const tt = j / SR, f = 38 + 60 * Math.exp(-tt * 12);
      ph += 2 * Math.PI * f / SR;
      const s = Math.sin(ph) * Math.exp(-tt * 3.2) * 0.5;
      add(b0 + j, s, s);
    }
  }
}

// ── 정규화 후 16비트 WAV ──
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
console.log(`  ${out}  ${SEC}초 · 전환 ${CUTS.join(" / ")}초 · 피크 ${peak.toFixed(2)} → 0.89`);
