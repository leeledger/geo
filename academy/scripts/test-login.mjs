// 로그인 창 버튼(Step 39b) 단위 시험 — 판정 정규식·대상 표·open-session 판정 걸음·pc-runner 시간창·todo-text 분기·창요청(가짜 q). DB·브라우저 없음.
//   node scripts/test-login.mjs
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { 구글나감, 네이버나감, 빙나감, 네이버쿠키, 판정걸음 } from "../../tools/login-rules.mjs";
import { 로그인대상, 창요청검사, 확인된곳, 창이름, 창요청, 오래된창요청닫기 } from "../../web/lib/login-core.mjs";
import { 시간창안, 끝줄, 옛작업상태, 관리자한줄, 차례 } from "../../tools/pc-runner.mjs";

let 통과 = 0, 실패 = 0;
const 봄 = (이름, 참, 보탬 = "") => { if (참) 통과++; else { 실패++; console.log(`✗ ${이름}${보탬 ? ` — ${보탬}` : ""}`); } };

// ─────────────────────────────────────────── login-rules
const 옛빙 = (u) => /login|signin|\/webmasters\/about/i.test(u);
const 빙주소 = [
  "https://www.bing.com/webmasters/about", "https://www.bing.com/webmasters/about?ref=x", "https://login.live.com/oauth20_authorize.srf",
  "https://www.bing.com/webmasters/submiturl?siteUrl=https%3A%2F%2Frobotncoding.com%2F", "https://www.bing.com/webmasters/home",
  "https://www.bing.com/signin?x", "https://login.microsoftonline.com/common/oauth2",
];
봄("빙 판정 — 옮긴 뒤에도 같은 결과", 빙주소.every((u) => 빙나감(u) === 옛빙(u)), 빙주소.map((u) => `${빙나감(u)}/${옛빙(u)}`).join(" "));
봄("빙 /webmasters/about 은 풀림", 빙나감("https://www.bing.com/webmasters/about"));
봄("빙 제출 화면은 됨", !빙나감("https://www.bing.com/webmasters/submiturl?siteUrl=https%3A%2F%2Frobotncoding.com%2F"));
봄("구글 /about 풀림 · 속성 화면 됨", 구글나감("https://search.google.com/search-console/about") && !구글나감("https://search.google.com/search-console?resource_id=sc-domain%3Arobotncoding.com"));
봄("네이버 로그인 화면 풀림", 네이버나감("https://nid.naver.com/nidlogin.login") && !네이버나감("https://searchadvisor.naver.com/console/board"));
봄("NID_AUT 만료일 있음 → 유지", 네이버쿠키([{ name: "NID_AUT", expires: 1893456000 }]) === "유지");
봄("NID_AUT 세션 쿠키 → 세션만", 네이버쿠키([{ name: "NID_AUT", expires: -1 }]) === "세션만");
봄("NID_AUT 없음", 네이버쿠키([{ name: "NID_SES", expires: 1 }]) === "없음" && 네이버쿠키(undefined) === "없음");

// 판정 걸음 — 두 번 연속 + 10초
const 걸음들 = (seq, isOut = 빙나감) => {
  let st = { streak: 0 }, ok = false;
  for (const [url, t] of seq) { st = 판정걸음(st, { url, now: t, openedAt: 0, isOut }); if (st.ok) { ok = t; break; } }
  return ok;
};
const 됨주소 = "https://www.bing.com/webmasters/submiturl?siteUrl=x";
봄("한 번 된 주소는 ✓ 아님", 걸음들([[됨주소, 12000]]) === false);
봄("두 번 연속이어도 10초 전이면 ✓ 아님", 걸음들([[됨주소, 3000], [됨주소, 6000]]) === false);
봄("두 번 연속 + 10초 → ✓", 걸음들([[됨주소, 3000], [됨주소, 6000], [됨주소, 9000], [됨주소, 12000]]) === 12000);
봄("리다이렉트 전 주소 → 풀림 → 처음부터", 걸음들([[됨주소, 9000], ["https://www.bing.com/webmasters/about", 12000], [됨주소, 15000]]) === false);
봄("about:blank 는 안 셈", 걸음들([["about:blank", 12000], ["about:blank", 15000]]) === false);
봄("네이버 쿠키가 없으면 주소가 돼도 ✓ 아님", !판정걸음({ streak: 5 }, { url: "https://searchadvisor.naver.com/x", now: 20000, openedAt: 0, isOut: 네이버나감, extraOk: false }).ok);

// ─────────────────────────────────────────── 대상 표
봄("login-google → google · 학원 프로필", JSON.stringify(로그인대상("login-google", "robotncoding")) === JSON.stringify({ sites: ["google"], profile: ".browser-profile" }));
봄("login-naver → naver", 로그인대상("login-naver", null)?.sites[0] === "naver");
봄("login-microsoft → microsoft", 로그인대상("login-microsoft", null)?.sites[0] === "microsoft");
봄("login-naver-blog-<slug> → 고객 행 slug 프로필", JSON.stringify(로그인대상("login-naver-blog-docttak", "docttak")) === JSON.stringify({ sites: ["blog"], profile: ".browser-profile-docttak" }));
봄("dedupe slug 와 고객 행 slug 가 다르면 null", 로그인대상("login-naver-blog-docttak", "ilog") === null);
봄("dedupe 글자로 경로를 안 만듦(../)", 로그인대상("login-naver-blog-../x", "../x") === null);
봄("모르는 login-* → null", 로그인대상("login-kakao", null) === null);
봄("창요청검사 — 학원 프로필 셋", 창요청검사({ profile: ".browser-profile", sites: ["google", "microsoft"], from: 3 })?.from === 3);
봄("창요청검사 — from 이 글자(bigint)여도 숫자로", 창요청검사({ profile: ".browser-profile", sites: ["google"], from: "1699" })?.from === 1699);
봄("창요청검사 — 블로그는 고객 프로필 하나", 창요청검사({ profile: ".browser-profile-docttak", sites: ["blog"] }) !== null && 창요청검사({ profile: ".browser-profile", sites: ["blog"] }) === null);
봄("창요청검사 — 이상한 프로필 거부", 창요청검사({ profile: "../../x", sites: ["google"] }) === null && 창요청검사({ profile: ".browser-profile-docttak", sites: ["google"] }) === null);
봄("창요청검사 — 모르는 곳 거부", 창요청검사({ profile: ".browser-profile", sites: ["kakao"] }) === null && 창요청검사(null) === null);
const 출력 = `브라우저를 띄웠습니다\n  ✓ ${창이름.google} 로그인 확인\n\n아직 확인 안 된 곳: ${창이름.microsoft}`;
봄("open-session 출력 읽기 — 일부", JSON.stringify(확인된곳(출력, ["google", "microsoft"])) === JSON.stringify({ 됨: ["google"], 안됨: ["microsoft"] }));
봄("open-session 출력 읽기 — 없음", 확인된곳("", ["blog"]).안됨[0] === "blog");
// open-session 이 찍는 글자와 표가 같다
const 원문 = fs.readFileSync(new URL("../../tools/open-session.mjs", import.meta.url), "utf8");
봄("open-session 이름 = 창이름 표", Object.values(창이름).every((n) => 원문.includes(`"${n}"`)) && 원문.includes("✓ ${s.name} 로그인 확인"));

// ─────────────────────────────────────────── pc-runner
const 때 = (hm) => Date.parse(`2026-10-06T${hm}:00+09:00`);
봄("LOGIN_POLL_HOURS 빈 값 = 끔", !시간창안("", 때("12:00")) && !시간창안(undefined, 때("12:00")));
봄("8-24 — 12시 켬 · 7시 끔 · 23:59 켬", 시간창안("8-24", 때("12:00")) && !시간창안("8-24", 때("07:59")) && 시간창안("8-24", 때("23:59")));
봄("0-24 — 늘", 시간창안("0-24", 때("00:00")) && 시간창안("0-24", 때("23:59")));
봄("모양 틀림 = 끔", !시간창안("8~24", 때("12:00")) && !시간창안("24-8", 때("12:00")) && !시간창안("8-25", 때("12:00")));
봄("종료코드 3 → 건너뜀 줄", 끝줄("local-agent", 3, 0).startsWith("건너뜀 local-agent · 다른 실행이 돌고 있음") && 끝줄("local-agent", 0, 5) === "끝 local-agent · 종료코드 0 · 5초");
봄("측정 16:00 — 10:00 에 돈 뒤 16:00 에 또 차례", 차례({ at: ["10:00", "16:00"] }, 때("10:00"), 때("16:01")) && !차례({ at: ["10:00", "16:00"] }, 때("10:00"), 때("15:59")));
봄("옛 작업 상태 — 사용 안 함 = 끔", 옛작업상태('"\\Cited AI Measure","N/A","사용 안 함"\r\n') === "끔" && 옛작업상태('"\\Cited AI Measure","N/A","Disabled"') === "끔");
봄("옛 작업 상태 — 준비 = 켜짐", 옛작업상태('"\\Cited AI Measure","2026-10-06 오후 9:30:00","준비"\r\n"\\Cited AI Measure","2026-10-06 오후 9:30:00","준비"') === "켜짐");
봄("옛 작업 상태 — 빈 출력 = 모름", 옛작업상태("") === "모름");
봄("관리자 한 줄", 관리자한줄(["\\Cited Heartbeat", "\\Cited AI Measure"]) === "Get-ScheduledTask -TaskPath '\\' -TaskName 'Cited Heartbeat','Cited AI Measure' | Disable-ScheduledTask");
const pc원문 = fs.readFileSync(new URL("../../tools/pc-runner.mjs", import.meta.url), "utf8");
봄("pc-runner — 로그인 타이머는 busy 와 따로", /setInterval\(loginTick, 60_000\)/.test(pc원문) && /loginBusy/.test(pc원문));
const la원문 = fs.readFileSync(new URL("../../tools/local-agent.mjs", import.meta.url), "utf8");
봄("local-agent — 잠금 건너뜀 종료코드 3", /이미 돌고 있습니다 — 건너뜀"\);\s*process\.exit\(3\)/.test(la원문));
봄("local-agent — login 문구에 현황판 버튼", (la원문.match(/현황판 「로그인 창 열기」를 누르거나 PC 에서 node tools\/open-session\.mjs/g) ?? []).length === 2);
봄("bing-submit-urls 는 login-rules 를 씀", /import \{ 빙나감 \} from "\.\/login-rules\.mjs"/.test(fs.readFileSync(new URL("../../tools/bing-submit-urls.mjs", import.meta.url), "utf8")));

// ─────────────────────────────────────────── todo-text login 분기 — TS 를 깎아 임시 파일로(agents 는 글자 그대로 돌려주는 가짜)
{
  const ts = createRequire(new URL("../../web/package.json", import.meta.url))("typescript");
  const 글 = fs.readFileSync(new URL("../../web/lib/todo-text.ts", import.meta.url), "utf8")
    .replace('import { plain, WORKFLOW_PLAIN } from "./agents";', "const plain = (s) => s; const WORKFLOW_PLAIN = {};");
  const js = ts.transpileModule(글, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  const 임시 = path.join(os.tmpdir(), `todo-text-${process.pid}.mjs`);
  fs.writeFileSync(임시, js);
  try {
    const { todoText } = await import(pathToFileURL(임시).href);
    const 기본 = { agent: "deliver", kind: "human", title: "빙 웹마스터 로그인이 풀렸습니다", detail: "로컬 에이전트가 …", error: "", evidence: "", link: null, payload: { sticky: true } };
    const x = todoText({ ...기본, dedupe: "login-microsoft" });
    봄("todo-text — login-* → 로그인 창 버튼", x.action.type === "login" && x.why.startsWith("버튼을 누르면 원장 PC 에 로그인 창이 뜹니다"));
    봄("todo-text — 다른 human 은 그대로", todoText({ ...기본, dedupe: "bing-site-docttak" }).action.type !== "login");
    const 지금 = Date.parse("2026-10-06T14:10:00+09:00");
    const 눌림 = todoText({ ...기본, dedupe: "login-microsoft", evidence: "2026-10-06 14:05 로그인 창 요청함(14:05 KST)" }, 지금);
    봄("todo-text — 누른 뒤 「조치 중 · 로그인 창 요청함」", /^조치 중 · 10\/06 로그인 창 요청함\(14:05 KST\)/.test(눌림.doing ?? ""), 눌림.doing);
    봄("todo-text — 창 못 엶은 조치 중 아님", todoText({ ...기본, dedupe: "login-microsoft", evidence: "2026-10-06 14:40 로그인 창 못 엶 — PC 가 꺼져 있어 창을 못 열었습니다" }, 지금).doing === null);
  } finally { fs.rmSync(임시, { force: true }); }
}

// ─────────────────────────────────────────── 창요청 — 가짜 q (SQL 순서·인자만)
{
  const 로그 = [];
  const 행 = { id: 7, client_id: 3, dedupe_key: "login-naver-blog-docttak", title: "문서딱 블로그 로그인 필요", slug: "docttak" };
  const 가짜 = ({ 찾음 = true, 넣음 = true } = {}) => async (s, p = []) => {
    로그.push([s.replace(/\s+/g, " ").trim().slice(0, 40), p]);
    if (/^\s*select t\.id/.test(s)) return 찾음 ? [행] : [];
    if (/^\s*insert into geo\.agent_tasks/.test(s)) return 넣음 ? [{ id: 99 }] : [];
    if (/^\s*select id from geo\.agent_tasks/.test(s)) return [{ id: 99 }];
    return [];
  };
  const 때 = new Date("2026-10-06T05:05:00Z");
  let r = await 창요청(가짜(), 7, 때);
  const 넣기 = 로그.find((x) => x[0].startsWith("insert"));
  봄("창요청 — open-login 로컬 대기 · dedupe open-login-naver-blog-docttak", r.ok && !r.이미 && 넣기?.[1][1] === "open-login-naver-blog-docttak");
  봄("창요청 — payload 프로필·곳·from·sticky", (() => { const p = JSON.parse(넣기[1][3]); return p.profile === ".browser-profile-docttak" && p.sites.join() === "blog" && p.from === 7 && p.sticky === true; })());
  봄("창요청 — login 일감 근거에 「로그인 창 요청함(14:05 KST)」", 로그.some((x) => x[0].startsWith("update geo.agent_tasks") && x[1][1] === "2026-10-06 14:05 로그인 창 요청함(14:05 KST)"));
  로그.length = 0;
  r = await 창요청(가짜({ 넣음: false }), 7, 때);
  봄("창요청 — 이미 대기·실행 중이면 그대로(근거 안 붙임)", r.ok && r.이미 && !로그.some((x) => x[0].startsWith("update")));
  r = await 창요청(가짜({ 찾음: false }), 8, 때);
  봄("창요청 — login-* 사람 대기가 아니면 거부", !r.ok && r.err === "not-login");
  const 원문2 = fs.readFileSync(new URL("../../web/lib/login-core.mjs", import.meta.url), "utf8");
  봄("창요청 SQL — 사람 대기·human·login-%·kin-captcha-% 만", /t\.status = '사람 대기' and t\.kind = 'human' and \(t\.dedupe_key like 'login-%' or t\.dedupe_key like 'kin-captcha-%'\)/.test(원문2));
  봄("창요청 SQL — 로컬 대기·실행 중이면 안 덮음", /where geo\.agent_tasks\.status not in \('로컬 대기', '실행 중'\)/.test(원문2));
  const 닫음 = await 오래된창요청닫기(async (s, p = []) => (/^\s*update geo\.agent_tasks set status = '실패'/.test(s)
    ? [{ id: 99, client_id: 3, payload: { from: 7 }, last_error: "PC 가 꺼져 있어 창을 못 열었습니다" }] : (로그.push([s, p]), [])), 때);
  봄("30분 지난 요청 → 실패 + login 일감 근거", 닫음.length === 1 && 로그.some((x) => x[1][0] === 7 && /PC 가 꺼져 있어/.test(x[1][1])));
  봄("오래된창요청닫기 SQL — 30분 로컬 대기·20분 실행 중", /status = '로컬 대기' and updated_at < now\(\) - interval '30 minutes'/.test(원문2) && /status = '실행 중' and updated_at < now\(\) - interval '20 minutes'/.test(원문2));
}

console.log(`\n${통과} 통과 · ${실패} 실패`);
if (실패) process.exitCode = 1;
