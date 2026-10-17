// 네이버 자동 다시 로그인(Step 52) 시험 — DB·네트워크 없음. 저장값은 임시 폴더에 카나리아 비번으로 만든다.
// 로그인 화면은 ctx.route 로 채운 가짜다. 실제 네이버에는 아무 요청도 안 간다.
//   node scripts/test-auto-login.mjs
// 브라우저 시나리오는 자식 프로세스(--child)로 돌리고, 부모가 그 출력·상태 파일·바뀐 로그에서 카나리아를 찾는다.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const TOOLS = path.join(ROOT, "tools");
const 자식 = process.argv.includes("--child");

let 통과 = 0, 실패 = 0;
const 봄 = (이름, 참, 보탬 = "") => { if (참) 통과++; else { 실패++; console.log(`✗ ${이름}${보탬 ? ` — ${보탬}` : ""}`); } };

if (!자식) {
  // ─────────────────────────────────────────── 준비: 임시 저장값(카나리아)
  const 폴더 = fs.mkdtempSync(path.join(os.tmpdir(), "auto-login-test-"));
  process.env.AUTO_LOGIN_SECRETS_DIR = 폴더;
  const 핵 = `CANARY-${crypto.randomBytes(8).toString("hex")}`;
  const 카나리아 = `${핵}&'"%한글`;
  const 아이디 = "force11test";
  // 시험용 저장값 — 비대화형. 비번은 base64 로 스크립트에 넣는다(따옴표·& 를 안 깨뜨리게). 운영 저장은 save-login 의 Get-Credential 이 한다
  const 만들기 = (name, u, p) => {
    const b = Buffer.from(p, "utf8").toString("base64");
    const 경로 = path.join(폴더, `${name}.xml`).replace(/'/g, "''");
    try {
      execFileSync(A.POWERSHELL, ["-NoProfile", "-NonInteractive", "-Command", [
        "$ErrorActionPreference = 'Stop'",
        `$p = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${b}'))`,
        "$s = ConvertTo-SecureString -String $p -AsPlainText -Force",
        `New-Object System.Management.Automation.PSCredential('${u}', $s) | Export-Clixml -LiteralPath '${경로}'`,
      ].join("; ")], { stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
    } catch { console.log("시험 저장값을 못 만들었습니다(PowerShell)"); process.exit(1); }
  };
  const A = await import("../../tools/auto-login.mjs");
  만들기("naver", 아이디, 카나리아);
  fs.writeFileSync(path.join(폴더, "broken.xml"), "<Objs><깨진");
  // Step 53 — 계정마다 다른 카나리아. 고객(B)·마이크로소프트(C)가 서로·학원(A)과 섞이면 걸린다
  const 핵B = `CANARYB-${crypto.randomBytes(8).toString("hex")}`, 카나리아B = `${핵B}&'"%고객`;
  const 핵C = `CANARYC-${crypto.randomBytes(8).toString("hex")}`, 카나리아C = `${핵C}&'"%마소`;
  const 아이디B = "docttaktest", 아이디C = "ms-test@example.com";
  만들기("naver-docttak", 아이디B, 카나리아B);
  만들기("microsoft", 아이디C, 카나리아C);
  만들기("naver-bs", "\\force11", `${핵}-bs`); // Get-Credential 이 붙이는 앞 「\」

  // ─────────────────────────────────────────── 저장소에 안 들어감
  const git = (args) => spawnSync("git", args, { cwd: ROOT, encoding: "utf8" });
  for (const f of ["tools/.secrets/naver.xml", "tools/.secrets/naver.state.json", "tools/.secrets/shots/x.png"]) {
    봄(`git check-ignore ${f}`, git(["check-ignore", "-q", f]).status === 0);
  }
  봄("git ls-files tools/.secrets 빈 출력", git(["ls-files", "tools/.secrets"]).stdout.trim() === "");
  봄("check-ignore 는 루트 .gitignore 줄", /^\.gitignore:\d+:tools\/\.secrets\//.test(git(["check-ignore", "-v", "tools/.secrets/naver.xml"]).stdout.trim()));

  // ─────────────────────────────────────────── 복호화
  {
    const v = A.복호화("naver");
    봄("복호화 왕복 — 카나리아 그대로", v.p === 카나리아 && v.u === 아이디);
  }
  for (const name of ["broken", "없는이름"]) {
    let e = null;
    try { A.복호화(name); } catch (x) { e = x; }
    봄(`복호화 실패(${name}) → 고정 문구 하나`, e?.message === "저장된 로그인 값을 못 읽음" && e.cause === undefined && Object.keys(e).length === 0
      && !/Clixml|powershell|Exception|깨진/i.test(String(e.stack)), String(e?.message));
  }
  봄("저장값있음", A.저장값있음("naver") && !A.저장값있음("없는이름"));

  // ─────────────────────────────────────────── 시도가능·자동로그인할까
  const H = 3600 * 1000, 지금 = Date.parse("2026-10-17T12:40:00+09:00");
  const 빈 = { lastAttemptAt: null, lastResult: null, blocked: false, bad: false };
  봄("시도가능 — 처음", A.시도가능(빈, 지금));
  봄("시도가능 — 19시간59분 false", !A.시도가능({ ...빈, lastAttemptAt: 지금 - (20 * H - 60000) }, 지금));
  봄("시도가능 — 20시간 true", A.시도가능({ ...빈, lastAttemptAt: 지금 - 20 * H }, 지금));
  봄("시도가능 — blocked false", !A.시도가능({ ...빈, blocked: true }, 지금));
  봄("시도가능 — bad false", !A.시도가능({ ...빈, bad: true }, 지금));
  // 계정이름(D189) — 기본값 없음
  for (const [입력, 기대] of [
    [".browser-profile", "naver"], [path.join(TOOLS, ".browser-profile"), "naver"], [path.join(TOOLS, ".browser-profile") + path.sep, "naver"],
    [".browser-profile-docttak", "naver-docttak"], [path.join(TOOLS, ".browser-profile-docttak"), "naver-docttak"],
    [".browser-profile-../x", null], [".browser-profile-", null], ["foo", null], [".browser-profile-UP", null],
    [path.join(TOOLS, ".browser-profile-a/b"), null], [".browser-profile-" + "a".repeat(41), null], ["", null], [undefined, null],
  ]) 봄(`계정이름(${String(입력).replace(TOOLS, "<tools>")}) → ${기대}`, A.계정이름(입력) === 기대, String(A.계정이름(입력)));
  봄("마소계정이름 — 학원 프로필만", A.마소계정이름(path.join(TOOLS, ".browser-profile")) === "microsoft" && A.마소계정이름(".browser-profile-docttak") === null && A.마소계정이름("foo") === null);

  const 까닭 = (...a) => A.자동로그인할까(...a).까닭;
  봄("자동로그인할까 — 계정 null → 프로필 모름", 까닭(null, true, 빈, 지금) === "프로필 모름" && 까닭(A.계정이름("foo"), true, 빈, 지금) === "프로필 모름");
  {
    const 고객 = A.계정이름(path.join(TOOLS, ".browser-profile-docttak"));
    봄("자동로그인할까 — 고객 계정·저장값 있음 → 함", A.자동로그인할까(고객, A.저장값있음(고객), A.상태읽기(고객), 지금).할까 === true);
    // hostingkr 저장값은 없고 naver.xml 은 있다 — 학원 값으로 떨어지면 안 된다
    const 없는고객 = A.계정이름(".browser-profile-hostingkr");
    봄("자동로그인할까 — 고객 저장값 없음(naver.xml 만 있음) → 저장값 없음", A.저장값있음("naver") && 까닭(없는고객, A.저장값있음(없는고객), A.상태읽기(없는고객), 지금) === "저장값 없음");
  }
  봄("자동로그인할까 — 저장값 없음", 까닭("naver", false, 빈, 지금) === "저장값 없음");
  봄("자동로그인할까 — 20시간 안", 까닭("naver", true, { ...빈, lastAttemptAt: 지금 - H }, 지금) === "20시간 안");
  봄("자동로그인할까 — 막힘", 까닭("naver", true, { ...빈, blocked: true }, 지금) === "막힘");
  봄("자동로그인할까 — 비번틀림", 까닭("naver", true, { ...빈, bad: true, blocked: true }, 지금) === "비번틀림");
  봄("자동로그인할까 — 함", A.자동로그인할까("naver", true, 빈, 지금).할까 === true);

  // 네이버다시로그인 — 안 하는 길은 page 를 건드리지 않는다(null 로 넘겨도 된다). 줄은 멈춤줄 꼴
  {
    const 안함 = async (프로필) => (await A.네이버다시로그인(null, null, 프로필)).줄;
    const 줄1 = await 안함("foo"), 줄2 = await 안함(".browser-profile-hostingkr");
    A.상태쓰기("naver-docttak", { lastAttemptAt: Date.now() });
    const 줄3 = await 안함(path.join(TOOLS, ".browser-profile-docttak"));
    fs.rmSync(path.join(폴더, "naver-docttak.state.json"), { force: true });
    봄("네이버다시로그인 안 함 — 프로필 모름", 줄1 === "자동 로그인 안 함: 프로필 모름" && A.멈춤줄(줄1) === 줄1, 줄1);
    봄("네이버다시로그인 안 함 — 저장값 없음", 줄2 === "자동 로그인 안 함: 저장값 없음" && A.멈춤줄(줄2) === 줄2, 줄2);
    봄("네이버다시로그인 안 함 — 20시간 안(계정마다 상태)", 줄3 === "자동 로그인 안 함: 20시간 안" && A.멈춤줄(줄3) === 줄3 && A.상태읽기("naver").lastAttemptAt === null, 줄3);
    const m1 = await A.마이크로소프트다시로그인(null, null, ".browser-profile-docttak");
    봄("마이크로소프트다시로그인 — 고객 프로필 → 프로필 모름", m1.ok === false && m1.줄 === "자동 로그인 안 함: 프로필 모름");
  }

  // 저장아이디 — 평문 아이디만, 복호화 안 함
  봄("저장아이디 — 앞 백슬래시 뗌", A.저장아이디("naver-bs") === "force11", String(A.저장아이디("naver-bs")));
  봄("저장아이디 — 학원·고객·마소", A.저장아이디("naver") === 아이디 && A.저장아이디("naver-docttak") === 아이디B && A.저장아이디("microsoft") === 아이디C);
  봄("저장아이디 — 파일 없음·이상한 이름 null", A.저장아이디("naver-hostingkr") === null && A.저장아이디("../naver") === null && A.저장아이디("broken") === null);
  봄("저장아이디 — 비번 안 나옴", ![A.저장아이디("naver"), A.저장아이디("naver-docttak"), A.저장아이디("microsoft"), A.저장아이디("naver-bs")].some((v) => /CANARY/.test(String(v))));

  // ─────────────────────────────────────────── 상태 파일
  A.상태쓰기("naver", { lastAttemptAt: 지금, lastResult: "캡차", blocked: true, 엉뚱: 카나리아 });
  봄("상태쓰기 — 네 칸만", JSON.stringify(Object.keys(JSON.parse(fs.readFileSync(path.join(폴더, "naver.state.json"), "utf8")))) === '["lastAttemptAt","lastResult","blocked","bad"]');
  A.상태쓰기("naver", { blocked: false });
  봄("상태쓰기 — 덮어쓰기는 준 칸만", A.상태읽기("naver").lastResult === "캡차" && A.상태읽기("naver").blocked === false && A.상태읽기("naver").lastAttemptAt === 지금);
  봄("상태읽기 — 없으면 빈 상태", JSON.stringify(A.상태읽기("없는이름")) === JSON.stringify(빈));

  // ─────────────────────────────────────────── 출력 읽기 · 남은 날
  const 출력 = "글 제목\n네이버 로그인이 필요합니다. 창에서 로그인해 주세요 (최대 8분).\n자동 로그인 멈춤: 캡차 · 화면 C:\\dev\\x\\naver-20261017-1240.png\r\n에디터 프레임을 못 찾았습니다.";
  봄("멈춤줄 — 근거 한 줄", A.멈춤줄(출력) === "자동 로그인 멈춤: 캡차 · 화면 C:\\dev\\x\\naver-20261017-1240.png", String(A.멈춤줄(출력)));
  봄("멈춤줄 — 같은 출력에 /로그인이 필요/ 여전히", /로그인이 필요/.test(출력));
  봄("멈춤줄 — 안 함 줄", A.멈춤줄("x\n자동 로그인 안 함: 20시간 안\n") === "자동 로그인 안 함: 20시간 안");
  봄("멈춤줄 — 없음 null", A.멈춤줄("네이버 로그인이 필요합니다.") === null && A.멈춤줄(undefined) === null);
  봄("남은날줄", A.남은날줄("a\nNID_AUT 남은 12일\n") === 12 && A.남은날줄("NID_AUT 남은 날 모름") === null);
  const 초 = Math.floor(지금 / 1000);
  봄("세션남은일 — 2.5일 → 2", A.세션남은일([{ name: "NID_AUT", expires: 초 + 2.5 * 86400 }], 지금) === 2);
  봄("세션남은일 — 세션만·없음 null", A.세션남은일([{ name: "NID_AUT", expires: -1 }], 지금) === null && A.세션남은일([], 지금) === null);

  // 세션경고 — 가짜 q
  const 가짜 = () => { const 로그 = []; return { 로그, q: async (s, p = []) => { 로그.push([s, p]); return []; } }; };
  {
    let g = 가짜();
    let r = await A.세션경고(g.q, 2, false, "2026-10-17 12:40");
    봄("N=2·저장값 없음 → soon 올림", r === "올림" && g.로그.length === 1 && /insert into geo\.agent_tasks/.test(g.로그[0][0]) && /'naver-session-soon'/.test(g.로그[0][0])
      && g.로그[0][1][0] === "네이버 블로그 로그인이 2일 뒤 풀립니다" && /node tools\/save-login\.mjs naver/.test(g.로그[0][1][1]));
    g = 가짜();
    r = await A.세션경고(g.q, 2, true, "2026-10-17 12:40");
    봄("N=2·저장값 있음 → 안 올림", r === "그대로" && g.로그.length === 0);
    g = 가짜();
    r = await A.세션경고(g.q, 10, false, "2026-10-17 12:40");
    봄("N=10 → soon 완료(근거 붙임)", r === "완료" && /update geo\.agent_tasks set status='완료'/.test(g.로그[0][0]) && /dedupe_key='naver-session-soon' and status='사람 대기'/.test(g.로그[0][0])
      && g.로그[0][1][0] === "2026-10-17 12:40 NID_AUT 남은 10일");
    // Step 53 — 기본값은 학원 행(1)·naver 명령
    g = 가짜();
    await A.세션경고(g.q, 2, false, "2026-10-17 12:40");
    봄("세션경고 기본값 — client 1 · naver 명령", g.로그[0][1][2] === 1 && /values \(\$3, 'deliver', 'human', 'naver-session-soon'/.test(g.로그[0][0]) && g.로그[0][1][1].includes("node tools/save-login.mjs naver 를"));
    g = 가짜();
    r = await A.세션경고(g.q, 1, false, "2026-10-17 12:40", 7, "naver-docttak");
    봄("세션경고 고객 — 그 client 행 · 그 계정 명령", r === "올림" && g.로그[0][1][2] === 7 && g.로그[0][1][1].includes("node tools/save-login.mjs naver-docttak 를")
      && !g.로그[0][1][1].includes("save-login.mjs naver 를") && /docttak/.test(g.로그[0][1][0]), JSON.stringify(g.로그[0]?.[1]));
    g = 가짜();
    r = await A.세션경고(g.q, 9, false, "2026-10-17 12:40", 7, "naver-docttak");
    봄("세션경고 고객 — 완료도 그 client 행만", r === "완료" && /where client_id=\$2 and dedupe_key='naver-session-soon'/.test(g.로그[0][0]) && g.로그[0][1][1] === 7);
    let e = null;
    try { await A.세션경고(가짜().q, 1, false, "x", 1, "microsoft"); } catch (x) { e = x; }
    봄("세션경고 — 네이버 계정만(마소 사전 경고 없음, D195)", e?.message === "계정 이름이 아닙니다");
  }

  // 세션 경고 일감은 login- 으로 시작하지 않는다 — 현황판이 쓸 수 없는 「로그인 창 열기」 버튼을 붙이지 않게(D185)
  {
    const ts = createRequire(new URL("../../web/package.json", import.meta.url))("typescript");
    const 글 = fs.readFileSync(new URL("../../web/lib/todo-text.ts", import.meta.url), "utf8")
      .replace('import { plain, WORKFLOW_PLAIN } from "./agents";', "const plain = (s) => s; const WORKFLOW_PLAIN = {};");
    const 임시 = path.join(os.tmpdir(), `todo-text-al-${process.pid}.mjs`);
    fs.writeFileSync(임시, ts.transpileModule(글, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText);
    try {
      const { todoText } = await import(pathToFileURL(임시).href);
      const g = 가짜();
      await A.세션경고(g.q, 2, false, "2026-10-17 12:40");
      const 키 = /values \(\$3, 'deliver', 'human', '([^']+)'/.exec(g.로그[0][0])?.[1] ?? null;
      const x = todoText({ agent: "deliver", kind: "human", dedupe: 키, title: g.로그[0][1][0], detail: g.로그[0][1][1], error: "", evidence: "", link: null, payload: { sticky: true } });
      봄("세션 경고 일감 키는 naver-session-soon", 키 === "naver-session-soon", String(키));
      봄("todo-text — naver-session-soon 에 로그인 창 버튼 없음", x.action?.type !== "login" && !/로그인 창이 뜹니다/.test(x.why ?? ""), JSON.stringify(x.action));
      const g2 = 가짜();
      await A.세션경고(g2.q, 2, false, "2026-10-17 12:40", 7, "naver-docttak");
      const 키2 = /values \(\$3, 'deliver', 'human', '([^']+)'/.exec(g2.로그[0][0])?.[1] ?? null;
      const x2 = todoText({ agent: "deliver", kind: "human", dedupe: 키2, title: g2.로그[0][1][0], detail: g2.로그[0][1][1], error: "", evidence: "", link: null, payload: { sticky: true } });
      봄("todo-text — 고객 행 naver-session-soon 에도 로그인 창 버튼 없음(D185)", 키2 === "naver-session-soon" && x2.action?.type !== "login" && !/로그인 창이 뜹니다/.test(x2.why ?? ""), JSON.stringify(x2.action));
      봄("todo-text — 대조: login-naver 는 로그인 버튼", todoText({ agent: "deliver", kind: "human", dedupe: "login-naver", title: "t", detail: "d", error: "", evidence: "", link: null, payload: { sticky: true } }).action?.type === "login");
    } finally { fs.rmSync(임시, { force: true }); }
  }

  // ─────────────────────────────────────────── 끼운 자리(원문)
  const nbp = fs.readFileSync(path.join(TOOLS, "naver-blog-post.mjs"), "utf8");
  const la = fs.readFileSync(path.join(TOOLS, "local-agent.mjs"), "utf8");
  봄("naver-blog-post — 기존 줄 글자 그대로", nbp.includes(`console.log("네이버 로그인이 필요합니다. 창에서 로그인해 주세요 (최대 8분).");`));
  봄("naver-blog-post — 프로필열기 · 학원 프로필 비교 없음 · 계정이름 하나로", /await 프로필열기\(path\.resolve\(process\.cwd\(\), PROFILE\)/.test(nbp) && !nbp.includes('PROFILE === ".browser-profile"')
    && /await 네이버다시로그인\(page, ctx, PROFILE\)/.test(nbp) && /const 계정 = 계정이름\(PROFILE\);/.test(nbp));
  봄("local-agent — 멈춤줄을 근거로", /사람로그인\("naver", "네이버 블로그", 멈춤 \?/.test(la));
  봄("local-agent — 자동 로그인 안내 문장", la.includes("저장된 로그인 값이 있으면 먼저 혼자 다시 로그인해 보고, 막혔을 때만 이 일감이 뜹니다."));
  // Step 53 끼운 자리
  const al = fs.readFileSync(path.join(TOOLS, "auto-login.mjs"), "utf8");
  const 모든도구 = fs.readdirSync(TOOLS).filter((f) => f.endsWith(".mjs")).map((f) => [f, fs.readFileSync(path.join(TOOLS, f), "utf8")]);
  봄("auto-login — 학원 프로필 비교 0", !al.includes('PROFILE === ".browser-profile"'));
  봄("복호화( 호출은 auto-login 안 1곳(정의 빼고)", 모든도구.reduce((n, [f, s]) => n + (s.match(/(?<!function )복호화\(/g) ?? []).length * (f === "auto-login.mjs" ? 1 : 100), 0) === 2,
    모든도구.filter(([, s]) => /(?<!function )복호화\(/.test(s)).map(([f]) => f).join(","));
  const sp = fs.readFileSync(path.join(TOOLS, "smartplace-keyword.mjs"), "utf8"), kf = fs.readFileSync(path.join(TOOLS, "kin-find.mjs"), "utf8");
  const bs = fs.readFileSync(path.join(TOOLS, "bing-submit-urls.mjs"), "utf8");
  봄("smartplace — 다시로그인 · 원래 주소 재방문 · 기존 줄·종료 2", /await 네이버다시로그인\(page, ctx, PROFILE\)/.test(sp) && /r\.ok[\s\S]{0,80}await 가기\(\);\s*if \(!\/nid/.test(sp)
    && sp.includes('console.log("로그인이 안 돼 있습니다.");') && /await 끝내기\(2\)/.test(sp));
  봄("kin-find — 쿠키 없음이면 nid 로 가서 다시로그인 · 기존 줄", kf.includes("https://nid.naver.com/nidlogin.login?url=https%3A%2F%2Fwww.naver.com%2F") && /네이버다시로그인\(page, ctx, 프로필\)/.test(kf)
    && kf.includes('console.log("✗ 로그인이 필요합니다 — 네이버 로그인이 풀렸습니다");') && /세션경고\(q, 남은, 저장값있음\(계정\), KST\(\), c\.id, 계정\)/.test(kf) && /!DRY && 계정/.test(kf));
  봄("local-agent — 고객 블로그 멈춤줄 근거 · save-login 안내 · 세션경고", /로그인일감\("네이버 로그인이 풀렸습니다\.", 멈춤 \?/.test(la) && la.includes("node tools/save-login.mjs ${계정} 를 한 번 돌리면 그다음부터 혼자 다시 로그인합니다.")
    && /세션경고\(q, 남은, 저장값있음\(계정\), KST\(\), c\.id, 계정\)/.test(la));
  봄("local-agent — 플레이스·빙 멈춤줄 근거", /사람로그인\("naver", "네이버", 멈춤 \?/.test(la) && /사람로그인\("microsoft", "빙 웹마스터", 멈춤 \?/.test(la));
  봄("bing-submit-urls — 마소 다시로그인 · 원래 주소 재방문 · 기존 줄", /마이크로소프트다시로그인\(page, ctx, PROFILE\)/.test(bs) && bs.includes('say("로그인이 풀렸습니다 — 빙 웹마스터에 다시 로그인")'));
  봄("실행 옵션·우회 없음 — stealth·addCookies·userAgent 를 운영 도구에 안 넣음", !/stealth|userAgent|addCookies/.test(al + sp + kf + bs + nbp));

  // ─────────────────────────────────────────── save-login 인자 · 목록(D193·D198)
  {
    const S = await import("../../tools/save-login.mjs");
    const 판 = fs.mkdtempSync(path.join(os.tmpdir(), "save-login-test-"));
    for (const d of [".browser-profile", ".browser-profile-b", ".browser-profile-a", ".browser-profile-UP", "other"]) fs.mkdirSync(path.join(판, d));
    fs.writeFileSync(path.join(판, ".browser-profile-c"), ""); // 폴더가 아님
    봄("--all 목록 — naver · 고객 이름순 · microsoft", JSON.stringify(S.계정목록(판)) === '["naver","naver-a","naver-b","microsoft"]', JSON.stringify(S.계정목록(판)));
    봄("인자 --all", JSON.stringify(S.인자판정("--all", 판).계정들) === '["naver","naver-a","naver-b","microsoft"]');
    봄("인자 naver · naver-a · microsoft", S.인자판정("naver", 판).계정들?.[0] === "naver" && S.인자판정("naver-a", 판).계정들?.[0] === "naver-a" && S.인자판정("microsoft", 판).계정들?.[0] === "microsoft");
    for (const a of ["google", "kakao", "naver-nope", "naver-../x", "naver-", "naver-UP", "naver-c", "", undefined]) {
      const v = S.인자판정(a, 판);
      봄(`인자 ${a} → 거부`, Boolean(v.오류) && !v.계정들, JSON.stringify(v));
    }
    봄("인자 google — 대상 아님 안내", /자동 로그인 대상이 아닙니다 — node tools\/open-session\.mjs 로 사람이 로그인/.test(S.인자판정("google", 판).오류));
    봄("프로필경로 — 한 방향 표", S.프로필경로("naver", 판) === path.join(판, ".browser-profile") && S.프로필경로("microsoft", 판) === path.join(판, ".browser-profile")
      && S.프로필경로("naver-a", 판) === path.join(판, ".browser-profile-a") && S.프로필경로("naver-../x", 판) === null && S.프로필경로("google", 판) === null);
    봄("창문구 — 학원·고객·마소", S.창문구("naver") === "네이버 — 학원 블로그 계정" && S.창문구("naver-a") === "네이버 — a 고객 블로그 계정(학원 계정 아님)"
      && S.창문구("microsoft") === "마이크로소프트 — 빙 웹마스터 계정(이메일)" && S.창문구("naver-../x") === null);
    fs.rmSync(판, { recursive: true, force: true });
    // 실제로 돌려 본다 — 인자에서 끝나야 한다(잠금·PowerShell 전)
    const 잠금 = path.join(TOOLS, ".open-session.lock");
    const 잠금전 = fs.existsSync(잠금) ? fs.statSync(잠금).mtimeMs : null;
    for (const a of ["google", "naver-nope"]) {
      const t = Date.now();
      const r = spawnSync(process.execPath, [path.join(TOOLS, "save-login.mjs"), a], { cwd: ROOT, encoding: "utf8", timeout: 60000, env: { ...process.env, AUTO_LOGIN_SECRETS_DIR: 폴더 } });
      const o = `${r.stdout}${r.stderr}`;
      봄(`save-login ${a} → 종료 1 · 바로 끝 · 창 안 뜸`, r.status === 1 && Date.now() - t < 30000 && /사용: node tools\/save-login\.mjs/.test(o) && !/기다립니다|저장했습니다|취소/.test(o), `${r.status} ${o.trim().slice(0, 200)}`);
    }
    봄("save-login 거부 — 창 잠금 안 건드림", (fs.existsSync(잠금) ? fs.statSync(잠금).mtimeMs : null) === 잠금전);
  }

  // ─────────────────────────────────────────── 브라우저 시나리오(자식) + 유출
  const 로그전 = new Map(fs.readdirSync(TOOLS).filter((f) => f.endsWith(".log")).map((f) => [f, fs.statSync(path.join(TOOLS, f)).size]));
  const c = spawnSync(process.execPath, [fileURLToPath(import.meta.url), "--child"], {
    cwd: path.join(ROOT, "academy"), encoding: "utf8", timeout: 10 * 60000, maxBuffer: 20 * 1024 * 1024,
    env: { ...process.env, AUTO_LOGIN_SECRETS_DIR: 폴더, TEST_CANARY_B64: Buffer.from(카나리아, "utf8").toString("base64"), TEST_ID: 아이디,
      TEST_CANARY_B_B64: Buffer.from(카나리아B, "utf8").toString("base64"), TEST_ID_B: 아이디B,
      TEST_CANARY_C_B64: Buffer.from(카나리아C, "utf8").toString("base64"), TEST_ID_C: 아이디C },
  });
  const 자식출력 = `${c.stdout ?? ""}${c.stderr ?? ""}`;
  for (const l of 자식출력.split(/\r?\n/)) if (/^✗ /.test(l)) console.log(l);
  const m = /^자식 (\d+) 통과 · (\d+) 실패$/m.exec(c.stdout ?? "");
  봄("자식 시나리오 끝까지 돎", Boolean(m), 끝줄(자식출력));
  if (m) { 통과 += Number(m[1]); 실패 += Number(m[2]); }

  const 샘 = (글) => {
    const s = String(글 ?? "");
    const 찾음 = [];
    // 세 카나리아(학원 A · 고객 B · 마소 C) 전부
    for (const [h, k, u] of [[핵, 카나리아, 아이디], [핵B, 카나리아B, 아이디B], [핵C, 카나리아C, 아이디C]]) {
      if (s.includes(h)) 찾음.push(`원문 ${h.slice(0, 7)}`);
      if (s.includes(encodeURIComponent(k))) 찾음.push("URL 인코딩");
      for (const t of s.match(/[A-Za-z0-9+/]{16,}={0,2}/g) ?? []) {
        if (Buffer.from(t, "base64").toString("utf8").includes(h)) { 찾음.push("base64"); break; }
      }
      for (const b of [Buffer.from(k).toString("base64"), Buffer.from(JSON.stringify({ u, p: k })).toString("base64")]) if (s.includes(b)) 찾음.push("base64 그대로");
    }
    return 찾음;
  };
  봄("유출 — 자식 stdout+stderr(반환 객체 포함)", 샘(자식출력).length === 0 && /결과 /.test(자식출력), 샘(자식출력).join(","));
  const 상태파일 = fs.readdirSync(폴더).filter((f) => f.endsWith(".state.json"));
  봄("유출 — state.json", 상태파일.length >= 1 && 상태파일.every((f) => 샘(fs.readFileSync(path.join(폴더, f), "utf8")).length === 0));
  // 저장값(xml) 밖의 모든 파일 — 상태·스크린샷(이름과 바이트)
  const 전부파일 = fs.readdirSync(폴더, { recursive: true }).map(String).filter((f) => fs.statSync(path.join(폴더, f)).isFile() && !f.endsWith(".xml"));
  const 샌파일 = 전부파일.filter((f) => { const b = fs.readFileSync(path.join(폴더, f)); return 샘(f).length || 샘(b.toString("utf8")).length || 샘(b.toString("latin1")).length; });
  봄("유출 — 임시 폴더의 상태·스크린샷 파일 이름·내용", 전부파일.some((f) => f.endsWith(".png")) && 샌파일.length === 0, 샌파일.join(","));
  const 바뀐로그 = fs.readdirSync(TOOLS).filter((f) => f.endsWith(".log") && fs.statSync(path.join(TOOLS, f)).size !== (로그전.get(f) ?? 0));
  봄("유출 — 시험 중 바뀐 tools/*.log", 바뀐로그.every((f) => {
    const b = fs.readFileSync(path.join(TOOLS, f));
    return 샘(b.subarray(Math.min(로그전.get(f) ?? 0, b.length)).toString("utf8")).length === 0;
  }), 바뀐로그.join(","));

  fs.rmSync(폴더, { recursive: true, force: true });
  console.log(`\n${통과} 통과 · ${실패} 실패`);
  if (실패) process.exitCode = 1;
}

function 끝줄(s) { return String(s).trim().split(/\r?\n/).slice(-3).join(" | ").slice(-300); }

if (자식) {
  const { chromium } = await import("../../tools/node_modules/playwright/index.mjs");
  const A = await import("../../tools/auto-login.mjs");
  const 카나리아 = Buffer.from(process.env.TEST_CANARY_B64, "base64").toString("utf8");
  const 아이디 = process.env.TEST_ID;
  const 폴더 = A.비밀폴더();

  // 2026-10 실제 nid 화면을 본뜬 꼴(D187): input#id · input#pw[type=password] · input#loginStay + label ·
  // 로그인 버튼 #loginBtn_row / #loginBtn_column 둘 중 화면 폭에 따라 하나만 보임. 숨은 캡차 틀이 늘 있다
  const 로그인화면 = ({ 위 = "", 막음 = false, 비번형 = "password", 버튼 = "row" } = {}) => `<!doctype html><html><head><meta charset="utf-8"></head><body>
${위}
<form id="frmNIDLogin" method="POST" action="https://nid.naver.com/nidlogin.login" ${막음 ? 'onsubmit="event.preventDefault()"' : ""}>
  <input type="text" id="id" name="id" placeholder="아이디">
  <input type="${비번형}" id="pw" name="pw" placeholder="비밀번호">
  <input type="checkbox" id="loginStay" name="nvlong" class="input_keep"><label for="loginStay">로그인 상태 유지</label>
  <button type="submit" id="loginBtn_row" class="btn_login" ${버튼 === "row" ? "" : 'style="display:none"'}>로그인</button>
  <button type="submit" id="loginBtn_column" class="btn_login" ${버튼 === "column" ? "" : 'style="display:none"'}>로그인</button>
  ${위.includes('id="captcha"') ? "" : '<div id="captcha" style="display:none"><img id="captchaimg"></div>'}
</form>
<script>window.__keys = 0; window.__clicks = 0;
addEventListener("keydown", () => window.__keys++, true); addEventListener("input", () => window.__keys++, true);
for (const b of document.querySelectorAll(".btn_login")) b.addEventListener("click", () => window.__clicks++);</script></body></html>`;
  const 글화면 = (글) => `<!doctype html><html><head><meta charset="utf-8"></head><body><p>${글}</p></body></html>`;
  const 블로그로 = `<!doctype html><html><body><script>location.href = "https://blog.naver.com/force11?Redirect=Write"</script></body></html>`;
  const 캡차틀 = '<div id="captcha"><img id="captchaimg" width="200" height="60" alt="">자동입력 방지문자를 입력해 주세요</div>';
  const 년 = () => Math.floor(Date.now() / 1000) + 365 * 86400;

  const 시나리오 = [
    { 이름: "성공", 기대: { ok: true }, post: async (ctx) => { await ctx.addCookies([{ name: "NID_AUT", value: "t", domain: ".naver.com", path: "/", expires: 년() }]); return 블로그로; } },
    // 좁은 폭 — #loginBtn_row 는 숨고 #loginBtn_column 만 보인다
    { 이름: "성공(세로 버튼)", 첫화면: 로그인화면({ 버튼: "column" }), 기대: { ok: true }, post: async (ctx) => { await ctx.addCookies([{ name: "NID_AUT", value: "t", domain: ".naver.com", path: "/", expires: 년() }]); return 블로그로; } },
    { 이름: "세션만", 기대: { 사유: "모르는화면", blocked: true }, post: async (ctx) => { await ctx.addCookies([{ name: "NID_AUT", value: "t", domain: ".naver.com", path: "/" }]); return 블로그로; } },
    { 이름: "캡차", 기대: { 사유: "캡차", blocked: true }, post: async () => 로그인화면({ 위: 캡차틀 }) },
    // 네이버는 비번이 틀리면 캡차를 같이 띄운다 — 비번틀림(bad)이어야 옛 비번으로 다시 안 친다
    { 이름: "비번틀림+캡차", 기대: { 사유: "비번틀림", bad: true }, post: async () => 로그인화면({ 위: `${캡차틀}<div id="err_common">비밀번호를 잘못 입력했습니다.</div>` }) },
    { 이름: "2단계", 기대: { 사유: "2단계", blocked: true }, post: async () => 글화면("2단계 인증 알림을 보냈습니다. 휴대전화에서 확인해 주세요.") },
    { 이름: "새기기", 기대: { 사유: "새기기", blocked: true }, post: async () => 글화면("새로운 기기(브라우저)에서 로그인하려면 확인이 필요합니다.") },
    { 이름: "보호조치", 기대: { 사유: "보호조치", blocked: true }, post: async () => 글화면("회원님의 아이디를 보호조치 했습니다.") },
    { 이름: "비번틀림", 기대: { 사유: "비번틀림", bad: true }, post: async () => 로그인화면({ 위: '<div id="err_common">아이디(로그인 전용 아이디) 또는 비밀번호를 잘못 입력했습니다.</div>' }) },
    { 이름: "모르는화면", 기대: { 사유: "모르는화면", blocked: true }, post: async () => 글화면("잠시 후 다시 시도해 주세요.") },
    { 이름: "시간초과", 기대: { 사유: "시간초과" }, 첫화면: 로그인화면({ 막음: true }) },
    { 이름: "처음부터 캡차", 기대: { 사유: "캡차", blocked: true, 안침: true }, 첫화면: 로그인화면({ 위: 캡차틀 }) },
    // #pw 가 글자가 보이는 칸이면 비번을 안 친다(스크린샷에 찍힌다)
    { 이름: "비번 칸이 글자칸", 기대: { 사유: "모르는화면", blocked: true, 안침: true }, 첫화면: 로그인화면({ 비번형: "text" }) },
    { 이름: "칸 없음",기대: { 사유: "모르는화면", blocked: true, 안침: true }, 첫화면: 글화면("새 로그인 화면") },
    { 이름: "저장값 못 읽음", 저장값: "broken", 기대: { 사유: "저장값 못 읽음", bad: true, 안침: true } },
  ];

  const 브라우저 = await chromium.launch({ headless: true });
  for (const s of 시나리오) {
    const name = s.저장값 ?? "naver";
    fs.rmSync(path.join(폴더, `${name}.state.json`), { force: true });
    const ctx = await 브라우저.newContext({ locale: "ko-KR", timezoneId: "Asia/Seoul" });
    const 제출 = [];
    let 밖 = 0;
    await ctx.route("**/*", async (route) => {
      const req = route.request(), u = req.url();
      if (/^https:\/\/nid\.naver\.com\//.test(u)) {
        if (req.method() === "POST") {
          제출.push(req.postData() ?? "");
          return route.fulfill({ contentType: "text/html; charset=utf-8", body: await s.post(ctx) });
        }
        return route.fulfill({ contentType: "text/html; charset=utf-8", body: s.첫화면 ?? 로그인화면() });
      }
      if (/^https:\/\/blog\.naver\.com\//.test(u)) return route.fulfill({ contentType: "text/html; charset=utf-8", body: 글화면("블로그") });
      밖++;
      return route.abort();
    });
    const page = await ctx.newPage();
    await page.goto("https://nid.naver.com/nidlogin.login?mode=form&url=https%3A%2F%2Fblog.naver.com%2Fforce11%3FRedirect%3DWrite");
    const 샷 = path.join(폴더, "shots-test", s.이름);
    const 전 = Date.now();
    const r = await A.자동로그인(page, ctx, name, { shotsDir: 샷, 대기ms: 4000 });
    const 상태 = A.상태읽기(name);
    console.log(`결과 ${s.이름} ${JSON.stringify(r)} ${JSON.stringify(상태)}`);
    const 기 = s.기대, 이름 = `[${s.이름}]`;
    봄(`${이름} lastAttemptAt 남김`, 상태.lastAttemptAt >= 전);
    봄(`${이름} 바깥 요청 0`, 밖 === 0, String(밖));
    봄(`${이름} 로그인 제출 ≤ 1`, 제출.length <= 1, String(제출.length));
    if (기.ok) {
      const f = new URLSearchParams(제출[0] ?? "");
      봄(`${이름} ok`, r.ok === true && r.사유 === null, JSON.stringify(r));
      봄(`${이름} 제출에 카나리아 비번이 그대로`, f.get("pw") === 카나리아);
      봄(`${이름} 제출 아이디`, f.get("id") === 아이디);
      봄(`${이름} 로그인 상태 유지 켜짐`, f.get("nvlong") === "on");
      봄(`${이름} 상태 ok · 막힘 아님`, 상태.lastResult === "ok" && !상태.blocked && !상태.bad);
      봄(`${이름} 스크린샷 없음`, !fs.existsSync(샷));
    } else {
      봄(`${이름} 사유 ${기.사유}`, r.ok === false && r.사유 === 기.사유, JSON.stringify(r));
      봄(`${이름} 상태 값`, 상태.lastResult === 기.사유 && 상태.blocked === Boolean(기.blocked) && 상태.bad === Boolean(기.bad), JSON.stringify(상태));
      봄(`${이름} 스크린샷 파일`, Boolean(r.화면) && fs.existsSync(r.화면) && path.dirname(r.화면) === 샷 && /naver|broken/.test(path.basename(r.화면)));
      if (기.안침) {
        const 키 = await page.evaluate(() => window.__keys ?? 0).catch(() => 0);
        봄(`${이름} 입력 이벤트 0 · 제출 0`, 키 === 0 && 제출.length === 0, `${키}/${제출.length}`);
      }
      if (s.이름 === "시간초과") 봄(`${이름} 로그인 클릭 1`, (await page.evaluate(() => window.__clicks)) === 1);
    }
    await ctx.close();
  }
  // ─────────────────────────────────────────── Step 53 카나리아 교차 — 프로필 → 계정 → 그 계정 저장값만
  const 카나리아B = Buffer.from(process.env.TEST_CANARY_B_B64, "base64").toString("utf8"), 아이디B = process.env.TEST_ID_B;
  const 카나리아C = Buffer.from(process.env.TEST_CANARY_C_B64, "base64").toString("utf8"), 아이디C = process.env.TEST_ID_C;
  const TOOLS = path.resolve("../tools");
  const 교차 = [
    { 프로필: ".browser-profile-docttak", 계정: "naver-docttak", 내것: 카나리아B, 내아이디: 아이디B, 남의것: [카나리아, 카나리아C] },
    { 프로필: path.join(TOOLS, ".browser-profile-docttak"), 계정: "naver-docttak", 내것: 카나리아B, 내아이디: 아이디B, 남의것: [카나리아, 카나리아C] },
    { 프로필: path.join(TOOLS, ".browser-profile"), 계정: "naver", 내것: 카나리아, 내아이디: 아이디, 남의것: [카나리아B, 카나리아C] },
  ];
  for (const x of 교차) {
    for (const 막음 of [false, true]) {
      const 이름 = `[교차 ${x.계정}${path.isAbsolute(x.프로필) ? " 절대" : ""}${막음 ? " 막힌 제출" : ""}]`;
      fs.rmSync(path.join(폴더, `${x.계정}.state.json`), { force: true });
      const ctx = await 브라우저.newContext({ locale: "ko-KR", timezoneId: "Asia/Seoul" });
      const 제출 = [];
      await ctx.route("**/*", async (route) => {
        const req = route.request(), u = req.url();
        if (/^https:\/\/nid\.naver\.com\//.test(u)) {
          if (req.method() === "POST") {
            제출.push(req.postData() ?? "");
            await ctx.addCookies([{ name: "NID_AUT", value: "t", domain: ".naver.com", path: "/", expires: 년() }]);
            return route.fulfill({ contentType: "text/html; charset=utf-8", body: 블로그로 });
          }
          return route.fulfill({ contentType: "text/html; charset=utf-8", body: 로그인화면({ 막음 }) });
        }
        if (/^https:\/\/blog\.naver\.com\//.test(u)) return route.fulfill({ contentType: "text/html; charset=utf-8", body: 글화면("블로그") });
        return route.abort();
      });
      const page = await ctx.newPage();
      await page.goto("https://nid.naver.com/nidlogin.login?url=https%3A%2F%2Fwww.naver.com%2F");
      const r = await A.네이버다시로그인(page, ctx, x.프로필, { shotsDir: path.join(폴더, "shots-cross"), 대기ms: 3000 });
      const 상태 = A.상태읽기(x.계정);
      console.log(`결과 ${이름} ${JSON.stringify(r)}`);
      if (!막음) {
        const f = new URLSearchParams(제출[0] ?? "");
        봄(`${이름} ok · 그 계정 비번·아이디`, r.ok === true && r.줄 === null && f.get("pw") === x.내것 && f.get("id") === x.내아이디, JSON.stringify(r));
        const 값들 = [...new URLSearchParams(제출[0] ?? "").values()].join("\n");
        봄(`${이름} 남의 비번 제출에 없음`, 제출.length === 1 && x.남의것.every((k) => !값들.includes(k)));
        봄(`${이름} 상태는 그 계정 파일에`, 상태.lastResult === "ok" && fs.existsSync(path.join(폴더, `${x.계정}.state.json`)));
      } else {
        const 쳐진것 = await page.inputValue("#pw").catch(() => null);
        const 화면글 = await page.content();
        봄(`${이름} 그 계정 비번만 쳐짐`, 쳐진것 === x.내것 && x.남의것.every((k) => !화면글.includes(k) && 쳐진것 !== k));
        봄(`${이름} 멈춤 줄 — 멈춤줄 꼴 · 스크린샷 이름은 계정`, r.ok === false && A.멈춤줄(r.줄) === r.줄 && /^자동 로그인 멈춤: 시간초과 · 화면 /.test(r.줄)
          && new RegExp(`${x.계정}-\\d{8}-\\d{4}\\.png$`).test(r.줄), r.줄);
      }
      await ctx.close();
    }
  }

  // ─────────────────────────────────────────── Step 53 마이크로소프트(D198) — 가짜 login.live.com
  const 마소이메일 = `<!doctype html><html><head><meta charset="utf-8"></head><body><div>로그인</div>
<form method="POST" action="https://login.live.com/ppsecure/post.srf?s=1"><input type="email" name="loginfmt" id="i0116" placeholder="이메일, 전화 또는 Skype">
<input type="submit" id="idSIButton9" value="다음"></form></body></html>`;
  const 마소비번 = (위 = "", 막음 = false) => `<!doctype html><html><head><meta charset="utf-8"></head><body>${위}<div>암호 입력</div>
<form method="POST" action="https://login.live.com/ppsecure/post.srf?s=2" ${막음 ? 'onsubmit="event.preventDefault()"' : ""}><input type="hidden" name="login" value="x">
<input type="password" name="passwd" id="i0118" placeholder="암호"><input type="submit" id="idSIButton9" value="로그인"></form></body></html>`;
  const 마소유지 = `<!doctype html><html><head><meta charset="utf-8"></head><body><div>로그인 상태를 유지하시겠습니까?</div>
<form method="POST" action="https://login.live.com/ppsecure/post.srf?s=3"><input type="button" id="idBtn_Back" value="아니요"><input type="submit" id="idSIButton9" value="예"></form></body></html>`;
  const 빙으로 = `<!doctype html><html><body><script>location.href = "https://www.bing.com/webmasters/home"</script></body></html>`;
  const 마소시나리오 = [
    { 이름: "성공", s2: () => 마소유지, 기대: { ok: true, 제출수: 3 } },
    { 이름: "Authenticator 승인", s2: () => 글화면("로그인 요청 승인 — Authenticator 앱을 열고 표시된 숫자를 입력하세요."), 기대: { 사유: "2단계", blocked: true, 제출수: 2 } },
    { 이름: "비번틀림", s2: () => 마소비번('<div id="passwordError">계정 또는 암호가 잘못되었습니다.</div>'), 기대: { 사유: "비번틀림", bad: true, 제출수: 2 } },
    { 이름: "모르는화면", s2: () => 글화면("잠시 후 다시 시도해 주세요."), 기대: { 사유: "모르는화면", blocked: true, 제출수: 2 } },
    { 이름: "처음부터 계정 고르기", 첫화면: 글화면("계정 선택 — Pick an account"), 기대: { 사유: "모르는화면", blocked: true, 제출수: 0 } },
  ];
  for (const s of 마소시나리오) {
    const 이름 = `[마소 ${s.이름}]`;
    fs.rmSync(path.join(폴더, "microsoft.state.json"), { force: true });
    const ctx = await 브라우저.newContext({ locale: "ko-KR", timezoneId: "Asia/Seoul" });
    const 제출 = [];
    let 밖 = 0;
    await ctx.route("**/*", async (route) => {
      const req = route.request(), u = req.url();
      const html = (b) => route.fulfill({ contentType: "text/html; charset=utf-8", body: b });
      if (/^https:\/\/login\.live\.com\//.test(u)) {
        if (req.method() === "POST") {
          제출.push(req.postData() ?? "");
          const 단계 = /[?&]s=(\d)/.exec(u)?.[1];
          return html(단계 === "1" ? 마소비번() : 단계 === "2" ? s.s2() : 빙으로);
        }
        return html(s.첫화면 ?? 마소이메일);
      }
      if (/^https:\/\/www\.bing\.com\//.test(u)) return html(글화면("Bing Webmaster Tools"));
      밖++;
      return route.abort();
    });
    const page = await ctx.newPage();
    await page.goto("https://login.live.com/login.srf");
    const r = await A.마이크로소프트다시로그인(page, ctx, path.join(TOOLS, ".browser-profile"), { shotsDir: path.join(폴더, "shots-ms"), 대기ms: 4000 });
    const 상태 = A.상태읽기("microsoft");
    console.log(`결과 ${이름} ${JSON.stringify(r)} ${JSON.stringify(상태)}`);
    const 기 = s.기대, 모두 = 제출.map((b) => [...new URLSearchParams(b).values()].join("\n")).join("\n");
    봄(`${이름} 바깥 요청 0 · 제출 수 ${기.제출수}`, 밖 === 0 && 제출.length === 기.제출수, `${밖}/${제출.length}`);
    봄(`${이름} 학원·고객 비번 없음`, [카나리아, 카나리아B].every((k) => !모두.includes(k)));
    if (제출.length >= 1) 봄(`${이름} 이메일 단계엔 비번 없음`, new URLSearchParams(제출[0]).get("loginfmt") === 아이디C && ![...new URLSearchParams(제출[0]).values()].join("\n").includes(카나리아C));
    if (제출.length >= 2) 봄(`${이름} 비번 단계에 마소 비번`, new URLSearchParams(제출[1]).get("passwd") === 카나리아C);
    if (기.ok) {
      봄(`${이름} ok · 상태 ok`, r.ok === true && r.줄 === null && 상태.lastResult === "ok" && !상태.blocked && !상태.bad, JSON.stringify(r));
      봄(`${이름} 빙으로 돌아옴`, /^https:\/\/www\.bing\.com\//.test(page.url()));
    } else {
      봄(`${이름} 줄 · 상태`, r.ok === false && r.줄.startsWith(`자동 로그인 멈춤: ${기.사유} · 화면 `) && A.멈춤줄(r.줄) === r.줄
        && 상태.lastResult === 기.사유 && 상태.blocked === Boolean(기.blocked) && 상태.bad === Boolean(기.bad), `${r.줄} ${JSON.stringify(상태)}`);
    }
    await ctx.close();
  }
  {
    // 로그인 화면이 아니면(빙 /webmasters/about 등) 아무것도 안 친다
    fs.rmSync(path.join(폴더, "microsoft.state.json"), { force: true });
    const ctx = await 브라우저.newContext();
    await ctx.route("**/*", (route) => route.fulfill({ contentType: "text/html; charset=utf-8", body: 마소이메일 }));
    const page = await ctx.newPage();
    await page.goto("https://www.bing.com/webmasters/about");
    const r = await A.마이크로소프트다시로그인(page, ctx, path.join(TOOLS, ".browser-profile"), { shotsDir: path.join(폴더, "shots-ms"), 대기ms: 2000 });
    봄("[마소 로그인 화면 아님] 안 함 · 시도 안 남김", r.줄 === "자동 로그인 안 함: 로그인 화면이 아님" && A.상태읽기("microsoft").lastAttemptAt === null, r.줄);
    await ctx.close();
  }
  await 브라우저.close();

  // 스크린샷은 최근 10장만
  {
    const 샷 = path.join(폴더, "shots-keep");
    fs.mkdirSync(샷, { recursive: true });
    for (let i = 0; i < 12; i++) fs.writeFileSync(path.join(샷, `naver-20260101-00${String(i).padStart(2, "0")}.png`), "");
    const b2 = await chromium.launch({ headless: true });
    const ctx = await b2.newContext();
    await ctx.route("**/*", (route) => route.fulfill({ contentType: "text/html; charset=utf-8", body: 글화면("새 로그인 화면") }));
    const page = await ctx.newPage();
    await page.goto("https://nid.naver.com/nidlogin.login");
    const r = await A.자동로그인(page, ctx, "naver", { shotsDir: 샷, 대기ms: 1000 });
    const 남음 = fs.readdirSync(샷).sort();
    봄("스크린샷 최근 10장만", 남음.length === 10 && 남음.includes(path.basename(r.화면 ?? "")) && !남음.includes("naver-20260101-0000.png"), 남음.join(","));
    await b2.close();
  }

  console.log(`자식 ${통과} 통과 · ${실패} 실패`);
}
