// 고객에게 가는 글 금지어 전수(Step 55b D233) — 착수순서·체크리스트를 갈래 × dns × needs_build × 밀린 날 × 빠진 것 전 조합으로 돌려
// 보낼글 · setup-send 일감 글 · 재촉 글을 모아 금지어(client-core 고객금지말)가 0 인지 본다. DB·네트워크 없음.
// 원장 일감 금지어 전수(Step 57 D255) — 같은 조합 + 이름 판별 말·자동 세팅 멈춤·계약 갈래에서 열리는 원장 일감 제목·할 일 글,
// 자동 세팅 단계 말(원장으로 멈추면 할 일 글이 된다), 정찰 notracker 문구, 할 일 순서 줄에서 원장금지말 0.
// 착수 판정(Step 58) — 판 글 원장금지말 0 · 고객에게 보낼 요약(D273) 고객금지말 0 · 퍼센트·성공률류 0.
//   node scripts/test-client-copy.mjs
import fs from "node:fs";
import { 체크리스트, 일감계획, 고객금지말, 금지말찾기, 원장금지말, 원장금지말찾기, 일감제목, 계약말, 자동단계, 자동단계말 } from "../../web/lib/client-core.mjs";
import { 착수순서, 할일순서 } from "../../web/lib/onboard-core.mjs";
import { 사람말 as 자동사람말, 사실뽑기 } from "../../web/lib/auto-setup-core.mjs";
import * as 판정 from "../../web/lib/feasibility-core.mjs";

let 통과 = 0, 실패 = 0;
const 봄 = (이름, 참, 보탬 = "") => { if (참) 통과++; else { 실패++; console.log(`✗ ${이름}${보탬 ? ` — ${보탬}` : ""}`); } };

const 오늘 = "2026-10-17";
const 더하기 = (d, n) => new Date(Date.parse(`${d}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
const KEY = "k".repeat(32);
const 갈래들 = { 사이트: "miso-dental.co.kr", 빌더: "miso.imweb.me", 플랫폼: "blog.naver.com", 없음: null };
const 채널들 = { 사이트: {}, 빌더: {}, 플랫폼: { blog: "https://blog.naver.com/miso_blog", place: null, sns: null }, 없음: { blog: null, place: "https://m.place.naver.com/hospital/1", sns: null } };
const 점검 = {
  없음: { checkedAt: "t", home: { status: 200 }, robots: { status: 200, blocked: [] }, sitemap: { status: 200, ok: true, pages: 3, url: "u" }, llmsTxt: { status: 200, ok: true },
    homeLdTypes: ["Dentist"], indexnowFile: { status: 200, ok: true } },
  전부: { checkedAt: "t", home: { status: 200 }, robots: { status: 200, blocked: ["GPTBot"] }, sitemap: { status: 404, ok: false, url: "u" }, llmsTxt: { status: 404, ok: false, head: "" },
    homeLdTypes: [], indexnowFile: { status: 404, ok: false } },
};
// 키 파일만 빠짐(D250) — setup-keyfile 원장 일감이 열린다
점검.키만 = { ...점검.없음, indexnowFile: { status: 404, ok: false } };
const 업무 = (needs, 밀림) => ["intake", "questions", "inquiry-sheet", "local-audit", "manual-baseline", "baseline-report", ...(needs === "none" ? [] : ["site-launch"]),
  "content-draft", "content-approve", "content-publish", "manual-day30", "final-report", "renewal"].map((code) => ({ code, status: "대기", due_on: 더하기(오늘, -밀림) }));

const 모음 = [];
/** 원장에게 보이는 글 — 일감 제목·할 일(detail, send 는 보낼글이라 고객 글 시험 몫)·할 일 순서 줄 */
const 원장모음 = [];
let 조합 = 0;
for (const [갈래, domain] of Object.entries(갈래들)) {
  for (const dns of ["고객", "우리", "모름", null]) {
    for (const needs of ["none", "setup", "build", null]) {
      for (const 밀림 of [0, 3, 10]) {
        for (const 빠짐 of ["없음", "전부", "키만"]) {
          for (const 블로그 of [null, "받음"]) {
            조합++;
            const onboard = { ...(dns ? { dns } : {}), ...(블로그 ? { blog: 블로그 } : {}), channels: 채널들[갈래] };
            const row = { id: 1, slug: "miso", name: "미소치과", domain, relation: "외부", status: "active", started_on: 더하기(오늘, -밀림), crawl_key: "ck",
              config: { v: 1, indexnow: domain && 갈래 !== "플랫폼" ? { mode: "우리", key: KEY } : { mode: "안 씀" }, wantGsc: !!domain && 갈래 !== "플랫폼", gsc: false,
                answerTerms: ["미소치과"], onboard } };
            const pilot = needs ? { id: "p-1", status: "진행", needs_build: needs, paid_on: 더하기(오늘, -밀림), started_on: 더하기(오늘, -밀림), ends_on: 더하기(오늘, 20), inquiry_key: "k-1" } : null;
            const derived = domain ? 점검[빠짐] : {};
            const 세팅줄 = 체크리스트(row, derived, { pilot: pilot ? { id: "p-1", status: "진행", approved: false } : null });
            const r = 착수순서({ row, derived, 세팅줄, pilot, tasks: pilot ? 업무(needs, 밀림) : [], questions: [], content: [], ai: [], checks: [], audits: [], 로그인일감: [], 크롤: null }, 오늘);
            const 이름 = `${갈래}·dns ${dns ?? "없음"}·${needs ?? "파일럿 없음"}·밀림 ${밀림}·빠짐 ${빠짐}·블로그 ${블로그 ?? "-"}`;
            for (const s of r.단계) for (const x of s.줄) if (x.보낼글) 모음.push({ 이름, 단계: s.id, 줄: x.id, 글: x.보낼글, 갈래, 빠짐, 밀림, needs });
            for (const t of 일감계획(row, 세팅줄).열기.filter((t) => t.key === "setup-send")) 모음.push({ 이름, 단계: "일감", 줄: "setup-send", 글: t.detail, 갈래, 빠짐, 밀림 });
            for (const x of 세팅줄) if (x.보낼글) 모음.push({ 이름, 단계: "체크리스트", 줄: x.id, 글: x.보낼글, 갈래, 빠짐, 밀림 });
            for (const t of 일감계획(row, 세팅줄).열기) 원장모음.push({ 이름, 줄: t.key, 글: t.key === "setup-send" ? t.title : `${t.title}\n${t.detail}` });
            const 순서 = 할일순서({ row, derived, 세팅줄, pilot, tasks: pilot ? 업무(needs, 밀림) : [], questions: [], content: [], ai: [], checks: [], audits: [], 로그인일감: [], 크롤: null }, 오늘);
            for (const x of 순서?.줄 ?? []) 원장모음.push({ 이름, 줄: `순서 ${x.id}`, 글: `${x.일}\n${x.말}` });
          }
        }
      }
    }
  }
}

console.log(`조합 ${조합}개 · 고객 글 ${모음.length}개`);
봄(`조합 ${조합}개를 돌림 · 고객 글 ${모음.length}개 모음`, 조합 === 4 * 4 * 4 * 3 * 3 * 2 && 모음.length > 100);
const 걸림 = 모음.map((x) => ({ ...x, 말: 금지말찾기(x.글) })).filter((x) => x.말.length);
봄(`금지어 0 (목록 ${고객금지말.length}개)`, !걸림.length, 걸림.slice(0, 5).map((x) => `${x.이름} ${x.단계}.${x.줄} [${x.말.join(",")}] ${x.글.slice(0, 80)}`).join("\n   "));
봄("blog.naver.com 고객 — robots·sitemap·llms·IndexNow 를 말하는 고객 글 0", !모음.filter((x) => x.갈래 === "플랫폼").some((x) => /robots|sitemap|사이트맵|llms|indexnow/i.test(x.글)));
봄("blog.naver.com 고객 — 사이트 단계 보낼글 0 · setup-send 0", !모음.some((x) => x.갈래 === "플랫폼" && ["site", "일감", "체크리스트"].includes(x.단계)));
봄("홈페이지 없음 고객 — 사이트 단계 보낼글 0 · setup-send 0", !모음.some((x) => x.갈래 === "없음" && ["site", "일감", "체크리스트"].includes(x.단계)));
봄("사이트가 다 된 고객 — 사이트 단계 보낼글 0", !모음.some((x) => x.빠짐 === "없음" && ["site", "일감", "체크리스트"].includes(x.단계) && x.갈래 !== "없음" && x.갈래 !== "플랫폼"));
// 구축(build) 계약은 새 사이트를 여는 일이라 도메인 담당을 묻는 글(dns 모름)이 남는다 — 사이트를 그대로 쓰는 none·setup·파일럿 없음만 본다
봄("사이트가 다 된 고객 · 밀린 날 0 — 받을 것 단계 보낼글 0", !모음.some((x) => x.빠짐 === "없음" && x.밀림 === 0 && x.needs !== "build" && x.단계 === "receive" && !(x.줄 === "blog")),
  모음.filter((x) => x.빠짐 === "없음" && x.밀림 === 0 && x.needs !== "build" && x.단계 === "receive").map((x) => `${x.이름} ${x.줄}`).slice(0, 3).join(" / "));
봄("빠진 것이 있는 사이트 고객 — 보낼글은 관리자 아이디 한 문장(고칠 목록 아님)", 모음.filter((x) => x.줄 === "send" || x.줄 === "setup-send").every((x) => /관리자 아이디/.test(x.글) && !/\n\d\. /.test(x.글)));
봄("빌더 고객 — 빌더 이름 + 관리자 아이디", 모음.filter((x) => x.갈래 === "빌더" && x.단계 === "체크리스트").every((x) => x.글.includes("아임웹 관리자 아이디로")));
봄("블로그 채널이 있으면 블로그 아이디 요청 글", 모음.some((x) => x.갈래 === "플랫폼" && x.줄 === "blog" && x.글.includes("네이버 블로그 아이디로 저희가 들어갈 수 있게")));
봄("불안 팔지 않음 — 「늦」「서두르」「놓치」 0", !모음.some((x) => /늦|서두르|놓치/.test(x.글)));

// ─────────────── 원장 일감 금지어(D255)
// 이름 판별 말 — 흔한 말(원장 출처라 자동으로 못 고침) · 빈 말
for (const terms of [["송파구 영어 학원"], []]) {
  const row = { slug: "a", name: "가나영어학원", domain: null, relation: "외부", config: { answerTerms: terms, auto: { 출처: { 판별말: "원장" } } } };
  for (const t of 일감계획(row, 체크리스트(row, {})).열기) 원장모음.push({ 이름: `name ${terms.length}`, 줄: t.key, 글: `${t.title}\n${t.detail}` });
}
// 자동 세팅 멈춤 — 단계마다 원장으로 멈춘 말(단계 말 표 · 시간 초과 · 3번째 실패 꼴)
const 멈춘말 = [자동사람말.홈못엶(), 자동사람말.넘김("https://x.kr/"), 자동사람말.채널없음, 자동사람말.모름("업종·지역"), 자동사람말.후보적음(9),
  ...자동단계.flatMap((k) => [`${자동단계말[k]} 단계가 3번 다 시간 안에 안 끝났습니다. 「다시 시도」를 누릅니다`, `${자동단계말[k]} 단계가 오류로 멈췄습니다. 다시 시도합니다 — 3번째도 안 돼 멈췄습니다`])];
for (const 말 of 멈춘말) {
  const row = { slug: "a", name: "가게", domain: null, relation: "외부", config: { answerTerms: ["가나다라"], auto: { 단계: { 사이트: { 상태: "원장", 말 } } } } };
  for (const t of 일감계획(row, 체크리스트(row, {})).열기) 원장모음.push({ 이름: "auto", 줄: t.key, 글: `${t.title}\n${t.detail}` });
}
// 자동 세팅 판에 뜨는 말 원문(D260) — 단계 말(됨·원장·실패 전부, 원장으로 멈추면 할 일 글이 된다) · 업종·지역 출처 힌트.
// 기술 까닭은 오류 칸에만 둔다(시험 밖). 사람말 표는 위에서 함수로 돌렸다
const 자동원문 = fs.readFileSync(new URL("../../web/lib/auto-setup-core.mjs", import.meta.url), "utf8").split(/\r?\n/)
  .flatMap((l) => [...l.matchAll(/(?:말|출처): (["`])(.*?)\1/g)].map((m) => m[2]));
for (const html of ["", "<title>치과 미용실</title><p>서울 송파구 1</p><p>서울 강남구 2</p>", '<script type="application/ld+json">{"@type":"Dentist","address":"서울 송파구 1"}</script>']) {
  const 사실 = 사실뽑기(html, "가게");
  자동원문.push(사실.업종.출처, 사실.지역.출처);
}
for (const 글 of 자동원문) 원장모음.push({ 이름: "auto 원문", 줄: "말", 글 });
// 정찰 notracker(사람 대기로 열린다) — 제목·왜·할 일 원문
const 정찰 = fs.readFileSync(new URL("./scout.mjs", import.meta.url), "utf8");
const 정찰블록 = /report\(`notracker-[\s\S]*?\);/.exec(정찰)?.[0] ?? "";
원장모음.push({ 이름: "scout", 줄: "notracker", 글: 정찰블록.replace(/report\(`notracker-\$\{c\.slug\}`, "기회",/, "") });
// 일감 제목 표 전부 · 계약 할 일
for (const [k, f] of Object.entries(일감제목)) 원장모음.push({ 이름: "제목표", 줄: k, 글: f("가게") });
원장모음.push({ 이름: "계약", 줄: "할일", 글: 계약말.할일 });

console.log(`원장 글 ${원장모음.length}개 · 자동 원문 ${자동원문.length}줄`);
봄("원장 글을 모았다 — 일감·할 일 순서·자동 말·정찰", 원장모음.length > 500 && 자동원문.length >= 5 && 정찰블록.includes("AI가 사이트를 읽으러"), `${원장모음.length} · ${자동원문.length} · ${정찰블록.length}`);
const 원장걸림 = 원장모음.map((x) => ({ ...x, 말: 원장금지말찾기(x.글) })).filter((x) => x.말.length);
봄(`원장 일감 금지어 0 (목록 ${원장금지말.length}개)`, !원장걸림.length, 원장걸림.slice(0, 6).map((x) => `${x.이름} ${x.줄} [${x.말.join(",")}] ${x.글.slice(0, 90)}`).join("\n   "));
봄("열린 원장 일감 종류 — send·gsc·keyfile·name·auto 가 다 나옴 · 계약 전 measure 는 안 열림", ["setup-send", "setup-gsc", "setup-keyfile", "setup-name", "setup-auto"].every((k) => 원장모음.some((x) => x.줄 === k))
  && !원장모음.some((x) => x.줄 === "setup-measure"));
봄("build 갈래 — 할 일 순서 2번째 줄이 홈페이지 만들기 시작", 원장모음.some((x) => x.줄 === "순서 build"));

// ─────────────── 착수 판정(Step 58) — 판의 모든 글자는 원장금지말 0, 고객에게 보낼 요약(D273)은 고객금지말 0 · 퍼센트·성공률류 0
{
  const 곳 = Object.keys(판정.곳정보);
  const 날 = (i) => 더하기(오늘, -10 + i);
  const 답들 = ["", "알파코딩학원을 추천합니다", "코딩은 일찍 배우면 좋습니다", "**미소치과**에서는"];
  const 판글 = [], 고객글 = [];
  for (const 날수 of [0, 3, 9]) for (const 업종 of ["코딩학원", "치과", null, "앱"]) for (const 사이트 of [null, "none", "setup", "build"]) for (const intake of ["됨", "아직", null]) for (const 언급 of [0, 1, 5]) {
    const 잰 = Array.from({ length: 날수 }, (_, i) => 날(i));
    const 창 = 판정.창고르기(잰);
    const rows = 잰.flatMap((d) => 곳.flatMap((m) => Array.from({ length: 5 }, (_, i) => ({ d, collection_method: m, stage: "local", mentioned: i < 언급, answer: 답들[i % 답들.length], prompt_id: `q${i}` }))));
    const 요인 = 판정.요인들({ rows, 창, 사이트상태: 사이트, 플랫폼: { page: { fetched: 언급 > 0 } }, intake상태: intake, 사실: { 업종, 지역: 언급 ? "송파구" : null }, 업종, 우리Re: 언급 === 5 ? null : /미소\s?치과/i });
    const 결과 = 판정.종합(요인);
    판글.push(...요인.flatMap((x) => [x.이름, x.숫자말, x.등급, x.이유말]), 결과.판정, ...결과.이유들, ...결과.못잰것, 판정.단계말(창),
      ...판정.레퍼런스줄({ 첫: { 창, 요인, 종합: 결과 }, 최근: { 창, 요인, 종합: 결과 } }));
    const s = 판정.고객요약({ 창, 요인, 종합: 결과 });
    if (s) 고객글.push(s);
  }
  for (let n = 0; n < 8; n++) 판글.push(판정.지난기록({ n, m: Math.floor(n / 2) }));
  판글.push(판정.기준안내);
  const 판걸림 = 판글.map((x) => ({ 글: x, 말: 원장금지말찾기(x) })).filter((x) => x.말.length);
  봄(`착수 판정 글 ${판글.length}개 — 원장금지말 0`, 판글.length > 1000 && !판걸림.length, 판걸림.slice(0, 3).map((x) => `[${x.말.join(",")}] ${x.글.slice(0, 80)}`).join("\n   "));
  const 고객걸림 = 고객글.map((x) => ({ 글: x, 말: [...금지말찾기(x), ...원장금지말찾기(x)] })).filter((x) => x.말.length);
  봄(`고객에게 보낼 요약 ${고객글.length}개 — 고객금지말·원장금지말 0`, 고객글.length > 100 && !고객걸림.length, 고객걸림.slice(0, 3).map((x) => `[${x.말.join(",")}] ${x.글.slice(0, 80)}`).join("\n   "));
  봄("착수 판정·고객 요약 — 「%」「성공률」「확률」「가능성」 0", ![...판글, ...고객글].some((x) => /%|성공률|확률|가능성/.test(x)));
  봄("고객 요약 — 불안 팔지 않음(「늦」「서두르」「놓치」 0) · 경쟁 이름 없음", !고객글.some((x) => /늦|서두르|놓치|알파/.test(x)));
}

console.log(`${통과} 통과 · ${실패} 실패`);
if (실패) process.exitCode = 1;
