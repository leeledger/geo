// 사이티드 파비콘·공유 썸네일 굽기. tools 에서 node cited-brand-render.mjs
// icon.svg 를 원본으로 favicon.ico·apple-icon.png 를, 히어로 문구로 opengraph-image.png(1200×630)를 만든다.
// 문구를 바꾸면 web/app/opengraph-image.alt.txt 도 같이 바꾼다.
import { createRequire } from "node:module";
import fs from "node:fs";
const require = createRequire("C:/dev/AGO&GEO/tools/package.json");
const { chromium } = require("playwright");
const APP = "C:/dev/AGO&GEO/web/app";
const svg = fs.readFileSync(`${APP}/icon.svg`, "utf8");

const b = await chromium.launch();
const pg = await b.newPage();

async function iconPng(size) {
  await pg.setViewportSize({ width: size, height: size });
  await pg.setContent(`<html><body style="margin:0;background:transparent">${svg.replace('width="64" height="64"', `width="${size}" height="${size}"`)}</body></html>`);
  return pg.screenshot({ omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } });
}

// apple-icon — iOS 는 모서리를 스스로 깎으므로 꽉 찬 사각
{
  await pg.setViewportSize({ width: 180, height: 180 });
  await pg.setContent(`<html><body style="margin:0">${svg.replace('width="64" height="64"', 'width="180" height="180"').replace('rx="14"', 'rx="0"')}</body></html>`);
  fs.writeFileSync(`${APP}/apple-icon.png`, await pg.screenshot({ clip: { x: 0, y: 0, width: 180, height: 180 } }));
}

// favicon.ico — PNG 를 그대로 담는 ICO(16·32·48)
{
  const pngs = [];
  for (const s of [16, 32, 48]) pngs.push([s, await iconPng(s)]);
  const head = Buffer.alloc(6 + 16 * pngs.length);
  head.writeUInt16LE(0, 0); head.writeUInt16LE(1, 2); head.writeUInt16LE(pngs.length, 4);
  let off = head.length;
  pngs.forEach(([s, p], i) => {
    const o = 6 + 16 * i;
    head.writeUInt8(s, o); head.writeUInt8(s, o + 1); head.writeUInt8(0, o + 2); head.writeUInt8(0, o + 3);
    head.writeUInt16LE(1, o + 4); head.writeUInt16LE(32, o + 6);
    head.writeUInt32LE(p.length, o + 8); head.writeUInt32LE(off, o + 12);
    off += p.length;
  });
  fs.writeFileSync(`${APP}/favicon.ico`, Buffer.concat([head, ...pngs.map(([, p]) => p)]));
}

// 공유 썸네일 1200×630 — 문구는 랜딩 히어로 그대로(숫자 없음)
{
  await pg.setViewportSize({ width: 1200, height: 630 });
  await pg.setContent(`<!doctype html><html><head>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css">
<style>
*{box-sizing:border-box;margin:0}
body{width:1200px;height:630px;background:#0A1A33;color:#EEF3FB;font-family:Pretendard,sans-serif;word-break:keep-all;position:relative;overflow:hidden}
body::before{content:"";position:absolute;inset:0;background:
 radial-gradient(760px 460px at 92% -10%, rgba(64,132,255,.32), transparent 60%),
 radial-gradient(rgba(255,255,255,.07) 1px, transparent 1.3px) 0 0/26px 26px}
.in{position:relative;padding:72px 84px;height:100%;display:flex;flex-direction:column}
.logo{display:flex;align-items:center;gap:16px;font-size:34px;font-weight:800;letter-spacing:-.03em}
.logo em{font-style:normal;font-weight:500;font-size:24px;color:#AFBDD3}
h1{margin-top:auto;font-size:92px;line-height:1.18;letter-spacing:-.045em;font-weight:800;color:#fff}
h1 span{color:#6BAEFF}
p{margin-top:28px;font-size:30px;color:#AFBDD3;letter-spacing:-.02em}
.dom{position:absolute;right:84px;top:80px;font-size:26px;font-weight:600;color:#AFBDD3}
</style></head><body><div class="in">
<div class="logo">${svg.replace('width="64" height="64"', 'width="52" height="52"')}Cited<em>사이티드</em></div>
<h1>손님은 AI가 꼽아 준<br><span>몇 곳만 봅니다</span></h1>
<p>그 몇 곳에 우리 회사 이름이 들어가게 만듭니다.</p>
</div><div class="dom">cited.kr</div></body></html>`, { waitUntil: "networkidle" });
  await pg.evaluate(() => document.fonts.ready);
  const fam = await pg.evaluate(() => document.fonts.check('800 92px Pretendard'));
  if (!fam) throw new Error("Pretendard 못 받음");
  fs.writeFileSync(`${APP}/opengraph-image.png`, await pg.screenshot({ clip: { x: 0, y: 0, width: 1200, height: 630 } }));
}
await b.close();
console.log("ok");
