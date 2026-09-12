/**
 * 「코딩 커리큘럼, 어떤 순서로 배워야 하나요?」 — 학원 커리큘럼을 정면으로 다루는 글.
 *
 * 사실은 두 곳에서만 가져왔다. 지어낸 문장이 하나도 없어야 이 글이 값을 한다.
 *   학원   robotncoding.com · llms.txt — 철학 문장, 5단계 이름·학년대·도구, 평가 기준
 *   스탠퍼드 themodernsoftware.dev — CS146S 공식 과목 설명과 주제
 *
 * 안 쓴 것도 적어 둔다. 확인이 안 돼서 뺐다.
 *   「1년 만에 커리큘럼 85%를 바꿨다」 — 검색으로 확인 안 됨. 전혀 다른 85%(2026년
 *     졸업생의 85%가 AI 를 썼다)와 섞이기 쉬운 모양이라 더 위험하다
 *   「학생이 손으로 코드를 못 쓰게 한다」 — 2차 블로그만 주장하고 공식 과목 사이트엔 없다
 *   engineering.stanford.edu 「Period of transition」 기사 — 2012년 6월 14일 글이다.
 *     제목만 보면 지금 이야기 같지만 AI 와 무관한 트랙제 개편이다. 통째로 버렸다
 *
 *   node scripts/seed-post-curriculum.mjs           초안
 *   node scripts/seed-post-curriculum.mjs --publish 공개
 */
import fs from "node:fs";
import { Pool } from "pg";

for (const l of fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8").split(/\r?\n/)) {
  const m = /^([A-Z_]+)=(.*)$/.exec(l);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

const PUBLISH = process.argv.includes("--publish");

const POST = {
  slug: "koding-kurikyulleom-sunseo",
  title: "코딩 커리큘럼, 어떤 순서로 배워야 하나요?",
  category: "교육관점",
  tags: ["커리큘럼", "코딩교육", "AI교육", "초등코딩", "파이썬"],
  summary:
    "대학은 이미 과목을 바꿨습니다. 손으로 코드를 쓰는 훈련에서 에이전트와 일하는 훈련으로요. 초등·중등에서는 그 앞에 쌓아야 할 순서가 따로 있습니다. 저희가 다섯 단계로 나눠 가르치는 이유를 적었습니다.",
  body: `스탠퍼드에 CS146S라는 과목이 있습니다. 이름이 「The Modern Software Developer」이고, 2025년 가을에 처음 열렸습니다. 과목 설명 첫 문장이 이렇습니다. 대규모 언어모델이 소프트웨어 개발을 주로 손으로 코드를 쓰는 일에서, 점점 유능해지는 코딩 에이전트와 **협업하는 일**로 바꿔 놓았다고요.

수업에서 다루는 것도 문법이 아닙니다. 명세를 먼저 쓰고 그대로 만들게 하는 방법, 도구를 엮어 안 무너지는 흐름을 만드는 방법, 그걸 실제로 굴리는 방법입니다.

저는 이 소식을 듣고 커리큘럼을 바꿔야겠다고 생각하지 않았습니다. 오히려 **순서를 지키는 게 더 중요해졌다**고 봤습니다.

## 왜 순서가 더 중요해졌나

AI에게 일을 시키려면 두 가지가 됩니다. 무엇을 만들지 말로 정확히 말할 수 있어야 하고, 나온 결과가 틀렸을 때 어디가 틀렸는지 짚을 수 있어야 합니다.

둘 다 문법을 외워서 생기는 힘이 아닙니다. 순서대로 생각해 본 경험, 조건을 나눠 본 경험, 안 돌아가는 걸 붙잡고 원인을 찾아본 경험에서 나옵니다. 그 경험이 없는 아이는 AI가 내놓은 코드를 그냥 받아 적습니다.

저희 학원 문장이 「코딩을 가르치지 않습니다. 생각하는 방법을 가르칩니다」인 이유가 여기 있습니다.

## 다섯 단계로 나눈 이유

**1단계 — 컴퓨팅 사고력 기초 형성** (초등 1~4학년). 순차·반복·조건을 손으로 겪습니다. 변수와 함수가 뭔지 감을 잡고, 안 되는 걸 고쳐 보는 일을 처음 합니다. 엔트리와 code.org, 옥토스튜디오, 스크래치 주니어를 씁니다.

**2단계 — 알고리즘과 창의 융합** (초등 3~6학년). 정렬과 탐색처럼 이름 붙은 방법을 배웁니다. 센서를 붙여 화면 밖에서도 돌아가게 만들고요. 엔트리 고급, 아두이노, 마이크로비트입니다.

**3단계 — 텍스트 기반 프로그래밍 입문** (초등 5학년 이상). 파이썬으로 넘어갑니다. 여기서 자연어 코딩을 같이 합니다. 하고 싶은 걸 한국어로 적어 코드를 받아 보는 겁니다. 앞 단계를 지난 아이는 이때 받은 코드를 읽습니다.

**4단계 — 문제 해결 중심의 알고리즘 강화**. 동적 계획법, 그래프. 대회와 진학을 보는 아이들이 옵니다.

**5단계 — 진로 체험과 융합 프로젝트**. AI와 사물인터넷, 데이터 분석, 앱을 팀으로 만듭니다. 포트폴리오가 여기서 나옵니다.

## 언제 다음 단계로 넘어가나

학년으로 넘기지 않습니다. 3단계가 초등 5학년 이상인 건 **가장 이른 시점**이지 넘어가는 때가 아닙니다.

저희가 보는 건 하나입니다. 아이가 자기가 만든 걸 말로 설명할 수 있는가. 「여기서 세 번 돌고, 조건이 맞으면 멈춥니다」 정도면 됩니다. 이게 되는 아이는 파이썬에서 문법을 외우지 않고 읽습니다. 안 되면 블록에서 더 만들어 봅니다.

같은 학년이어도 반년씩 차이가 납니다. 그게 정상입니다.

## 채점 기준이 바뀌었습니다

예전에는 정답 코드와 같은지를 봤습니다. 지금은 **실제로 작동했는지**를 봅니다.

로봇이 목적지까지 갔는가. 만든 프로그램이 끝까지 돌았는가. 답안지와 한 글자도 안 틀리게 쓴 아이보다, 자기 방식으로 굴러가게 만든 아이가 더 멀리 갑니다. AI가 코드를 써 주는 시대에는 이 차이가 더 벌어집니다.

## 하지 마셔야 할 것

**단계를 건너뛰고 파이썬부터 시키지 마십시오.** 학부모님들이 가장 많이 물어보시는 게 「언제 파이썬 넘어가나요」입니다. 블록으로 조건과 반복을 충분히 겪지 않은 아이는 파이썬에서 문법을 외웁니다. 외운 것은 오래 안 갑니다.

**반대로 「AI가 다 해주니 코딩은 됐다」도 아닙니다.** 스탠퍼드가 새로 만든 과목도 결국 소프트웨어를 만드는 수업입니다. 도구가 바뀐 것이지 만드는 일이 없어진 게 아닙니다.

## 학원을 보실 때

커리큘럼 표를 받으시면 단계 이름 말고 **각 단계에서 아이가 직접 만드는 게 뭔지** 물어보십시오. 표는 어디나 비슷하게 생겼습니다. 차이는 그 칸 안에서 아이가 손을 움직이는 시간에서 납니다.`,
  확인필요: [
    "CS146S 가 2025년 가을 첫 개설이라는 것 — 과목 공식 사이트 기준입니다. 개설 연도를 다시 보셔도 좋습니다.",
    "「학부모님들이 가장 많이 물어보시는 게 언제 파이썬 넘어가나요」 — 상담에서 실제로 그러신지 원장님만 아십니다. 아니면 이 문장을 빼야 합니다.",
    "「다음 단계로 넘기는 기준은 아이가 자기가 만든 걸 말로 설명할 수 있는가」 — 사이트에 적혀 있지 않은 내용입니다. 실제 기준과 다르면 고쳐 주십시오.",
    "영상 자막을 못 받아서 영상 내용은 한 줄도 안 썼습니다. 영상에 이 글과 어긋나는 이야기가 있으면 알려 주십시오.",
  ],
};

const u = new URL(process.env.DATABASE_URL);
u.searchParams.delete("sslmode");
const pool = new Pool({
  connectionString: u.toString(),
  ssl: { rejectUnauthorized: process.env.DATABASE_SSL_INSECURE !== "true" },
});

await pool.query(
  `insert into academy.posts (slug,title,summary,body,category,tags,published,published_at,client_id,updated_at)
   values ($1,$2,$3,$4,$5,$6,$7,$8,1,now())
   on conflict (slug) do update set
     title=excluded.title, summary=excluded.summary, body=excluded.body,
     category=excluded.category, tags=excluded.tags, published=excluded.published,
     published_at=coalesce(academy.posts.published_at, excluded.published_at),
     updated_at=now()`,
  [POST.slug, POST.title, POST.summary, POST.body, POST.category, POST.tags,
   PUBLISH, PUBLISH ? new Date() : null],
);

const paras = POST.body.split("\n\n").filter((x) => x.trim() && !x.startsWith("##"));
const good = paras.filter((x) => x.length >= 80 && x.length <= 400).length;
console.log(POST.title);
console.log(`  ${POST.body.length}자 · 인용 좋은 문단 ${good}/${paras.length} · ${PUBLISH ? "공개" : "초안"}`);
console.log(`  https://robotncoding.com/blog/${POST.slug}`);
console.log("\n발행 전에 확인하실 것:");
for (const s of POST.확인필요) console.log("  ·", s);
console.log("\n어휘 검사: node scripts/slop-check.mjs " + POST.slug);
console.log("숫자 검사: node scripts/fact-check.mjs " + POST.slug);
await pool.end();
