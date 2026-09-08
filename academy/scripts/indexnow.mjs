/**
 * IndexNow — 검색엔진에 "이 페이지 새로 생겼다"고 직접 알린다.
 *
 * 크롤러가 찾아올 때까지 기다리는 대신 우리가 먼저 알린다.
 * 네이버(2023.7~)와 빙이 지원하고, 한 곳에 보내면 참여 엔진끼리 공유한다.
 * 구글은 참여하지 않는다 — 구글은 Search Console 에서 사람이 요청해야 한다.
 *
 * 키 파일이 사이트 루트에 있어야 소유자로 인정한다.
 *   https://robotncoding.com/<key>.txt  안에 <key> 가 그대로 들어 있어야 한다.
 *
 *   node scripts/indexnow.mjs            사이트맵의 전 페이지 알림
 *   node scripts/indexnow.mjs --list     보낼 목록만 확인
 */
import fs from "node:fs";
import path from "node:path";

const HOST = "robotncoding.com";
const KEY_FILE = path.join(process.cwd(), "public", "indexnow-key.txt");

// 키는 한 번 만들면 바꾸지 않는다. 바꾸면 이전 알림의 소유 증명이 끊긴다.
let KEY;
if (fs.existsSync(KEY_FILE)) {
  KEY = fs.readFileSync(KEY_FILE, "utf8").trim();
} else {
  KEY = [...crypto.getRandomValues(new Uint8Array(16))]
    .map((b) => b.toString(16).padStart(2, "0")).join("");
  fs.mkdirSync(path.dirname(KEY_FILE), { recursive: true });
  fs.writeFileSync(KEY_FILE, KEY);
  // 규약상 <key>.txt 이름이어야 하므로 같은 내용으로 하나 더 둔다
  fs.writeFileSync(path.join(process.cwd(), "public", `${KEY}.txt`), KEY);
  console.log("키 생성:", KEY);
  console.log("배포 후 https://" + HOST + "/" + KEY + ".txt 가 열려야 합니다.");
}

/** 사이트맵에서 URL 을 읽는다 — 목록을 따로 관리하면 반드시 어긋난다 */
async function urls() {
  const r = await fetch(`https://${HOST}/sitemap.xml`);
  if (!r.ok) throw new Error("사이트맵을 못 읽었습니다: " + r.status);
  const xml = await r.text();
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
}

const list = await urls();
console.log(`사이트맵에서 ${list.length}개 주소를 읽었습니다.`);

if (process.argv.includes("--list")) {
  list.forEach((u) => console.log("  " + u));
  process.exit(0);
}

// 참여 엔진 아무 곳에나 보내면 서로 공유하지만,
// 네이버는 자체 엔드포인트가 확실하므로 둘 다 보낸다.
const ENDPOINTS = [
  { name: "Bing", url: "https://api.indexnow.org/indexnow" },
  { name: "Naver", url: "https://searchadvisor.naver.com/indexnow" },
];

const body = {
  host: HOST,
  key: KEY,
  keyLocation: `https://${HOST}/${KEY}.txt`,
  urlList: list,
};

for (const ep of ENDPOINTS) {
  try {
    const r = await fetch(ep.url, {
      method: "POST",
      headers: { "content-type": "application/json; charset=utf-8" },
      body: JSON.stringify(body),
    });
    const txt = await r.text().catch(() => "");
    // 200 = 접수, 202 = 접수했고 키 확인 중, 400/403/422 = 문제
    const ok = r.status === 200 || r.status === 202;
    console.log(`  ${ep.name.padEnd(6)} HTTP ${r.status} ${ok ? "접수됨" : "실패"}${txt ? " · " + txt.slice(0, 120) : ""}`);
  } catch (e) {
    console.log(`  ${ep.name.padEnd(6)} 실패 · ${e.message}`);
  }
}

console.log("\n구글은 IndexNow 에 참여하지 않습니다. Search Console 에서 직접 요청해야 합니다.");
