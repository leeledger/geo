// 현황판 은어 검사(Step 40) — 화면 문장에 내부 이름·로그 조각이 안 나오게.
//   node academy/scripts/test-ops-words.mjs
// 1) 화면 문장을 만드는 순수 함수(상태문장 · todoText · 확장줄 · clientRows reason/does)를 fixture 로 돌려 금지어 0
// 2) web/app/admin/ops/*.tsx 의 주석 아닌 줄에서 따옴표 글·JSX 글을 뽑아 금지어 0 — 상태 값 그 자체인 글(「세션 대기」 같은 비교용)은 뺀다
// 하나라도 걸리면 종료코드 1.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { 상태문장 } from "../../web/lib/client-status-core.mjs";
import { 확장줄 } from "./loop-grow.mjs";

const 금지어 = ["총괄", "근거", "집필", "삽화", "유통", "수리공", "감사", "조사", "영점", "커버리지", "확장 질문", "불림", "덜 잼",
  "읽을 자리", "세션 대기", "세션에서 할 일", "원장님 몫이 아닙니다"];
/** 일감 상태 값 — 이것만 든 글은 화면 문장이 아니라 비교용 값이다 */
const 상태값 = new Set(["대기", "관찰", "사람 대기", "세션 대기", "로컬 대기", "수리 대기", "수리 승인 대기", "수리 확인", "실행 중", "실패", "완료", "닫힘"]);

let fail = 0, pass = 0;
const 봄 = (어디, 글) => {
  const 걸림 = 금지어.filter((w) => String(글).includes(w));
  if (걸림.length) { fail++; console.log(`✗ ${어디}: 「${걸림.join("」「")}」 — ${String(글).slice(0, 120)}`); } else pass++;
};

// ── 1. 순수 함수 출력
const 빈 = { measure: 0, posts: 0, outside: { blog: 0, jisikin: 0, cafe: 0 }, guides: 0, gsc: 0, bing: 0, naver: 0, touched: {}, backlog: {}, repairOff: false };
const 밀림 = { n: 2, q: 12, oldest: "2026-09-17" };
for (const [이름, raw] of [
  ["빈", { ...빈, name: "새 고객" }],
  ["아이로그", { ...빈, name: "아이로그", measure: 42, touched: { post: "2026-09-18" }, backlog: { session: 밀림 } }],
  ["전부", { ...빈, name: "학원", measure: 1, posts: 1, outside: { blog: 1, jisikin: 1, cafe: 1 }, guides: 1, gsc: 1, bing: 1, naver: 1, touched: { post: "2026-10-10" },
    backlog: { owner: 밀림, session: 밀림, local: 밀림, repair: 밀림, failed: 밀림 }, repairOff: true }],
  ["수리 켜짐", { ...빈, name: "x", touched: { post: "2026-10-10" }, backlog: { repair: 밀림 } }],
]) {
  const s = 상태문장(raw, "2026-10-10");
  for (const [k, v] of Object.entries(s)) 봄(`상태문장 ${이름} ${k}`, Array.isArray(v) ? v.join(" / ") : v);
}

봄("확장줄", 확장줄([{ prompt_id: "q1" }, { prompt_id: "q2" }], [
  { prompt_id: "q1", collection_method: "m", mentioned: true, cited: false },
  { prompt_id: "q1", collection_method: "m", mentioned: true, cited: false },
]));

// todoText · clientRows — TS 를 깎아 임시 폴더에(test-todo-words 와 같은 방식)
const ts = createRequire(new URL("../../web/package.json", import.meta.url))("typescript");
const 폴더 = fs.mkdtempSync(path.join(os.tmpdir(), "ops-words-"));
const 깎기 = (이름, 바꿈) => {
  let 글 = fs.readFileSync(new URL(`../../web/lib/${이름}.ts`, import.meta.url), "utf8");
  for (const [a, b] of 바꿈) {
    if (!글.includes(a)) throw new Error(`${이름}.ts 에 「${a}」가 없습니다`);
    글 = 글.replace(a, b);
  }
  fs.writeFileSync(path.join(폴더, `${이름}.mjs`),
    ts.transpileModule(글, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText);
};
try {
  깎기("agents", [
    ['import { pool } from "./ops";', 'const pool = () => { throw new Error("시험에서 DB 안 씀"); };'],
    ['from "./client-core.mjs"', `from ${JSON.stringify(new URL("../../web/lib/client-core.mjs", import.meta.url).href)}`],
  ]);
  깎기("todo-text", [['from "./agents";', 'from "./agents.mjs";']]);
  const { todoText } = await import(pathToFileURL(path.join(폴더, "todo-text.mjs")).href);
  const { clientRows, judge, ROLES, plain } = await import(pathToFileURL(path.join(폴더, "agents.mjs")).href);

  const 일 = (o) => ({ agent: "audit", kind: "human", title: "", detail: "", error: "", evidence: "", link: null, payload: {}, ...o });
  const 일감들 = [
    ...["R1", "R2", "R3", "R4", "R5", "R6", "R9"].map((rule) => 일({ kind: "investigate", title: `조사 · 감사 ${rule}: 영점`, payload: { rule, facts: { vendor: "bytedance" } } })),
    일({ kind: "investigate", error: "수리공이 못 고침", payload: { rule: "R5", facts: { vendor: "apple", pages_total: 51, pages_crawled: 1 }, diagnosis: { 결론: "감사 결론" } } }),
    ...["검토 불합격", "가드에 걸림", "3번 실패", "합치다 멈춤", "사람이 합칩니다", "되돌림", "거절", "다시 열림", "고칠 수 없는 파일", "효과 없음"]
      .map((e) => 일({ kind: "investigate", error: e, payload: { rule: "R1" } })),
    일({ kind: "repair-approval", title: "자동 수리 승인 대기: 감사 R3 조사", link: "https://github.com/x/pull/1" }),
    일({ kind: "workflow-failed", payload: { file: "audit.yml" } }),
    일({ kind: "workflow-failed", payload: { file: "repair.yml" } }),
    일({ kind: "material", payload: { unused: 0, 빈손: 2 } }),
    일({ kind: "setup", title: "문서딱 세팅", payload: { 칸: "send", slug: "docttak" } }),
    일({ kind: "human", dedupe: "login-naver", title: "네이버 블로그 로그인이 풀렸습니다" }),
    일({ kind: "listing", payload: { query: "잠실 초등 코딩학원", targets: ["a.com"] } }),
    일({ kind: "listing", payload: { query: "잠실 초등 코딩학원" } }),
    일({ kind: "crawl-push", title: "아이로그 — naver 커버리지 20% (최고 100%)", payload: { vendor: "naver" } }),
    일({ kind: "crawl-push", title: "로봇&코딩학원 — openai 커버리지 45.1% (최고 100%)", payload: { vendor: "openai" } }),
  ];
  for (const t of 일감들) {
    const x = todoText(t);
    봄(`todoText ${t.kind} ${t.payload?.rule ?? t.error ?? ""}`, `${x.title} / ${x.why} / ${x.action.label ?? ""}`);
  }

  // plain — 활동 기록 원문에 든 내부 이름을 사람 말로
  for (const s of ["감사 R5 조사 · 영점 — bytedance 커버리지 2%", "수리공 멈춤 — 검토 불합격", "조사 · 근거 없는 완료: 일감 946"]) 봄(`plain 「${s}」`, plain(s));

  const 지금 = Date.parse("2026-10-10T09:00:00+09:00");
  const 세션일 = { agent: "content", kind: "question-draft", status: "세션 대기", title: "x", updatedAt: "2026-09-17T13:29:47Z", createdAt: "2026-09-17T13:29:47Z", clientId: 2 };
  for (const [이름, pipe, tasks] of [
    ["콘텐츠 늦음", { posts: false, indexnow: false, marketing: false }, [세션일]],
    ["콘텐츠 쉼", { posts: false, indexnow: false, marketing: true }, []],
    ["유통 없음", { posts: false, indexnow: false, marketing: false }, []],
  ]) {
    for (const r of ROLES.filter((x) => ["content", "deliver"].includes(x.id))) {
      for (const row of clientRows(r, { id: 2, name: "아이로그" }, pipe, [], tasks, 지금)) 봄(`clientRows ${이름} ${r.id}`, `${row.name} / ${row.does} / ${row.reason ?? ""}`);
    }
  }
  for (const r of ROLES) 봄(`ROLES ${r.id}`, `${r.name} / ${r.does} / ${r.jobs.map((j) => j.name).join(" · ")}`);
  const 수리 = ROLES.find((r) => r.id === "repair");
  봄("judge 수리 꺼짐", judge(수리, { acts: [{ agent: "repair", action: "수리", ok: true, summary: "스위치 꺼짐", at: "2026-10-10T00:00:00Z", kind: null }], tasks: [] }, 지금).reason);
} finally {
  fs.rmSync(폴더, { recursive: true, force: true });
}

// ── 2. ops 화면 파일의 글
const 화면 = new URL("../../web/app/admin/ops/", import.meta.url);
for (const f of fs.readdirSync(화면).filter((x) => x.endsWith(".tsx"))) {
  const 줄들 = fs.readFileSync(new URL(f, 화면), "utf8").split(/\r?\n/);
  줄들.forEach((줄, i) => {
    const s = 줄.trim();
    if (/^(\/\/|\*|\/\*|\{\/\*)/.test(s)) return;   // 주석 줄
    const 코드 = 줄.replace(/\/\/.*$/, "").replace(/\{\/\*.*?\*\/\}/g, "");
    const 글들 = [
      ...[...코드.matchAll(/"([^"\\]*)"|'([^'\\]*)'|`([^`\\]*)`/g)].map((m) => m[1] ?? m[2] ?? m[3]),
      ...[...코드.matchAll(/>([^<>{}]+)</g)].map((m) => m[1]),
    ].filter((x) => /[가-힣]/.test(x) && !상태값.has(x.trim()));
    for (const 글 of 글들) 봄(`${f}:${i + 1}`, 글);
  });
}

console.log(`\n${pass} 통과 · ${fail} 실패`);
if (fail) process.exitCode = 1;
