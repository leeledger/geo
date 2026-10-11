/**
 * IndexNow — 검색엔진에 "이 페이지 새로 생겼다"고 직접 알린다.
 *
 * 크롤러가 찾아올 때까지 기다리는 대신 우리가 먼저 알린다.
 * 네이버(2023.7~)와 빙이 지원하고, 한 곳에 보내면 참여 엔진끼리 공유한다.
 * 구글은 참여하지 않는다 — 구글은 Search Console 에서 사람이 요청해야 한다.
 *
 * 키 파일이 사이트 루트에 있어야 소유자로 인정한다.
 *   https://<도메인>/<key>.txt  안에 <key> 가 그대로 들어 있어야 한다.
 *
 * 09.11 전까지 HOST 가 robotncoding.com 으로 박혀 있어 아이로그는 한 번도 안 알렸다.
 * 이제 고객사를 돈다. 키 파일이 아직 안 올라간 곳은 건너뛰고 그렇게 적는다 —
 * 키 없이 보내면 두 엔진 다 거절하는데, 로그만 보면 보낸 줄 안다.
 *
 *   node scripts/indexnow.mjs                          전 고객사, 사이트맵 전 페이지
 *   node scripts/indexnow.mjs --list                   보낼 목록만 확인
 *   node scripts/indexnow.mjs --client ilog            한 곳
 *   node scripts/indexnow.mjs --client robotncoding /blog/새글-slug   주소를 직접 지정
 *
 * 마지막 형태가 필요한 이유: 사이트맵은 한 시간마다 다시 만들어진다.
 * 글을 올린 직후에는 사이트맵에 아직 없어서, 사이트맵만 보면 새 글을 빼먹는다.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { 고객고르기, 잠깐DB } from "../clients.mjs";

const ACADEMY_ROOT = fileURLToPath(new URL("../", import.meta.url));

/** 키를 고른다. 이 저장소에 사이트가 있는 곳은 파일에서, 밖에 있는 곳은 설정에서. */
function keyFor(c) {
  if (c.indexnowKey) return c.indexnowKey;
  if (!c.indexnowKeyFile) return null;
  // GitHub Actions와 heartbeat는 실행 위치가 다르다. cwd 기준이면 저장소 루트에 새 키를 만들고
  // 운영에 없는 키로 알림을 시도하므로, academy 루트를 기준으로 고정한다.
  const file = path.join(ACADEMY_ROOT, c.indexnowKeyFile);
  // 키는 한 번 만들면 바꾸지 않는다. 바꾸면 이전 알림의 소유 증명이 끊긴다.
  if (fs.existsSync(file)) return fs.readFileSync(file, "utf8").trim();
  const key = [...crypto.getRandomValues(new Uint8Array(16))]
    .map((b) => b.toString(16).padStart(2, "0")).join("");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, key);
  // 규약상 <key>.txt 이름이어야 하므로 같은 내용으로 하나 더 둔다
  fs.writeFileSync(path.join(path.dirname(file), `${key}.txt`), key);
  console.log("키 생성:", key, "— 배포 후 https://" + c.domain + "/" + key + ".txt 가 열려야 합니다.");
  return key;
}

/** 사이트맵에서 URL 을 읽는다 — 목록을 따로 관리하면 반드시 어긋난다 */
async function urls(c, given) {
  if (given.length) {
    return given.map((p) => {
      // Git Bash 는 /blog/... 를 C:/Program Files/Git/blog/... 로 바꿔 버린다.
      // 그대로 보내면 두 엔진 다 200 을 주는데 실제로는 없는 주소를 넣게 된다.
      const m = /^[A-Za-z]:[\\/].*?[\\/](blog[\\/].*)$/.exec(p);
      if (m) {
        console.warn(`  (셸이 경로를 바꿨습니다. /${m[1].replace(/\\/g, "/")} 로 고쳐 보냅니다)`);
        p = "/" + m[1].replace(/\\/g, "/");
      } else if (/^[A-Za-z]:[\\/]/.test(p)) {
        throw new Error(`주소가 아니라 파일 경로입니다: ${p}\n  전체 URL 로 주세요: https://${c.domain}/blog/...`);
      }
      return p.startsWith("http") ? p : `https://${c.domain}${p.startsWith("/") ? "" : "/"}${p}`;
    });
  }
  const r = await fetch(`https://${c.domain}/sitemap.xml`);
  if (!r.ok) throw new Error("사이트맵을 못 읽었습니다: " + r.status);
  const xml = await r.text();
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim());
}

// 참여 엔진 아무 곳에나 보내면 서로 공유하지만,
// 네이버는 자체 엔드포인트가 확실하므로 둘 다 보낸다.
const ENDPOINTS = [
  { name: "Bing", url: "https://api.indexnow.org/indexnow" },
  { name: "Naver", url: "https://searchadvisor.naver.com/indexnow" },
];

const clients = await 잠깐DB((q) => 고객고르기(process.argv, q));
const given = process.argv.slice(2).filter((a, i, all) => !a.startsWith("--") && all[i - 1] !== "--client");
if (given.length && clients.length > 1) {
  throw new Error("주소를 직접 줄 때는 --client 로 한 곳을 고르세요.");
}

let failed = 0;
for (const c of clients) {
  console.log(`\n══ ${c.name} · ${c.domain} ══`);
  /**
   * DB 고객(Step 37): 「우리」가 보내고 키가 있을 때만. 키만 넣고 고객이 파일을 안 올리면 빙이 403 을 쌓는다 —
   * 보내기 전에 키 파일 본문이 키와 같은지 그 자리에서 본다. 코드 고객은 아래 예전 길 그대로
   */
  if (c.출처 !== "코드") {
    const mode = c.indexnow?.mode ?? "우리";
    if (!c.domain) { console.log(`  ${c.slug}: domain 없음 — 건너뜀`); continue; }
    if (mode !== "우리") { console.log(`  ${c.slug}: IndexNow 「${mode}」 — 안 보냄`); continue; }
    // 메시지를 "키 설정이 없습니다"로 맞춘다 — 색인결과()가 이 문구로 "키없음"을 "실패"와 구분한다(#1385, 문서딱이 "키 없음"으로만 찍혀 못 걸러짐)
    if (!c.indexnowKey) { console.log(`  ${c.slug}: 키 설정이 없습니다. 건너뜁니다.`); continue; }
    const 확인 = await fetch(`https://${c.domain}/${c.indexnowKey}.txt`, { redirect: "follow" })
      .then(async (r) => ({ ok: r.ok && (await r.text()).trim() === c.indexnowKey, code: r.ok ? "본문 다름" : r.status }))
      .catch((e) => ({ ok: false, code: String(e.message).slice(0, 40) }));
    if (!확인.ok) { console.log(`  ${c.slug}: 키 파일 확인 안 됨(${확인.code}) — 안 보냄`); continue; }
  }
  const key = keyFor(c);
  if (!key) { console.log("  키 설정이 없습니다. 건너뜁니다."); continue; }

  // 키 파일이 실제로 열리는지 먼저 본다
  const live = await fetch(`https://${c.domain}/${key}.txt`).then(async (r) => r.ok && (await r.text()).trim() === key).catch(() => false);
  if (!live) {
    console.log(`  키 파일이 아직 없습니다 — https://${c.domain}/${key}.txt`);
    console.log("  사이트에 키 파일이 올라간 뒤부터 알립니다. (고객사 전달 파일에 들어 있습니다)");
    continue;
  }

  let list;
  try {
    list = await urls(c, given);
  } catch (e) {
    console.log("  " + e.message);
    failed++;
    continue;
  }
  console.log(given.length ? `  지정한 주소 ${list.length}개` : `  사이트맵에서 ${list.length}개 주소`);
  if (process.argv.includes("--list")) {
    list.forEach((x) => console.log("    " + x));
    continue;
  }

  const body = { host: c.domain, key, keyLocation: `https://${c.domain}/${key}.txt`, urlList: list };
  // 네이버는 홈(루트) 주소를 「Invalid urls」 422 로 거절한다. 하위 주소는 받는다(2026-09-22 확인).
  // 홈 하나 때문에 묶음 전체가 실패로 찍혀, 빙은 접수했는데도 에이전트가 사흘 내리 「색인 알림 실패」를 적었다
  const 루트 = (x) => /^https?:\/\/[^/]+\/?$/.test(x);
  for (const ep of ENDPOINTS) {
    const 보낼것 = ep.name === "Naver" ? list.filter((x) => !루트(x)) : list;
    if (!보낼것.length) {
      console.log(`  ${ep.name.padEnd(6)} 건너뜀 · 홈 주소는 받지 않습니다 (서치어드바이저 「웹 페이지 수집」으로 요청)`);
      continue;
    }
    try {
      const r = await fetch(ep.url, {
        method: "POST",
        headers: { "content-type": "application/json; charset=utf-8" },
        body: JSON.stringify({ ...body, urlList: 보낼것 }),
      });
      const txt = await r.text().catch(() => "");
      // 200 = 접수, 202 = 접수했고 키 확인 중, 400/403/422 = 문제
      const ok = r.status === 200 || r.status === 202;
      if (!ok) failed++;
      console.log(`  ${ep.name.padEnd(6)} HTTP ${r.status} ${ok ? "접수됨" : "실패"}${txt ? " · " + txt.slice(0, 120) : ""}`);
    } catch (e) {
      failed++;
      console.log(`  ${ep.name.padEnd(6)} 실패 · ${e.message}`);
    }
  }
}

console.log("\n구글은 IndexNow 에 참여하지 않습니다. Search Console 에서 직접 요청해야 합니다.");
if (failed) process.exitCode = 1;
