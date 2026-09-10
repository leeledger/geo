/**
 * 오늘학교 — 소개 탭 (학원소개 · 입시실적).
 *
 * 이 두 칸이 이 지면에서 가장 큰 본문이다. AI 가 지역 질문에 답할 때
 * 이 목록을 읽는 걸 확인했으니, 여기 적히는 문장이 곧 인용 후보다.
 *
 * 모든 문장은 robotncoding.com 의 JSON-LD 에 있는 사실만 쓴다.
 * 한 줄이라도 지어내면 사업 전체가 무너진다.
 *
 * 특히 한양대는 「진학」이 아니라 「입시 지도」다. 원문의 구분을 그대로 지킨다.
 *
 *   node prompie-intro.mjs
 */
import { chromium } from "playwright";
import path from "node:path";

const URL_ = "https://academy.prompie.com/administrators/wibhx5b/academy/manage/info/";

const INTRO = `코딩을 가르치지 않습니다. 생각하는 방법을 가르칩니다.

서울 송파구 석촌동에 있는 코딩·로봇·AI 교육 학원입니다. 개발자 출신 원장이 직접 지도합니다. 의료정보시스템, 생산·물류 ERP, 쇼핑몰, 금융사·카드사 콜센터 시스템을 개발했습니다. 소프트웨어만이 아니라 시스템·하드웨어 개발, 펌웨어, 카메라 영상처리 모듈, 대용량 데이터베이스 설계·운영까지 다뤘습니다. 중앙대학교 산학 자문위원과 학기 특강 교수를 맡았습니다.

가르치는 것은 코드 문법이 아닙니다. 문제를 쪼개고, 규칙을 세우고, 틀렸을 때 원인을 찾는 훈련입니다. AI 가 코드를 대신 써 주는 시대에 사람에게 남는 일이 그것입니다. AI 를 어디까지 믿어도 되는지, 어디서부터 직접 확인해야 하는지도 함께 가르칩니다.

■ 5단계 로드맵

1단계 컴퓨팅 사고력 기초 (초등 1~4학년)
순차·반복·조건 등 프로그래밍 기본 구조와 문제 분해·패턴 인식을 블록코딩으로 익힙니다.

2단계 알고리즘과 창의 융합 코딩 (초등 3~6학년)
정렬·탐색 알고리즘, 피지컬 컴퓨팅, AI 기초 체험을 다룹니다.

3단계 텍스트 기반 프로그래밍 입문 (초등 5학년 이상)
Python 문법과 자료구조, 파일 입출력을 실습 중심으로 익힙니다.

4단계 문제 해결 중심의 알고리즘 강화 (초등 5~6학년, 중등 연계)
동적 계획법·그래프 알고리즘. 한국코드페어·SW사고력올림피아드·USACO 를 대비합니다.

5단계 진로 체험 및 융합 프로젝트
AI·IoT·데이터 분석·앱 개발 체험과 Python Flask 웹개발. 수시모집 학생부종합전형에 낼 포트폴리오와 생활기록부 활동 기록 작성을 지도합니다.

■ 주제별 과정

첫 코딩 (7세~초등 3학년, 15주) — 글자를 몰라도 시작합니다. 큰 버튼을 눌러 로봇을 움직이는 단계에서 블록 조립까지 이어집니다.
AI 시대 코딩 (초등 5학년~중3, 24주) — AI 에게 정확히 요청하는 법을 배웁니다. 프롬프트 한 줄에서 완성작까지 갑니다.
코딩으로 수학 저학년 (초등 1~4학년, 16주) — 덧셈·뺄셈부터 구구단까지 손으로 풀던 것을 코드로 만듭니다.
코딩으로 수학 (초등 5학년~중3, 23주) — 제곱근·인수분해·이차함수·삼각비·통계를 코드로 확인합니다.
메이커 (초등 4학년~중2, 19주) — 브라우저 시뮬레이션으로 회로를 구성하고 LED 부터 센서 제어까지 다룹니다.

■ 수업 시간

초등 저학년 90분, 초등 고학년 이상 120분입니다.

■ 자체 개발 학습 프로그램

원장이 직접 만든 브라우저 기반 학습 프로그램을 씁니다. 70개 과정, 1,597개 챕터입니다.

채점 기준은 정답 코드와 같은지가 아니라 프로그램이 실제로 작동했는지입니다. AI 튜터는 정답 코드를 주지 않습니다. 어긋난 곳과 골격만 짚습니다.

학습 화면이 자동 저장되고, 아이가 남긴 소감과 함께 학부모에게 링크로 갑니다. 여기에 담당 선생님이 수업 중 지켜본 모습을 더해 학습 성장 리포트를 보냅니다. 태도·집중력·학습 의지·이해력·표현력·창의성 여섯 영역으로 자라는 방향을 기록하고, 회차마다 무엇을 했고 어디를 어려워했는지 코멘트를 남깁니다. 쌓인 기록은 진학·상담에 낼 수 있는 학습 포트폴리오 문서가 됩니다.

■ 다루는 것

파이썬, 자바, 자바스크립트, SQL, 아두이노, 마이크로비트, 엔트리, 스크래치 주니어, PyCharm, Git.
컴퓨팅 사고력, 알고리즘, AI 리터러시, 프롬프트 설계, 로봇·IoT, 데이터 분석, 앱 개발.

전화 02-422-0525 · robotncoding.com`;

const RESULT = `■ 대회 수상

한국코드페어 금상
학생발명품대회 최우수상
서울특별시교육청 과학전람회 중등부 최우수상
스팀컵 로봇&코딩 부문 금상
전국학생통계활용대회 우수상
SW사고력올림피아드 우수상

■ 특허

재원생 학생 특허 등록 2건. 아이디어 단계부터 출원까지 지도했습니다.

■ 진학

재원생들이 주로 수시모집 학생부종합전형으로 진학했습니다.

서울대학교 의과대학
한국과학기술원(KAIST)
한국과학영재학교
선린인터넷고등학교
미림마이스터고등학교
단국대학교부속소프트웨어고등학교
서울로봇고등학교

한양대학교 공과대학은 입시를 지도했습니다.`;

const ctx = await chromium.launchPersistentContext(path.join(process.cwd(), ".browser-profile"), {
  headless: false, viewport: { width: 1440, height: 1000 },
  locale: "ko-KR", timezoneId: "Asia/Seoul",
  args: ["--disable-blink-features=AutomationControlled"],
});
ctx.on("dialog", (d) => d.accept().catch(() => {}));
const page = ctx.pages()[0] ?? (await ctx.newPage());
const say = (s) => console.log(`  ${s}`);

await page.goto(URL_, { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForTimeout(3500);

const ta = page.locator("textarea");
const n = await ta.count();
say(`textarea ${n}개`);
if (n < 2) { say("칸이 모자랍니다. 화면이 바뀐 것 같습니다."); await ctx.close(); process.exit(1); }

for (const [i, text, label] of [[0, INTRO, "학원소개"], [1, RESULT, "입시실적"]]) {
  const box = ta.nth(i);
  const cur = (await box.inputValue().catch(() => "")).trim();
  if (cur) { say(`${label} 이미 ${cur.length}자 있음 — 건드리지 않습니다`); continue; }
  await box.fill(text);
  const got = (await box.inputValue()).length;
  say(`${label} ${got}자 넣었습니다`);
}

await page.screenshot({ path: "prompie-intro-before.png", fullPage: true }).catch(() => {});
const save = page.getByRole("button", { name: /저장/ }).first();
await save.click();
say("저장하기 눌렀습니다");
await page.waitForTimeout(5000);

// 넘긴 것과 저장된 것은 다르다. 다시 읽어 확인한다.
await page.goto(URL_, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(3500);
const a = (await page.locator("textarea").nth(0).inputValue().catch(() => "")).length;
const b = (await page.locator("textarea").nth(1).inputValue().catch(() => "")).length;
say(`다시 읽음 — 학원소개 ${a}자 · 입시실적 ${b}자`);
await page.screenshot({ path: "prompie-intro-after.png", fullPage: true }).catch(() => {});

await new Promise((r) => setTimeout(r, 1500));
await ctx.close().catch(() => {});
