/**
 * 분석 — 이 실험의 결론이 나오는 곳.
 *
 * 답하려는 질문: "AI 답변의 브랜드 언급은 검색 순위로 얼마나 설명되는가?"
 * 설명되지 않는 부분(잔차)이 이 사업의 시장 규모다.
 *
 *   node src/analyze.js --engine anthropic
 *
 * 입력: data/mentions.<engine>.jsonl   (AI 쪽)
 *       data/rankings.json             (검색 쪽, 선택)
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readJsonl, readJson, parseArgs } from "./store.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const args = parseArgs(process.argv.slice(2));
const engineName = args.engine || "anthropic";

const spec = readJson(path.resolve(ROOT, args.prompts || "prompts/erp-kr.json"));
const mentions = await readJsonl(path.resolve(ROOT, args.in || `data/mentions.${engineName}.jsonl`));
const rankingsPath = path.resolve(ROOT, args.rankings || "data/rankings.json");
const rankings = fs.existsSync(rankingsPath) ? readJson(rankingsPath) : null;

// --search-only: 엔진 키가 아직 없을 때 검색 쪽만 먼저 본다.
const searchOnly = Boolean(args["search-only"]);
if (!mentions.length && !searchOnly) {
  console.error("추출 결과가 없습니다. extract-run.js 를 먼저 돌리거나 --search-only 로 실행하세요.");
  process.exit(1);
}

const BRANDS = spec.brand_universe;
const byId = Object.fromEntries(BRANDS.map((b) => [b.id, b]));
const pct = (x) => `${(x * 100).toFixed(1)}%`;
const bar = (v, max, w = 22) => "█".repeat(Math.max(0, Math.round((v / (max || 1)) * w)));

/* ───────────────────────── 1. AI 쪽 지표 ───────────────────────── */

const execs = mentions.length;                      // 총 실행 수
const promptIds = [...new Set(mentions.map((m) => m.prompt_id))];

const ai = {}; // brand_id → 집계
for (const b of BRANDS) ai[b.id] = { id: b.id, name: b.name, hits: 0, mrr: 0, endorsed: 0, dismissed: 0, positions: [] };
const outsiders = new Map();

for (const m of mentions) {
  for (const b of m.brands ?? []) {
    if (!b.brand_id) { outsiders.set(b.name, (outsiders.get(b.name) ?? 0) + 1); continue; }
    const a = ai[b.brand_id];
    if (!a) continue;
    a.hits++;
    a.mrr += 1 / Math.max(1, b.position);
    a.positions.push(b.position);
    if (b.stance === "endorsed") a.endorsed++;
    if (b.stance === "dismissed") a.dismissed++;
  }
}

const totalMentionEvents = Object.values(ai).reduce((s, a) => s + a.hits, 0);
for (const a of Object.values(ai)) {
  a.presence = a.hits / execs;                                  // 노출률
  a.share = totalMentionEvents ? a.hits / totalMentionEvents : 0; // 답변 점유율
  a.rankScore = a.hits ? a.mrr / a.hits : 0;                    // 평균 MRR
  a.avgPos = a.positions.length ? a.positions.reduce((s, p) => s + p, 0) / a.positions.length : null;
  a.endorseRate = a.hits ? a.endorsed / a.hits : 0;
  a.aiVisibility = a.mrr;                                       // 위치 가중 노출량
}

/* ─────────── 2. 재현성 — 같은 질문을 반복하면 같은 답이 나오는가 ─────────── */

const byPrompt = {};
for (const m of mentions) (byPrompt[m.prompt_id] ??= []).push(m);

let jaccardSum = 0, jaccardN = 0;
for (const [, runs] of Object.entries(byPrompt)) {
  if (runs.length < 2) continue;
  const sets = runs.map((r) => new Set((r.brands ?? []).map((b) => b.brand_id ?? b.name)));
  for (let i = 0; i < sets.length; i++)
    for (let j = i + 1; j < sets.length; j++) {
      const inter = [...sets[i]].filter((x) => sets[j].has(x)).length;
      const uni = new Set([...sets[i], ...sets[j]]).size;
      if (uni) { jaccardSum += inter / uni; jaccardN++; }
    }
}
const stability = jaccardN ? jaccardSum / jaccardN : null;

/* ─────────── 3. fan-out — 질문 1개가 검색 쿼리 몇 개로 쪼개지는가 ─────────── */

const fanouts = mentions.map((m) => (m.search_queries ?? []).length).filter((n) => n > 0);
const fanoutAvg = fanouts.length ? fanouts.reduce((a, b) => a + b, 0) / fanouts.length : 0;
const allQueries = mentions.flatMap((m) => m.search_queries ?? []);
const queryFreq = new Map();
for (const q of allQueries) queryFreq.set(q, (queryFreq.get(q) ?? 0) + 1);

/* ─────────── 4. 인용 도메인 ─────────── */

const domFreq = new Map();
for (const m of mentions) for (const d of m.citation_domains ?? []) domFreq.set(d, (domFreq.get(d) ?? 0) + 1);
const ownDomains = new Set(BRANDS.map((b) => b.domain).filter(Boolean));
const citedDomains = [...domFreq.entries()].sort((a, b) => b[1] - a[1]);
const totalCites = citedDomains.reduce((s, [, c]) => s + c, 0);
const ownCiteShare = totalCites
  ? citedDomains.filter(([d]) => ownDomains.has(d)).reduce((s, [, c]) => s + c, 0) / totalCites
  : 0;

/* ─────────── 5. 검색 쪽 지표 + 상관 (핵심) ─────────── */

function spearman(xs, ys) {
  const n = xs.length;
  if (n < 3) return null;
  const rank = (v) => {
    const idx = v.map((val, i) => [val, i]).sort((a, b) => b[0] - a[0]);
    const r = new Array(n);
    let i = 0;
    while (i < n) {
      let j = i;
      while (j + 1 < n && idx[j + 1][0] === idx[i][0]) j++;
      const avg = (i + j) / 2 + 1;
      for (let k = i; k <= j; k++) r[idx[k][1]] = avg;
      i = j + 1;
    }
    return r;
  };
  const rx = rank(xs), ry = rank(ys);
  const mx = rx.reduce((a, b) => a + b, 0) / n, my = ry.reduce((a, b) => a + b, 0) / n;
  let num = 0, dx = 0, dy = 0;
  for (let i = 0; i < n; i++) {
    num += (rx[i] - mx) * (ry[i] - my);
    dx += (rx[i] - mx) ** 2;
    dy += (ry[i] - my) ** 2;
  }
  return dx && dy ? num / Math.sqrt(dx * dy) : null;
}

let searchStats = null;
if (rankings) {
  // 검색 가시성 = Σ (DCG 가중치 × 그 문서에 브랜드가 등장하는가)
  // 자사 도메인이 랭크된 경우와, 남의 문서(리스티클) 안에 이름이 있는 경우를 모두 센다.
  // 후자가 GEO 의 핵심 레버라서 분리해 기록한다.
  const s = {};
  for (const b of BRANDS) s[b.id] = { id: b.id, name: b.name, own: 0, thirdParty: 0, bestOwnRank: null, inTop10: false, inTop20: false, confirmedPages: 0, inferredPages: 0 };

  const aliasesOf = (b) => [b.name, ...(b.aliases ?? [])].map((a) => a.toLowerCase().replace(/\s+/g, ""));

  for (const [, results] of Object.entries(rankings.queries ?? {})) {
    for (const r of results) {
      const w = 1 / Math.log2(r.rank + 1);
      const hay = `${r.title ?? ""} ${r.snippet ?? ""} ${r.text ?? ""}`.toLowerCase().replace(/\s+/g, "");
      // 페이지를 실제로 열어 확인한 목록이 있으면 그걸 쓴다.
      // 없으면 제목/스니펫 매칭으로 대체하는데, 이건 본문에만 있는 브랜드를 놓친다 (과소집계).
      const confirmed = Array.isArray(r.brands_present);
      for (const b of BRANDS) {
        const isOwn = b.domain && r.domain && r.domain.endsWith(b.domain);
        const named = confirmed
          ? r.brands_present.includes(b.id)
          : aliasesOf(b).some((a) => hay.includes(a));
        if (named) { if (confirmed) s[b.id].confirmedPages++; else s[b.id].inferredPages++; }
        if (isOwn) {
          s[b.id].own += w;
          if (s[b.id].bestOwnRank === null || r.rank < s[b.id].bestOwnRank) s[b.id].bestOwnRank = r.rank;
        } else if (named) {
          s[b.id].thirdParty += w;
        }
        if (isOwn || named) {
          if (r.rank <= 10) s[b.id].inTop10 = true;
          if (r.rank <= 20) s[b.id].inTop20 = true;
        }
      }
    }
  }
  for (const v of Object.values(s)) v.searchVisibility = v.own + v.thirdParty;
  searchStats = s;
}

let corr = null, residual = null, coverage = null, inversion = null;
if (searchStats) {
  const ids = BRANDS.map((b) => b.id);
  const xs = ids.map((id) => ai[id].aiVisibility);
  const ys = ids.map((id) => searchStats[id].searchVisibility);
  const rho = spearman(xs, ys);
  corr = rho;
  residual = rho === null ? null : 1 - rho * rho;

  // 검색 상위에 아예 없는 브랜드가 AI 답변에서 차지한 비중
  const notTop10 = Object.values(ai).filter((a) => !searchStats[a.id].inTop10).reduce((s, a) => s + a.hits, 0);
  const notTop20 = Object.values(ai).filter((a) => !searchStats[a.id].inTop20).reduce((s, a) => s + a.hits, 0);
  coverage = { notInTop10: totalMentionEvents ? notTop10 / totalMentionEvents : 0,
               notInTop20: totalMentionEvents ? notTop20 / totalMentionEvents : 0 };

  // 순위 역전 — AI 가 1순위로 부르는 브랜드가 검색 1위 브랜드와 다른가
  const aiTop = [...Object.values(ai)].sort((a, b) => b.aiVisibility - a.aiVisibility)[0];
  const seTop = [...Object.values(searchStats)].sort((a, b) => b.searchVisibility - a.searchVisibility)[0];
  inversion = { ai: aiTop?.name, search: seTop?.name, inverted: aiTop?.id !== seTop?.id };
}

/* ───────────────────────── 리포트 ───────────────────────── */

const L = [];
const say = (s = "") => { L.push(s); console.log(s); };

say(`\n${"═".repeat(64)}`);
say(`  ${spec.label} · ${engineName}`);
say(`  실행 ${execs}회 · 프롬프트 ${promptIds.length}개 · 언급 이벤트 ${totalMentionEvents}건`);
say(`${"═".repeat(64)}\n`);

const ranked = Object.values(ai).filter((a) => a.hits).sort((a, b) => b.aiVisibility - a.aiVisibility);
const maxVis = ranked[0]?.aiVisibility ?? 1;
const zero = Object.values(ai).filter((a) => !a.hits);

if (!searchOnly) {
say("── 브랜드별 AI 노출 ".padEnd(64, "─"));
say(`${"브랜드".padEnd(20)} ${"노출률".padStart(7)} ${"점유율".padStart(7)} ${"평균위치".padStart(8)} ${"추천률".padStart(7)}`);
for (const a of ranked) {
  say(`${a.name.padEnd(20)} ${pct(a.presence).padStart(7)} ${pct(a.share).padStart(7)} ${(a.avgPos?.toFixed(1) ?? "-").padStart(8)} ${pct(a.endorseRate).padStart(7)}  ${bar(a.aiVisibility, maxVis)}`);
}
if (zero.length) say(`\n한 번도 언급되지 않음: ${zero.map((z) => z.name).join(", ")}`);
if (outsiders.size) {
  say(`\n유니버스 밖 브랜드 상위:`);
  [...outsiders.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).forEach(([n, c]) => say(`   ${String(c).padStart(3)}회  ${n}`));
}

say(`\n── 답변 재현성 `.padEnd(64, "─"));
say(stability === null
  ? "  반복 실행이 없어 측정 불가 (--repeats 2 이상 필요)"
  : `  반복 간 브랜드 집합 일치도(Jaccard)  ${pct(stability)}`);
say(stability !== null && stability < 0.7
  ? "  → 같은 질문도 답이 크게 흔들린다. 1회 조회 결과를 '순위'라 부르는 도구는 소음을 파는 것."
  : "  → 비교적 안정적. 그래도 신뢰구간은 함께 보고해야 한다.");

say(`\n── 쿼리 분해(fan-out) `.padEnd(64, "─"));
if (!queryFreq.size) {
  say(`  측정 불가 — 웹 UI 수동 수집에서는 엔진 내부 검색 쿼리를 볼 수 없다.`);
  say(`  (API 수집으로 전환하면 이 항목이 채워진다)`);
} else {
say(`  실행당 평균 검색 쿼리  ${fanoutAvg.toFixed(1)}개`);
{
  say(`  실제로 던져진 쿼리 상위:`);
  [...queryFreq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10)
    .forEach(([q, c]) => say(`     ${String(c).padStart(3)}회  ${q}`));
  say(`  → 사용자 질문 1개가 서로 다른 쿼리 ${queryFreq.size}종으로 확장됐다.`);
  say(`     head 키워드 1위보다 분해된 쿼리 전반의 커버리지가 중요하다는 직접 증거.`);
}
}

say(`\n── 인용 도메인 `.padEnd(64, "─"));
if (!totalCites) say("  인용 정보 없음");
else {
  const maxC = citedDomains[0][1];
  citedDomains.slice(0, 12).forEach(([d, c]) =>
    say(`  ${d.padEnd(28)} ${String(c).padStart(4)}  ${bar(c, maxC, 16)}${ownDomains.has(d) ? "  ← 자사군" : ""}`));
  say(`\n  자사 도메인 인용 비중  ${pct(ownCiteShare)}`);
  say(`  → 나머지 ${pct(1 - ownCiteShare)}는 제3자 문서. 여기가 실제 최적화 대상이다.`);
}
} /* !searchOnly */

/* ── 검색 쪽 단독 리포트 — 엔진 키가 없어도 여기까지는 볼 수 있다 ── */
if (searchStats) {
  const queries = Object.entries(rankings.queries ?? {});
  const allResults = queries.flatMap(([, rs]) => rs);
  const kindCount = new Map();
  for (const r of allResults) kindCount.set(r.kind ?? "unknown", (kindCount.get(r.kind ?? "unknown") ?? 0) + 1);
  // 브랜드가 소유·통제하는 지면인가 아닌가로 가른다.
  const OWNED = new Set(["own", "own_blog", "agency_owned", "competitor_blog"]);
  const thirdPartyShare = allResults.length
    ? allResults.filter((r) => !OWNED.has(r.kind ?? "")).length / allResults.length
    : 0;
  const impersonating = allResults.filter((r) => (r.kind ?? "") === "impersonating_authority").length;

  say(`\n── 검색 상위 문서의 성격 `.padEnd(64, "─"));
  say(`  쿼리 ${queries.length}개 · 상위 문서 ${allResults.length}건`);
  for (const [k, c] of [...kindCount.entries()].sort((a, b) => b[1] - a[1])) {
    say(`  ${k.padEnd(18)} ${String(c).padStart(3)}건  ${bar(c, allResults.length, 18)}`);
  }
  say(`
  업체가 소유·통제하지 않는 지면의 비중  ${pct(thirdPartyShare)}`);
  say(thirdPartyShare > 0.5
    ? `  → 상위를 제3자 문서가 점유한다. 최적화 대상은 내 페이지 순위가 아니라 남의 리스트 안의 내 이름이다.`
    : `  → 상위 대부분이 업체가 스스로 만든 지면이다. 이 카테고리의 "추천 순위"는 사실상 자가 발행물이다.`);
  if (impersonating) {
    say(`
  ⚠ 실재 기관과 혼동되는 도메인의 문서  ${impersonating}건`);
    say(`     rankings json 의 notes 를 확인할 것. 운영 주체는 확인되지 않았다.`);
  }

  // 도메인별 등장 빈도 = 인용 소스 점령 우선순위
  const dom = new Map();
  for (const r of allResults) dom.set(r.domain, (dom.get(r.domain) ?? 0) + 1 / Math.log2(r.rank + 1));
  say(`\n── 진입 우선순위 (검색 노출 가중치 상위) `.padEnd(64, "─"));
  const domRanked = [...dom.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
  const maxD = domRanked[0]?.[1] ?? 1;
  for (const [d, w] of domRanked) say(`  ${d.padEnd(28)} ${w.toFixed(2).padStart(5)}  ${bar(w, maxD, 16)}`);

  say(`\n── 검색 가시성 (브랜드별) `.padEnd(64, "─"));
  say(`${"브랜드".padEnd(20)} ${"자사".padStart(6)} ${"제3자".padStart(6)} ${"합계".padStart(6)}  ${"근거"}`);
  const sRanked = Object.values(searchStats).sort((a, b) => b.searchVisibility - a.searchVisibility);
  for (const v of sRanked) {
    if (!v.searchVisibility) continue;
    const basis = v.confirmedPages ? `확인 ${v.confirmedPages}p` : `추정 ${v.inferredPages}p`;
    say(`${v.name.padEnd(20)} ${v.own.toFixed(2).padStart(6)} ${v.thirdParty.toFixed(2).padStart(6)} ${v.searchVisibility.toFixed(2).padStart(6)}  ${basis}`);
  }
  const noOwn = sRanked.filter((v) => v.searchVisibility && !v.own);
  if (noOwn.length) {
    say(`\n  자사 도메인은 상위에 없는데 제3자 문서로만 노출되는 브랜드:`);
    say(`     ${noOwn.map((v) => v.name).join(", ")}`);
    say(`  → 자사 SEO 순위와 AI 노출이 분리된다는 직접 증거.`);
  }
}

if (searchOnly) {
  say(`\n${"━".repeat(64)}`);
  say("  AI 쪽 데이터가 없어 상관은 계산하지 못했습니다.");
  say("  ANTHROPIC_API_KEY 를 설정하고 run.js → extract-run.js 를 돌린 뒤");
  say("  --search-only 없이 다시 실행하면 잔차가 나옵니다.");
  say(`${"━".repeat(64)}\n`);
  fs.writeFileSync(path.resolve(ROOT, `data/report.search-only.txt`), L.join("\n"), "utf8");
  process.exit(0);
}

say(`\n${"━".repeat(64)}`);
say("  핵심 질문 — AI 언급은 검색 순위로 설명되는가");
say(`${"━".repeat(64)}`);
if (!searchStats) {
  say("  data/rankings.json 이 없어 상관을 계산하지 못했습니다.");
  say("  검색 순위 데이터를 수집한 뒤 다시 실행하세요.");
} else {
  say(`  Spearman 상관 ρ        ${corr === null ? "계산 불가" : corr.toFixed(3)}`);
  say(`  설명되는 분산 ρ²       ${corr === null ? "-" : pct(corr * corr)}`);
  say(`  설명되지 않는 잔차     ${residual === null ? "-" : pct(residual)}   ← 이 사업의 시장`);
  say("");
  say(`  검색 top-10 밖 브랜드가 차지한 AI 언급  ${pct(coverage.notInTop10)}`);
  say(`  검색 top-20 밖 브랜드가 차지한 AI 언급  ${pct(coverage.notInTop20)}`);
  say("");
  say(`  AI 1순위     ${inversion.ai}`);
  say(`  검색 1순위   ${inversion.search}`);
  say(`  순위 역전    ${inversion.inverted ? "있음 — 검색 승자와 AI 승자가 다르다" : "없음"}`);
  say("");
  const r = residual ?? 0;
  say(r < 0.10
    ? "  판정: 검색 순위가 거의 전부를 설명한다. 별도 GEO 상품의 근거가 약하다."
    : r < 0.30
    ? "  판정: 상당 부분이 검색으로 설명된다. GEO 는 SEO 위에 얹는 층으로만 성립한다."
    : "  판정: 검색으로 설명되지 않는 영역이 크다. 독립 상품으로 성립할 여지가 있다.");
  say("  주의: 표본이 작으면 ρ 는 크게 흔들린다. 프롬프트 50개·반복 3회 이상에서 읽을 것.");
}
say("");

const report = {
  generated_at: new Date().toISOString(),
  vertical: spec.vertical, engine: engineName,
  executions: execs, prompts: promptIds.length, mention_events: totalMentionEvents,
  brands: ranked, zero_mention: zero.map((z) => z.id),
  outsiders: [...outsiders.entries()].sort((a, b) => b[1] - a[1]),
  stability, fanout_avg: fanoutAvg, unique_queries: queryFreq.size,
  cited_domains: citedDomains, own_citation_share: ownCiteShare,
  search: searchStats, spearman: corr, residual, coverage, inversion,
};
const out = path.resolve(ROOT, `data/report.${engineName}.json`);
fs.writeFileSync(out, JSON.stringify(report, null, 2), "utf8");
fs.writeFileSync(path.resolve(ROOT, `data/report.${engineName}.txt`), L.join("\n"), "utf8");
console.log(`리포트 저장: ${path.relative(ROOT, out)}\n`);
