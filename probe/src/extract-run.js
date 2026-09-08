/**
 * 추출 패스 — 수집한 답변 원문에서 브랜드 언급을 구조화한다.
 * 엔진을 다시 호출하지 않으므로 스키마를 바꿔가며 몇 번이든 재실행할 수 있다.
 *
 *   node src/extract-run.js --engine anthropic
 *   node src/extract-run.js --engine anthropic --force   # 전부 다시 추출
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { extractMentions, buildResolver } from "./extract.js";
import { appendJsonl, readJsonl, readJson, pool, withRetry, parseArgs } from "./store.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");

const args = parseArgs(process.argv.slice(2));
const engineName = args.engine || "anthropic";
const promptFile = path.resolve(ROOT, args.prompts || "prompts/erp-kr.json");
const spec = readJson(promptFile);

/**
 * 파일 이름에 프롬프트 세트를 넣는다. 엔진 이름만 쓰면 버티컬이 달라도
 * 같은 파일에 쌓여서 인용률이 엉킨다. run.js 와 같은 규칙을 쓴다.
 */
const setName = path.basename(promptFile, ".json");

/** 이름 규칙을 바꾸기 전에 돌린 파일이 남아 있다. 새 이름이 없으면 옛 이름을 쓴다. */
function pick(kind) {
  const now = path.resolve(ROOT, `data/${kind}.${setName}.${engineName}.jsonl`);
  const was = path.resolve(ROOT, `data/${kind}.${engineName}.jsonl`);
  if (!fs.existsSync(now) && fs.existsSync(was)) {
    console.error(`  (옛 이름 파일을 씁니다: ${path.relative(ROOT, was)})`);
    return was;
  }
  return now;
}

const inFile = args.in ? path.resolve(ROOT, args.in) : pick("responses");
const outFile = args.out
  ? path.resolve(ROOT, args.out)
  : path.resolve(ROOT, `data/mentions.${setName}.${engineName}.jsonl`);
const concurrency = Number(args.concurrency ?? 4);

const resolve = buildResolver(spec.brand_universe);
const responses = (await readJsonl(inFile)).filter((r) => r.ok);
if (!responses.length) {
  console.error(`${path.relative(ROOT, inFile)} 에 성공 응답이 없습니다. 먼저 run.js 를 돌리세요.`);
  process.exit(1);
}

const done = args.force
  ? new Set()
  : new Set((await readJsonl(outFile)).map((r) => `${r.prompt_id}|${r.engine}|${r.attempt}`));
const todo = responses.filter((r) => !done.has(`${r.prompt_id}|${r.engine}|${r.attempt}`));

console.log(`응답 ${responses.length}건 · 추출 대상 ${todo.length}건 (모델 ${process.env.EXTRACT_MODEL || "claude-opus-5"})\n`);

let failed = 0, unknownBrands = new Map();

await pool(todo, concurrency, async (r) => {
  const label = `${r.prompt_id}#${r.attempt}`;
  try {
    const ex = await withRetry(() => extractMentions(r.text), { label });
    if (ex._extract_status === "FAILED") failed++;

    const brands = (ex.brands ?? []).map((b) => {
      const id = resolve(b.name);
      if (!id) unknownBrands.set(b.name, (unknownBrands.get(b.name) ?? 0) + 1);
      return { ...b, brand_id: id };
    });

    appendJsonl(outFile, {
      prompt_id: r.prompt_id,
      stage: r.stage,
      engine: r.engine,
      attempt: r.attempt,
      answer_kind: ex.answer_kind,
      brands,
      citation_domains: [...new Set((r.citations ?? []).map((c) => c.domain).filter(Boolean))],
      search_queries: r.search_queries ?? [],
      extract_status: ex._extract_status,
    });
    console.log(`  ✓ ${label}  ${brands.length}개 브랜드 (${brands.map((b) => b.brand_id ?? "?" + b.name).join(", ") || "없음"})`);
  } catch (e) {
    failed++;
    console.error(`  ✗ ${label}  ${e.message.slice(0, 160)}`);
  }
});

console.log(`\n추출 완료 · 실패 ${failed}건`);
if (unknownBrands.size) {
  console.log(`\n유니버스 밖 브랜드 (prompts json 의 brand_universe 에 추가할지 검토):`);
  [...unknownBrands.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20)
    .forEach(([n, c]) => console.log(`   ${String(c).padStart(3)}회  ${n}`));
}
console.log(`\n다음: node src/analyze.js --engine ${engineName}`);
