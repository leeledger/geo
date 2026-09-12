/**
 * 주간 글 초안을 스스로 쓴다.
 *
 * 고리의 빈자리를 메운다. 지금 자동으로 도는 넷(정찰·노출측정·스냅샷·브리핑)은
 * 전부 「재는 일」이다. 「쓰는 일」에는 담당이 없어서 사람이 멈추면 발행도 멈춘다.
 *
 * 순서
 *   1. 주제를 고른다   — topics.json 에서 안 쓴 것 중, 지고 있는 검색어를 겨냥하는 것 우선
 *   2. 근거를 모은다   — who-wins(그 자리에서 무엇이 이기는가) · 기존 글(겹치는 주장) · 측정 숫자
 *   3. 초안을 쓴다     — Claude. 금지 표현은 slop-check 가 잡는 것과 같은 목록을 미리 준다
 *   4. 스스로 검사한다 — slop-check 규칙으로 1차 거름. 걸리면 한 번 고쳐 쓴다
 *   5. 초안으로 넣는다 — published=false. 발행은 사람이 한다
 *
 * 발행까지 자동으로 하지 않는다. CLAUDE.md 의 「사람만 할 수 있는 일 — 발행 전 사실 확인」이고,
 * 지어낸 문장 하나가 다른 문서와 어긋나면 레퍼런스 전체가 죽는다.
 * 그래서 이 스크립트는 「사실 확인이 필요한 문장」을 따로 뽑아 같이 남긴다.
 *
 *   node scripts/write-draft.mjs            주제를 골라 초안까지
 *   node scripts/write-draft.mjs --dry      고른 주제와 프롬프트만 보고 멈춘다 (키 없이 됨)
 *   node scripts/write-draft.mjs --topic <id>   주제를 직접 지정
 *
 * 모델은 키가 있는 쪽을 쓴다. GROQ_API_KEY 든 ANTHROPIC_API_KEY 든 된다.
 * 둘 다 있으면 WRITER_PROVIDER=groq|anthropic, 모델은 WRITER_MODEL 로 바꾼다.
 */
import fs from "node:fs";
import { Pool } from "pg";

for (const l of fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8").split(/\r?\n/)) {
  const m = /^([A-Z_]+)=(.*)$/.exec(l);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

const DRY = process.argv.includes("--dry");
// indexOf 가 -1 일 때 +1 하면 argv[0](node 경로)을 주제로 읽는다. 한 번 당했다.
const TI = process.argv.indexOf("--topic");
const WANT = TI >= 0 ? process.argv[TI + 1] : null;
const CLIENT = 1;

/**
 * 어느 모델로 쓰는가. 키가 있는 쪽을 쓴다. 둘 다 있으면 WRITER_PROVIDER 로 고른다.
 *
 * 이 일은 모델을 크게 타지 않는다 — 프롬프트 1.5K 토큰, 출력 4K, 주 1편.
 * 갈리는 건 난이도가 아니라 「안 쓰는 능력」이다. slop-check 가 잡는 8종을 안 쓰고
 * 확인된 숫자 밖으로 안 나가는 것. 그건 돌려 보고 재면 된다.
 *
 * Groq 은 무료 한도가 있어 0원으로 시작할 수 있다. 초안은 어차피 사람이 사실 확인을
 * 하고 나가니, 문장이 뻣뻣해도 레퍼런스가 다치는 길은 막혀 있다.
 * 모델 이름은 자주 바뀐다. 거절당하면 Groq 문서에서 확인해 WRITER_MODEL 로 넘긴다.
 */
const 공급자 = (() => {
  const pick =
    process.env.WRITER_PROVIDER ||
    (process.env.ANTHROPIC_API_KEY ? "anthropic" : process.env.GROQ_API_KEY ? "groq" : null);

  if (pick === "groq") {
    return {
      이름: "groq",
      key: process.env.GROQ_API_KEY,
      url: "https://api.groq.com/openai/v1/chat/completions",
      // 무료 한도표(2026-09-12 확인)에 글쓰기로 쓸 만한 건 넷뿐이다.
      // gpt-oss-120b 120B · gpt-oss-20b 20B · qwen3.8-27b 27B — 셋 다 8K TPM.
      // groq/compound 는 70K TPM 이지만 도구를 스스로 부르는 에이전트형이라
      // 「JSON 하나만」이 안 지켜질 수 있다. 제일 큰 것을 기본으로 둔다.
      // 한국어가 뻣뻣하면 WRITER_MODEL=qwen/qwen3.8-27b 로 바꿔 재 본다.
      model: process.env.WRITER_MODEL || "openai/gpt-oss-120b",
      // TPM 8,000 은 프롬프트와 출력을 합쳐서 센다. 프롬프트가 2.4천자(≈1.5K 토큰)라
      // 출력은 6,000 까지가 한계다. 본문 2,800자면 출력만 4천 토큰 가까이 나온다.
      최대토큰: Number(process.env.WRITER_MAX_TOKENS) || 6000,
      headers: (k) => ({ "content-type": "application/json", authorization: `Bearer ${k}` }),
      text: (d) => {
        const m = d.choices?.[0]?.message ?? {};
        return m.content || m.reasoning || "";
      },
      끊겼나: (d) => d.choices?.[0]?.finish_reason === "length",
    };
  }
  if (pick === "anthropic") {
    return {
      이름: "anthropic",
      key: process.env.ANTHROPIC_API_KEY,
      url: "https://api.anthropic.com/v1/messages",
      model: process.env.WRITER_MODEL || "claude-opus-5",
      최대토큰: Number(process.env.WRITER_MAX_TOKENS) || 6000,
      headers: (k) => ({ "content-type": "application/json", "x-api-key": k, "anthropic-version": "2023-06-01" }),
      text: (d) => (d.content ?? []).map((c) => c.text ?? "").join(""),
      끊겼나: (d) => d.stop_reason === "max_tokens",
    };
  }
  return null;
})();

const u = new URL(process.env.DATABASE_URL);
u.searchParams.delete("sslmode");
const pool = new Pool({ connectionString: u.toString(), ssl: { rejectUnauthorized: false } });
const q = (sql, p = []) => pool.query(sql, p).then((r) => r.rows);

/** slop-check 가 잡는 것과 같은 목록. 사후에 잡느니 미리 안 쓰게 한다. */
const 금지 = [
  "「오늘은 ~에 대해 알아보겠습니다」 같은 서론. 첫 문장부터 본론으로",
  "「먼저 / 다음으로 / 마지막으로」로 순서를 까는 것",
  "「정말 중요합니다」 「매우 유익합니다」 같은 빈 강조",
  "「~라고 할 수 있습니다」 「~인 것 같습니다」 로 흐리게 닫기",
  "「다양한」 「여러 가지」 「많은」 — 숫자를 알면 숫자를 쓴다",
  "「놀라운」 「혁신적인」 「필수적인」 같은 과장",
  "양쪽 다 맞다는 양비론. 어느 쪽인지 말한다",
  "검색하면 아무나 쓸 수 있는 일반론",
  "「~하는 것이 바람직하다」 「~하는 것이 현명하다」 같은 훈계조 닫기",
];

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
 * 지어내기를 막는 자리. 규칙 목록에 한 줄로 끼워 두면 모델이 흘려 넘긴다.
 * 실제로 그랬다 — 「확인된 숫자만」이라고 썼는데 없는 설문을 만들어 왔다(2026-09-12, gpt-oss-120b).
 * 구멍을 남겨 두면 채운다. 그래서 「모르면 이렇게 써라」까지 준다.
 */
const 지어내기금지 = [
  "확인된 숫자 밖의 숫자는 한 개도 쓰지 않는다. 반 인원·비율·기간·가격 전부.",
  "설문·조사·통계를 만들어 내지 않는다. 우리는 설문을 한 적이 없다.",
  "겪지 않은 수업 장면을 겪은 것처럼 쓰지 않는다. 어떤 교구를 쓰는지 너는 모른다.",
  "모르는 것은 모른다고 쓴다. 숫자로 채우지 말고 판단 기준만 준다.",
  "  나쁜 예: 「8명 이하가 적당하다」 「응답자의 40%가 그만뒀다」",
  "  좋은 예: 「한 반 인원을 물어보세요. 몇 명부터 질문이 밀리는지도 같이 물으면 답이 분명해집니다」",
  "주제의 「각도」가 상담에서 들은 이야기를 요구해도, 너에게 그 기록이 없으면 지어내지 말고 학부모가 직접 확인할 방법으로 바꿔 쓴다.",
];

/**
 * 모델이 본문에 진짜 줄바꿈을 넣어 보내면 그건 JSON 이 아니다.
 * 마크다운 본문을 JSON 문자열에 담으라고 시키면 자주 이런다 (qwen3.8-27b, 2026-09-12).
 * 모델 탓이 아니라 파서가 약한 것이다. 따옴표 안인지 밖인지만 따라가며 고친다.
 */
const 줄바꿈고치기 = (s) => {
  let out = "";
  let 따옴표안 = false;
  let 이스케이프 = false;
  for (const ch of s) {
    if (이스케이프) { out += ch; 이스케이프 = false; continue; }
    if (ch === "\\") { out += ch; 이스케이프 = true; continue; }
    if (ch === '"') { 따옴표안 = !따옴표안; out += ch; continue; }
    if (따옴표안 && (ch === "\n" || ch === "\r" || ch === "\t")) {
      out += ch === "\n" ? "\\n" : ch === "\r" ? "\\r" : "\\t";
      continue;
    }
    out += ch;
  }
  return out;
};

const main = async () => {
  // ── 1. 주제
  const bank = JSON.parse(fs.readFileSync(new URL("../content/topics.json", import.meta.url), "utf8"));
  const 남은것 = bank.topics.filter((t) => !t.slug);
  if (남은것.length === 0) {
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
  const 고른것 = WANT
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

  const 숫자 = await q(
    `select
       (select count(*) from academy.posts where client_id=$1 and published)::int 글수,
       (select count(*) from academy.crawl_hits where client_id=$1)::int 크롤러방문
    `,
    [CLIENT],
  ).catch(() => [{}]);

  const prompt = [
    "너는 송파구에서 코딩·로봇 학원을 운영하는 원장이다. 학부모가 읽을 글을 직접 쓴다.",
    "광고가 아니라 판단 기준을 주는 글이다. 읽고 나서 우리 학원에 안 와도 도움이 됐으면 그걸로 됐다.",
    "",
    `# 이번 주제\n${고른것.title}\n각도: ${고른것.angle}\n분류: ${고른것.category}\n태그: ${(고른것.tags ?? []).join(", ")}`,
    "",
    `# 지켜야 할 것\n- ${규칙.join("\n- ")}`,
    "",
    "# 절대 지어내지 않는다 (이걸 어기면 글을 통째로 버린다)\n" +
      지어내기금지.map((s) => (s.startsWith("  ") ? s : `- ${s}`)).join("\n"),
    "",
    `# 쓰면 안 되는 것 (하나라도 있으면 광고로 분류된다)\n- ${금지.join("\n- ")}`,
    "",
    `# 확인된 숫자 (이 밖의 숫자는 쓰지 않는다)\n- 공개한 글 ${숫자[0]?.글수 ?? "?"}편\n- AI·검색 크롤러 누적 방문 ${숫자[0]?.크롤러방문 ?? "?"}회`,
    "",
    `# 이미 쓴 글 (주장이 겹치면 안 된다)\n${기존글.map((p) => `- ${p.title} — ${p.summary ?? ""}`).join("\n")}`,
    "",
    `# 지금 지고 있는 검색어\n${지는검색어.map((r) => `- ${r.query}`).join("\n") || "- (측정 없음)"}`,
    "",
    "# 내놓을 형식 (JSON 하나만, 다른 말 없이)",
    `{"title": "질문형 제목", "summary": "결론 한두 줄", "tags": ["5개"], "body": "마크다운 본문", "확인필요": ["내가 지어냈을 수 있어 원장 확인이 필요한 문장"]}`,
    "",
    "확인필요 에는 상담·수업에서 실제로 있었던 일처럼 쓴 문장을 빠짐없이 넣어라.",
    "네가 겪지 않은 일을 겪은 것처럼 쓰면 발행 전에 걸러야 한다.",
  ].join("\n");

  if (DRY) {
    // 키가 없어도 어느 쪽으로 붙을지는 여기서 확인된다. 호출은 안 한다.
    console.log(`  쓸 모델: ${공급자 ? `${공급자.model} (${공급자.이름})` : "없음 — 키가 하나도 없습니다"}`);
    console.log(`\n── 프롬프트 (${prompt.length}자) ──\n`);
    console.log(prompt);
    console.log("\n--dry 라 여기서 멈춥니다. 실제 생성은 GROQ_API_KEY 나 ANTHROPIC_API_KEY 가 있어야 합니다.");
    return;
  }

  if (!공급자?.key) {
    console.log("\n키가 없습니다. 초안을 쓰지 못합니다. 둘 중 하나를 GitHub Secrets 에 넣으면 주 1회 자동으로 돕니다.");
    console.log("  GROQ_API_KEY       무료 한도가 있어 0원으로 시작할 수 있습니다. 한국어 맵시는 떨어집니다");
    console.log("  ANTHROPIC_API_KEY  월 4편 기준 4,037~8,187원 (api-cost.mjs)");
    console.log("어느 쪽이든 초안까지입니다. 발행 전 사실 확인은 사람이 합니다.");
    process.exitCode = 78; // 설정 없음 — 실패와 구분한다
    return;
  }
  console.log(`  쓰는 모델: ${공급자.model} (${공급자.이름})`);

  const res = await fetch(공급자.url, {
    method: "POST",
    headers: 공급자.headers(공급자.key),
    // 두 쪽 다 OpenAI 계열 필드를 받는다. max_tokens 이름도 같다.
    body: JSON.stringify({
      model: 공급자.model,
      max_tokens: 공급자.최대토큰,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) {
    console.log("생성 실패:", res.status, (await res.text()).slice(0, 200));
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

  const 껍질벗김 = text.replace(/```(?:json)?/g, "");
  const json = 껍질벗김.slice(껍질벗김.indexOf("{"), 껍질벗김.lastIndexOf("}") + 1);
  let post;
  try {
    post = JSON.parse(json);
  } catch {
    try {
      post = JSON.parse(줄바꿈고치기(json));
      console.log("  (본문에 진짜 줄바꿈이 들어와 고쳐 읽었습니다)");
    } catch (e) {
      // 앞 200자만 찍으면 원인을 못 짚는다. 잘렸는지 깨졌는지부터 갈라야 한다.
      console.log("JSON 으로 안 왔습니다:", e.message.slice(0, 80));
      console.log(`  끝난 이유: ${data.choices?.[0]?.finish_reason ?? data.stop_reason ?? "?"} · 받은 길이 ${text.length}자`);
      console.log("  앞:", text.slice(0, 110).replace(/\s+/g, " "));
      console.log("  뒤:", text.slice(-110).replace(/\s+/g, " "));
      process.exitCode = 1;
      return;
    }
  }

  // 스스로 검사한다. 어휘는 slop-check 가 뒤에서 보고, 여기서는 짜임새를 본다.
  // 넣기는 넣되 무엇이 모자란지 같이 남긴다 — 사람이 고칠지 다시 돌릴지 정한다.
  const 본문 = post.body ?? "";
  const 흠 = [];
  // 하한만 보고 상한을 안 봐서 4,255자짜리를 「걸린 데 없음」으로 통과시켰다(2026-09-12, qwen3.8-27b).
  if (본문.length < 1800) 흠.push(`본문 ${본문.length}자 — 1,800자에 못 미칩니다. 판단 기준이 모자랍니다`);
  if (본문.length > 2800) 흠.push(`본문 ${본문.length}자 — 2,800자를 넘었습니다. 늘어지면 잘라 인용하기가 나빠집니다`);
  if (/^#+\s*\*\*/m.test(본문)) 흠.push("소제목에 ** 를 겹쳐 썼습니다");

  // 한국어만 쓰는 모델이 아니면 한자·영어가 새어 나온다.
  // qwen3.8-27b 이 「최대几名까지」 「화면을转播하는」 「Instead, 부장님이」를 뱉었다(2026-09-12).
  // 사람이 읽으면 바로 보이는데 어휘 검사에는 안 걸린다. 기계로 잡히는 건 기계가 잡는다.
  const 한자 = 본문.match(/[一-鿿]+/g);
  if (한자) 흠.push(`한자가 섞였습니다: ${[...new Set(한자)].slice(0, 5).join(" ")}`);
  const 영어 = 본문.match(/(?<=[가-힣\s])(?:Instead|However|Therefore|Moreover|Furthermore|or|and|but)(?=[\s,.])/g);
  if (영어) 흠.push(`영어가 섞였습니다: ${[...new Set(영어)].slice(0, 5).join(" ")}`);
  if (/##\s*\**\s*(마무리|결론|정리)/.test(본문)) 흠.push("「마무리」 문단 — 앞에서 한 말을 다시 합니다");
  // 지역이 없으면 동네 검색어에서 안 잡힌다. topic-gap 이 내내 지적해 온 것이다.
  const 동네주제 = /송파|잠실|석촌|가락/.test(`${고른것.title} ${(고른것.tags ?? []).join(" ")}`);
  if (동네주제 && !/송파|잠실|석촌|가락|헬리오/.test(본문)) {
    흠.push("본문에 지역이 한 번도 안 나옵니다 — 동네 검색어를 겨냥한 글인데 지역이 없으면 안 잡힙니다");
  }

  const slug = 고른것.id;
  await q(
    `insert into academy.posts (slug,title,summary,body,category,tags,published,client_id,updated_at)
     values ($1,$2,$3,$4,$5,$6,false,$7,now())
     on conflict (slug) do update set
       title=excluded.title, summary=excluded.summary, body=excluded.body,
       tags=excluded.tags, updated_at=now()`,
    [slug, post.title, post.summary, post.body, 고른것.category, post.tags ?? 고른것.tags, CLIENT],
  );

  // Actions 가 이 슬러그로 AI 티 검사를 돌린다. 안 넘기면 발행된 글만 보고
  // 정작 방금 쓴 초안은 건너뛴다 — 「0편에서 걸림」이 이 글 얘기인 줄 알게 된다.
  if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `slug=${slug}\n`);

  console.log(`\n초안으로 넣었습니다: ${post.title} (${(post.body ?? "").length}자)`);
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
