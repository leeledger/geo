/**
 * 바깥 사실로 여는 글을 쓴다. 관점 글이 아니라 뉴스 글이다.
 *
 * 왜 따로 만드나. 관점 글(write-draft)은 「학원 고르는 기준」을 주는 틀인데,
 * 그 틀은 학원 이름을 한 번도 안 써도 결국 「우리는 그 조건을 충족한다」는 광고가 된다.
 * 원장님 지적이 맞았다 — 제미나이 초안이 딱 그랬다(2026-09-12).
 *
 * 원장님이 직접 쓰신 글 중에 제일 나은 결이 이것이다:
 *   「2025년부터 코딩 교육이 의무화 됩니다」 — 교육부 「디지털 인재 양성 종합 방안」으로 열고
 *   (초등 34시간·중등 68시간), 그게 무슨 뜻인지 풀고, 학원 이야기는 맨 끝 서명뿐이다.
 * 검증되는 사실이 앞에 있으면 광고가 아니라 정보가 된다.
 *
 * 규칙이 관점 글과 정반대인 곳이 있다.
 *   관점 글 — 숫자를 쓰지 마라 (잰 게 없으니까)
 *   뉴스 글 — 숫자를 써라. 단 출처가 붙은 것만. 출처 없는 숫자가 더 위험하다
 *
 * 근거는 구글 검색 그라운딩으로 잡는다. 실제로 읽은 자리가 응답에 같이 오고,
 * 그 주소를 본문 끝 「출처」에 남긴다. 그래야 원장님이 30초에 검증하실 수 있다.
 * 그래서 이 스크립트는 제미나이가 있어야 돈다.
 *
 *   node scripts/write-news.mjs         주제를 찾아 초안까지
 *   node scripts/write-news.mjs --dry   프롬프트만 보고 멈춘다 (키 없이 됨)
 */
import fs from "node:fs";
import { Pool } from "pg";
import { 공급자만들기, 금지, 지어내기금지, 파싱, 공통짜임새, 재시도 } from "./writer-common.mjs";

for (const l of fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8").split(/\r?\n/)) {
  const m = /^([A-Z_]+)=(.*)$/.exec(l);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

const DRY = process.argv.includes("--dry");
const CLIENT = 1;
const 공급자 = 공급자만들기();

const u = new URL(process.env.DATABASE_URL);
u.searchParams.delete("sslmode");
const pool = new Pool({ connectionString: u.toString(), ssl: { rejectUnauthorized: false } });
const q = (sql, p = []) => pool.query(sql, p).then((r) => r.rows);

/** 뉴스 글에만 거는 규칙. 관점 글에 걸면 안 된다 — 거기선 「피해야 할 것」이 필수 항목이다. */
const 뉴스규칙 = [
  "바깥의 검증되는 사실 하나로 연다. 제도 변경·고시·대회 일정·공식 발표 같은 것.",
  "그 사실이 학부모에게 무슨 뜻인지 푼다. 이게 글의 몸통이다.",
  "숫자를 써라. 시행 연도·시수·대상 학년·일정. 단 검색으로 확인한 것만 쓴다.",
  "숫자마다 어디서 나온 것인지 본문에 밝힌다 — 「교육부 ○○ 방안에 따르면」처럼.",
  "확인 못 한 것은 「아직 안 정해졌습니다」라고 쓴다. 추측으로 채우지 않는다.",
  "문단 80~400자. 소제목은 ## 만. 본문 1500~2800자.",
  "제목에 그 사실이 들어가야 한다. 학부모가 검색창에 칠 말로 쓴다.",
];

/** 홍보 틀 금지. 이게 이 글의 존재 이유다. */
const 홍보금지 = [
  "「학원 고를 때 이걸 보세요」 틀로 쓰지 마라. 학원 이름을 안 써도 광고가 된다.",
  "「상담 가서 이렇게 물어보세요」로 채우지 마라.",
  "「이런 학원은 피하세요」 목록을 넣지 마라. 이 글은 학원 이야기가 아니다.",
  "우리 학원의 수업·교구·반 운영을 언급하지 마라. 한 번도.",
  "체험 수업·문의·등록을 권하지 마라.",
  "독자가 이 글을 읽고 학원을 안 알아봐도 된다. 사실을 알고 가면 그걸로 됐다.",
];

const main = async () => {
  const 기존글 = await q(
    `select title from academy.posts
      where client_id = $1 and published order by published_at desc limit 25`,
    [CLIENT],
  ).catch(() => []);

  const 오늘 = new Date().toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul" });

  const prompt = [
    "너는 송파구에서 코딩·로봇 학원을 운영하는 원장이다. 학부모가 읽을 글을 직접 쓴다.",
    "이번에 쓸 것은 학원 소개가 아니라 바깥 소식이다. 광고가 아니라 정보다.",
    "",
    `오늘은 ${오늘} 이다.`,
    "",
    "# 할 일",
    "먼저 구글 검색으로 최근 6개월 안의 사실을 찾는다. 다음 가운데 학부모가 알면 도움이 될 것 하나를 고른다.",
    "- 초·중·고 정보 교과와 AI 교육 관련 교육부·시도교육청 정책 변경",
    "- 소프트웨어·AI 관련 학생 대회의 일정과 요강 변경",
    "- 학교 현장의 AI 도구 사용 지침",
    "- 대학 입시에서 소프트웨어 관련 전형의 변화",
    "찾은 사실이 실제로 확인되지 않으면 그 주제를 버리고 다른 것을 고른다. 없으면 없다고 답한다.",
    "",
    `# 지켜야 할 것\n- ${뉴스규칙.join("\n- ")}`,
    "",
    `# 홍보로 가면 이 글은 죽는다\n- ${홍보금지.join("\n- ")}`,
    "",
    `# 절대 지어내지 않는다\n- ${지어내기금지.join("\n- ")}`,
    "",
    `# 쓰면 안 되는 표현\n- ${금지.join("\n- ")}`,
    "",
    `# 이미 쓴 글 (같은 주제를 또 쓰지 마라)\n${기존글.map((p) => `- ${p.title}`).join("\n")}`,
    "",
    "# 내놓을 형식 (JSON 하나만, 다른 말 없이)",
    '{"slug": "영문소문자와붙임표만-40자이내", "title": "제목", "summary": "결론 한두 줄",',
    ' "tags": ["5개"], "body": "마크다운 본문", "근거": ["본문에 쓴 사실과 그 출처를 짝지어 적는다"],',
    ' "확인필요": ["검색으로 확실히 못 박지 못해 원장 확인이 필요한 문장"]}',
    "",
    "근거 에는 본문에 쓴 숫자와 날짜를 하나도 빠짐없이 넣고, 각각 어느 문서에서 본 것인지 적어라.",
    "찾지 못했으면 body 를 빈 문자열로 두고 확인필요 에 이유를 적어라. 지어내는 것보다 낫다.",
  ].join("\n");

  if (DRY) {
    console.log(`쓸 모델: ${공급자 ? `${공급자.model} (${공급자.이름})` : "없음 — 키가 하나도 없습니다"}`);
    console.log(`검색 근거: ${공급자?.검색가능 ? "쓸 수 있음" : "못 씀 — 제미나이가 있어야 합니다"}`);
    console.log(`\n── 프롬프트 (${prompt.length}자) ──\n`);
    console.log(prompt);
    return;
  }

  if (!공급자?.key) {
    console.log("\n키가 없습니다. GEMINI_API_KEY 를 GitHub Secrets 에 넣으면 돕니다.");
    process.exitCode = 78;
    return;
  }
  if (!공급자.검색가능) {
    // 검색 없이 쓰면 뉴스가 아니라 기억으로 지어낸 글이 된다. 그건 제일 위험하다.
    console.log(`\n${공급자.이름} 은 검색 근거를 못 답니다. 뉴스 글은 근거가 없으면 쓰면 안 됩니다.`);
    console.log("GEMINI_API_KEY 를 넣거나, 관점 글은 write-draft.mjs 로 쓰세요.");
    process.exitCode = 78;
    return;
  }
  console.log(`쓰는 모델: ${공급자.model} (${공급자.이름}) · 검색 근거 켬`);

  const res = await 재시도(공급자.url, {
    method: "POST",
    headers: 공급자.headers(공급자.key),
    body: JSON.stringify(공급자.요청(prompt, 공급자.최대토큰, { 검색: true })),
  });
  if (!res.ok) {
    // 오류를 끊어 찍어 두 번이나 답을 잘라 먹었다 — 404 는 쓸 모델 이름을,
    // 429 는 어느 한도인지(분당인지 일일인지)와 재시도 간격을 본문에 담아 준다.
    // 오류는 끝까지 읽혀야 쓸모가 있다. 길어야 몇 줄이다.
    const 본문 = await res.text();
    console.log("생성 실패:", res.status);
    console.log(본문.slice(0, 2000));
    if (res.status === 402) {
      // 크레딧 없음은 설정 문제다. 78 로 끝내면 write.yml 이 「건너뜀」으로 적고 빨간불을 안 낸다
      console.log("\nOpenRouter 크레딧이 없습니다. https://openrouter.ai/settings/credits 에서 충전하면 다음 주부터 다시 씁니다.");
      process.exitCode = 78;
      return;
    }
    if (res.status === 429) {
      const 간격 = /"retryDelay"\s*:\s*"([^"]+)"/.exec(본문)?.[1];
      console.log(`\n무료 한도에 걸렸습니다.${간격 ? ` 재시도 간격 ${간격}.` : ""}`);
      console.log("분당 한도면 잠시 뒤 되고, 일일 한도면 내일 풀립니다. 위 quotaId 를 보세요.");
    }
    process.exitCode = 1;
    return;
  }
  const data = await res.json();
  const text = 공급자.text(data);
  const 출처 = 공급자.출처(data);

  if (공급자.끊겼나?.(data)) {
    console.log(`\n출력이 상한(${공급자.최대토큰} 토큰)에 걸려 잘렸습니다. WRITER_MAX_TOKENS 를 올리세요.`);
    process.exitCode = 1;
    return;
  }

  const { post, 고쳐읽음, 오류 } = 파싱(text);
  if (오류) {
    console.log("JSON 으로 안 왔습니다:", 오류);
    console.log(`  끝난 이유: ${data.candidates?.[0]?.finishReason ?? "?"} · 받은 길이 ${text.length}자`);
    console.log("  앞:", text.slice(0, 110).replace(/\s+/g, " "));
    console.log("  뒤:", text.slice(-110).replace(/\s+/g, " "));
    process.exitCode = 1;
    return;
  }
  if (고쳐읽음) console.log("  (본문에 진짜 줄바꿈이 들어와 고쳐 읽었습니다)");

  let 본문 = post.body ?? "";
  if (!본문.trim()) {
    console.log("\n쓸 만한 사실을 못 찾았다고 합니다. 초안을 넣지 않습니다.");
    for (const s of post.확인필요 ?? []) console.log("  ·", s);
    return;
  }

  // 출처를 본문 끝에 남긴다. 원장님이 30초에 검증하실 수 있어야 「객관성」이 말이 된다.
  if (출처.length) {
    본문 += `\n\n## 출처\n${출처.map((s) => `- [${s.제목 || s.주소}](${s.주소})`).join("\n")}`;
  }

  const 흠 = 공통짜임새(본문);
  if (본문.length < 1500) 흠.push(`본문 ${본문.length}자 — 1,500자에 못 미칩니다`);
  if (본문.length > 2800) 흠.push(`본문 ${본문.length}자 — 2,800자를 넘었습니다`);
  if (!출처.length) 흠.push("검색 근거가 응답에 하나도 안 왔습니다 — 사실 확인 없이 쓴 글일 수 있습니다");
  // 홍보 틀로 돌아가는지 기계로 본다. 사람 눈에는 보이는데 어휘 검사에는 안 걸린다.
  const 홍보 = 본문.match(/우리 학원|저희 학원|체험 수업|상담 문의|등록하세요|피하세요/g);
  if (홍보) 흠.push(`홍보 틀로 돌아갔습니다: ${[...new Set(홍보)].join(" ")}`);

  const slug = /^[a-z0-9-]{4,60}$/.test(post.slug ?? "")
    ? post.slug
    : `news-${new Date().toISOString().slice(0, 10)}`;

  const 넣음 = await q(
    `insert into academy.posts (slug,title,summary,body,category,tags,published,client_id,updated_at)
     values ($1,$2,$3,$4,$5,$6,false,$7,now())
     on conflict (slug) do update set
       title=excluded.title, summary=excluded.summary, body=excluded.body,
       tags=excluded.tags, updated_at=now()
     where not academy.posts.published
     returning slug`,
    [slug, post.title, post.summary, 본문, "교육관점", post.tags ?? [], CLIENT],
  );
  if (!넣음.length) {
    // 발행된 글과 슬러그가 겹쳤다. 초안이 안 생겼는데 생긴 것처럼 찍으면 회사 루프가 거짓 완료를 적는다
    console.log(`\n발행된 글과 슬러그(${slug})가 겹쳐 초안을 넣지 않았습니다.`);
    process.exitCode = 1;
    return;
  }
  // 회사 루프(company.mjs)가 이 줄로 초안이 생겼는지 안다
  console.log(`DRAFT_SLUG=${slug}`);

  if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `slug=${slug}\n`);

  console.log(`\n초안으로 넣었습니다: ${post.title} (${본문.length}자)`);
  console.log(`  슬러그 ${slug}`);

  console.log(`\n검색으로 읽은 자리 ${출처.length}곳:`);
  for (const s of 출처) console.log(`  · ${s.제목 || "(제목 없음)"}\n    ${s.주소}`);

  console.log("\n본문에 쓴 사실과 출처:");
  for (const g of post.근거 ?? []) console.log("  ·", g);

  if ((post.확인필요 ?? []).length) {
    console.log("\n확인이 필요한 문장:");
    for (const s of post.확인필요) console.log("  ·", s);
  }

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
