/**
 * 지식iN 실제 질문 찾기(Step 41) — 고객 네이버 프로필로 kin.naver.com 을 읽어, 고객 도구로 풀리는 최근 질문을 geo.kin_questions 에 넣는다.
 * kin-agent.mjs 가 하루 세 번 부른다. 답은 marketing-draft.mjs --kin-question 이 쓰고, 등록은 원장이 누른다.
 *
 * 주 출처는 분야 새 질문 목록(clients.mjs marketing.kinDirs)이다. 검색 최신순은 「마지막 답 날」 순이라 옛 질문으로 찬다(첫 실행 후보 0, KG-41-3).
 * 검색은 분야에서 후보를 다 못 채웠을 때만(보조).
 * 화면 글자만 읽는다. 누르는 것은 없다(주소 이동뿐). 캡차·차단이 뜨면 멈추고 사람 일감 — 우회하지 않는다.
 * 요청 사이 3~6초 쉼, 분야 목록 하루 15쪽(한 번에 5) · 검색 하루 10회(한 번에 4) — .kin-find-day.json 에 따로 셈, 후보 하루 3개.
 * 질문 열기는 하루 10번. 캡차를 만난 날은 .kin-find-day.json blocked 로 적고 그날 다시 열지 않는다(종료코드 4).
 * 실행마다 geo.kin_runs 한 줄(돎·막힘·실패·안 돎) — 현황판 공급 줄이 못 잰 날을 0 으로 띄우지 않게.
 * 하루 세 번(kin-agent.mjs, pc-runner 09·13·19시) 돈다. 분야마다 본 가장 큰 docId 를 적어 두고 그보다 새 질문만 본다.
 *
 * 거름: 질문 날 7일 안(오늘 포함) · 채택 답 없음 · 답 3개 미만 · 제목·본문이 고객 페이지 줄(marketing.pages)에 맞음.
 * 목록 제목·토막이 페이지 줄에 안 맞으면 질문을 열지 않는다(목록 글은 잘려 있어 몇 개는 놓친다 — 요청 수를 아끼는 쪽).
 * 열어 보고 떨어진 질문도 「버림」(까닭)으로 남긴다 — 다음 날 같은 질문을 다시 열지 않게.
 *
 *   node tools/kin-find.mjs --client docttak              찾아서 넣는다
 *   node tools/kin-find.mjs --client docttak --dry        찍기만(DB 안 바꿈). 검색 횟수는 센다
 *   node tools/kin-find.mjs --client docttak --query "pdf 용량 줄이기"   그 검색어 하나만(밀린 초안 정리). 후보 1개까지
 *   node tools/kin-find.mjs --client docttak --look [--query ...]  화면 원문을 academy/scripts/fixtures/kin/ 에 찍는다(셀렉터 확인용)
 *
 * 끝 코드: 0 정상 · 1 실패(화면 못 읽음 등) · 2 로그인 필요 · 4 캡차·차단
 * 출력 「FOUND <id> <url>」 줄은 밀린 초안 정리(kin-backlog.mjs)가 읽는다.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import pg from "pg";
import { loadClients } from "../academy/clients.mjs";
import { 네이버쿠키 } from "./login-rules.mjs";
import { 목록주소, 목록읽기, 분야주소, 분야읽기, 도구맞음, 질문읽기, 날짜풀기, 막힘, 후보거름, kst날 } from "../web/lib/kin-core.mjs";
import { MARKETING_DDL } from "../web/lib/marketing-core.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DAY_FILE = path.join(HERE, ".kin-find-day.json");
const OS_LOCK = path.join(HERE, ".open-session.lock");
const FIXTURE = path.join(HERE, "../academy/scripts/fixtures/kin");

const arg = (k) => { const i = process.argv.indexOf(k); return i >= 0 ? process.argv[i + 1] : null; };
const SLUG = arg("--client");
const LOOK = process.argv.includes("--look");
const DRY = process.argv.includes("--dry") || LOOK;
const ONE = arg("--query");

// 하루 세 번 돈다(kin-agent, 09·13·19시). 분야 목록은 하루 15쪽 · 한 번에 5쪽, 검색은 하루 10회 · 한 번에 4회
const 검색상한 = 10, 분야상한 = 15, 분야한번 = 5, 검색한번 = ONE ? 1 : 4, 후보상한 = ONE ? 1 : 3, 열기상한 = ONE ? 4 : 8, 열기하루 = 10;
const 오늘 = kst날();
const 일주일전 = new Date(Date.parse(`${오늘}T00:00:00Z`) - 6 * 86400000).toISOString().slice(0, 10);
const 쉼 = () => new Promise((r) => setTimeout(r, 3000 + Math.floor(Math.random() * 3000)));

if (!SLUG) { console.log("사용법: node tools/kin-find.mjs --client <slug> [--dry] [--query 검색어] [--look]"); process.exit(1); }

for (const l of fs.readFileSync(path.join(HERE, "../academy/.env.local"), "utf8").split(/\r?\n/)) {
  const m = /^([A-Z_]+)=(.*)$/.exec(l);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}
const u = new URL(process.env.DATABASE_URL);
u.searchParams.delete("sslmode");
// 브라우저가 몇 분 도는 동안 연결을 붙잡지 않게 쿼리마다 연다(local-agent 와 같은 줄)
const q = async (s, p = []) => {
  const c = new pg.Client({ connectionString: u.toString(), ssl: { rejectUnauthorized: process.env.DATABASE_SSL_INSECURE !== "true" } });
  await c.connect();
  try { return (await c.query(s, p)).rows; } finally { await c.end().catch(() => {}); }
};
const 활동 = (ok, summary, clientId) => DRY ? Promise.resolve() :
  q(`insert into geo.agent_activity (client_id, agent, action, ok, summary, run_url) values ($1,'deliver','지식iN 질문 찾기',$2,$3,'kin-find')`,
    [clientId, ok, String(summary).slice(0, 1000)]).catch(() => {});
const 사람일감 = (clientId, dedupe, title, detail) => DRY ? Promise.resolve() :
  q(`insert into geo.agent_tasks (client_id, agent, kind, dedupe_key, title, detail, status, priority, payload)
     values ($1, 'deliver', 'human', $2, $3, $4, '사람 대기', 5, '{"sticky":true}'::jsonb)
     on conflict (client_id, dedupe_key) do update set status='사람 대기', detail=excluded.detail, updated_at=now()`, [clientId, dedupe, title, detail]);

const [c] = await loadClients(q, { slug: SLUG, includeTest: true });
if (!c?.marketing?.pages?.length || !c.marketing.blogProfile) {
  console.log(`✗ ${SLUG}: 바깥 글 페이지 줄(marketing.pages)이나 네이버 프로필(marketing.blogProfile)이 없습니다`);
  process.exit(1);
}
const 맞는페이지 = (t) => c.marketing.pages.find((x) => x.re.test(t)) ?? null;
const 프로필 = path.join(HERE, c.marketing.blogProfile);
const 로그인일감 = (why) => 사람일감(c.id, `login-naver-blog-${c.slug}`, `${c.name} 네이버 로그인 필요`,
  `${why} 지식iN 질문 찾기·답 창이 이 프로필(${c.marketing.blogProfile})을 씁니다. 현황판 「로그인 창 열기」를 누르거나 PC 에서 node tools/open-session.mjs --blog ${c.marketing.blogProfile} 로 로그인해 주세요.`);

if (!DRY) for (const s of MARKETING_DDL) await q(s);
/**
 * 실행 한 번 = kin_runs 한 줄(KG-41-6 · Richard Must Fix b). 돈 것만이 아니라 막힘·실패·안 돎도 남긴다 — 현황판이 못 잰 날을 0 으로 띄우지 않게.
 * status 돎 · 막힘(캡차) · 실패(로그인·화면 바뀜·오류) · 안 돎(상한·창 떠 있음). --dry 는 안 남긴다
 */
const 실행기록 = (status, note, n = {}) => DRY ? Promise.resolve() :
  q(`insert into geo.kin_runs (client_id, status, note, read, matched, candidates) values ($1,$2,$3,$4,$5,$6)`,
    [c.id, status, String(note).slice(0, 300), n.read ?? 0, n.matched ?? 0, n.candidates ?? 0]).catch((e) => console.log(`  ⚠ kin_runs 못 남김: ${e.message}`));
const 그만 = async (code, status, note, line) => { console.log(line); await 실행기록(status, note); process.exit(code); };

if (!fs.existsSync(프로필)) {
  await 로그인일감("네이버 프로필이 아직 없습니다.");
  await 활동(false, "로그인 필요 — 프로필 없음", c.id);
  await 그만(2, "실패", "로그인 필요 — 프로필 없음", `✗ 로그인이 필요합니다 — 프로필 ${c.marketing.blogProfile} 이 없습니다`);
}
// 로그인 창(login-poll → open-session·kin-open)이 같은 프로필을 쓰고 있으면 안 연다 — 크로미움이 깨진다
if (fs.existsSync(OS_LOCK) && Date.now() - fs.statSync(OS_LOCK).mtimeMs < 13 * 60000) {
  await 그만(1, "안 돎", "로그인·답 창이 떠 있음", "✗ 로그인·답 창이 떠 있습니다 — 다음 차례에 다시");
}

// 검색 하루 10회 · 분야 목록 하루 15쪽 · 질문 열기 하루 10번 — 따로 센다. --dry·--look 도 실제 요청이라 센다
// seen — 분야마다 지금까지 본 가장 큰 docId. 다음 실행은 그보다 새 질문만 「읽은 질문」으로 센다(세 번 돌아도 겹쳐 세지 않게)
// blocked — 캡차를 만난 날. 그날은 다시 열지 않는다(13·19시 차례·밀린 초안 정리 모두)
const 날기록 = (() => {
  try {
    const j = JSON.parse(fs.readFileSync(DAY_FILE, "utf8"));
    return j.day === 오늘 ? { lists: 0, opens: 0, seen: {}, ...j } : { day: 오늘, searches: 0, lists: 0, opens: 0, next: j.next ?? 0, seen: j.seen ?? {} };
  } catch { return { day: 오늘, searches: 0, lists: 0, opens: 0, next: 0, seen: {} }; }
})();
const 날저장 = () => fs.writeFileSync(DAY_FILE, JSON.stringify(날기록));
if (날기록.blocked === 오늘) await 그만(4, "막힘", "오늘 캡차 — 다시 안 엶", "✗ 오늘 캡차가 떴던 날입니다 — 우회하지 않고 건너뜀(캡차)");
const 분야남음 = !ONE && (c.marketing.kinDirs ?? []).length > 0 && 날기록.lists < 분야상한;
if ((날기록.searches >= 검색상한 && !분야남음) || 날기록.opens >= 열기하루) {
  await 그만(0, "안 돎", "하루 상한", `오늘 검색 ${날기록.searches}회·분야 목록 ${날기록.lists}쪽·질문 열기 ${날기록.opens}번 — 하루 상한이라 건너뜀`);
}

const 표없음 = (e) => (e?.code === "42P01" ? [] : Promise.reject(e));
const 승인 = (await q(`select pq.text from geo.pilot_questions pq join geo.pilots p on p.id = pq.pilot_id
  where p.client_id = $1 and pq.approved and pq.stage = 'keyword' order by pq.position`, [c.id])).map((r) => r.text);
const 검색어들 = ONE ? [ONE] : 승인.filter((t) => 맞는페이지(t));
if (!검색어들.length) await 그만(0, "안 돎", "승인 검색어 없음", "승인 검색어가 없습니다 — 건너뜀");
const 오늘후보 = ONE ? 0 : Number((await q(`select count(*)::int n from geo.kin_questions where client_id = $1 and status = '후보'
  and (found_at at time zone 'Asia/Seoul')::date = $2::date`, [c.id, 오늘]).catch(표없음))[0]?.n ?? 0);
if (오늘후보 >= 후보상한) await 그만(0, "안 돎", "후보 하루 상한", `오늘 후보 ${오늘후보}개 — 하루 상한 ${후보상한}개라 건너뜀`);
const 본주소 = new Set((await q(`select url from geo.kin_questions where client_id = $1`, [c.id]).catch(표없음)).map((r) => r.url));

const ctx = await chromium.launchPersistentContext(프로필, {
  headless: false, viewport: { width: 1280, height: 900 }, locale: "ko-KR", timezoneId: "Asia/Seoul",
  args: ["--disable-blink-features=AutomationControlled"],
});
const page = ctx.pages()[0] ?? await ctx.newPage();
let 끝코드 = 0;
const 찾음 = [], 떨어짐 = [];
let 검색 = 0, 분야읽음 = 0, 열어봄 = 0, 못읽음 = "";
const 분야셈 = { 읽음: 0, 칠일: 0, 맞음: 0 };
try {
  if (네이버쿠키(await ctx.cookies("https://nid.naver.com").catch(() => [])) === "없음") {
    console.log("✗ 로그인이 필요합니다 — 네이버 로그인이 풀렸습니다");
    await 로그인일감("네이버 로그인이 풀렸습니다.");
    await 활동(false, "로그인 필요", c.id);
    await 실행기록("실패", "로그인 필요");
    끝코드 = 2;
  } else {
    const 시작 = ONE ? 0 : 날기록.next % 검색어들.length;
    const 차례 = [...검색어들.slice(시작), ...검색어들.slice(0, 시작)];
    const 열기 = async (url) => {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
      await page.waitForTimeout(1500);
      const text = await page.evaluate(() => document.body?.innerText ?? "").catch(() => "");
      if (막힘(text, page.url())) throw Object.assign(new Error(`캡차·차단 화면: ${page.url()}`), { 막힘: true });
      return page.content();
    };
    const 다참 = () => 찾음.length + 오늘후보 >= 후보상한 || 열어봄 >= 열기상한 || 날기록.opens >= 열기하루;
    // 질문 하나를 열어 읽고 거르고 남긴다. false 면 화면을 못 읽은 것
    const 살펴보기 = async (url, query) => {
      await 쉼();
      const d = await 열기(url);
      열어봄++; 날기록.opens++; 날저장();
      본주소.add(url);
      if (LOOK) fs.writeFileSync(path.join(FIXTURE, `detail-${new URL(url).searchParams.get("docId")}.html`), 원문줄임(d));
      const r = 질문읽기(d);
      if (!r) { 못읽음 = `질문 페이지를 못 읽었습니다(화면이 바뀜): ${url}`; return false; }
      const asked = 날짜풀기(r.askedText);
      const 까닭 = 후보거름({ ...r, asked }, 오늘, 맞는페이지);
      console.log(`  ${까닭 ? "·" : "✓"} ${asked ?? r.askedText ?? "날짜?"} 답 ${r.answers}${r.adopted ? " 채택" : ""} | ${r.title.slice(0, 60)} | ${url}${까닭 ? ` — ${까닭}` : ""}`);
      (까닭 ? 떨어짐 : 찾음).push({ ...r, asked, url, query, 까닭 });
      if (DRY || !asked) return true;
      const [row] = await q(`insert into geo.kin_questions (client_id, url, title, body, asked_at, answers, adopted, query, status, note)
           values ($1,$2,$3,$4,$5::date,$6,$7,$8,$9,$10) on conflict (url) do nothing returning id`,
        [c.id, url, r.title.slice(0, 300), r.body.slice(0, 4000), asked, r.answers, r.adopted, query, 까닭 ? "버림" : "후보", 까닭 ?? ""]);
      if (row && !까닭) console.log(`FOUND ${row.id} ${url}`);
      return true;
    };

    /**
     * ① 분야 새 질문 목록(주 출처, KG-41-3) — 최신 질문 순이라 7일 안 질문이 바로 보인다. 쪽 1 을 분야마다 먼저, 남으면 쪽 2.
     * 목록에는 본문이 없어 제목만으로 고객 페이지 줄에 맞는지 거른다. 검색어 칸은 같은 페이지 줄에 맞는 승인 검색어(없으면 「분야 <번호>」)
     */
    // 분야마다 쪽 1. 쪽 1 이 전부 앞 실행 뒤 새 질문이면(사이에 놓친 게 있을 수 있다) 쪽 2 를 뒤에 붙인다. 한 번에 5쪽, 하루 15쪽
    const 차례쪽 = (ONE ? [] : (c.marketing.kinDirs ?? [])).map((dir) => ({ dir, 쪽: 1 }));
    const docId = (url) => Number(new URL(url).searchParams.get("docId"));
    for (let k = 0; k < 차례쪽.length; k++) {
      const { dir, 쪽 } = 차례쪽[k];
      if (날기록.lists >= 분야상한 || 분야읽음 >= 분야한번 || 다참() || 못읽음) break;
      if (분야읽음 > 0) await 쉼();
      const html = await 열기(분야주소(dir, 쪽));
      분야읽음++; 날기록.lists++; 날저장();
      const 줄 = 분야읽기(html);
      if (LOOK) { fs.mkdirSync(FIXTURE, { recursive: true }); const a = html.indexOf("<table"); fs.writeFileSync(path.join(FIXTURE, `dir-${dir}-${쪽}.html`), a >= 0 ? html.slice(a, html.indexOf("</table>", a) + 8) : html); }
      if (!줄.length) { 못읽음 = `분야 ${dir} 질문 목록을 못 읽었습니다(화면이 바뀜)`; break; }
      const 전 = Number(날기록.seen[dir] ?? 0);
      const 새 = 줄.filter((x) => docId(x.url) > 전);
      if (쪽 === 1 && 전 && 새.length === 줄.length) 차례쪽.push({ dir, 쪽: 2 });
      const 안 = 새.filter((x) => { const d = 날짜풀기(x.when); return d && d >= 일주일전; });
      const 맞음 = 안.filter((x) => 도구맞음(x.title, 맞는페이지));
      분야셈.읽음 += 줄.length; 분야셈.칠일 += 안.length; 분야셈.맞음 += 맞음.length;
      console.log(`\n분야 ${dir} 쪽 ${쪽}: 질문 ${줄.length} · 처음 봄 ${새.length} · 그중 7일 안 ${안.length} · 도구 말 맞음 ${맞음.length}${맞음.length ? ` (${맞음.map((x) => x.title.slice(0, 30)).join(" / ")})` : ""}`);
      for (const x of 맞음) {
        if (본주소.has(x.url) || (x.answers != null && x.answers >= 3)) continue;
        if (다참()) break;
        const p줄 = 도구맞음(x.title, 맞는페이지);
        if (!(await 살펴보기(x.url, 승인.find((t) => 맞는페이지(t) === p줄) ?? `분야 ${dir}`))) break;
      }
      // 본 자리 — --dry 는 안 적는다(저장 안 한 질문을 다음 실제 실행이 건너뛰면 안 된다)
      if (!DRY) { 날기록.seen[dir] = Math.max(전, ...줄.map((x) => docId(x.url))); 날저장(); }
    }

    // ② 검색(보조) — 분야에서 다 못 채웠을 때
    for (const [i, query] of 차례.entries()) {
      if (못읽음 || 날기록.searches >= 검색상한 || 검색 >= 검색한번 || 다참()) break;
      if (검색 > 0 || 분야읽음 > 0) await 쉼();
      const html = await 열기(목록주소(query));
      검색++; 날기록.searches++; 날기록.next = ONE ? 날기록.next : (시작 + i + 1) % 검색어들.length; 날저장();
      const 목록 = 목록읽기(html);
      console.log(`\n「${query}」 목록 ${목록.줄.length}개${목록.없음 ? " (검색결과 없음)" : ""}`);
      if (LOOK) {
        fs.mkdirSync(FIXTURE, { recursive: true });
        const ul = html.indexOf('<ul class="basic1"');
        fs.writeFileSync(path.join(FIXTURE, "list.html"), ul >= 0 ? html.slice(ul, html.indexOf("</ul>", ul) + 5) : html);
      }
      if (!목록.줄.length && !목록.없음) { 못읽음 = `「${query}」 검색 목록을 못 읽었습니다(화면이 바뀜)`; break; }
      for (const x of 목록.줄) {
        // 목록 날은 마지막 답 날일 수 있다 — 그게 7일 밖이면 질문도 밖이고, 최신순이라 뒤도 밖이다
        if (x.day && x.day < 일주일전) break;
        if (본주소.has(x.url)) continue;
        if (x.answers != null && x.answers >= 3) continue;
        if (!도구맞음(`${x.title}\n${x.snippet}`, 맞는페이지)) continue;
        if (다참()) break;
        if (!(await 살펴보기(x.url, query))) break;
      }
      if (못읽음) break;
    }
  }
} catch (e) {
  if (e.막힘) {
    console.log(`✗ ${e.message} — 우회하지 않고 멈춥니다(캡차)`);
    // 그날은 다시 열지 않는다 — --dry·--look 도 실제 요청이었으니 같이 적는다
    날기록.blocked = 오늘; 날저장();
    await 사람일감(c.id, `kin-captcha-${c.slug}`, "지식iN 이 자동 접근을 막았습니다(캡차)",
      `${오늘} 지식iN 질문 찾기 중 캡차·차단 화면이 떴습니다. 우회하지 않습니다. 오늘은 더 열지 않습니다. PC 에서 ${c.marketing.blogProfile} 프로필로 kin.naver.com 을 열어 한 번 풀어 주시면 다음 날부터 다시 찾습니다.`);
    await 활동(false, `캡차·차단 — 오늘 멈춤 (검색 ${검색}회 · 열어 본 질문 ${열어봄})`, c.id);
    await 실행기록("막힘", "캡차·차단 화면");
    끝코드 = 4;
  } else {
    console.log(`✗ ${e.message}`);
    await 활동(false, `실패: ${e.message}`, c.id);
    await 실행기록("실패", e.message);
    끝코드 = 1;
  }
} finally {
  await ctx.close().catch(() => {});
}

if (끝코드 === 0) {
  const 요약 = `분야 목록 ${분야읽음}쪽(질문 ${분야셈.읽음} · 처음 본 7일 안 ${분야셈.칠일} · 도구 말 맞음 ${분야셈.맞음}) · 검색 ${검색}회 · 열어 본 질문 ${열어봄} · 후보 ${찾음.length}${떨어짐.length ? ` · 떨어짐 ${떨어짐.length}` : ""}`;
  console.log(`\n${c.name} 지식iN — ${요약}${DRY ? " · --dry(저장 안 함)" : ""}`);
  for (const x of 찾음) console.log(`  후보 ${x.asked} 답 ${x.answers} | ${x.title} | ${x.url}`);
  if (못읽음) {
    console.log(`✗ ${못읽음}`);
    await 활동(false, `${못읽음} — ${요약}`, c.id);
    await 실행기록("실패", 못읽음);
    끝코드 = 1;
  } else {
    await 활동(true, 요약, c.id);
    // 현황판 「분야 목록에서 읽은 질문 · 맞는 질문」 — 맞는 질문은 열어 보고 도구와 맞았던 것(채택돼 놓친 것 포함, 검색으로 연 것도)
    await 실행기록("돎", 요약, { read: 분야셈.칠일, candidates: 찾음.length,
      matched: [...찾음, ...떨어짐].filter((x) => !["도구와 안 맞음", "질문을 못 읽음", "7일 지남", "질문 날짜 모름"].includes(x.까닭 ?? "")).length });
    // 캡차 일감은 다시 읽히면 풀린 것이다
    if (!DRY) await q(`update geo.agent_tasks set status='완료', done_at=now(), updated_at=now(), evidence=left(coalesce(evidence,'') || E'\n' || $3, 4000)
      where client_id=$1 and dedupe_key=$2 and status='사람 대기'`, [c.id, `kin-captcha-${c.slug}`, `${오늘} 지식iN 다시 읽힘`]).catch(() => {});
  }
}
process.exitCode = 끝코드;

/** --look 원문 — 스크립트·스타일·빈 줄을 뺀 질문 영역(시험 fixture). 화면이 바뀌면 다시 찍어 정규식을 맞춘다 */
function 원문줄임(html) {
  const 시작 = html.indexOf('<div class="endContent');
  return (시작 >= 0 ? html.slice(시작) : html)
    .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<svg[\s\S]*?<\/svg>/gi, "")
    .replace(/<p class="headerUsername">[^<]*<\/p>/g, "")   // 로그인한 계정 아이디는 fixture 에 남기지 않는다
    .replace(/\s*\n\s*/g, "\n");
}
