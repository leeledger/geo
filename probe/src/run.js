/**
 * 수집기 — 프롬프트 × 엔진 × 반복 을 실행하고 원문 응답을 그대로 적재한다.
 *
 *   node src/run.js --engine anthropic --repeats 3
 *   node src/run.js --engine anthropic --limit 2 --repeats 1   # 스모크 테스트
 *   node src/run.js --engine anthropic --stage discovery
 *   node src/run.js --dry-run                                   # 호출 수·예상 비용만
 *
 * 이미 수집한 (prompt, engine, attempt) 조합은 건너뛴다. 중간에 죽어도 다시 돌리면 이어서 간다.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ENGINES, VERIFIED } from "./engines.js";
import { appendJsonl, readJsonl, readJson, pool, withRetry, parseArgs } from "./store.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");

const args = parseArgs(process.argv.slice(2));
const promptFile = path.resolve(ROOT, args.prompts || "prompts/erp-kr.json");
const engineName = args.engine || "anthropic";
const repeats = Number(args.repeats ?? 3);
const concurrency = Number(args.concurrency ?? 4);
/**
 * 출력 파일에 프롬프트 세트 이름을 넣는다.
 *
 * 엔진 이름만 쓰면 버티컬이 달라도 같은 파일에 쌓인다. ERP 측정과 학원 측정이
 * 한 파일에 섞이면 인용률이 엉킨다. 이어받기 판정도 이 파일을 보고 하므로
 * 섞인 채로 두면 조용히 틀린다.
 */
const setName = path.basename(promptFile, ".json");
const outFile = path.resolve(ROOT, args.out || `data/responses.${setName}.${engineName}.jsonl`);

const spec = readJson(promptFile);
let prompts = spec.prompts;
if (args.stage) prompts = prompts.filter((p) => p.stage === args.stage);
if (args.limit) prompts = prompts.slice(0, Number(args.limit));

const engineFn = ENGINES[engineName];
if (!engineFn) {
  console.error(`알 수 없는 엔진: ${engineName}. 가능: ${Object.keys(ENGINES).join(", ")}`);
  process.exit(1);
}

// 응답 700토큰 · 추출 포함 블렌디드 단가. 설계서 7장과 같은 가정.
const USD_PER_CALL = 0.01;
const tasks = [];
for (const p of prompts) {
  for (let attempt = 1; attempt <= repeats; attempt++) {
    tasks.push({ prompt: p, attempt });
  }
}

console.log(`버티컬   ${spec.label}`);
console.log(`엔진     ${engineName}${VERIFIED.has(engineName) ? "" : "  ⚠ 미검증 어댑터 — 첫 1건으로 응답 구조를 먼저 확인할 것"}`);
console.log(`프롬프트 ${prompts.length}개 × 반복 ${repeats}회 = ${tasks.length} 호출`);
console.log(`예상비용 약 $${(tasks.length * USD_PER_CALL).toFixed(2)}`);
console.log(`출력     ${path.relative(ROOT, outFile)}`);

if (args["dry-run"]) process.exit(0);

const done = new Set(
  (await readJsonl(outFile))
    .filter((r) => r.ok)
    .map((r) => `${r.prompt_id}|${r.engine}|${r.attempt}`)
);
const todo = tasks.filter((t) => !done.has(`${t.prompt.id}|${engineName}|${t.attempt}`));
console.log(`이미 수집 ${done.size}건 · 남은 작업 ${todo.length}건\n`);

let ok = 0, fail = 0, grounded = 0;
const startedAt = Date.now();

await pool(todo, concurrency, async (task) => {
  const label = `${task.prompt.id}#${task.attempt}`;
  const t0 = Date.now();
  try {
    const r = await withRetry(() => engineFn(task.prompt.text), { label });
    appendJsonl(outFile, {
      ok: true,
      run_started_at: new Date(startedAt).toISOString(),
      collected_at: new Date().toISOString(),
      vertical: spec.vertical,
      prompt_id: task.prompt.id,
      stage: task.prompt.stage,
      prompt_text: task.prompt.text,
      attempt: task.attempt,
      engine: r.engine,
      model: r.model,
      latency_ms: Date.now() - t0,
      text: r.text,
      citations: r.citations,
      grounded: r.grounded,
      search_queries: r.search_queries,
      stop_reason: r.stop_reason,
      stop_details: r.stop_details ?? null,
      usage: r.usage,
      raw: r.raw, // 원본 보관 — 지표 정의를 바꿔 과거를 재계산할 때 유일한 근거
    });
    ok++;
    if (r.grounded) grounded++;
    const q = r.search_queries.length;
    console.log(`  ✓ ${label}  ${r.citations.length}인용 · ${q}쿼리 · ${Date.now() - t0}ms`);
  } catch (e) {
    appendJsonl(outFile, {
      ok: false,
      collected_at: new Date().toISOString(),
      prompt_id: task.prompt.id,
      attempt: task.attempt,
      engine: engineName,
      error: e.message.slice(0, 500),
    });
    fail++;
    console.error(`  ✗ ${label}  ${e.message.slice(0, 160)}`);
  }
});

console.log(`\n완료 — 성공 ${ok} · 실패 ${fail} · 그라운딩됨 ${grounded}/${ok}`);
if (ok && grounded === 0) {
  console.warn("⚠ 실시간 검색이 한 번도 수행되지 않았습니다. 학습된 지식만 측정한 셈이라 실험이 성립하지 않습니다.");
}
console.log(`다음: node src/extract-run.js --engine ${engineName}`);
