// 현황판 문장(Step 40) 단위 시험 — todo-text listing·crawl-push 분기 · clientRows 콘텐츠 줄 늦음/쉼 · judge 「정상인데 활동 없음」.
//   node academy/scripts/test-todo-words.mjs
// TS 를 깎아 임시 폴더에 두고 부른다(test-login.mjs 와 같은 방식). DB 는 안 쓴다 — pool 은 부르면 터지는 가짜.
// 하나라도 틀리면 종료코드 1.
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

let fail = 0, pass = 0;
const t = (name, f) => {
  try { f(); pass++; } catch (e) { fail++; console.log(`✗ ${name}\n   ${e.message.split("\n")[0]}`); }
};

/** web/lib/<이름>.ts 를 JS 로 깎아 임시 폴더에. 바꿀 줄은 [원문, 대신] */
const ts = createRequire(new URL("../../web/package.json", import.meta.url))("typescript");
const 폴더 = fs.mkdtempSync(path.join(os.tmpdir(), "todo-words-"));
const 깎기 = (이름, 바꿈) => {
  let 글 = fs.readFileSync(new URL(`../../web/lib/${이름}.ts`, import.meta.url), "utf8");
  for (const [a, b] of 바꿈) {
    if (!글.includes(a)) throw new Error(`${이름}.ts 에 「${a}」가 없습니다`);
    글 = 글.replace(a, b);
  }
  const js = ts.transpileModule(글, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  fs.writeFileSync(path.join(폴더, `${이름}.mjs`), js);
};
const 코어 = new URL("../../web/lib/client-core.mjs", import.meta.url).href;

try {
  깎기("agents", [
    ['import { pool } from "./ops";', 'const pool = () => { throw new Error("시험에서 DB 안 씀"); };'],
    ['from "./client-core.mjs"', `from ${JSON.stringify(코어)}`],
  ]);
  깎기("todo-text", [['from "./agents";', 'from "./agents.mjs";']]);
  const { todoText } = await import(pathToFileURL(path.join(폴더, "todo-text.mjs")).href);
  const { judge, clientRows, contentLate, ROLES } = await import(pathToFileURL(path.join(폴더, "agents.mjs")).href);

  // ── todo-text listing
  const 일 = (o) => ({ agent: "deliver", kind: "listing", title: "등재 필요: 「잠실 초등 코딩학원」", detail: "학원 목록 사이트가 1쪽을 차지하고 나온데다 …", error: "", evidence: "", link: null, payload: {}, ...o });
  t("listing — targets 앞 3개로 이유를 새로 씀", () => {
    const x = todoText(일({ payload: { query: "잠실 초등 코딩학원", targets: ["a.com", "b.kr", "c.net", "d.io"] } }));
    assert.equal(x.title, "「잠실 초등 코딩학원」 검색에 올라가기");
    assert.equal(x.why, "이 검색 1쪽을 차지한 곳: a.com, b.kr, c.net. 그곳에 학원 정보를 올리면 됩니다(업체 로그인 필요)");
  });
  t("listing — targets 없으면 닫아도 된다고", () => {
    assert.equal(todoText(일({ payload: { query: "q", targets: [] } })).why, "어디에 올릴지 모릅니다 — 닫아도 됩니다");
    assert.equal(todoText(일({ payload: { query: "q" } })).why, "어디에 올릴지 모릅니다 — 닫아도 됩니다");
  });

  // ── todo-text crawl-push
  const 밀기 = (vendor, title) => todoText({ agent: "deliver", kind: "crawl-push", title, detail: "", error: "", evidence: "", link: null, payload: { vendor } });
  t("crawl-push openai — 숫자 읽고 빙 웹마스터", () => {
    const x = 밀기("openai", "로봇&코딩학원 — openai 커버리지 45.1% (최고 100%)");
    assert.equal(x.title, "ChatGPT 가 우리 글을 덜 읽습니다 (45.1% · 가장 많이 읽는 곳 100%)");
    assert.equal(x.why, "ChatGPT 는 빙이 읽은 글로 답합니다. 빙 웹마스터에 주소를 내면 늘어납니다(로그인 필요)");
  });
  t("crawl-push apple — 숫자 못 읽으면 괄호 뺌 · robots", () => {
    const x = 밀기("apple", "애플 로봇이 덜 옴");
    assert.equal(x.title, "애플이 우리 글을 덜 읽습니다");
    assert.equal(x.why, "이 검색 로봇이 robots.txt 에서 막혔는지 봅니다");
  });
  t("crawl-push 모르는 vendor — 「검색 로봇이」", () => assert.match(밀기("zzz", "x").title, /^검색 로봇이 우리 글을 덜 읽습니다/));

  // ── 콘텐츠 줄 — 늦음 · 쉼
  const 지금 = Date.parse("2026-10-10T09:00:00+09:00");
  const 콘텐츠 = ROLES.find((r) => r.id === "content");
  const 세션일 = (created) => ({ agent: "content", kind: "question-draft", status: "세션 대기", title: "x", updatedAt: created, createdAt: created, clientId: 2 });
  const 파이프 = { posts: false, indexnow: false, marketing: false };
  t("clientRows 콘텐츠 — 세션 글 23일 → 늦음 · 문장", () => {
    const [r] = clientRows(콘텐츠, { id: 2, name: "아이로그" }, 파이프, [], [세션일("2026-09-17T13:29:47Z")], 지금);
    assert.equal(r.state, "late");
    assert.equal(r.reason, "가이드 글이 23일째 안 써졌습니다 — Claude 세션을 열어야 움직입니다");
    assert.equal(r.does, "글은 Claude 세션이 아이로그 저장소에 씁니다 · 밀린 글 1편");
  });
  t("clientRows 콘텐츠 — 바깥 글 고객은 기존 문장을 앞에", () => {
    const [r] = clientRows(콘텐츠, { id: 3, name: "문서딱" }, { ...파이프, marketing: true }, [], [], 지금);
    assert.equal(r.does, "매일 지식iN·카페 초안 1건씩, 블로그 주 2편(원장 확인 뒤 게시) · 글은 Claude 세션이 문서딱 저장소에 씁니다 · 밀린 글 0편");
  });
  t("clientRows 콘텐츠 — 2일이면 늦음 아님", () => {
    const [r] = clientRows(콘텐츠, { id: 2, name: "아이로그" }, 파이프, [], [세션일("2026-10-08T03:00:00Z")], 지금);
    assert.notEqual(r.state, "late");
  });
  t("clientRows 콘텐츠 — 열린 것 없고 10일 활동 없음 → 쉼", () => {
    const [r] = clientRows(콘텐츠, { id: 2, name: "아이로그" }, 파이프, [], [], 지금);
    assert.equal(r.state, "idle");
    assert.equal(r.reason, "최근 10일 한 일이 없습니다");
  });
  t("contentLate — 막힘은 그대로", () => {
    const 막힘 = { id: "content", name: "글 쓰기", does: "", state: "stuck", reason: "실패", last: null, next: null, today: { ok: 0, fail: 1 } };
    assert.equal(contentLate(막힘, [세션일("2026-09-17T13:29:47Z")], true, 지금), 막힘);
  });

  // ── judge 일반 규칙 — 정상인데 활동 없음
  t("judge — 열린 일감은 있는데 10일 활동 없음 → 쉼(「정상 · 기록 없음」 금지)", () => {
    const 역할 = { id: "x", name: "x", does: "", agents: ["x"], jobs: [] };
    const r = judge(역할, { acts: [], tasks: [{ agent: "x", kind: "k", status: "관찰", title: "t", updatedAt: "2026-10-09T00:00:00Z" }] }, 지금);
    assert.equal(r.state, "idle");
    assert.equal(r.reason, "최근 10일 한 일이 없습니다");
  });
  t("judge — 활동 있으면 정상", () => {
    const 역할 = { id: "x", name: "x", does: "", agents: ["x"], jobs: [] };
    const r = judge(역할, { acts: [{ agent: "x", action: "일", ok: true, summary: "", at: "2026-10-10T00:00:00Z", kind: null }], tasks: [] }, 지금);
    assert.equal(r.state, "ok");
  });
} finally {
  fs.rmSync(폴더, { recursive: true, force: true });
}

console.log(`\n${pass} 통과 · ${fail} 실패`);
if (fail) process.exitCode = 1;
