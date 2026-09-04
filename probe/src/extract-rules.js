/**
 * 규칙 기반 추출 — API 키 없이 답변 원문에서 브랜드 언급을 뽑는다.
 *
 *   node src/extract-rules.js --engine chatgpt
 *
 * LLM 추출(extract-run.js)과 같은 형식의 mentions.<engine>.jsonl 을 만들므로
 * analyze.js 는 어느 쪽으로 만들었든 그대로 읽는다.
 *
 * 신뢰도가 지표마다 다르다. 정직하게 구분해서 쓸 것:
 *
 *   노출 여부 · 등장 위치 · 등장 순서   →  문자열 매칭. LLM 과 사실상 동일하게 정확하다.
 *   추천 강도(stance)                  →  주변 어휘 휴리스틱. 참고용. 계약 지표로 쓰지 말 것.
 *   속성 연상(attributes)              →  하지 않는다. 규칙으로는 신뢰할 수 없다.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { appendJsonl, readJsonl, readJson, parseArgs } from "./store.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const args = parseArgs(process.argv.slice(2));
const engineName = args.engine || "chatgpt";

const spec = readJson(path.resolve(ROOT, args.prompts || "prompts/erp-kr.json"));
const inFile = path.resolve(ROOT, args.in || `data/responses.${engineName}.jsonl`);
const outFile = path.resolve(ROOT, args.out || `data/mentions.${engineName}.jsonl`);

const norm = (s) => (s ?? "").toLowerCase().replace(/\s+/g, "");

// 긴 별칭이 먼저 잡혀야 한다. "더존"이 "더존비즈온"보다 먼저 매칭되면 안 되는 건 아니지만
// (같은 브랜드라 결과는 같다), 브랜드 간 포함 관계가 있을 때 짧은 쪽이 긴 쪽을 가로챈다.
const BRANDS = spec.brand_universe.map((b) => ({
  id: b.id,
  name: b.name,
  aliases: [b.name, ...(b.aliases ?? [])].map(norm).sort((x, y) => y.length - x.length),
}));

/* stance 휴리스틱 — 브랜드명 주변 ±60자의 어휘를 본다 */
const POS = ["추천", "권장", "권합", "가장적합", "최적", "베스트", "1순위", "첫번째로", "가장많이", "유리", "적합합", "좋습니", "낫습니", "우수"];
const NEG = ["대신", "보다는", "적합하지않", "권하지않", "부족", "아쉬", "단점", "한계", "부담", "비싸", "과하", "필요없", "어렵습니", "맞지않"];

function stanceNear(hay, at, len) {
  const win = hay.slice(Math.max(0, at - 60), Math.min(hay.length, at + len + 60));
  const neg = NEG.some((w) => win.includes(w));
  const pos = POS.some((w) => win.includes(w));
  if (neg && !pos) return "dismissed";
  if (pos && !neg) return "endorsed";
  return "listed";
}

function extractRules(answerText) {
  const hay = norm(answerText);
  if (!hay) return { answer_kind: "refuses_or_deflects", brands: [] };

  const hits = [];
  for (const b of BRANDS) {
    let best = -1, bestLen = 0;
    for (const a of b.aliases) {
      const i = hay.indexOf(a);
      if (i !== -1 && (best === -1 || i < best)) { best = i; bestLen = a.length; }
    }
    if (best !== -1) hits.push({ brand_id: b.id, name: b.name, at: best, len: bestLen });
  }

  hits.sort((x, y) => x.at - y.at);
  const brands = hits.map((h, i) => ({
    name: h.name,
    brand_id: h.brand_id,
    position: i + 1,
    stance: stanceNear(hay, h.at, h.len),
    stance_confidence: "heuristic", // LLM 추출과 구분하기 위한 표식
    attributes: [],
  }));

  return {
    answer_kind: brands.length ? "recommends_brands" : "explains_only",
    brands,
  };
}

/* ─────────────────────────── 실행 ─────────────────────────── */

const responses = (await readJsonl(inFile)).filter((r) => r.ok !== false);
if (!responses.length) {
  console.error(`${path.relative(ROOT, inFile)} 에 응답이 없습니다.`);
  console.error(`먼저 수집 결과를 가져오세요:  node src/manual-import.js --engine ${engineName} --file data/manual.${engineName}.json`);
  process.exit(1);
}

const done = args.force
  ? new Set()
  : new Set((await readJsonl(outFile)).map((r) => `${r.prompt_id}|${r.engine}|${r.attempt}`));

let n = 0, empty = 0;
for (const r of responses) {
  const key = `${r.prompt_id}|${r.engine}|${r.attempt}`;
  if (done.has(key)) continue;

  const ex = extractRules(r.text);
  if (!ex.brands.length) empty++;

  appendJsonl(outFile, {
    prompt_id: r.prompt_id,
    stage: r.stage,
    engine: r.engine,
    attempt: r.attempt,
    answer_kind: ex.answer_kind,
    brands: ex.brands,
    citation_domains: [...new Set((r.citations ?? []).map((c) => c.domain).filter(Boolean))],
    search_queries: r.search_queries ?? [],
    extract_status: "rules",
  });
  n++;
  console.log(`  ✓ ${r.prompt_id}#${r.attempt}  ${ex.brands.map((b) => b.brand_id).join(", ") || "브랜드 없음"}`);
}

console.log(`\n규칙 추출 ${n}건 완료 · 브랜드가 하나도 없는 답변 ${empty}건`);
if (empty / Math.max(1, n) > 0.4) {
  console.warn(`⚠ 브랜드 미검출 비율이 높습니다 (${((empty / n) * 100).toFixed(0)}%).`);
  console.warn(`  별칭 사전이 부실하거나 답변이 일반론뿐일 수 있습니다.`);
  console.warn(`  답변 원문 몇 개를 직접 읽고 prompts json 의 aliases 를 보강하세요.`);
}
console.log(`\n다음: node src/analyze.js --engine ${engineName}`);
