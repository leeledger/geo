/**
 * 통합 진단 — 사이트 점수 + AI 노출 실측 + 제3자 지면 격차를 한 장으로 합친다.
 *
 *   node src/diagnose.js iquest --engine websearch
 *   node src/diagnose.js douzone --engine websearch --html
 *
 * 이 도구의 존재 이유:
 * 사이트 점수와 AI 노출률의 상관은 우리 실측에서 -0.009 였다. 즉 사이트만 고쳐도 노출은 안 온다.
 * 진단이 상품이 되려면 "사이트가 문제인가, 남의 문서가 문제인가"를 갈라줘야 한다.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readJsonl, readJson, parseArgs } from "./store.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const args = parseArgs(process.argv.slice(2));
const brandId = args._[0];
if (!brandId) {
  console.error("사용법: node src/diagnose.js <brand_id> [--engine websearch] [--html]");
  process.exit(1);
}
const engine = args.engine || "websearch";
const spec = readJson(path.resolve(ROOT, args.prompts || "prompts/erp-kr.json"));
const brand = spec.brand_universe.find((b) => b.id === brandId);
if (!brand) {
  console.error(`brand_universe 에 '${brandId}' 가 없습니다. 가능: ${spec.brand_universe.map((b) => b.id).join(", ")}`);
  process.exit(1);
}

/* ── 1. 사이트 점수 ── */
let site = null;
if (brand.domain) {
  const f = path.resolve(ROOT, `data/scans/${brand.domain}.json`);
  if (fs.existsSync(f)) site = readJson(f);
  else console.error(`⚠ 사이트 스캔 없음. 먼저: node src/scan.js ${brand.domain}`);
}

/* ── 2. AI 노출 실측 ── */
const mentions = await readJsonl(path.resolve(ROOT, `data/mentions.${engine}.jsonl`));
const execs = mentions.length;
const all = {};
for (const b of spec.brand_universe) all[b.id] = { id: b.id, name: b.name, hits: 0, mrr: 0, pos: [] };
let totalEvents = 0;
for (const m of mentions) {
  for (const x of m.brands ?? []) {
    if (!x.brand_id || !all[x.brand_id]) continue;
    all[x.brand_id].hits++;
    all[x.brand_id].mrr += 1 / Math.max(1, x.position);
    all[x.brand_id].pos.push(x.position);
    totalEvents++;
  }
}
for (const a of Object.values(all)) {
  a.presence = execs ? a.hits / execs : 0;
  a.share = totalEvents ? a.hits / totalEvents : 0;
  a.avgPos = a.pos.length ? a.pos.reduce((s, p) => s + p, 0) / a.pos.length : null;
}
const me = all[brandId];
const leaderboard = Object.values(all).filter((a) => a.hits).sort((a, b) => b.presence - a.presence);
const myRank = leaderboard.findIndex((a) => a.id === brandId) + 1;

/* ── 3. 제3자 지면 격차 ── */
const rankPath = path.resolve(ROOT, args.rankings || "data/rankings.json");
let third = null;
if (fs.existsSync(rankPath)) {
  const rk = readJson(rankPath);
  const allDocs = Object.values(rk.queries ?? {}).flat();
  const OWNED = new Set(["own", "own_blog", "agency_owned", "competitor_blog"]);
  // 브랜드가 소유하지 않은 지면만. 여기 이름이 있느냐가 실제 레버.
  const docs = allDocs.filter((d) => !OWNED.has(d.kind ?? "") && Array.isArray(d.brands_present));
  const seen = new Map();
  for (const d of docs) if (!seen.has(d.url)) seen.set(d.url, d);
  const uniq = [...seen.values()];

  const count = (id) => uniq.filter((d) => d.brands_present.includes(id)).length;
  const mine = count(brandId);
  const rows = spec.brand_universe
    .map((b) => ({ id: b.id, name: b.name, docs: count(b.id) }))
    .filter((r) => r.docs > 0)
    .sort((a, b) => b.docs - a.docs);
  const missing = uniq
    .filter((d) => !d.brands_present.includes(brandId) && d.brands_present.length > 0)
    .map((d) => ({ url: d.url, domain: d.domain, title: d.title, has: d.brands_present }))
    .sort((a, b) => b.has.length - a.has.length);

  third = { totalDocs: uniq.length, mine, coverage: uniq.length ? mine / uniq.length : 0, rows, missing };
}

/* ── 4. 판정 — 2×2 ── */
const siteScore = site?.total ?? null;
const aiPct = me ? me.presence * 100 : 0;
const SITE_OK = 60, AI_OK = 35;
let verdict, reason, focus;
if (siteScore === null) {
  verdict = "판정 불가"; reason = "사이트 스캔 결과가 없습니다"; focus = "site";
} else if (siteScore >= SITE_OK && aiPct >= AI_OK) {
  verdict = "양호 — 확장 단계";
  reason = "사이트도 준비돼 있고 AI 답변에도 등장합니다. 커버리지를 넓히는 단계입니다.";
  focus = "expand";
} else if (siteScore >= SITE_OK && aiPct < AI_OK) {
  verdict = "사이트는 됐는데 안 불립니다";
  reason = "사이트는 AI가 읽을 준비가 돼 있습니다. 문제는 남의 문서에 이름이 없다는 것이고, 이건 사이트를 더 고쳐도 해결되지 않습니다.";
  focus = "third_party";
} else if (siteScore < SITE_OK && aiPct >= AI_OK) {
  verdict = "제3자가 받쳐주는 중 — 기회";
  reason = "사이트는 미흡한데 이미 AI 답변에 등장합니다. 남의 문서가 대신 일하고 있다는 뜻이고, 사이트를 고치면 더 오를 여지가 큽니다.";
  focus = "site";
} else {
  verdict = "양쪽 다 미흡";
  reason = "사이트가 AI에게 읽히지 않고, 남의 문서에도 이름이 없습니다. 사이트 기초부터 잡아야 합니다.";
  focus = "site";
}

/* ── 5. 액션 ── */
const actions = [];
if (focus === "site" || siteScore < SITE_OK) {
  for (const n of (site?.notes ?? []).slice(0, 3)) actions.push({ kind: "사이트", pri: n.pri, msg: n.msg });
}
if (third && third.coverage < 0.6) {
  const top = third.missing.slice(0, 3);
  for (const d of top) {
    const who = d.has.map((h) => spec.brand_universe.find((b) => b.id === h)?.name ?? h).slice(0, 3).join(", ");
    actions.push({
      kind: "제3자 지면", pri: 1,
      msg: `${d.domain} — "${(d.title ?? "").slice(0, 40)}" 에 ${who} 는 있고 ${brand.name} 는 없습니다. 이 문서 진입이 최우선입니다.`,
    });
  }
}
if (me && me.avgPos && me.avgPos > 2.5) {
  actions.push({ kind: "서열", pri: 2, msg: `언급은 되지만 평균 ${me.avgPos.toFixed(1)}번째입니다. 첫 번째로 불리려면 비교 문서에서의 배치를 바꿔야 합니다.` });
}
actions.sort((a, b) => a.pri - b.pri);

/* ── 출력 ── */
const report = {
  brand: { id: brandId, name: brand.name, domain: brand.domain },
  generated_at: new Date().toISOString(),
  vertical: spec.label,
  engine, executions: execs, prompts: new Set(mentions.map((m) => m.prompt_id)).size,
  site: site ? { total: site.total, grade: site.grade, checks: Object.fromEntries(Object.entries(site.checks).map(([k, v]) => [k, v.score])) } : null,
  ai: me ? { presence: +(me.presence * 100).toFixed(1), share: +(me.share * 100).toFixed(1), avgPos: me.avgPos ? +me.avgPos.toFixed(1) : null, rank: myRank || null, competitors: leaderboard.length } : null,
  leaderboard: leaderboard.map((a) => ({ name: a.name, presence: +(a.presence * 100).toFixed(1), avgPos: a.avgPos ? +a.avgPos.toFixed(1) : null, isMe: a.id === brandId })),
  thirdParty: third ? { totalDocs: third.totalDocs, mine: third.mine, coverage: +(third.coverage * 100).toFixed(1), rows: third.rows, missing: third.missing.slice(0, 6) } : null,
  verdict, reason, focus, actions,
};

const outDir = path.resolve(ROOT, "data/diagnoses");
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, `${brandId}.json`), JSON.stringify(report, null, 2), "utf8");

const pct = (n) => `${n}%`;
console.log(`\n${"═".repeat(60)}`);
console.log(`  ${brand.name} · AI 노출 진단`);
console.log(`${"═".repeat(60)}\n`);
console.log(`  사이트 GEO 점수    ${siteScore ?? "—"}${site ? ` / 100  (${site.grade})` : ""}`);
console.log(`  AI 노출률          ${pct(report.ai?.presence ?? 0)}  ·  ${myRank || "-"}위 / ${leaderboard.length}개 브랜드`);
console.log(`  답변 내 평균 위치   ${report.ai?.avgPos ?? "—"}`);
if (third) console.log(`  제3자 문서 등장     ${third.mine} / ${third.totalDocs}건  (${pct(+(third.coverage * 100).toFixed(1))})`);
console.log(`\n  판정 ▸ ${verdict}`);
console.log(`  ${reason}\n`);
console.log(`${"─".repeat(60)}`);
console.log(`  경쟁 지형`);
for (const b of report.leaderboard) {
  const bar = "█".repeat(Math.round(b.presence / 4)).padEnd(16, "·");
  console.log(`  ${(b.isMe ? "▶ " : "  ") + b.name.padEnd(16)} ${String(b.presence).padStart(5)}%  ${bar}`);
}
console.log(`\n${"─".repeat(60)}`);
console.log(`  먼저 할 것`);
actions.slice(0, 5).forEach((a, i) => console.log(`  ${i + 1}. [${a.kind}] ${a.msg}`));
console.log(`\n저장: data/diagnoses/${brandId}.json\n`);
