// seed-panel 패널점검 · cited 패널 시험 (Step 51). node scripts/test-seed-panel.mjs — DB 안 씀
import assert from "node:assert/strict";
import fs from "node:fs";
import { 패널점검 } from "./seed-panel.mjs";
import * as 아이로그 from "./seed-ilog-panel.mjs";
import * as 문서딱 from "./seed-docttak-panel.mjs";
import * as 사이티드 from "./seed-cited-panel.mjs";

let fail = 0;
const t = (name, fn) => {
  try { fn(); console.log(`ok   ${name}`); } catch (e) { fail++; console.error(`FAIL ${name}\n     ${e.message}`); }
};

// geo.clients id 15 cited 의 answer_pattern (Arch 실측 2026-10-16). seed-panel dry 가 DB 값과 다시 대조한다
const DB이름 = String.raw`사\s?이\s?티\s?드|cited\.kr`;
const 등록검색어 = ["GEO 대행사", "GEO 마케팅 업체", "AEO 대행사", "AI 검색 노출 대행", "챗GPT 회사 노출 방법", "GEO 비용"];
const ac = JSON.parse(fs.readFileSync(new URL("../../handoff/research/step51/autocomplete.json", import.meta.url), "utf8"));
const 자동완성 = new Map(ac.seeds.map((s) => [s.seed, s.items]));

t("cited — 20개 · 중복 없음 · 이름말 = DB answer_pattern → 통과", () => {
  assert.equal(사이티드.패널.length, 20);
  assert.equal(new Set(사이티드.패널.map(([, x]) => x)).size, 20);
  assert.equal(사이티드.이름말(), DB이름);
  assert.equal(패널점검(사이티드, DB이름), null);
});
t("cited — 이름원문 없음(null·빈 글자) → 오류 글자", () => {
  assert.equal(패널점검(사이티드), "이름 판별 말 없음 — /admin/clients 에서 넣는다");
  assert.equal(패널점검(사이티드, null), "이름 판별 말 없음 — /admin/clients 에서 넣는다");
  assert.equal(패널점검(사이티드, ""), "이름 판별 말 없음 — /admin/clients 에서 넣는다");
});
t("cited — DB 이름말과 다르면 멈춤", () => {
  assert.equal(패널점검(사이티드, "사이티드"), "이름 판별 말이 DB answer_pattern 과 다름");
});
t("cited — 19개면 멈춤 · 같은 질문이면 멈춤", () => {
  assert.match(패널점검({ ...사이티드, 패널: 사이티드.패널.slice(1) }, DB이름), /19개/);
  const 겹침 = [...사이티드.패널.slice(1), 사이티드.패널[1]];
  assert.equal(패널점검({ ...사이티드, 패널: 겹침 }, DB이름), "같은 질문이 있음");
});
t("cited — keyword 17 · brand 3 · 대화체 없음", () => {
  const 셈 = 사이티드.패널.reduce((m, [s]) => ((m[s] = (m[s] ?? 0) + 1), m), {});
  assert.deepEqual(셈, { keyword: 17, brand: 3 });
});
t("cited — keyword 글자가 자동완성 원문(출처의 씨앗·순위 그대로)이거나 등록 검색어 6개 중 하나", () => {
  for (const [stage, text, 출처] of 사이티드.패널.filter(([s]) => s === "keyword")) {
    const m = /^네이버 자동완성 · 씨앗 (.+) · (\d+)위$/.exec(출처);
    if (m) assert.equal(자동완성.get(m[1])?.[Number(m[2]) - 1], text, `${text} ← ${출처}`);
    else {
      assert.equal(출처, "등록 경쟁 검색어(guides.ts 겨냥)", text);
      assert.ok(등록검색어.includes(text), text);
    }
  }
});
t("cited — 띄어쓰기·대소문자만 다른 중복 없음", () => {
  const 키 = 사이티드.패널.map(([, x]) => x.toLowerCase().replace(/\s+/g, ""));
  assert.equal(new Set(키).size, 20);
});
t("cited — 경쟁사 = geo-kr.json brand_universe 앞 5곳 이름", () => {
  const g = JSON.parse(fs.readFileSync(new URL("../../probe/prompts/geo-kr.json", import.meta.url), "utf8"));
  assert.equal(사이티드.파일럿.competitors, g.brand_universe.slice(0, 5).map((b) => b.name).join(", "));
  assert.equal(사이티드.새고객, undefined);
});
t("회귀 — 아이로그·문서딱 기존대로 null(clients.mjs 덩어리와 대조)", () => {
  assert.equal(패널점검(아이로그), null);
  assert.equal(패널점검(문서딱), null);
});
t("회귀 — 문서딱 이름말이 틀리면 clients.mjs 오류 글자 그대로", () => {
  assert.equal(패널점검({ ...문서딱, 이름말: () => "x" }), "이름 판별 말이 clients.mjs 와 다름");
});

console.log(fail ? `\n${fail}건 실패` : "\n전부 통과");
process.exit(fail ? 1 : 0);
