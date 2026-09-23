/**
 * 관점 글 초안을 스스로 쓴다. 바깥 소식으로 여는 뉴스 글은 write-news.mjs 가 쓴다.
 *
 * 2026-09-23 부터 **재료가 먼저다.** 주제 은행에서 주제를 고르고 빈자리를 모델이 채우게 두면
 * 일반론과 지어낸 장면이 들어온다 — 원장이 이틀에 초안 3편을 그 이유로 버렸다.
 * 그래서 원장이 실제로 듣고 겪은 것(academy.materials)이 있을 때만 관점 글을 쓴다.
 *
 *   모드 재료  안 쓴 재료 3개 이상 → 그 재료로 쓴다
 *   모드 사실  재료가 모자라고 쓸 사실이 있음 → write-news.mjs 에 넘긴다. 여기서는 안 쓴다
 *   모드 없음  둘 다 아님 → 아무것도 안 쓴다. 재료를 달라는 일감만 올리고 78 로 끝낸다
 *
 * 빈손으로 오는 게 슬롭을 내놓는 것보다 낫다. 원장이 읽고 버리는 시간이 더 비싸다.
 *
 * 순서
 *   1. 재료를 읽는다   — 안 쓴 재료. 주제는 재료에 맞춘다
 *   2. 근거를 모은다   — 기존 글(겹치는 주장) · 지고 있는 검색어 · 원장이 버린 이유
 *   3. 초안을 쓴다     — 금지 표현은 slop-rules 가 잡는 것과 같은 목록을 미리 준다
 *   4. 게이트를 돈다   — slop-rules 의 치명. 걸리면 한 번만 다시 쓰고, 두 번째도 걸리면 안 넣는다
 *   5. 초안으로 넣는다 — published=false. 발행은 사람이 한다
 *
 * 발행까지 자동으로 하지 않는다. CLAUDE.md 의 「사람만 할 수 있는 일 — 발행 전 사실 확인」이고,
 * 지어낸 문장 하나가 다른 문서와 어긋나면 레퍼런스 전체가 죽는다.
 *
 *   node scripts/write-draft.mjs                주제를 골라 초안까지
 *   node scripts/write-draft.mjs --dry          고른 주제와 프롬프트만 보고 멈춘다 (키 없이 됨)
 *   node scripts/write-draft.mjs --topic <id>   주제를 직접 지정
 *
 * 모델은 키가 있는 쪽을 쓴다 (anthropic → gemini → groq).
 * WRITER_PROVIDER·WRITER_MODEL·WRITER_MAX_TOKENS 로 바꾼다.
 */
import fs from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";
import { 공급자만들기, 공급자들, 금지, 지어내기금지, 파싱, 공통짜임새, 재시도 } from "./writer-common.mjs";
import { 검사 } from "./slop-rules.mjs";

for (const l of fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8").split(/\r?\n/)) {
  const m = /^([A-Z_]+)=(.*)$/.exec(l);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

const DRY = process.argv.includes("--dry");
// indexOf 가 -1 일 때 +1 하면 argv[0](node 경로)을 주제로 읽는다. 한 번 당했다.
const TI = process.argv.indexOf("--topic");
const WANT = TI >= 0 ? process.argv[TI + 1] : null;
// 개선 루프(daily-agent.mjs)가 AI 답변에서 안 불린 질문을 겨냥해 부른다. 주제 은행을 안 쓴다
const 인자 = (name) => {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : null;
};
const QUESTION = 인자("--question");
const STAGE = 인자("--stage") ?? "problem";
const SOURCES = (인자("--sources") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
const CLIENT = 1;
const ADMIN = process.env.ADMIN_BASE_URL || "https://geo-rose-nine.vercel.app";
const 오늘 = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });
let 공급자 = 공급자만들기();

const u = new URL(process.env.DATABASE_URL);
u.searchParams.delete("sslmode");
const pool = new Pool({ connectionString: u.toString(), ssl: { rejectUnauthorized: false } });
const q = (sql, p = []) => pool.query(sql, p).then((r) => r.rows);

const 규칙 = [
  "제목은 학부모가 검색창에 치는 말 그대로. 「꼭 확인해야 할 3가지」 같은 기사 제목은 안 된다",
  "문단 80~400자. 잘라 인용하기 좋은 길이",
  "소제목은 ## 만. 소제목에 ** 를 겹쳐 쓰지 않는다. 굵게는 본문 안에서만",
  "본문 1800~2800자를 반드시 채운다. 짧으면 판단 기준이 모자란 것이다",
  "「우리 학원으로 오세요」로 닫지 않는다. 판단 기준을 주고 끝낸다",
  "불안을 팔지 않는다. 「지금 안 하면 늦습니다」 류 금지",
  "하지 말아야 할 것을 한 번은 말한다",
  "목록은 진짜 나열일 때만. 체크리스트로 닫지 않는다",
  "「마무리」 「결론」 문단으로 닫지 않는다. 앞에서 한 말을 다시 하는 자리다",
  "동네 검색어를 겨냥한 글이면 지역 이름(송파·잠실·석촌)이 본문에 실제로 들어가야 한다. " +
    "억지로 끼우면 티가 난다 — 통학 거리나 상담에서 나오는 맥락에 자연스럽게 둔다",
];

/**
 * 재료를 달라는 일감. dedupe_key 는 company.mjs 의 신호와 같은 것을 쓴다 —
 * 재료가 3개를 넘으면 회사 루프가 알아서 닫는다. 여기서 따로 닫지 않는다.
 */
const 재료일감 = async ({ title, detail, payload = {} }) =>
  q(
    `insert into geo.agent_tasks (client_id, agent, kind, dedupe_key, title, detail, payload, priority, status, link)
     values ($1, 'content', 'material', 'material-need', $2, $3, $4::jsonb, 12, '사람 대기', $5)
     on conflict (client_id, dedupe_key) do update set
       title = excluded.title, detail = excluded.detail,
       payload = geo.agent_tasks.payload || excluded.payload,
       priority = excluded.priority, link = coalesce(excluded.link, geo.agent_tasks.link), updated_at = now(),
       status = case when geo.agent_tasks.status in ('닫힘', '완료') then '사람 대기' else geo.agent_tasks.status end`,
    [CLIENT, title, detail, JSON.stringify(payload), `${ADMIN}/admin/material`],
  ).catch((e) => console.log("  ⚠ 재료 일감을 못 올렸습니다:", e.message.slice(0, 90)));

/**
 * 빈손으로 끝난 횟수를 센다. 한 주 건너뛰는 건 괜찮다 — 두 주 연속이면 발행이 멈춘 것이다.
 * 그때는 우선순위를 맨 위로 올려 따로 알린다(sticky — 신호가 없어도 회사 루프가 안 닫는다).
 */
const 빈손 = async (왜) => {
  const [t] = await q(
    `select coalesce((payload->>'빈손')::int, 0) n from geo.agent_tasks
      where client_id = $1 and dedupe_key = 'material-need'`, [CLIENT]).catch(() => []);
  const n = (t?.n ?? 0) + 1;
  if (n >= 2) {
    await q(
      `insert into geo.agent_tasks (client_id, agent, kind, dedupe_key, title, detail, payload, priority, status, link)
       values ($1, 'content', 'material', 'material-stopped', $2, $3, $4::jsonb, 5, '사람 대기', $5)
       on conflict (client_id, dedupe_key) do update set
         title = excluded.title, detail = excluded.detail,
         payload = geo.agent_tasks.payload || excluded.payload, priority = excluded.priority, updated_at = now(),
         status = case when geo.agent_tasks.status = '닫힘' then '사람 대기' else geo.agent_tasks.status end`,
      [
        CLIENT,
        `발행이 멈췄습니다 — 자동 초안이 ${n}주 연속 빈손`,
        `주 1편이 끊기면 크롤러도 뜸해지고 레퍼런스가 늙습니다.\n이유: ${왜}\n재료 한 줄이면 다음 주는 돕니다: ${ADMIN}/admin/material`,
        JSON.stringify({ sticky: true, 빈손: n, 왜 }),
        `${ADMIN}/admin/material`,
      ],
    ).catch((e) => console.log("  ⚠ 멈춤 일감을 못 올렸습니다:", e.message.slice(0, 90)));
    console.log(`  ⚠ ${n}주 연속 빈손입니다. 발행 멈춤 일감을 올렸습니다.`);
  }
  return n;
};

/** 초안이 나왔으면 빈손 카운터를 0 으로 돌리고 멈춤 일감을 닫는다 */
const 다시돎 = async () => {
  await q(`update geo.agent_tasks set payload = payload || '{"빈손":0}'::jsonb, updated_at = now()
            where client_id = $1 and dedupe_key = 'material-need'`, [CLIENT]).catch(() => {});
  await q(
    `update geo.agent_tasks set status = '닫힘', done_at = now(), updated_at = now(),
            evidence = left(evidence || chr(10) || $2, 4000)
      where client_id = $1 and dedupe_key = 'material-stopped' and status <> '닫힘'`,
    [CLIENT, `${오늘()} 초안이 다시 나와 닫음`]).catch(() => {});
};

const main = async () => {
  // ── 0. 재료가 먼저다
  const 재료들 = await q(
    `select id, kind, said, context, day::text as day from academy.materials
      where client_id = $1 and cardinality(used_in) = 0
      order by day desc limit 12`,
    [CLIENT],
  ).catch((e) => {
    console.log("  ⚠ 재료를 못 읽었습니다:", e.message.slice(0, 90));
    return [];
  });

  // 같은 이유로 또 버려지지 않게 원장이 버린 이유를 프롬프트에 넣는다
  const 버린이유 = await q(
    `select reasons, note from academy.draft_feedback
      where client_id = $1 order by created_at desc limit 5`, [CLIENT]).catch(() => []);

  const [측정] = QUESTION
    ? await q(
        `select coalesce(raw->>'answer','') answer,
                (select string_agg(distinct c->>'domain', ', ') from jsonb_array_elements(citations) c) doms
           from academy.ai_measurements
          where client_id = $1 and prompt_text = $2 order by measured_on desc limit 1`, [CLIENT, QUESTION]).catch(() => [])
    : [];

  // write-news 는 구글 검색 그라운딩이 있어야 돈다(그 파일 머리 주석). 키가 없으면 넘길 곳이 없다
  const 뉴스가능 = Boolean(process.env.GEMINI_API_KEY);
  const 모드 = 재료들.length >= 3 ? "재료" : (측정?.answer || 뉴스가능) ? "사실" : "없음";
  console.log(`모드=${모드}`);

  // ── 모드 사실 — 여기서는 글을 안 쓴다. write-news.mjs 에 넘기고 종료 코드를 그대로 이어받는다
  if (모드 === "사실") {
    console.log(`  안 쓴 재료가 ${재료들.length}개뿐입니다. 관점 글 대신 사실 글로 넘깁니다.`);
    const r = spawnSync(process.execPath, [fileURLToPath(new URL("./write-news.mjs", import.meta.url)), ...(DRY ? ["--dry"] : [])],
      { encoding: "utf8", maxBuffer: 20 * 1024 * 1024 });
    process.stdout.write(r.stdout ?? "");
    if (r.stderr) process.stderr.write(r.stderr);
    process.exitCode = r.status ?? 1;
    if (DRY) return;
    if (!/DRAFT_SLUG=/.test(r.stdout ?? "")) {
      const n = await 빈손("재료가 모자라 사실 글로 넘겼는데 거기서도 초안이 안 나왔습니다");
      await 재료일감({
        title: "초안 재료가 필요합니다",
        detail: `안 쓴 재료 ${재료들.length}개 · 사실 글로 넘겼지만 초안이 안 나왔습니다. 상담·수업에서 들은 말 한 줄이면 다음 실행에서 관점 글이 나갑니다.`,
        payload: { unused: 재료들.length, 빈손: n, 모드: "사실" },
      });
    } else {
      await 다시돎();
    }
    return;
  }

  // ── 모드 없음 — 아무것도 안 쓴다. 빈손이 슬롭보다 낫다
  if (모드 === "없음") {
    console.log(`  안 쓴 재료 ${재료들.length}개 · 쓸 사실도 없습니다. 초안을 만들지 않습니다.`);
    const n = DRY ? null : await 빈손("재료도 없고 쓸 사실도 없었습니다");
    await 재료일감({
      title: "초안 재료가 필요합니다 — 이번 주는 글을 안 썼습니다",
      detail: `안 쓴 재료 ${재료들.length}개. 재료가 없으면 자동 초안은 일반론이 됩니다. 상담에서 들은 말·수업에서 있었던 일 한 줄이면 30초입니다.`,
      payload: { unused: 재료들.length, ...(n === null ? {} : { 빈손: n }), 모드: "없음" },
    });
    console.log(`재료 적는 곳: ${ADMIN}/admin/material`);
    process.exitCode = 78; // 재료 없음 — 실패와 구분한다
    return;
  }

  // ── 1. 주제 — 재료에 맞춘다
  const bank = JSON.parse(fs.readFileSync(new URL("../content/topics.json", import.meta.url), "utf8"));
  const 남은것 = bank.topics.filter((t) => !t.slug);

  // 컬럼은 hit(boolean) 이다. exposed 가 아니다 — 틀린 이름으로 조회하면
  // catch 가 삼켜서 「근거 없는 프롬프트」가 조용히 만들어진다. 그래서 실패는 반드시 찍는다.
  // 엔진이 여럿이라 한 엔진이라도 잡혔으면 진 게 아니다.
  const 지는검색어 = await q(
    `select query from academy.serp_checks
      where client_id = $1 and kind = '경쟁' and checked_at > now() - interval '7 days'
      group by query having bool_or(hit) = false`,
    [CLIENT],
  ).catch((e) => {
    console.log("  ⚠ 지고 있는 검색어를 못 읽었습니다:", e.message.slice(0, 90));
    return [];
  });
  const STOP = new Set(["학원", "추천", "코딩", "초등", "교실"]);
  const 낱말 = (s) =>
    s.split(/\s+/).map((w) => w.replace(/[^가-힣a-zA-Z0-9]/g, "")).filter((w) => w.length >= 2 && !STOP.has(w));
  const 핵심어 = [...new Set(지는검색어.flatMap((r) => 낱말(r.query)))];
  // 핵심어 자리에 재료 낱말을 넣는다. 주제 은행이 아니라 재료가 주제를 고른다
  const 재료낱말 = [...new Set(재료들.flatMap((m) => 낱말(`${m.said} ${m.context}`)))];

  const 짚 = (t) => `${t.title} ${(t.tags ?? []).join(" ")} ${t.angle ?? ""}`;
  const 점수 = (t) => 핵심어.filter((k) => 짚(t).includes(k)).length;
  const 재료점수 = (t) => 재료낱말.filter((k) => 짚(t).includes(k)).length;

  const 후보 = QUESTION
    ? [{
        id: null,
        title: QUESTION,
        angle: "학부모가 AI 에게 이 질문을 그대로 했는데 우리 사이트가 답에 안 나왔다. " +
          "이 질문에 곧장 답하는 글이어야 한다. 첫 문단에서 질문에 대한 판단을 먼저 말한다." +
          (SOURCES.length ? ` 대신 인용된 곳: ${SOURCES.join(", ")} — 그들이 못 주는 판단 기준을 준다. 베끼지 않는다.` : ""),
        category: STAGE === "local" || STAGE === "brand" ? "학부모안내" : "교육관점",
        tags: [],
      }]
    : WANT
      ? 남은것.filter((t) => t.id === WANT)
      : [...남은것].sort((a, b) => (재료점수(b) * 3 + 점수(b)) - (재료점수(a) * 3 + 점수(a)));

  if (WANT && !후보.length) {
    console.log(`주제 ${WANT} 를 못 찾았습니다.`);
    return;
  }
  // 맞물리는 주제가 없으면 재료 자체에서 제목을 뽑게 한다. 주제 은행을 억지로 끌어다 쓰지 않는다
  const 맞물림 = QUESTION || WANT ? true : 후보.length > 0 && 재료점수(후보[0]) >= 1;
  if (!QUESTION && !WANT && !맞물림) {
    console.log("  맞물리는 주제가 주제 은행에 없습니다 — 재료에서 제목을 뽑습니다.");
  }

  // ── 2. 근거
  const 기존글 = await q(
    `select title, summary from academy.posts
      where client_id = $1 and published and source_url is null
      order by published_at desc limit 12`,
    [CLIENT],
  ).catch(() => []);

  const 버린줄 = 버린이유
    .map((f) => {
      const rs = (f.reasons ?? []).join(" · ");
      const note = (f.note ?? "").trim();
      return rs || note ? `- ${rs || "이유 없음"}${note ? ` — 「${note}」` : ""}` : null;
    })
    .filter(Boolean);

  /**
   * 프롬프트를 만든다. 재료는 라벨(m1..)을 붙여 준다 — 모델이 실제로 쓴 재료를 그 라벨로 돌려준다.
   * 라벨이 없으면 어느 재료를 썼는지 못 알아내고, 그러면 게이트가 지어낸 장면을 못 가른다.
   */
  const 만들기 = (고른것, 쓸재료, 고침 = []) => {
    const 재료표 = 쓸재료
      .map((m, i) => `- [m${i + 1}] ${m.kind} · ${m.day} · ${m.context || "상황 기록 없음"}: 「${m.said}」`)
      .join("\n");
    const 숫자재료 = 쓸재료.some((m) => m.kind === "숫자");
    return [
      "너는 송파구에서 코딩·로봇 학원을 운영하는 원장이다. 학부모가 읽을 글을 직접 쓴다.",
      "광고가 아니라 판단 기준을 주는 글이다. 읽고 나서 우리 학원에 안 와도 도움이 됐으면 그걸로 됐다.",
      "",
      맞물림
        ? `# 이번 주제\n${고른것.title}\n각도: ${고른것.angle}\n분류: ${고른것.category}\n태그: ${(고른것.tags ?? []).join(", ")}`
        : "# 이번 주제\n주제를 아래 재료에서 직접 뽑아라. 학부모가 검색창에 칠 말 그대로 제목을 짓는다.\n" +
          `주제 은행에 맞물리는 것이 없어서 재료가 주제다. 분류는 ${고른것?.category ?? "학부모안내"} 로 둔다.`,
      "",
      `# 이 글에 쓸 재료 (원장이 실제로 듣고 겪은 것. 여기 없는 장면은 하나도 만들지 마라)\n${재료표}`,
      "",
      "첫 문단은 위 재료 중 하나를 그대로 인용해서 연다. 고쳐 쓰지 말고 들은 말 그대로 따옴표 안에 넣는다.",
      "재료에 없는 상담·수업 장면은 한 줄도 쓰지 마라. 「한 학부모가」 「어떤 아이가」로 시작하는 문장은",
      "위 재료에 그 말이 있을 때만 쓴다. 없으면 그 문단을 통째로 지운다.",
      "",
      `# 지켜야 할 것\n- ${규칙.join("\n- ")}`,
      "",
      "# 절대 지어내지 않는다 (이걸 어기면 글을 통째로 버린다)\n" +
        지어내기금지.map((s) => `- ${s}`).join("\n"),
      "",
      `# 쓰면 안 되는 것 (하나라도 있으면 광고로 분류된다)\n- ${금지.join("\n- ")}`,
      "",
      // 「확인된 숫자」로 공개 글 수와 크롤러 방문 수를 줬더니 그걸 글 소재로 썼다 —
      // 「공개한 43편의 글에서… 크롤러가 누적 659회 방문하는 동안에도」(gemini-3.6-flash, 2026-09-12).
      // 쓸 수 있는 숫자를 주면 쓴다. 그래서 안 준다. 바깥 사실을 놓고 쓰는 글은 write-news.mjs 다.
      "# 쓸 수 있는 숫자\n" +
        "- 없다. 이 글에 쓸 수 있는 숫자는 하나도 없다. 숫자를 쓰지 마라.\n" +
        "- 반 인원·비율·기간·가격 전부. 모르면 판단 기준만 준다.\n" +
        "  나쁜 예: 「8명 이하가 적당하다」 「응답자의 40%가 그만뒀다」\n" +
        "  좋은 예: 「한 반 인원을 물어보세요. 몇 명부터 질문이 밀리는지도 같이 물으면 답이 분명해집니다」" +
        (숫자재료
          ? "\n- 예외 하나: 위 재료 중 종류가 「숫자」인 것에 적힌 숫자는 적힌 그대로만 쓸 수 있다. 바꾸거나 더하거나 비율로 고치지 마라."
          : ""),
      "",
      버린줄.length
        ? `# 원장이 최근에 버린 이유 (되풀이하면 또 버린다)\n${버린줄.join("\n")}`
        : "",
      "",
      측정?.answer
        ? "# AI 가 이 질문에 지금 이렇게 답한다 (우리 학원은 안 나온다)\n" +
          `${측정.answer.slice(0, 1800)}\n\n` +
          `대신 인용된 곳: ${측정.doms ?? "없음"}\n` +
          "이 답에서 비어 있는 것 — 판단 기준, 확인할 질문, 안 맞는 경우 — 을 채우는 글을 쓴다. 저 답을 요약하거나 베끼지 마라."
        : "",
      "",
      `# 이미 쓴 글 (주장이 겹치면 안 된다)\n${기존글.map((p) => `- ${p.title} — ${p.summary ?? ""}`).join("\n")}`,
      "",
      `# 지금 지고 있는 검색어\n${지는검색어.map((r) => `- ${r.query}`).join("\n") || "- (측정 없음)"}`,
      "",
      고침.length ? `# 방금 쓴 글이 게이트에 걸렸다. 같은 실수를 하지 마라\n- ${고침.join("\n- ")}` : "",
      "",
      "# 내놓을 형식 (JSON 하나만, 다른 말 없이)",
      QUESTION || !맞물림
        ? `{"title": "질문형 제목", "slug": "제목을 로마자로 옮긴 주소. 소문자·숫자·하이픈만, 60자 이하 (예: koding-hagwon-goreugi)", "summary": "결론 한두 줄", "tags": ["5개"], "body": "마크다운 본문", "쓴재료": ["m1"], "확인필요": ["내가 지어냈을 수 있어 원장 확인이 필요한 문장"]}`
        : `{"title": "질문형 제목", "summary": "결론 한두 줄", "tags": ["5개"], "body": "마크다운 본문", "쓴재료": ["m1"], "확인필요": ["내가 지어냈을 수 있어 원장 확인이 필요한 문장"]}`,
      "",
      "쓴재료 에는 본문에 실제로 인용한 재료의 라벨만 넣어라. 안 쓴 라벨을 넣으면 검사에서 걸려 글이 통째로 버려진다.",
      "확인필요 에는 상담·수업에서 실제로 있었던 일처럼 쓴 문장을 빠짐없이 넣어라.",
      "네가 겪지 않은 일을 겪은 것처럼 쓰면 발행 전에 걸러야 한다.",
      "",
      "# 마지막으로 스스로 훑어라 (내놓기 전에)",
      "- 소제목은 4개를 넘지 않는다. 목록은 한 군데까지. 체크리스트로 닫지 않는다",
      "- 첫 문장이 서론이면 지우고 둘째 문장부터 시작한다",
      "- 「쓰면 안 되는 것」 목록의 표현이 하나라도 남아 있으면 그 문장을 다시 쓴다",
      "- 검색하면 아무나 쓸 수 있는 문단이 있으면 지운다. 이 학원 원장만 쓸 수 있는 말로 바꾼다",
      "- 다 고친 최종본만 body 에 넣는다. 고치는 과정은 쓰지 마라",
    ].join("\n");
  };

  // 주제와 맞물리는 재료를 앞에 둔다. 프롬프트에는 8개까지만 — 더 주면 모델이 고르다 만다
  const 정렬 = (t) =>
    [...재료들]
      .sort((a, b) => 짚(t ?? { title: "", tags: [] }).split(/\s+/).filter((w) => b.said.includes(w)).length
        - 짚(t ?? { title: "", tags: [] }).split(/\s+/).filter((w) => a.said.includes(w)).length)
      .slice(0, 8);

  let 고른것 = 후보[0] ?? { id: null, title: "", angle: "", category: "학부모안내", tags: [] };
  let 쓸재료 = 정렬(고른것);
  console.log(`주제: ${맞물림 ? 고른것.title : "(재료에서 뽑는다)"}`);
  console.log(`  안 쓴 재료 ${재료들.length}개 중 ${쓸재료.length}개를 넘깁니다 · 재료 맞물림 ${재료점수(고른것)}개 · 지는 검색어 맞물림 ${점수(고른것)}개`);

  let prompt = 만들기(고른것, 쓸재료);

  if (DRY) {
    // 키가 없어도 어느 쪽으로 붙을지는 여기서 확인된다. 호출은 안 한다.
    console.log(`  쓸 모델: ${공급자 ? `${공급자.model} (${공급자.이름})` : "없음 — 키가 하나도 없습니다"}`);
    console.log(`\n── 프롬프트 (${prompt.length}자) ──\n`);
    console.log(prompt);
    console.log("\n--dry 라 여기서 멈춥니다. 실제 생성은 키가 있어야 합니다.");
    return;
  }

  if (!공급자들().length) {
    console.log("\n키가 없습니다. 초안을 쓰지 못합니다. 하나만 GitHub Secrets 에 넣으면 주 1회 자동으로 돕니다.");
    console.log("  GEMINI_API_KEY     무료 한도 있음. 무료 중에 한국어가 제일 낫다 (aistudio.google.com)");
    console.log("  ANTHROPIC_API_KEY  월 4편 기준 4,037~8,187원 (api-cost.mjs)");
    console.log("  GROQ_API_KEY       무료지만 오픈웨이트뿐이라 한국어가 깨진다 (2026-09-12 측정, BUILD-LOG)");
    console.log("어느 쪽이든 초안까지입니다. 발행 전 사실 확인은 사람이 합니다.");
    process.exitCode = 78; // 설정 없음 — 실패와 구분한다
    return;
  }

  /**
   * 앞 공급자가 막히면 다음으로 넘어간다. 하나에 매달리면 한도 하나에 주 1편이 통째로 선다.
   * 막힘은 상태 코드만이 아니다 — 200 에 빈 답, 잘린 답, JSON 이 아닌 답도 다음으로 넘긴다.
   */
  const 쓰기 = async (프롬프트) => {
    const 막힘 = [];
    for (const 후보공급자 of 공급자들()) {
      공급자 = 후보공급자;
      console.log(`  쓰는 모델: ${공급자.model} (${공급자.이름})`);
      const res = await 재시도(공급자.url, {
        method: "POST",
        headers: 공급자.headers(공급자.key),
        body: JSON.stringify(공급자.요청(프롬프트, 공급자.최대토큰)),
      }).catch((e) => ({ ok: false, status: 0, text: async () => e.message }));
      if (!res.ok) {
        // 끊어 찍어 두 번 답을 잘라 먹었다 — 404 는 쓸 모델 이름을, 429 는 어느 한도인지를
        // 본문에 담아 준다. 오류는 끝까지 읽혀야 쓸모가 있다. 길어야 몇 줄이다.
        const 오류본문 = await res.text();
        console.log("생성 실패:", res.status, `(${공급자.이름})`);
        console.log(오류본문.slice(0, 2000));
        // Anthropic 은 잔액 부족을 400 으로 준다. 돈 문제로 세야 「코드를 고쳐야 한다」 일감으로 잘못 올라가지 않는다
        막힘.push(`${공급자.이름} ${/credit balance is too low/i.test(오류본문) ? 402 : res.status}`);
        continue;
      }
      const data = await res.json().catch(() => ({}));
      const text = 공급자.text(data);

      // 상한에 걸려 잘리면 JSON 이 깨진다. 그때 「JSON 으로 안 왔습니다」라고만 찍으면
      // 모델이 이상한 줄 알고 엉뚱한 데를 뒤지게 된다. 잘린 건 잘렸다고 말한다.
      if (공급자.끊겼나?.(data)) {
        console.log(`\n출력이 상한(${공급자.최대토큰} 토큰)에 걸려 잘렸습니다. 글이 끝까지 안 나왔습니다. WRITER_MAX_TOKENS 를 올리세요.`);
        막힘.push(`${공급자.이름} 잘림`);
        continue;
      }

      const 읽음 = 파싱(text);
      if (읽음.오류 || !읽음.post?.body) {
        // 앞 200자만 찍으면 원인을 못 짚는다. 잘렸는지 깨졌는지부터 갈라야 한다.
        console.log("JSON 으로 안 왔습니다:", 읽음.오류 ?? "body 없음");
        console.log(`  끝난 이유: ${data.candidates?.[0]?.finishReason ?? data.choices?.[0]?.finish_reason ?? data.stop_reason ?? "?"} · 받은 길이 ${text.length}자`);
        console.log("  앞:", text.slice(0, 110).replace(/\s+/g, " "));
        console.log("  뒤:", text.slice(-110).replace(/\s+/g, " "));
        막힘.push(`${공급자.이름} JSON 아님`);
        continue;
      }
      return { ...읽음, 막힘 };
    }
    return { post: null, 막힘 };
  };

  /** 모델이 돌려준 라벨(m1)을 실제 재료 행으로 바꾼다. uuid 를 그대로 준 경우도 받는다 */
  const 라벨풀기 = (labels, 준재료) =>
    [...new Set((Array.isArray(labels) ? labels : []).map((s) => String(s).trim()))]
      .map((s) => {
        const m = /^m(\d+)$/i.exec(s);
        return m ? 준재료[Number(m[1]) - 1] : 준재료.find((r) => r.id === s);
      })
      .filter(Boolean);

  let post, 고쳐읽음, 쓴재료, 막힘;
  for (let 회 = 1; 회 <= 2; 회++) {
    const r = await 쓰기(prompt);
    막힘 = r.막힘;
    if (!r.post) break;
    쓴재료 = 라벨풀기(r.post.쓴재료, 쓸재료);
    const g = 검사(r.post.body ?? "", { 재료들: 쓴재료 });
    if (!g.치명.length) {
      ({ post, 고쳐읽음 } = r);
      if (회 === 2) console.log("  두 번째 글은 게이트를 통과했습니다.");
      break;
    }
    const 목록 = g.치명.map((f) => `${f.why} ${f.n}곳${f.말 ? ` — ${f.말}` : ""}`);
    console.log(`\n게이트에 걸렸습니다 (${회}회차):`);
    for (const line of 목록) console.log("  ✗", line);
    if (회 === 2) {
      // 두 번 다 일반론이면 모델을 더 돌려도 같은 것이 나온다. 재료가 모자란 것이다
      console.log("\n두 번 다 걸렸습니다. 초안을 넣지 않습니다 — 원장 큐에 슬롭을 올리지 않습니다.");
      const n = await 빈손(`자동 초안이 두 번 다 치명에 걸렸습니다: ${목록.join(" · ")}`);
      await 재료일감({
        title: "재료가 필요합니다 — 자동 초안이 두 번 다 일반론이었습니다",
        detail: `치명: ${목록.join(" · ")}\n안 쓴 재료 ${재료들.length}개. 원장이 실제로 들은 말이 있어야 지어낸 장면이 안 나옵니다.`,
        payload: { unused: 재료들.length, 빈손: n, 모드: "재료", 치명: 목록 },
      });
      process.exitCode = 78;
      return;
    }
    // 재료와 주제를 바꿔 한 번만 다시 쓴다
    쓸재료 = [...쓸재료.slice(1), 쓸재료[0]].filter(Boolean);
    고른것 = 후보[1] ?? 고른것;
    console.log(`  재료와 주제를 바꿔 한 번 더 씁니다 — 주제: ${맞물림 ? 고른것.title : "(재료에서 뽑는다)"}`);
    prompt = 만들기(고른것, 쓸재료, 목록);
  }

  if (!post) {
    console.log(`\n모든 공급자가 막혔습니다: ${(막힘 ?? []).join(" · ")}`);
    // 크레딧·한도·일시 과부하로만 막혔으면 고장이 아니라 돈·시간 문제다 — 78(건너뜀)로 끝내고,
    // 충전은 측정 쪽이 올리는 크레딧 일감 한 곳에서 사람에게 넘긴다. 그 밖의 이유(400·404·JSON)면 고장이라 1
    const 돈이나한도 = (막힘 ?? []).length > 0 && 막힘.every((m) => / (402|429|503)$/.test(m));
    if (돈이나한도) console.log("크레딧이나 한도에만 막혔습니다. 대시보드의 크레딧 일감을 보세요. 다음 실행에서 다시 해 봅니다.");
    process.exitCode = 돈이나한도 ? 78 : 1;
    return;
  }
  if (고쳐읽음) console.log("  (본문에 진짜 줄바꿈이 들어와 고쳐 읽었습니다)");

  // 스스로 검사한다. 어휘는 slop-check 가 뒤에서 보고, 여기서는 짜임새를 본다.
  // 넣기는 넣되 무엇이 모자란지 같이 남긴다 — 사람이 고칠지 다시 돌릴지 정한다.
  const 본문 = post.body ?? "";
  const 흠 = 공통짜임새(본문);
  // 하한만 보고 상한을 안 봐서 4,255자짜리를 「걸린 데 없음」으로 통과시켰다(2026-09-12, qwen3.8-27b).
  if (본문.length < 1800) 흠.push(`본문 ${본문.length}자 — 1,800자에 못 미칩니다. 판단 기준이 모자랍니다`);
  if (본문.length > 2800) 흠.push(`본문 ${본문.length}자 — 2,800자를 넘었습니다. 늘어지면 잘라 인용하기가 나빠집니다`);
  // 지역이 없으면 동네 검색어에서 안 잡힌다. topic-gap 이 내내 지적해 온 것이다.
  const 동네주제 = /송파|잠실|석촌|가락/.test(`${고른것.title} ${(고른것.tags ?? []).join(" ")}`);
  if (동네주제 && !/송파|잠실|석촌|가락|헬리오/.test(본문)) {
    흠.push("본문에 지역이 한 번도 안 나옵니다 — 동네 검색어를 겨냥한 글인데 지역이 없으면 안 잡힙니다");
  }

  let slug = 고른것.id;
  if (QUESTION || !맞물림 || !slug) {
    // 질문 모드·재료 주제는 기존 글을 절대 덮어쓰지 않는다. 겹치면 뒤에 번호를 붙인다
    const 기본 = /^[a-z0-9]+(-[a-z0-9]+)*$/.test(post.slug ?? "") && post.slug.length <= 60
      ? post.slug
      : `material-${new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" }).replace(/-/g, "")}`;
    slug = 기본;
    for (let n = 2; (await q(`select 1 from academy.posts where slug=$1`, [slug])).length; n++) slug = `${기본}-${n}`;
    await q(
      `insert into academy.posts (slug,title,summary,body,category,tags,published,client_id,updated_at)
       values ($1,$2,$3,$4,$5,$6,false,$7,now())`,
      [slug, post.title, post.summary, post.body, 고른것.category, post.tags ?? [], CLIENT],
    );
  } else {
    await q(
      `insert into academy.posts (slug,title,summary,body,category,tags,published,client_id,updated_at)
       values ($1,$2,$3,$4,$5,$6,false,$7,now())
       on conflict (slug) do update set
         title=excluded.title, summary=excluded.summary, body=excluded.body,
         tags=excluded.tags, updated_at=now()`,
      [slug, post.title, post.summary, post.body, 고른것.category, post.tags ?? 고른것.tags, CLIENT],
    );
  }

  // 쓴 재료에 이 글을 적는다. 안 적으면 다음 주에 같은 재료로 또 쓴다
  if (쓴재료.length) {
    await q(`update academy.materials set used_in = used_in || $1::text[] where id = any($2::uuid[])`,
      [[slug], 쓴재료.map((m) => m.id)]).catch((e) => console.log("  ⚠ 재료에 쓴 글을 못 적었습니다:", e.message.slice(0, 90)));
  }

  // 검토 화면(/admin/drafts)이 읽는다. 콘솔에만 찍으면 원장은 볼 길이 없다
  await q(
    `update academy.posts set review_notes = $2::jsonb where slug = $1 and not published`,
    [slug, JSON.stringify({
      확인필요: post.확인필요 ?? [],
      짜임새: 흠,
      모델: 공급자.model,
      모드: "재료",
      쓴재료: 쓴재료.map((m) => m.id),
      재료말: 쓴재료.map((m) => m.said.slice(0, 80)),
      질문: QUESTION ?? null,
      경쟁출처: SOURCES,
      쓴날: new Date().toISOString(),
    })],
  ).catch((e) => console.log("  ⚠ 검토 메모를 못 남겼습니다:", e.message));
  await 다시돎();
  console.log(`DRAFT_SLUG=${slug}`);

  // Actions 가 이 슬러그로 AI 티 검사를 돌린다. 안 넘기면 발행된 글만 보고
  // 정작 방금 쓴 초안은 건너뛴다 — 「0편에서 걸림」이 이 글 얘기인 줄 알게 된다.
  if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `slug=${slug}\n`);

  console.log(`\n초안으로 넣었습니다: ${post.title} (${본문.length}자)`);
  console.log(`쓴 재료 ${쓴재료.length}개: ${쓴재료.map((m) => `「${m.said.slice(0, 24)}…」`).join(" ") || "없음"}`);
  console.log("발행은 사람이 합니다. 확인이 필요한 문장:");
  for (const s of post.확인필요 ?? []) console.log("  ·", s);
  if (흠.length) {
    console.log("\n짜임새에서 걸린 것:");
    for (const h of 흠) console.log("  ✗", h);
  } else {
    console.log("\n짜임새는 걸린 데가 없습니다.");
  }

  console.log("\n어휘 검사: node scripts/slop-check.mjs " + slug);
  console.log("치명 검사: node scripts/slop-check.mjs --strict " + slug);
  console.log("숫자 검사: node scripts/fact-check.mjs " + slug);
  console.log("본문 읽기: node scripts/draft-peek.mjs " + slug);
};

main()
  .catch((e) => {
    console.log("실패:", e.message.slice(0, 200));
    process.exitCode = 1;
  })
  .finally(() => pool.end());
