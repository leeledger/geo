/**
 * 관점 글 초안을 스스로 쓴다. 바깥 소식으로 여는 뉴스 글은 write-news.mjs 가 쓴다.
 *
 * 고리의 빈자리를 메운다. 자동으로 도는 넷(정찰·노출측정·스냅샷·브리핑)은
 * 전부 「재는 일」이다. 「쓰는 일」에는 담당이 없어서 사람이 멈추면 발행도 멈춘다.
 *
 * 순서
 *   1. 주제를 고른다   — topics.json 에서 안 쓴 것 중, 지고 있는 검색어를 겨냥하는 것 우선
 *   2. 근거를 모은다   — 기존 글(겹치는 주장) · 지고 있는 검색어
 *   3. 초안을 쓴다     — 금지 표현은 slop-check 가 잡는 것과 같은 목록을 미리 준다
 *   4. 스스로 검사한다 — 짜임새를 본다. 어휘는 slop-check 가 뒤에서 본다
 *   5. 초안으로 넣는다 — published=false. 발행은 사람이 한다
 *
 * 발행까지 자동으로 하지 않는다. CLAUDE.md 의 「사람만 할 수 있는 일 — 발행 전 사실 확인」이고,
 * 지어낸 문장 하나가 다른 문서와 어긋나면 레퍼런스 전체가 죽는다.
 * 그래서 이 스크립트는 「사실 확인이 필요한 문장」을 따로 뽑아 같이 남긴다.
 *
 *   node scripts/write-draft.mjs                주제를 골라 초안까지
 *   node scripts/write-draft.mjs --dry          고른 주제와 프롬프트만 보고 멈춘다 (키 없이 됨)
 *   node scripts/write-draft.mjs --topic <id>   주제를 직접 지정
 *
 * 모델은 키가 있는 쪽을 쓴다 (anthropic → gemini → groq).
 * WRITER_PROVIDER·WRITER_MODEL·WRITER_MAX_TOKENS 로 바꾼다.
 */
import fs from "node:fs";
import { Pool } from "pg";
import { 공급자만들기, 공급자들, 금지, 지어내기금지, 파싱, 공통짜임새, 재시도 } from "./writer-common.mjs";

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

const main = async () => {
  // ── 1. 주제
  const bank = JSON.parse(fs.readFileSync(new URL("../content/topics.json", import.meta.url), "utf8"));
  const 남은것 = bank.topics.filter((t) => !t.slug);
  if (!QUESTION && 남은것.length === 0) {
    console.log("주제 은행이 비었습니다. content/topics.json 에 주제를 채우세요.");
    return;
  }

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
  const 핵심어 = [
    ...new Set(
      지는검색어.flatMap((r) =>
        r.query.split(/\s+/).map((w) => w.replace(/[^가-힣a-zA-Z0-9]/g, "")).filter((w) => w && !STOP.has(w)),
      ),
    ),
  ];

  const 점수 = (t) => {
    const hay = `${t.title} ${(t.tags ?? []).join(" ")} ${t.angle ?? ""}`;
    return 핵심어.filter((k) => hay.includes(k)).length;
  };
  const 고른것 = QUESTION
    ? {
        id: null,
        title: QUESTION,
        angle: "학부모가 AI 에게 이 질문을 그대로 했는데 우리 사이트가 답에 안 나왔다. " +
          "이 질문에 곧장 답하는 글이어야 한다. 첫 문단에서 질문에 대한 판단을 먼저 말한다." +
          (SOURCES.length ? ` 대신 인용된 곳: ${SOURCES.join(", ")} — 그들이 못 주는 판단 기준을 준다. 베끼지 않는다.` : ""),
        category: STAGE === "local" || STAGE === "brand" ? "학부모안내" : "교육관점",
        tags: [],
      }
    : WANT
      ? 남은것.find((t) => t.id === WANT)
      : [...남은것].sort((a, b) => 점수(b) - 점수(a))[0];
  if (!고른것) {
    console.log(`주제 ${WANT} 를 못 찾았습니다.`);
    return;
  }
  console.log(`주제: ${고른것.title}`);
  console.log(`  고른 이유: 지고 있는 검색어 핵심어 ${점수(고른것)}개와 맞물림 (${핵심어.join(" ") || "없음"})`);

  // ── 2. 근거
  const 기존글 = await q(
    `select title, summary from academy.posts
      where client_id = $1 and published and source_url is null
      order by published_at desc limit 12`,
    [CLIENT],
  ).catch(() => []);

  /**
   * 슬롭이 나오는 가장 큰 이유는 재료가 없어서다. 모델에게 일반론밖에 줄 게 없으면 일반론을 쓴다.
   * 그래서 이 글에만 있는 것을 준다 — 상담에서 실제로 나온 말, 그리고 AI 가 이 질문에 실제로 뭐라고 답했는지.
   */
  const 상담말 = await q(
    `select said, source from academy.inquiries
      where client_id = $1 and coalesce(said,'') <> '' order by day desc limit 8`, [CLIENT]).catch(() => []);
  const [측정] = QUESTION
    ? await q(
        `select coalesce(raw->>'answer','') answer,
                (select string_agg(distinct c->>'domain', ', ') from jsonb_array_elements(citations) c) doms
           from academy.ai_measurements
          where client_id = $1 and prompt_text = $2 order by measured_on desc limit 1`, [CLIENT, QUESTION]).catch(() => [])
    : [];

  const prompt = [
    "너는 송파구에서 코딩·로봇 학원을 운영하는 원장이다. 학부모가 읽을 글을 직접 쓴다.",
    "광고가 아니라 판단 기준을 주는 글이다. 읽고 나서 우리 학원에 안 와도 도움이 됐으면 그걸로 됐다.",
    "",
    `# 이번 주제\n${고른것.title}\n각도: ${고른것.angle}\n분류: ${고른것.category}\n태그: ${(고른것.tags ?? []).join(", ")}`,
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
      "  좋은 예: 「한 반 인원을 물어보세요. 몇 명부터 질문이 밀리는지도 같이 물으면 답이 분명해집니다」",
    "",
    상담말.length
      ? `# 상담에서 실제로 들은 말 (첫 문장은 이 중 하나에서 연다. 없는 말을 지어 붙이지 마라)\n${상담말.map((r) => `- 「${r.said}」 (${r.source})`).join("\n")}`
      : "# 상담에서 들은 말\n- 기록이 없다. 그러면 상담 장면을 지어내지 말고, 질문 자체로 연다.",
    "",
    측정?.answer
      ? `# AI 가 이 질문에 지금 이렇게 답한다 (우리 학원은 안 나온다)\n` +
        `${측정.answer.slice(0, 1800)}\n\n` +
        `대신 인용된 곳: ${측정.doms ?? "없음"}\n` +
        "이 답에서 비어 있는 것 — 판단 기준, 확인할 질문, 안 맞는 경우 — 을 채우는 글을 쓴다. 저 답을 요약하거나 베끼지 마라."
      : "",
    "",
    `# 이미 쓴 글 (주장이 겹치면 안 된다)\n${기존글.map((p) => `- ${p.title} — ${p.summary ?? ""}`).join("\n")}`,
    "",
    `# 지금 지고 있는 검색어\n${지는검색어.map((r) => `- ${r.query}`).join("\n") || "- (측정 없음)"}`,
    "",
    "# 내놓을 형식 (JSON 하나만, 다른 말 없이)",
    QUESTION
      ? `{"title": "질문형 제목", "slug": "제목을 로마자로 옮긴 주소. 소문자·숫자·하이픈만, 60자 이하 (예: koding-hagwon-goreugi)", "summary": "결론 한두 줄", "tags": ["5개"], "body": "마크다운 본문", "확인필요": ["내가 지어냈을 수 있어 원장 확인이 필요한 문장"]}`
      : `{"title": "질문형 제목", "summary": "결론 한두 줄", "tags": ["5개"], "body": "마크다운 본문", "확인필요": ["내가 지어냈을 수 있어 원장 확인이 필요한 문장"]}`,
    "",
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

  if (DRY) {
    // 키가 없어도 어느 쪽으로 붙을지는 여기서 확인된다. 호출은 안 한다.
    console.log(`  쓸 모델: ${공급자 ? `${공급자.model} (${공급자.이름})` : "없음 — 키가 하나도 없습니다"}`);
    console.log(`\n── 프롬프트 (${prompt.length}자) ──\n`);
    console.log(prompt);
    console.log("\n--dry 라 여기서 멈춥니다. 실제 생성은 키가 있어야 합니다.");
    return;
  }

  if (!공급자?.key) {
    console.log("\n키가 없습니다. 초안을 쓰지 못합니다. 하나만 GitHub Secrets 에 넣으면 주 1회 자동으로 돕니다.");
    console.log("  GEMINI_API_KEY     무료 한도 있음. 무료 중에 한국어가 제일 낫다 (aistudio.google.com)");
    console.log("  ANTHROPIC_API_KEY  월 4편 기준 4,037~8,187원 (api-cost.mjs)");
    console.log("  GROQ_API_KEY       무료지만 오픈웨이트뿐이라 한국어가 깨진다 (2026-09-12 측정, BUILD-LOG)");
    console.log("어느 쪽이든 초안까지입니다. 발행 전 사실 확인은 사람이 합니다.");
    process.exitCode = 78; // 설정 없음 — 실패와 구분한다
    return;
  }
  // 앞 공급자가 막히면 다음으로 넘어간다. 하나에 매달리면 한도 하나에 주 1편이 통째로 선다
  let res;
  const 막힘 = [];
  for (const 후보 of 공급자들()) {
    공급자 = 후보;
    console.log(`  쓰는 모델: ${공급자.model} (${공급자.이름})`);
    res = await 재시도(공급자.url, {
      method: "POST",
      headers: 공급자.headers(공급자.key),
      body: JSON.stringify(공급자.요청(prompt, 공급자.최대토큰)),
    });
    if (res.ok) break;
    // 끊어 찍어 두 번 답을 잘라 먹었다 — 404 는 쓸 모델 이름을, 429 는 어느 한도인지를
    // 본문에 담아 준다. 오류는 끝까지 읽혀야 쓸모가 있다. 길어야 몇 줄이다.
    const 오류본문 = await res.text();
    console.log("생성 실패:", res.status, `(${공급자.이름})`);
    console.log(오류본문.slice(0, 2000));
    막힘.push(`${공급자.이름} ${res.status}`);
  }
  if (!res?.ok) {
    console.log(`\n모든 공급자가 막혔습니다: ${막힘.join(" · ")}`);
    // 예비가 있는데도 다 막혔으면 조용히 넘기지 않는다 — 회사 루프가 실패를 보고 운영 일감으로 올린다
    process.exitCode = 1;
    return;
  }
  const data = await res.json();
  const text = 공급자.text(data);

  // 상한에 걸려 잘리면 JSON 이 깨진다. 그때 「JSON 으로 안 왔습니다」라고만 찍으면
  // 모델이 이상한 줄 알고 엉뚱한 데를 뒤지게 된다. 잘린 건 잘렸다고 말한다.
  if (공급자.끊겼나?.(data)) {
    console.log(`\n출력이 상한(${공급자.최대토큰} 토큰)에 걸려 잘렸습니다. 글이 끝까지 안 나왔습니다.`);
    console.log("WRITER_MAX_TOKENS 를 올리세요. 단 Groq 무료는 프롬프트까지 합쳐 분당 8,000 토큰입니다.");
    process.exitCode = 1;
    return;
  }

  const { post, 고쳐읽음, 오류 } = 파싱(text);
  if (오류) {
    // 앞 200자만 찍으면 원인을 못 짚는다. 잘렸는지 깨졌는지부터 갈라야 한다.
    console.log("JSON 으로 안 왔습니다:", 오류);
    console.log(`  끝난 이유: ${data.candidates?.[0]?.finishReason ?? data.choices?.[0]?.finish_reason ?? data.stop_reason ?? "?"} · 받은 길이 ${text.length}자`);
    console.log("  앞:", text.slice(0, 110).replace(/\s+/g, " "));
    console.log("  뒤:", text.slice(-110).replace(/\s+/g, " "));
    process.exitCode = 1;
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
  if (QUESTION) {
    // 질문 모드는 기존 글을 절대 덮어쓰지 않는다. 겹치면 뒤에 번호를 붙인다
    const 기본 = /^[a-z0-9]+(-[a-z0-9]+)*$/.test(post.slug ?? "") && post.slug.length <= 60
      ? post.slug
      : `ai-question-${new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" }).replace(/-/g, "")}`;
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
  // 검토 화면(/admin/drafts)이 읽는다. 콘솔에만 찍으면 원장은 볼 길이 없다
  await q(
    `update academy.posts set review_notes = $2::jsonb where slug = $1 and not published`,
    [slug, JSON.stringify({ 확인필요: post.확인필요 ?? [], 짜임새: 흠, 모델: 공급자.model, 질문: QUESTION ?? null, 경쟁출처: SOURCES, 쓴날: new Date().toISOString() })],
  ).catch((e) => console.log("  ⚠ 검토 메모를 못 남겼습니다:", e.message));
  console.log(`DRAFT_SLUG=${slug}`);

  // Actions 가 이 슬러그로 AI 티 검사를 돌린다. 안 넘기면 발행된 글만 보고
  // 정작 방금 쓴 초안은 건너뛴다 — 「0편에서 걸림」이 이 글 얘기인 줄 알게 된다.
  if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `slug=${slug}\n`);

  console.log(`\n초안으로 넣었습니다: ${post.title} (${본문.length}자)`);
  console.log("발행은 사람이 합니다. 확인이 필요한 문장:");
  for (const s of post.확인필요 ?? []) console.log("  ·", s);
  if (흠.length) {
    console.log("\n짜임새에서 걸린 것:");
    for (const h of 흠) console.log("  ✗", h);
  } else {
    console.log("\n짜임새는 걸린 데가 없습니다.");
  }

  console.log("\n어휘 검사: node scripts/slop-check.mjs " + slug);
  console.log("숫자 검사: node scripts/fact-check.mjs " + slug);
  console.log("본문 읽기: node scripts/draft-peek.mjs " + slug);
};

main()
  .catch((e) => {
    console.log("실패:", e.message.slice(0, 200));
    process.exitCode = 1;
  })
  .finally(() => pool.end());
