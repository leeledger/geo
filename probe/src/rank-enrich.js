/**
 * 검색 상위 문서를 실제로 열어 어떤 브랜드가 들어 있는지 채운다.
 * API 키가 필요 없다 — 페이지를 받아 별칭 매칭만 한다.
 *
 *   node src/rank-enrich.js
 *   node src/rank-enrich.js --force     # 이미 채워진 것도 다시
 *
 * 왜 필요한가: 제목·스니펫만 보면 본문에만 등장하는 브랜드를 놓친다.
 * "남의 리스트 안에 내 이름이 있는가"가 이 실험의 핵심 변수라서,
 * 여기를 추정으로 두면 검색 가시성이 과소집계된다.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readJson, pool, parseArgs } from "./store.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const args = parseArgs(process.argv.slice(2));

const spec = readJson(path.resolve(ROOT, args.prompts || "prompts/erp-kr.json"));
const rankPath = path.resolve(ROOT, args.rankings || "data/rankings.json");
const rankings = readJson(rankPath);

const norm = (s) => s.toLowerCase().replace(/\s+/g, "");
const BRANDS = spec.brand_universe.map((b) => ({
  id: b.id,
  aliases: [b.name, ...(b.aliases ?? [])].map(norm),
}));

function stripHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");
}

// 중복 URL 은 한 번만 받는다 (같은 문서가 여러 쿼리에 걸쳐 나온다)
const all = [];
for (const [query, results] of Object.entries(rankings.queries ?? {}))
  for (const r of results) all.push({ query, r });

const uniqueUrls = [...new Set(all.map(({ r }) => r.url))];
const need = args.force
  ? uniqueUrls
  : uniqueUrls.filter((u) => all.some(({ r }) => r.url === u && !Array.isArray(r.brands_present)));

console.log(`문서 ${uniqueUrls.length}개 중 ${need.length}개를 가져옵니다\n`);

const MIN_TEXT = 1200;              // 이보다 짧으면 본문을 못 받은 것으로 본다
const found = new Map();            // url → brand ids
let failed = 0, thin = 0;

await pool(need, 4, async (url) => {
  try {
    const res = await fetch(url, {
      headers: { "user-agent": "Mozilla/5.0 (compatible; ago-geo-probe/0.1)", "accept-language": "ko-KR,ko;q=0.9" },
      redirect: "follow",
      signal: AbortSignal.timeout(25_000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = norm(stripHtml(await res.text()));

    // JS 로 본문을 그리는 페이지는 껍데기만 온다. 그걸 "브랜드 없음"으로 기록하면
    // 조용히 과소집계된다 — 채우지 말고 미확인으로 남긴다.
    if (text.length < MIN_TEXT) {
      thin++;
      console.warn(`  ~ ${new URL(url).hostname.padEnd(26)} 본문 ${text.length}자 — 미확인으로 남김 (JS 렌더링 추정)`);
      return;
    }

    const ids = BRANDS.filter((b) => b.aliases.some((a) => text.includes(a))).map((b) => b.id);
    found.set(url, ids);
    console.log(`  ✓ ${new URL(url).hostname.padEnd(26)} ${ids.length}개  ${ids.join(", ") || "(없음)"}`);
  } catch (e) {
    failed++;
    console.error(`  ✗ ${new URL(url).hostname.padEnd(26)} ${e.message.slice(0, 80)}`);
  }
});

let filled = 0;
for (const { r } of all) {
  if (found.has(r.url)) { r.brands_present = found.get(r.url); filled++; }
}

rankings.enriched_at = new Date().toISOString();
fs.writeFileSync(rankPath, JSON.stringify(rankings, null, 2), "utf8");
console.log(`\n${filled}개 항목 갱신 · 실패 ${failed}건 → ${path.relative(ROOT, rankPath)}`);
console.log(`다음: node src/analyze.js --search-only`);
