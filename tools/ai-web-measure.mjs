/**
 * 소비자 화면 AI 측정 — ChatGPT · Perplexity · Gemini 를 로그아웃 브라우저로 매일 묻는다.
 *
 * 원장(2026-09-24): 「AI 질문도 여러 곳에 지속적으로 하고 리포팅」. 그때까지 매일 재는 엔진은 Claude(구독) 하나뿐이었다.
 * ChatGPT 는 9/17 손으로 2문항 잰 게 전부였다. API 는 크레딧이 없어 못 쓴다 — 그래서 학부모가 실제로 보는 화면을 연다.
 *
 * 규칙 (ai-measure.mjs 와 같게 — 다른 방법의 숫자를 한 비율로 합치지 않도록 collection_method 를 따로 적는다)
 *   질문    geo.pilot_questions 승인된 20문항 (Claude 측정과 같은 것)
 *   세션    문항마다 새 브라우저 문맥 = 로그아웃 · 쿠키 없음 · 개인화 없음
 *   고객    --client <slug> 로 한 곳. 안 주면 대상 목록 전부 — 진행 중 파일럿 고객 → 학원 → 측정 켠 고객(academy/measure-targets.mjs)
 *           이름 판별 말이 없는 고객은 「측정 설정 없음」, 승인 질문이 없으면 「승인 질문 없음」으로 그 고객만 멈추고 그 고객 일감을 올린다
 *   언급    geo.clients.answer_pattern, 비었으면 clients.mjs answerRe (학원은 「똑똑한 로봇&코딩학원」을 뺀 이름, 아이로그는 도메인)
 *   인용    답 영역의 링크 중 그 고객 도메인
 *   상한    모든 고객을 합쳐 하루 60질의(로그아웃 화면 3곳 × 20문항, env WEB_MEASURE_DAILY_MAX). 넘으면 그날은 더 묻지 않는다.
 *           고객이 둘 이상이면 순서대로 나눠 쓰고, 못 잰 고객은 「예산 모자람」 사람 일감으로 올린다
 *   원문    answer·links 를 raw 에 남긴다 — 나중에 사람이 다시 볼 수 있게
 *
 *   node ai-web-measure.mjs                    세 엔진 × 오늘 안 잰 문항
 *   node ai-web-measure.mjs --engine chatgpt   한 엔진만
 *   node ai-web-measure.mjs --client ilog      한 고객만 (geo.clients 슬러그)
 *   node ai-web-measure.mjs --limit 3          문항 수 제한(시험)
 *   node ai-web-measure.mjs --install          작업 스케줄러 「Cited AI Measure」 매일 21:30 (PC 가 꺼져 있었으면 켜질 때)
 *
 * 엔진이 막히면(로그인 요구·캡차·답 없음 3번 연속) 그 엔진은 그날 멈춘다. 우회하지 않는다.
 */
import { chromium } from "playwright";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { 측정대상, 예산부족알림, 예산부족닫기 } from "../academy/measure-targets.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const LOCK = path.join(HERE, ".ai-web-measure.lock");
const LOG = path.join(HERE, "ai-web-measure.log");
const 기록 = (s) => {
  const line = `${new Date().toLocaleString("sv-SE", { timeZone: "Asia/Seoul" })} ${s}`;
  console.log(line);
  fs.appendFileSync(LOG, line + "\n");
};

if (process.argv.includes("--install")) {
  const node = process.execPath.replace(/'/g, "''");
  const script = fileURLToPath(import.meta.url).replace(/'/g, "''");
  const ps = [
    `$a = New-ScheduledTaskAction -Execute '${node}' -Argument ('"' + '${script}' + '"') -WorkingDirectory '${HERE.replace(/'/g, "''")}'`,
    `$t = New-ScheduledTaskTrigger -Daily -At 21:30`,
    `$s = New-ScheduledTaskSettingsSet -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Hours 3) -DontStopIfGoingOnBatteries -AllowStartIfOnBatteries`,
    `Register-ScheduledTask -TaskName 'Cited AI Measure' -Action $a -Trigger $t -Settings $s -Description '사이티드: ChatGPT·Perplexity·Gemini 소비자 화면 측정' -Force | Out-Null`,
    `Get-ScheduledTask -TaskName 'Cited AI Measure' | Select-Object TaskName, State | Format-List`,
  ].join("; ");
  execFileSync(path.join(process.env.SystemRoot || "C:\\Windows", "System32", "WindowsPowerShell", "v1.0", "powershell.exe"), ["-NoProfile", "-Command", ps], { stdio: "inherit" });
  process.exit(0);
}

const arg = (n) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : null; };
const ONLY = arg("--engine");
const LIMIT = Number(arg("--limit")) || 0;
const SLUG = arg("--client");   // 없으면 대상 목록 전부

if (fs.existsSync(LOCK) && Date.now() - fs.statSync(LOCK).mtimeMs >= 3 * 3600 * 1000) fs.rmSync(LOCK, { force: true });
try { fs.writeFileSync(LOCK, String(process.pid), { flag: "wx" }); } catch { 기록("이미 돌고 있습니다 — 건너뜀"); process.exit(0); }

for (const l of fs.readFileSync(path.join(HERE, "../academy/.env.local"), "utf8").split(/\r?\n/)) {
  const m = /^([A-Z_]+)=(.*)$/.exec(l);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}
/** 모든 고객 합계. 로그아웃 소비자 화면은 소량으로만 묻는다(research/pilot-measurement-sop.md). 올리는 건 원장 몫 — env 한 줄 */
const 하루상한 = /^\d+$/.test(String(process.env.WEB_MEASURE_DAILY_MAX ?? "").trim()) ? Number(process.env.WEB_MEASURE_DAILY_MAX) : 60;
const u = new URL(process.env.DATABASE_URL);
u.searchParams.delete("sslmode");
// 한 번 도는 데 한 시간 넘게 걸린다. 연결을 붙잡으면 Neon 이 끊으니 쿼리마다 연다(local-agent 와 같은 모양)
const q = async (s, p = []) => {
  const c = new pg.Client({ connectionString: u.toString(), ssl: { rejectUnauthorized: process.env.DATABASE_SSL_INSECURE !== "true" } });
  await c.connect();
  try { return (await c.query(s, p)).rows; } finally { await c.end().catch(() => {}); }
};

// 시작한 날로 적는다. 밤늦게 시작해 자정을 넘겨도 한 회차는 한 날짜 — 문항마다 날짜가 갈리면 같은 날끼리 비교가 깨진다
const 오늘 = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });

/**
 * 답만 남긴다. 화면 글에는 우리가 넣은 질문이 들어 있다 — q18~20 처럼 질문에 학원 이름이 있으면 답과 상관없이 「언급」이 된다(Richard 21).
 * Perplexity 는 답 아래 「관련」 후속 질문도 같은 영역에 있다 — 거기서 자른다
 */
export const 답만 = (화면글, 질문) => {
  let t = String(화면글 ?? "");
  const i = t.lastIndexOf(질문);
  if (i >= 0) t = t.slice(i + 질문.length);
  t = t.split(질문).join(" ");
  const 끝 = t.search(/\n(관련|관련 질문|Related|후속 질문|People also ask)\n/);
  if (끝 > 0) t = t.slice(0, 끝);
  return t.trim();
};

/** 답 영역이 더 안 늘어나면 끝난 것으로 본다. 최대 기다림 안에 안 멈추면 그때 글을 쓴다 */
const 다될때까지 = async (p, 읽기, 최대 = 90000) => {
  const t0 = Date.now();
  let 전 = "", 같음 = 0;
  await p.waitForTimeout(8000);
  while (Date.now() - t0 < 최대) {
    const 지금 = await 읽기().catch(() => "");
    if (지금 && 지금.length === 전.length) { if (++같음 >= 3) return 지금; } else 같음 = 0;
    전 = 지금;
    await p.waitForTimeout(2500);
  }
  return 전;
};

const 링크들 = async (p, scope, 제외) => {
  const hrefs = await p.$$eval(`${scope} a[href]`, (as) => as.map((a) => a.href)).catch(() => []);
  const out = [];
  for (const raw of hrefs) {
    if (!/^https?:/.test(raw)) continue;
    let url;
    try { url = new URL(raw); } catch { continue; }
    // 구글은 출처를 google.com/url?q=<진짜 주소> 로 감싼다(Gemini). 풀어서 본다 — 안 풀면 제외 목록에 걸려 인용을 놓친다
    if (/(^|\.)google\.[a-z.]+$/.test(url.hostname) && url.pathname === "/url") {
      const real = url.searchParams.get("q") || url.searchParams.get("url");
      try { if (real) url = new URL(real); } catch { continue; }
    }
    url.searchParams.delete("utm_source");   // ChatGPT 가 붙이는 꼬리. 문자열로 자르면 ?가 &로 남아 주소가 깨진다
    const host = url.hostname.replace(/^www\./, "");
    if (제외.some((d) => host === d || host.endsWith(`.${d}`))) continue;
    out.push({ url: url.toString(), domain: host });
  }
  const seen = new Set();
  return out.filter((x) => (seen.has(x.url) ? false : seen.add(x.url)));
};

/** 입력칸을 찾아 넣는다. 화면이 A/B 로 바뀌어 한 선택자로 안 된다(2026-09-24 ChatGPT 가 textarea·contenteditable 을 번갈아 냈다) */
const 넣기 = async (p, 선택자들, 질문) => {
  const ok = await p.evaluate((sels) => {
    for (const s of sels) {
      const el = [...document.querySelectorAll(s)].find((e) => e.offsetWidth > 0 && e.offsetHeight > 0);
      if (el) { el.focus(); return true; }
    }
    return false;
  }, 선택자들);
  if (!ok) throw new Error("입력칸 없음");
  await p.keyboard.type(질문, { delay: 12 });
  await p.waitForTimeout(400);
  await p.keyboard.press("Enter");
};

const ENGINES = {
  chatgpt: {
    method: "chatgpt-web-logged-out", engine: "chatgpt-web", home: "https://chatgpt.com/",
    막힘: /로그인하여 계속|Log in to continue|unusual activity|비정상적인 활동/i,
    async ask(p, 질문) {
      await p.getByRole("button", { name: /비필수사항 거부|Reject non-essential/ }).click({ timeout: 3000 }).catch(() => {});
      await 넣기(p, ["#prompt-textarea[contenteditable=true]", "textarea[name=prompt]", "#prompt-textarea"], 질문);
      const 답 = await 다될때까지(p, () => p.locator("main").innerText());
      return { answer: 답.split(질문).slice(1).join(질문) || 답, links: await 링크들(p, "main", ["chatgpt.com", "openai.com", "mapbox.com", "openstreetmap.org"]) };
    },
  },
  perplexity: {
    method: "perplexity-web-logged-out", engine: "perplexity-web", home: "https://www.perplexity.ai/",
    막힘: /Sign in to continue|로그인해서 계속|verify you are human/i,
    async ask(p, 질문) {
      await 넣기(p, ["#ask-input", "textarea", "div[contenteditable=true]"], 질문);
      const 답 = await 다될때까지(p, () => p.locator("main").innerText());
      // 출처는 「링크」 탭에 따로 모여 있다(2026-09-24 화면 확인). 답 본문만 보면 인용을 놓친다
      const 본문링크 = await 링크들(p, "main", ["perplexity.ai", "mapbox.com"]);
      await p.getByText(/^(링크|Links|출처|Sources)$/).first().click({ timeout: 4000 }).catch(() => {});
      await p.waitForTimeout(2500);
      const 탭링크 = await 링크들(p, "main", ["perplexity.ai", "mapbox.com"]);
      const 모두 = [...본문링크, ...탭링크.filter((x) => !본문링크.some((y) => y.url === x.url))];
      return { answer: 답, links: 모두 };
    },
  },
  gemini: {
    method: "gemini-web-logged-out", engine: "gemini-web", home: "https://gemini.google.com/app",
    막힘: /로그인하여 계속|Sign in to continue|unusual traffic/i,
    async ask(p, 질문) {
      await 넣기(p, ["rich-textarea div[contenteditable=true]", "div[contenteditable=true]", "textarea"], 질문);
      const 읽기 = () => p.locator("model-response").last().innerText();
      const 답 = await 다될때까지(p, 읽기);
      return { answer: 답, links: await 링크들(p, "model-response", ["google.com", "google.co.kr", "gemini.google.com", "gstatic.com"]) };
    },
  },
};

/**
 * 못 재는 고객은 멈추고 원장 일감으로 올린다 — 로그에만 남기면 아무도 안 본다.
 * sticky: 회사 루프의 「신호 사라짐」 닫기에 걸리지 않게. 다음에 제대로 재면 아래에서 닫는다
 * 일감은 그 고객 id 에 붙인다. geo.clients 에 없는 슬러그면 붙일 곳이 없어 기록만 한다 — 학원에 붙이지 않는다(Step 25 D4)
 */
const 멈춤키 = (slug) => [`measure-conf-${slug}`, `measure-questions-${slug}`];
const 멈추고알림 = async (t, key, title, detail, 대기 = false) => {
  // 질문 승인 전은 고장이 아니라 대기다 — ai-measure.mjs 와 같게 빨간불(exitCode)을 켜지 않는다(Step 28 D21). 일감은 그대로 올린다
  기록(`${t.slug}: ${title} — ${대기 ? "대기" : "멈춤"}`);
  if (!대기) process.exitCode = 1;
  if (!t.id) { 기록(`${t.slug}: geo.clients 에 없는 고객이라 일감을 붙일 곳이 없음`); return; }
  await q(
    `insert into geo.agent_tasks (client_id, agent, kind, dedupe_key, title, detail, status, priority, payload)
     values ($1, 'measure', 'human', $2, $3, $4, '사람 대기', 20, '{"sticky":true}'::jsonb)
     on conflict (client_id, dedupe_key) do update set status='사람 대기', title=excluded.title, detail=excluded.detail,
       done_at=null, updated_at=now()`,
    [t.id, key, title, detail]).catch((e) => 기록(`일감 올리기 실패 ${e.message}`));
};

const main = async () => {
  // 누구를 잴지 — --client 가 없으면 진행 중 파일럿·측정 켠 고객·학원을 순서대로(academy/measure-targets.mjs)
  const 대상 = await 측정대상(q, 오늘, SLUG);
  const 나눔 = 대상.length > 1;   // 학원만 있으면 나누지 않는다 — 지금과 같게
  const 잴것 = [];
  for (const t of 대상) {
    if (!t.conf) {
      await 멈추고알림(t, 멈춤키(t.slug)[0], `AI 화면 측정 설정 없음: ${t.slug}`,
        "이 고객의 도메인·이름 판별 말(geo.clients.answer_pattern 또는 academy/clients.mjs answerRe)이 없어 소비자 화면 측정을 못 합니다. 넣으면 다음 실행부터 잽니다.");
      continue;
    }
    const questions = await q(
      `select 'q' || q.position as prompt_id, q.stage, q.text
         from geo.pilot_questions q join geo.pilots p on p.id = q.pilot_id
        where p.client_id = $1 and q.approved order by q.position`, [t.conf.id]);
    // 질문을 지어내지 않는다. 고객이 승인한 질문 패널이 있어야 잰다
    if (!questions.length) {
      await 멈추고알림(t, 멈춤키(t.slug)[1], `AI 화면 측정 승인 질문 없음: ${t.conf.name}`,
        "고객이 승인한 질문(geo.pilot_questions)이 없어 소비자 화면 측정을 멈췄습니다. 질문 패널을 받아 승인 표시를 하면 다음 실행부터 잽니다.", true);
      continue;
    }
    await q(`update geo.agent_tasks set status='완료', done_at=now(), updated_at=now()
              where client_id=$1 and dedupe_key = any($2) and status='사람 대기'`, [t.conf.id, 멈춤키(t.slug)]).catch(() => {});
    잴것.push({ t, CLIENT: t.conf, questions });
  }
  if (!잴것.length) return;

  // 하루 상한 — 모든 고객 합계. 막혀서 적재 안 된 시도도 화면에는 간 것이라 이번 실행에서 보낸 수는 따로 센다
  const [{ n: 오늘보냄 }] = await q(
    `select count(*)::int n from academy.ai_measurements where measured_on=$1 and collection_method like '%-web-logged-out'`, [오늘]);
  let 보냄 = 0;

  // 화면 밖에 띄운다 — 원장이 PC 를 쓰는 중에 창이 앞을 가리지 않게. 헤드리스는 로그아웃 화면이 막는 경우가 있어 쓰지 않는다
  // 자동화 표시를 숨기는 플래그(--disable-blink-features=AutomationControlled)는 쓰지 않는다 — 남의 소비자 화면에서 그걸 숨기면
  // 「우회하지 않는다」와 어긋난다(Richard 21, Arch 결정). 막히면 그 엔진은 그날 멈출 뿐이다
  const b = await chromium.launch({ headless: false, args: ["--window-position=-2400,0"] });
  const 요약 = [];
  try {
    for (const { t, CLIENT, questions } of 잴것) {
      const 이름 = CLIENT.answerRe;
      const 머리 = 나눔 ? `${CLIENT.name} ` : "";
      let 모자람 = 0, 다잼 = true;
      for (const [key, e] of Object.entries(ENGINES)) {
        if (ONLY && ONLY !== key) continue;
        const done = new Set((await q(
          `select prompt_id from academy.ai_measurements where client_id=$1 and measured_on=$2 and collection_method=$3`,
          [CLIENT.id, 오늘, e.method])).map((r) => r.prompt_id));
        let todo = questions.filter((x) => !done.has(x.prompt_id));
        if (LIMIT) todo = todo.slice(0, LIMIT);
        /**
         * 상한을 순서대로 나눈다(Step 25 D3). 고객이 둘 이상일 때만 — 학원 혼자면 지금처럼 문항마다 상한만 본다.
         * 한 엔진의 남은 문항을 다 못 보낼 만큼 남았으면 그 엔진은 안 연다 — 절반만 잰 날은 다른 날과 비교가 안 된다
         */
        const 남음 = 하루상한 - 오늘보냄 - 보냄;
        if (나눔 && !LIMIT && todo.length && 남음 < todo.length) {
          모자람 += todo.length; 다잼 = false;
          요약.push(`${머리}${key}: 오늘 ${done.size}/${questions.length} · 하루 상한 ${하루상한}질의 가운데 ${Math.max(0, 남음)}질의만 남아 ${todo.length}문항을 안 엶`);
          continue;
        }
        let ok = 0, hit = 0, cite = 0, 연속실패 = 0, 멈춤 = "", 상한걸림 = false, 시도 = 0;
        for (const x of todo) {
          if (오늘보냄 + 보냄 >= 하루상한) { 상한걸림 = true; break; }
          보냄++; 시도++;
          const ctx = await b.newContext({ locale: "ko-KR", timezoneId: "Asia/Seoul", viewport: { width: 1280, height: 900 } });
          const p = await ctx.newPage();
          try {
            await p.goto(e.home, { waitUntil: "domcontentloaded", timeout: 45000 });
            await p.waitForTimeout(5000);
            const r = await e.ask(p, x.text);
            const 글 = 답만(r.answer, x.text);
            if (e.막힘.test(글) || 글.length < 40) throw new Error(e.막힘.test(글) ? "막힘(로그인·캡차)" : "답 없음");
            const mentioned = 이름.test(글);
            const cited = r.links.some((c) => c.domain === CLIENT.domain || c.domain.endsWith(`.${CLIENT.domain}`));
            await q(
              `insert into academy.ai_measurements
                 (client_id, measured_on, collection_method, engine, model, prompt_id, stage, prompt_text,
                  attempt, mentioned, cited, citations, note, raw)
               values ($1,$2,$3,$4,'web',$5,$6,$7,1,$8,$9,$10::jsonb,$11,$12::jsonb)
               on conflict (client_id, measured_on, collection_method, engine, prompt_id, attempt) do nothing`,
              [CLIENT.id, 오늘, e.method, e.engine, x.prompt_id, x.stage, x.text, mentioned, cited,
                JSON.stringify(r.links), "소비자 화면 · 로그아웃 · 새 세션",
                JSON.stringify({ answer: 글.slice(0, 8000), links: r.links.slice(0, 60) })]);
            ok++; 연속실패 = 0;
            if (mentioned) hit++;
            if (cited) cite++;
            console.log(`  ${cited ? "◎" : mentioned ? "○" : "·"} ${key} ${나눔 ? `${CLIENT.slug} ` : ""}${x.prompt_id} 링크 ${r.links.length}`);
          } catch (err) {
            연속실패++;
            console.log(`  ✗ ${key} ${x.prompt_id} ${String(err.message).split("\n")[0].slice(0, 120)}`);
            await p.screenshot({ path: path.join(HERE, `ai-web-${key}-fail.png`) }).catch(() => {});
            if (연속실패 >= 3) { 멈춤 = String(err.message).split("\n")[0].slice(0, 80); break; }
          } finally {
            await ctx.close().catch(() => {});
          }
          await new Promise((res) => setTimeout(res, 4000 + Math.random() * 4000));
        }
        if (상한걸림) 모자람 += todo.length - 시도;
        if (done.size + ok < questions.length) 다잼 = false;
        const 줄 = `${머리}${key}: 오늘 ${done.size + ok}/${questions.length} · 이번에 이름 ${hit}/${ok} · 인용 ${cite}/${ok}${멈춤 ? ` · 멈춤(${멈춤})` : ""}${상한걸림 ? ` · 하루 상한 ${하루상한}질의에 닿아 멈춤` : ""}`;
        요약.push(줄);
        await q(`insert into geo.agent_activity (client_id, agent, action, ok, summary, run_url) values ($3,'measure','소비자 화면 AI 측정',$1,$2,'local-agent')`,
          [!멈춤, 줄, CLIENT.id]).catch(() => {});   // 멈춘 엔진은 실패로 적는다 — 몇 문항 됐어도 그날 끝까지 못 쟀다
      }
      // 상한 때문에 못 잰 고객은 조용히 빠지지 않는다. 다 잰 날 닫는다(엔진·문항 제한을 건 시험 실행은 「다 잼」으로 치지 않는다)
      if (모자람 > 0) {
        await 예산부족알림(q, t, "web", `소비자 화면 측정 하루 상한(모든 고객 합계 ${하루상한}질의)을 앞 순서 고객이 먼저 써서 ${오늘} ${CLIENT.name} 질의 ${모자람}개를 못 보냈습니다`,
          "PC 의 academy/.env.local 에 WEB_MEASURE_DAILY_MAX=<새 상한> 한 줄을 넣으면 다음 실행부터 잽니다. 로그아웃 화면은 소량으로만 묻는 게 원칙이라(research/pilot-measurement-sop.md) 올릴지는 원장이 정합니다.")
          .catch((err) => 기록(`예산 일감 올리기 실패 ${err.message}`));
      } else if (다잼 && !ONLY && !LIMIT) {
        await 예산부족닫기(q, t, "web", `${오늘} 소비자 화면 ${Object.keys(ENGINES).length}곳 × ${questions.length}문항 측정`)
          .catch((err) => 기록(`예산 일감 닫기 실패 ${err.message}`));
      }
    }
  } finally {
    await b.close().catch(() => {});
  }
  기록(`끝 — ${요약.join(" / ")}`);
};

main()
  .catch((e) => { 기록(`실패 ${e.message}`); process.exitCode = 1; })
  .finally(() => fs.rmSync(LOCK, { force: true }));
