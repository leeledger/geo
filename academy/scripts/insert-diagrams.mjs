/**
 * 도해를 본문에 넣는다.
 *
 * 8편이 도해 없이 글자만 있었다. 사이트에서도 읽기 힘들고, 네이버로 옮기면
 * 더 나빠진다 — 네이버는 이미지가 없으면 글이 안 읽힌다.
 *
 * 넣는 자리가 중요하다. 맨 위에 붙이면 장식이 되고, 그 도해가 설명하는
 * 대목 바로 앞에 놓아야 읽는 사람이 그림을 보고 다음 문단을 읽는다.
 *
 *   node scripts/insert-diagrams.mjs
 */
import fs from "node:fs";
import { Pool } from "pg";

for (const l of fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8").split(/\r?\n/)) {
  const m = /^([A-Z_]+)=(.*)$/.exec(l);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}
const u = new URL(process.env.DATABASE_URL);
u.searchParams.delete("sslmode");
const pool = new Pool({
  connectionString: u.toString(),
  ssl: { rejectUnauthorized: process.env.DATABASE_SSL_INSECURE !== "true" },
});

/** slug → { file, alt, before } — before 앞에 넣는다. 없으면 맨 뒤. */
const PLAN = {
  "koding-myeot-hangnyeonbuteo": {
    file: "age-ladder",
    alt: "나이별 코딩 학습 단계. 7세부터 초3은 글자를 몰라도 시작하고, 초1~초4는 코드를 쓰지 않고 순서와 반복과 조건으로 사고의 뼈대를 만들며, 초5 이상부터 파이썬으로 넘어간다. 기준은 나이가 아니라 설명할 수 있는가이다.",
    before: "## 그럼 늦게 시작하면 손해인가요",
  },
  "beullogeseo-paisseoneuro": {
    file: "ready-check",
    alt: "블록코딩에서 파이썬으로 넘어갈 때를 집에서 확인하는 법. 아이에게 이 블록은 왜 여기 있는지, 빼면 어떻게 될지, 숫자를 바꾸면 어떻게 될지 묻는다. 자기 말로 답하면 넘어갈 때이고 모르겠다고 하면 아직이다.",
    before: "## 넘어갈 때 이렇게 합니다",
  },
  "hagweon-vs-online-gangui": {
    file: "one-test",
    alt: "코딩학원과 온라인 강의 중 무엇이 맞는지 판단하는 기준 하나. 지난주에 아이가 스스로 강의를 열었으면 온라인으로 충분하고, 매번 시켜야 했으면 아직 사람이 필요하다.",
    before: "## 섞어 쓰는 방법",
  },
  "saenggibue-sseul-koding-project": {
    file: "record",
    alt: "생기부용 코딩 프로젝트는 완성작만으로 부족하다. 면접에서 묻는 세 가지와, 그래서 만드는 동안 남겨야 하는 네 가지를 나란히 보여준다.",
    before: "## 그래서 기록을 남기게 합니다",
  },
  "entry-scratch-eoneu-geot": {
    file: "tool-vs-class",
    alt: "엔트리와 스크래치는 도구로서 같다. 진짜 갈리는 것은 수업 방식이다. 예제를 따라 만들기만 하는 수업은 1년을 해도 혼자 못 만들고, 만들고 싶은 것을 정하는 수업이라야 사고가 붙는다.",
    before: "## 확인해 보는 법",
  },
  "yeongjaego-gwahakgo-koding-junbi": {
    file: "what-to-ask",
    alt: "영재고와 과학고 준비에서 가장 많이 놓치는 것은 과정 기록이다. 남겨야 할 세 가지와 학원 상담에서 물어볼 세 가지.",
    before: "## AI를 써도 되나",
  },
  "hagweoneseo-mueoseul-baewossna": {
    file: "what-remains",
    alt: "수업이 끝나면 무엇이 남는가. 만든 화면과 아이의 소감, 선생님 코멘트가 합쳐져 학습 성장 리포트가 된다. 태도, 집중력, 학습 의지, 이해력, 표현력, 창의성 여섯 영역을 기록하고 점수는 매기지 않는다.",
    before: "## 점수를 매기지 않는 이유",
  },
  // 한 글에 두 장. 척추(다섯 단계)와 제일 날카로운 대목(채점 기준)에 하나씩 둔다.
  "koding-kurikyulleom-sunseo": [
    {
      file: "five-stages",
      alt: "코딩 커리큘럼 다섯 단계. 1단계 컴퓨팅 사고력 기초는 초등 1~4학년이 엔트리와 스크래치 주니어로 순차와 반복과 조건을 익힌다. 2단계 알고리즘과 창의 융합은 초등 3~6학년이 아두이노와 마이크로비트로 정렬과 탐색을 배운다. 3단계 텍스트 기반 프로그래밍은 초등 5학년 이상이 파이썬 문법과 자연어 코딩을 한다. 4단계 알고리즘 강화는 진학과 대회를 보고 동적 계획법과 그래프를 다룬다. 5단계는 AI와 사물인터넷과 데이터와 앱을 팀으로 만든다. 넘어가는 기준은 학년이 아니라 자기가 만든 것을 말로 설명할 수 있는가이다.",
      before: "## 언제 다음 단계로 넘어가나",
    },
    {
      file: "grading-shift",
      alt: "채점 기준이 바뀌었다. 예전에는 정답 코드와 일치하는가를 봤고, 답안지와 한 글자도 안 틀리게 쓴 아이가 잘한 아이였다. 지금은 실제로 작동했는가를 본다. 로봇이 목적지까지 갔는가, 만든 프로그램이 끝까지 돌았는가를 본다. AI가 코드를 써 주는 시대에는 이 차이가 더 벌어진다.",
      before: "## 하지 마셔야 할 것",
    },
  ],
  "aiga-sukjereul-haetdamyeon": [
    {
      file: "three-questions",
      alt: "아이가 가져온 숙제를 놓고 묻는 세 가지. 이거 나한테 설명해 줄래, 이 부분은 왜 이렇게 썼어, AI가 틀린 데는 없었어. 스스로 한 아이는 설명하고 이유를 대고 틀린 데를 짚는다. 받아 적은 아이는 두 번째 문장에서 막히고 이유를 못 대고 몰라요라고 한다.",
      before: "## 같이 쓰면 남는 것이 생깁니다",
    },
    {
      file: "order-swap",
      alt: "AI를 같이 쓸 때 순서를 바꾼다. 아이가 먼저 자기 생각을 세 줄이라도 적고, 그다음 AI에게 묻고, 마지막에 둘을 비교해 고친다. 그러면 AI는 자기 생각을 확인하는 도구가 된다.",
      before: "이 순서면 AI가",
    },
  ],
  // 아래는 네이버에서 옮겨 온 옛 글. 원본 사진이 옮겨지지 않아 「사진 설명을 입력하세요」만 남아 있었다.
  "suhakmunjereul-kodingeuro-haegyeol-haeboja": {
    file: "divisor-steps",
    alt: "약수 구하기를 코딩으로 옮긴 네 단계. 입력이 12일 때, 숫자를 넣고, 1부터 12까지 하나씩 나눠 보고, 나머지가 0인 수만 리스트에 담고, 리스트를 보여준다. 결과는 1 2 3 4 6 12.",
    before: "위 과정은 약수를",
  },
  "jeolchajeoksago": [
    {
      file: "two-ways",
      alt: "1부터 100까지의 합을 구하는 두 방법. 하나씩 더하면 덧셈 99번, 공식 100×101÷2를 쓰면 곱셈 한 번과 나눗셈 한 번. 둘 다 5050이다.",
      before: "위의 예는 1786년",
    },
    {
      file: "sandwich",
      alt: "샌드위치 알고리즘. 로봇에게 시키려면 봉지를 연다, 식빵 두 장을 꺼낸다, 칼로 잼을 뜬다, 빵 한 면에 펴 바른다, 두 장을 겹친다로 나눠 정해 줘야 한다.",
      before: "다소 사소하게",
    },
  ],
  "aideuli-jaemiitge-moliphal-su-itdorok-haneungeoti": [
    {
      file: "interest-to-concept",
      alt: "좋아하는 것이 다르면 익히는 개념도 다르다. 수학을 좋아하면 구구단을 출력하며 중첩 반복을, 미술을 좋아하면 좌표를 옮기며 그림을 그리며 좌표계를, 축구를 좋아하면 공을 차고 굴리며 입사각과 반사각과 중력을 익힌다.",
      before: "반복문으로 구구단을 출력하려면",
    },
    {
      file: "think-stages",
      alt: "만드는 다섯 단계마다 생각이 붙는다. 아이디어, 스토리, 구조화, 알고리즘, 문제 해결.",
      before: "## 로봇앤코딩학원",
    },
  ],
  "jasini-mandeulgo-sipeun-geoteul-mandeuneun-jaemi": {
    file: "make-share-loop",
    alt: "만들고 싶은 것을 만들면 도는 고리. 만든다, 공유한다, 요구가 들어온다, 필요한 걸 찾아 배우며 고친다. 이 고리를 돌면 왜 수학을 배워야 하는지 스스로 묻게 된다.",
    before: "## 왜 배워야 하는가에",
  },
  "ai-sidae-uri-aiui-miraereul-junbihaneun-bangbeop": {
    file: "prompt-xo",
    alt: "AI에게 정확히 묻기. 웹사이트 만들어줘는 무엇으로, 어떤 것을, 어느 부분을이 없다. HTML과 CSS를 사용해서 반응형 포트폴리오 사이트의 네비게이션 바를 만들어줘는 세 가지가 다 있다.",
    before: "## ✅ AI의 답변 검증하기",
  },
};

// 네이버에서 옮겨 온 글에는 사라진 사진 자리에 에디터 안내문만 남았다. 도해를 넣는 김에 걷어 낸다.
const 빈자리 = /사진 설명을 입력하세요\.\s*/g;

let done = 0;
// 한 글에 여러 장이 필요할 때가 있다. 값이 배열이면 여러 장으로 본다.
for (const [slug, spec] of Object.entries(PLAN)) {
  const 계획들 = Array.isArray(spec) ? spec : [spec];
  const { rows } = await pool.query(`select body from academy.posts where slug = $1`, [slug]);
  if (!rows[0]) { console.log(`  ${slug} — 글이 없습니다`); continue; }

  let body = rows[0].body;
  let 바뀜 = false;
  const 걷어냄 = body.replace(빈자리, "");
  if (걷어냄 !== body) { body = 걷어냄; 바뀜 = true; }

  for (const p of 계획들) {
    if (body.includes(`/${p.file}.svg`)) { console.log(`  ${slug}/${p.file} — 이미 있습니다`); continue; }

    const img = `![${p.alt}](/blog/${slug}/${p.file}.svg)`;
    if (p.before && body.includes(p.before)) {
      body = body.replace(p.before, `${img}\n\n${p.before}`);
    } else {
      console.log(`  ${slug}/${p.file} — 「${p.before}」 를 못 찾아 맨 뒤에 붙입니다`);
      body = `${body}\n\n${img}`;
    }
    바뀜 = true;
  }
  if (!바뀜) continue;

  await pool.query(
    `update academy.posts set body = $1, updated_at = now() where slug = $2`, [body, slug]);
  console.log(`  ${slug} — 넣었습니다 (${body.length}자)`);
  done++;
}

const [{ n }] = (await pool.query(
  `select count(*)::int n from academy.posts
    where published and source_url is null and body not like '%![%'`)).rows;
console.log(`\n  ${done}편 처리 · 아직 도해 없는 글 ${n}편`);

await pool.end();
