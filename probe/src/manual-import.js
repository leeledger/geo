/**
 * 수집 워크벤치가 내보낸 JSON 을 파이프라인 형식으로 변환한다.
 *
 *   node src/manual-import.js --file data/manual.chatgpt.json
 *
 * 입력 형식 (워크벤치가 그대로 뱉는다):
 *   { engine: "chatgpt", collected_at: "...", entries: [
 *       { prompt_id, attempt, text, sources: ["https://...", ...] }, ... ] }
 */
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { appendJsonl, readJsonl, readJson, parseArgs } from "./store.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const args = parseArgs(process.argv.slice(2));

const spec = readJson(path.resolve(ROOT, args.prompts || "prompts/erp-kr.json"));
const byId = Object.fromEntries(spec.prompts.map((p) => [p.id, p]));

const inFile = path.resolve(ROOT, args.file || `data/manual.${args.engine || "chatgpt"}.json`);
if (!fs.existsSync(inFile)) {
  console.error(`파일이 없습니다: ${path.relative(ROOT, inFile)}`);
  console.error(`워크벤치에서 "JSON 내보내기"로 복사한 내용을 이 경로에 저장하세요.`);
  process.exit(1);
}

const manual = readJson(inFile);
const engineName = args.engine || manual.engine || "chatgpt";
const outFile = path.resolve(ROOT, args.out || `data/responses.${engineName}.jsonl`);

const domainOf = (u) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return null; } };

const existing = new Set(
  (await readJsonl(outFile)).map((r) => `${r.prompt_id}|${r.engine}|${r.attempt}`)
);

let n = 0, skipped = 0, unknown = 0;
for (const e of manual.entries ?? []) {
  if (!e.text || !e.text.trim()) { skipped++; continue; }
  const p = byId[e.prompt_id];
  if (!p) { unknown++; console.warn(`  ? 알 수 없는 prompt_id: ${e.prompt_id}`); continue; }

  const key = `${e.prompt_id}|${engineName}|${e.attempt}`;
  if (existing.has(key)) { skipped++; continue; }

  appendJsonl(outFile, {
    ok: true,
    collected_at: manual.collected_at ?? new Date().toISOString(),
    collection_method: "manual_web_ui", // API 수집과 섞이지 않게 표시해 둔다
    vertical: spec.vertical,
    prompt_id: e.prompt_id,
    stage: p.stage,
    prompt_text: p.text,
    attempt: e.attempt,
    engine: engineName,
    model: manual.model ?? `${engineName}-web`,
    text: e.text,
    citations: (e.sources ?? []).filter(Boolean).map((u) => ({ url: u, title: null, domain: domainOf(u) })),
    grounded: (e.sources ?? []).length > 0,
    search_queries: [], // 웹 UI 에서는 내부 검색 쿼리를 볼 수 없다
    stop_reason: null,
    usage: null,
  });
  n++;
}

console.log(`가져오기 ${n}건 · 건너뜀 ${skipped}건${unknown ? ` · 미확인 prompt_id ${unknown}건` : ""}`);
console.log(`→ ${path.relative(ROOT, outFile)}`);
console.log(`\n다음: node src/extract-rules.js --engine ${engineName}`);
