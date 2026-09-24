/**
 * 소비자 화면 AI 측정 — ChatGPT · Perplexity · Gemini 를 로그아웃 브라우저로 매일 묻는다.
 *
 * 원장(2026-09-24): 「AI 질문도 여러 곳에 지속적으로 하고 리포팅」. 그때까지 매일 재는 엔진은 Claude(구독) 하나뿐이었다.
 * ChatGPT 는 9/17 손으로 2문항 잰 게 전부였다. API 는 크레딧이 없어 못 쓴다 — 그래서 학부모가 실제로 보는 화면을 연다.
 *
 * 규칙 (ai-measure.mjs 와 같게 — 다른 방법의 숫자를 한 비율로 합치지 않도록 collection_method 를 따로 적는다)
 *   질문    geo.pilot_questions 승인된 20문항 (Claude 측정과 같은 것)
 *   세션    문항마다 새 브라우저 문맥 = 로그아웃 · 쿠키 없음 · 개인화 없음
 *   언급    학원 이름 정규식(「똑똑한 로봇&코딩학원」은 다른 곳이라 뺀다)
 *   인용    답 영역의 링크 중 robotncoding.com
 *   원문    answer·links 를 raw 에 남긴다 — 나중에 사람이 다시 볼 수 있게
 *
 *   node ai-web-measure.mjs                    세 엔진 × 오늘 안 잰 문항
 *   node ai-web-measure.mjs --engine chatgpt   한 엔진만
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

if (fs.existsSync(LOCK) && Date.now() - fs.statSync(LOCK).mtimeMs >= 3 * 3600 * 1000) fs.rmSync(LOCK, { force: true });
try { fs.writeFileSync(LOCK, String(process.pid), { flag: "wx" }); } catch { 기록("이미 돌고 있습니다 — 건너뜀"); process.exit(0); }

for (const l of fs.readFileSync(path.join(HERE, "../academy/.env.local"), "utf8").split(/\r?\n/)) {
  const m = /^([A-Z_]+)=(.*)$/.exec(l);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}
const u = new URL(process.env.DATABASE_URL);
u.searchParams.delete("sslmode");
// 한 번 도는 데 한 시간 넘게 걸린다. 연결을 붙잡으면 Neon 이 끊으니 쿼리마다 연다(local-agent 와 같은 모양)
const q = async (s, p = []) => {
  const c = new pg.Client({ connectionString: u.toString(), ssl: { rejectUnauthorized: process.env.DATABASE_SSL_INSECURE !== "true" } });
  await c.connect();
  try { return (await c.query(s, p)).rows; } finally { await c.end().catch(() => {}); }
};

const CLIENT = { id: 1, domain: "robotncoding.com" };
const 이름 = /(?<!똑똑한\s?)(로봇\s?(&|&amp;|앤|and)\s?코딩)|robotncoding/i;
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

const main = async () => {
  const questions = await q(
    `select 'q' || q.position as prompt_id, q.stage, q.text
       from geo.pilot_questions q join geo.pilots p on p.id = q.pilot_id
      where p.client_id = $1 and q.approved order by q.position`, [CLIENT.id]);
  if (!questions.length) { 기록("승인된 질문이 없습니다"); return; }

  // 화면 밖에 띄운다 — 원장이 PC 를 쓰는 중에 창이 앞을 가리지 않게. 헤드리스는 로그아웃 화면이 막는 경우가 있어 쓰지 않는다
  // 자동화 표시를 숨기는 플래그(--disable-blink-features=AutomationControlled)는 쓰지 않는다 — 남의 소비자 화면에서 그걸 숨기면
  // 「우회하지 않는다」와 어긋난다(Richard 21, Arch 결정). 막히면 그 엔진은 그날 멈출 뿐이다
  const b = await chromium.launch({ headless: false, args: ["--window-position=-2400,0"] });
  const 요약 = [];
  try {
    for (const [key, e] of Object.entries(ENGINES)) {
      if (ONLY && ONLY !== key) continue;
      const done = new Set((await q(
        `select prompt_id from academy.ai_measurements where client_id=$1 and measured_on=$2 and collection_method=$3`,
        [CLIENT.id, 오늘, e.method])).map((r) => r.prompt_id));
      let todo = questions.filter((x) => !done.has(x.prompt_id));
      if (LIMIT) todo = todo.slice(0, LIMIT);
      let ok = 0, hit = 0, cite = 0, 연속실패 = 0, 멈춤 = "";
      for (const x of todo) {
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
          console.log(`  ${cited ? "◎" : mentioned ? "○" : "·"} ${key} ${x.prompt_id} 링크 ${r.links.length}`);
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
      const 줄 = `${key}: 오늘 ${done.size + ok}/${questions.length} · 이번에 이름 ${hit}/${ok} · 인용 ${cite}/${ok}${멈춤 ? ` · 멈춤(${멈춤})` : ""}`;
      요약.push(줄);
      await q(`insert into geo.agent_activity (client_id, agent, action, ok, summary, run_url) values (1,'measure','소비자 화면 AI 측정',$1,$2,'local-agent')`,
        [!멈춤, 줄]).catch(() => {});   // 멈춘 엔진은 실패로 적는다 — 몇 문항 됐어도 그날 끝까지 못 쟀다
    }
  } finally {
    await b.close().catch(() => {});
  }
  기록(`끝 — ${요약.join(" / ")}`);
};

main()
  .catch((e) => { 기록(`실패 ${e.message}`); process.exitCode = 1; })
  .finally(() => fs.rmSync(LOCK, { force: true }));
