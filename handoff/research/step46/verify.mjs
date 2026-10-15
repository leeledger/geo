import { createRequire } from "node:module";
import fs from "node:fs";
const require = createRequire("C:/dev/AGO&GEO/tools/package.json");
const { chromium } = require("playwright");

const url = process.argv[2] || "http://localhost:3046/";
const OUT = process.argv[3] || "C:/dev/AGO&GEO/handoff/research/step46";
const tag = process.argv[4] || "";
const before = JSON.parse(fs.readFileSync(OUT + "/text-before.json", "utf8"));
const log = [];
let fails = 0;
const ok = (cond, msg) => { log.push((cond ? "PASS " : "FAIL ") + msg); if (!cond) fails++; };

const b = await chromium.launch();
const errs = [];
async function open(opts, w, h) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, ...opts });
  const p = await ctx.newPage();
  p.on("console", (m) => { if (m.type() === "error" || /hydrat/i.test(m.text())) errs.push(`[${w}] ${m.type()}: ${m.text().slice(0, 200)}`); });
  p.on("pageerror", (e) => errs.push(`[${w}] pageerror: ${e.message}`));
  await p.goto(url, { waitUntil: "commit" });
  // t=0 is first contentful paint (local server takes ~1s to first paint; the motion starts there)
  const at = (ms) => p.waitForFunction((ms) => {
    const f = performance.getEntriesByName("first-contentful-paint")[0];
    return f && performance.now() >= f.startTime + ms;
  }, ms, { polling: 16, timeout: 30000 });
  return { ctx, p, at: opts.javaScriptEnabled === false ? (ms) => p.waitForTimeout(ms + 1000) : at };
}

for (const [w, h] of [[1440, 900], [390, 844]]) {
  // 0.3s frame: the main thread is blocked by hydration around then, so a live screenshot lands late.
  // Freeze the hero CSS animations at first frame, seek them to 300ms, then shoot — the exact t=0.3s frame.
  {
    const ctx0 = await b.newContext({ viewport: { width: w, height: h } });
    const p0 = await ctx0.newPage();
    await p0.addInitScript(() => {
      const loop = () => {
        const h1 = document.querySelector(".hero h1");
        const as = h1 ? document.getAnimations().filter((x) => x.animationName && x.animationName.startsWith("hm-")) : [];
        if (as.length) { as.forEach((x) => x.pause()); window.__frozen = as; return; }
        requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
    });
    await p0.goto(url, { waitUntil: "commit" });
    await p0.waitForFunction(() => window.__frozen, null, { timeout: 30000 });
    const st = await p0.evaluate(() => {
      window.__frozen.forEach((x) => { x.currentTime = 300; });
      const h1 = document.querySelector(".hero h1");
      return { clip: getComputedStyle(h1).clipPath, filter: getComputedStyle(h1).filter, n: window.__frozen.length };
    });
    await p0.waitForTimeout(100);
    await p0.screenshot({ path: `${OUT}/${tag}${w}-0.3s.png` });
    ok(st.clip.startsWith("inset") && !st.clip.includes(" 100%)") && st.filter !== "none", `[${w}] t=0.3s h1 partly revealed (clip ${st.clip}, filter ${st.filter}, ${st.n} hm- animations)`);
    await ctx0.close();
  }
  const { ctx, p, at } = await open({}, w, h);
  await p.waitForSelector(".hero h1");
  await at(1500);
  await p.screenshot({ path: `${OUT}/${tag}${w}-1.5s.png` });
  const s15 = await p.evaluate(() => {
    const h1 = document.querySelector(".hero h1");
    return { clip: getComputedStyle(h1).clipPath, filter: getComputedStyle(h1).filter, anims: h1.getAnimations().length };
  });
  ok(s15.clip === "none" && s15.filter === "none", `[${w}] 1.5s h1 fully open (clip ${s15.clip}, filter ${s15.filter}, running anims ${s15.anims})`);
  await at(4000);
  await p.screenshot({ path: `${OUT}/${tag}${w}-4s.png` });
  if (w === 390) {
    const pre = await p.evaluate(() => document.querySelector(".hero .editor").classList.contains("in"));
    ok(!pre, "[390] editor below fold at 4s is not .in yet (typing waits for it)");
    await p.evaluate(() => document.querySelector(".hero .editor").scrollIntoView({ block: "center" }));
    await p.waitForTimeout(700);
    await p.screenshot({ path: `${OUT}/${tag}390-editor-typing.png` });
    await p.waitForTimeout(2600);
    await p.screenshot({ path: `${OUT}/${tag}390-editor-done.png` });
  }
  const s4 = await p.evaluate(() => {
    const ed = document.querySelector(".hero .editor");
    const lns = [...ed.querySelectorAll(".ln")];
    return {
      hero: document.querySelector(".hero").innerText,
      code: ed.querySelector("code").textContent,
      typing: ed.classList.contains("typing"),
      framed: !!ed.querySelector(".qa-frame.framed"),
      qaLines: ed.querySelectorAll(".qa-frame .ln").length,
      glow: ed.querySelectorAll(".end.glow").length,
      ln: lns.length,
      lnVisible: lns.every((l) => getComputedStyle(l).opacity === "1"),
      tf: getComputedStyle(ed).transform,
      rise: getComputedStyle(ed).getPropertyValue("--rise").trim(),
      edTop: ed.getBoundingClientRect().top,
    };
  });
  ok(s4.hero === before[w].hero, `[${w}] 4s .hero innerText identical to pre-change (${s4.hero.length} chars)`);
  ok(s4.code === before[w].code, `[${w}] 4s code textContent identical to pre-change (${s4.code.length} chars)`);
  ok(s4.typing && s4.ln === 12, `[${w}] code wrapped into ${s4.ln} .ln, .typing on`);
  ok(s4.framed && s4.qaLines === 6, `[${w}] .qa-frame.framed present wrapping ${s4.qaLines} lines`);
  ok(s4.glow === 2, `[${w}] .end.glow count ${s4.glow}`);
  ok(s4.lnVisible, `[${w}] all .ln opacity 1`);
  // matrix3d m42 (index 13) = vertical translation
  const m = s4.tf.match(/matrix3d\(([^)]+)\)/);
  const ty = m ? parseFloat(m[1].split(",")[13]) : NaN;
  ok(s4.rise === "0px" && Math.abs(ty) < 0.01, `[${w}] editor after .in: --rise ${s4.rise}, vertical translate ${ty} (${s4.tf.slice(0, 60)}...)`);

  // pointer tilt
  await p.mouse.move(w * 0.85, 200);
  await p.waitForTimeout(150);
  await p.mouse.move(w * 0.9, 150);
  await p.waitForTimeout(400);
  const tilt = await p.evaluate(() => {
    const ed = document.querySelector(".hero .editor");
    const m = getComputedStyle(ed).transform.match(/matrix3d\(([^)]+)\)/);
    const v = m ? m[1].split(",").map(Number) : [];
    return { rx: ed.style.getPropertyValue("--rx"), ry: ed.style.getPropertyValue("--ry"), m13: v[2] || 0, m42: v[13] || 0,
      col: document.querySelector(".hero .wrap>div:first-child").style.translate, cv: document.querySelector(".hero canvas").style.translate };
  });
  if (w === 1440) ok(Math.abs(tilt.m13) > 0.01 && Math.abs(tilt.m42) < 0.01 && tilt.col && tilt.cv, `[1440] pointer tilt: rx ${tilt.rx} ry ${tilt.ry}, m13 ${tilt.m13.toFixed(3)}, ty ${tilt.m42}, col ${tilt.col}, canvas ${tilt.cv}`);
  else ok(Math.abs(tilt.m13) < 0.0001 && !tilt.col && !tilt.cv, `[390] no tilt/parallax: m13 ${tilt.m13}, col '${tilt.col}', canvas '${tilt.cv}'`);

  // .btn:hover transform intact
  await p.hover(".hero .btn.primary");
  await p.waitForTimeout(300);
  const hov = await p.evaluate(() => getComputedStyle(document.querySelector(".hero .btn.primary")).transform);
  ok(/matrix\(1, 0, 0, 1, 0, -2\)/.test(hov), `[${w}] .btn:hover transform kept (${hov})`);

  // canvas moving: two frames differ
  const shot = async () => (await p.locator(".hero canvas").screenshot()).toString("base64");
  const f1 = await shot(); await p.waitForTimeout(500); const f2 = await shot();
  ok(f1 !== f2, `[${w}] canvas robot animates (frames differ)`);

  // scroll-out then other .rise sections
  await p.mouse.move(5, h - 5);
  await p.evaluate(() => window.scrollTo(0, document.querySelector(".hero").offsetHeight * 0.5));
  await p.waitForTimeout(300);
  const sc = await p.evaluate(() => { const s = document.querySelector(".hero .wrap").style; return { o: s.opacity, sc: s.scale, t: s.translate }; });
  ok(w === 1440 ? sc.o && Math.abs(parseFloat(sc.o) - 0.7) < 0.05 && !!sc.sc && !!sc.t : !sc.o && !sc.sc && !sc.t, `[${w}] scroll p≈.5: wrap opacity '${sc.o}' scale '${sc.sc}' translate '${sc.t}'`);
  if (w === 390) {
    await p.evaluate(() => document.querySelector(".hero .editor").scrollIntoView({ block: "center" }));
    await p.waitForTimeout(400);
    const eo = await p.evaluate(() => { let o = 1; for (let e = document.querySelector(".hero .editor"); e; e = e.parentElement) o *= parseFloat(getComputedStyle(e).opacity); return o; });
    ok(eo === 1, `[390] editor centred on screen: effective opacity ${eo}`);
  }
  const total = await p.evaluate(() => document.body.scrollHeight);
  for (let y = 0; y < total; y += h * 0.6) { await p.evaluate((y) => window.scrollTo(0, y), y); await p.waitForTimeout(120); }
  await p.waitForTimeout(900);
  const rs = await p.evaluate(() => [...document.querySelectorAll(".rise")].filter((e) => getComputedStyle(e).opacity !== "1").length);
  ok(rs === 0, `[${w}] all .rise opacity 1 after scrolling (${rs} not)`);
  await ctx.close();
}

// reduced motion
{
  const { ctx, p, at } = await open({ reducedMotion: "reduce" }, 1440, 900);
  await at(4000);
  await p.screenshot({ path: `${OUT}/${tag}1440-4s-reduce.png` });
  const r = await p.evaluate(() => ({
    typing: document.querySelector(".hero .editor").classList.contains("typing"),
    ln: document.querySelectorAll(".hero .ln").length,
    an: getComputedStyle(document.querySelector(".hero h1")).animationName,
    tf: getComputedStyle(document.querySelector(".hero .editor")).transform,
    hero: document.querySelector(".hero").innerText,
  }));
  ok(!r.typing && r.ln === 0 && r.an === "none" && r.tf === "none", `[reduce] no .typing, no .ln, h1 animation ${r.an}, editor transform ${r.tf}`);
  ok(r.hero === before[1440].hero, `[reduce] hero text identical`);
  await ctx.close();
}

// JS off
{
  const { ctx, p, at } = await open({ javaScriptEnabled: false }, 1440, 900);
  await at(4000);
  await p.screenshot({ path: `${OUT}/${tag}1440-4s-nojs.png` });
  const r = await p.evaluate(() => {
    const vis = (s) => { const e = document.querySelector(s); const c = getComputedStyle(e); const rc = e.getBoundingClientRect(); return c.opacity === "1" && c.clipPath === "none" && c.visibility !== "hidden" && rc.height > 0; };
    return { h1: vis(".hero h1"), sub: vis(".hero .sub"), cta: [...document.querySelectorAll(".hero .cta .btn")].every((b) => getComputedStyle(b).opacity === "1"),
      code: document.querySelector(".hero .editor code").textContent, ln: document.querySelectorAll(".hero .ln").length };
  }).catch((e) => ({ err: e.message }));
  ok(r.h1 && r.sub && r.cta, `[nojs] h1 ${r.h1} sub ${r.sub} cta ${r.cta} visible at 4s`);
  ok(r.code === before[1440].code && r.ln === 0, `[nojs] code DOM untouched (no .ln, text identical)`);
  await ctx.close();
}

await b.close();
ok(errs.length === 0, `console errors / hydration warnings: ${errs.length}`);
errs.forEach((e) => log.push("   " + e));
const text = log.join("\n");
fs.writeFileSync(`${OUT}/${tag}assertions.txt`, text + `\n\n${fails} failed\n`);
console.log(text + `\n\n${fails} failed`);
