/**
 * 개선 루프의 자기 점검. daily-agent.mjs 가 판정 뒤에 부른다.
 *
 * 루프는 질문을 하나씩 본다. 그래서 「일반 질문 9개가 다섯 곳 모두 0」 같은 구조를 한 번도 적지 못했고,
 * 검색 결과에 안 뜨는 글을 3주 동안 고치고 다시 밀었다(2026-09-29 원장 지적).
 * 여기서는 묶음으로 보고 헛수고를 끊는다.
 *
 *   narrow    한 묶음만 어디서도 안 나온다
 *   stalled   끝낸 행동이 14일 넘게 판정을 못 받았다
 *   repeat    같은 처방(글 고치기·재색인)을 3번 넘게 했는데 검색 결과에 우리 주소가 없다
 *   discover  그러니 글이 아니라 발견성(Brave 색인)을 본다
 *   widen     맞는 동네 질문을 한 칸씩 넓혀 어디서 빠지는지 잰다 (탐침 — 문장형·검색어형)
 *   variant   넓힐 동네가 없는 고객(아이로그)은 승인 검색어의 기능 말로 변형 탐침을 만든다 (Step 31 D43)
 *   regress   불리던 질문이 같은 곳·같은 엔진에서 떨어졌다 (Step 31 D39)
 *   promote   불린 탐침 — 승인 질문 후보로 원장에게 묻는다 (D40, 일감은 daily-agent 가 쓴다)
 *   gaps      넓힘 사슬에서 처음 0 이 된 칸 — 그 문장으로 세션 글 일감 (D41, 일감은 daily-agent 가 쓴다)
 *
 * LLM 을 부르지 않는다. DB 숫자를 문장틀에 넣기만 한다 — 지어낼 자리가 없다.
 * 곳(collection_method)이 다르면 비율을 합치지 않는다. 곳마다 따로 적는다.
 * DB 를 건드리지 않는 순수 함수다. 쓰기는 daily-agent 가 한다.
 */

const 날더하기 = (day, n) => {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

const 두글자 = (s) => {
  const t = String(s).replace(/[^가-힣a-zA-Z0-9]/g, "").toLowerCase();
  const set = new Set();
  for (let i = 0; i < t.length - 1; i++) set.add(t.slice(i, i + 2));
  return set;
};
/** 질문의 두 글자 묶음이 제목에 얼마나 들어 있나. 0~1 */
export const 겹침 = (question, title) => {
  const a = 두글자(question), b = 두글자(title);
  if (!a.size) return 0;
  let n = 0;
  for (const x of a) if (b.has(x)) n++;
  return n / a.size;
};

/** 학부모가 보기엔 problem·consider 가 같은 「일반 질문」이다. 글 처방도 같아서 한 묶음으로 센다. 검색어형(keyword, 아이로그 패널)도 이름·지역이 없는 말이라 같이 센다 */
const 묶음 = { local: "local", brand: "brand", problem: "general", consider: "general", keyword: "general" };
const 묶음이름 = { local: "동네 질문", brand: "이름 질문", general: "일반 질문" };
const 곳이름 = {
  "claude-code-headless-websearch": "Claude",
  "chatgpt-web-logged-out": "ChatGPT",
  "gemini-web-logged-out": "Gemini",
  "perplexity-web-logged-out": "Perplexity",
  "google-ai-mode-web-logged-out": "구글 AI 모드",
  "api-openrouter-web-exa": "OpenRouter",
  "api-anthropic-web-search": "Claude API",
  "api-gemini-google-search": "Gemini API",
  "api-groq-compound": "Groq",
};
export const 곳 = (m) => 곳이름[m] ?? m;
const 탐침곳 = "claude-code-headless-websearch";

// ── 반경 사다리: 동네 → 송파 → 서울 → 없음
const 동네말 = /석촌호수|석촌동|헬리오시티|가락동|잠실|석촌/g;
const 다음반경 = { 동네: "송파", 송파: "서울", 서울: "없음" };
export const 반경 = (text) =>
  new RegExp(동네말.source).test(text) ? "동네" : /송파/.test(text) ? "송파" : /서울/.test(text) ? "서울" : "없음";

/** 바꾼 말 뒤 조사를 받침에 맞춘다. 「잠실이나」→「송파이나」가 되면 어색하다 */
const 받침조사 = { 나: "이나", 랑: "이랑", 는: "은", 를: "을", 와: "과", 가: "이" };
const 조사맞춤 = (s, word, 받침) => s.replace(new RegExp(`${word}(이나|나|이랑|랑|은|는|을|를|과|와|이|가)(?=\\s|$)`, "g"), (_, j) => {
  const 없는꼴 = Object.entries(받침조사).find(([, v]) => v === j)?.[0] ?? j;
  return word + (받침 ? 받침조사[없는꼴] ?? 없는꼴 : 없는꼴);
});
const 다듬기 = (s) => s
  // 「송파나 송파 쪽에」 처럼 같은 말이 겹치면 하나로
  .replace(/(송파|서울)(?:나|이나|랑|이랑|하고|와|과|,)\s*\1/g, "$1")
  .replace(/\s+([?.!,])/g, "$1")
  .replace(/\s{2,}/g, " ")
  .trim();

/** 한 칸 넓힌 질문. 바뀐 게 없으면 null */
export const 넓히기 = (text) => {
  const from = 반경(text);
  const to = 다음반경[from];
  if (!to) return null;
  let t = text;
  if (to === "송파") t = 조사맞춤(t.replace(동네말, "송파"), "송파", false);
  if (to === "서울") t = 조사맞춤(t.replace(/서울\s*송파구|송파구|송파/g, "서울"), "서울", true);
  if (to === "없음") t = t.replace(/서울\s*(?:근처|쪽|주변)?\s*(?:에서|에|의|은|는|이나|나|사는데)?\s*/g, "");
  t = 다듬기(t);
  return t && t !== text ? { radius: to, text: t } : null;
};

/**
 * 검색어형 탐침. 학부모는 대화체보다 「송파구 코딩학원 추천」처럼 친다(원장 2026-09-29 — 구글 AI 모드에서 두 번째 카드로 나옴).
 * 틀은 이 셋뿐이다. 새로 지어내지 않는다
 */
export const 검색어틀 = ["코딩학원 추천", "초등 코딩학원", "로봇코딩학원"];
const 검색어다음 = { 석촌동: "송파구", 잠실: "송파구", 송파구: "서울", 서울: "없음" };
const 검색어 = (radius, 틀) => (radius === "없음" ? 틀 : `${radius} ${틀}`);
/** 검색어 탐침 한 칸 넓히기. 틀 밖의 글이면 null */
export const 검색어넓히기 = ({ text, radius }) => {
  const 틀 = 검색어틀.find((t) => text === 검색어(radius, t));
  const to = 검색어다음[radius];
  return 틀 && to ? { radius: to, text: 검색어(to, 틀) } : null;
};

/**
 * 변형 탐침(D43). 기능 말은 승인 검색어형 질문에서 틀 말(추천·무료·앱·프로그램)을 뺀 나머지다 — 새 말을 지어내지 않는다.
 * 변형 = { forms: ["{기능} 앱", …], strip: /…/g } (clients.mjs loop.probeVariants)
 */
export const 변형후보 = (questions, 변형) => {
  const 기능들 = [];
  for (const x of questions.filter((q) => q.stage === "keyword")) {
    const 기능 = x.text.replace(변형.strip, " ").replace(/\s{2,}/g, " ").trim();
    if (기능 && !기능들.some((f) => f.기능 === 기능)) 기능들.push({ 기능, from: x.prompt_id });
  }
  return 기능들.flatMap(({ 기능, from }) => 변형.forms.map((f) => ({ source_prompt: from, text: f.replace("{기능}", 기능) })));
};

/** 띄어쓰기·문장부호와 끝의 꼬리말(추천·좀·해줘·해주세요·알려줘·부탁해)을 뺀 글자 — 변형이 승인 질문과 사실상 같은지 볼 때 */
export const 꼬리뺀 = (s) => {
  let t = String(s ?? "").replace(/[^가-힣a-zA-Z0-9]/g, "");
  for (let prev = ""; prev !== t;) { prev = t; t = t.replace(/(추천|좀|해줘|해주세요|알려줘|부탁해)$/, ""); }
  return t;
};

const 같은글 = (a, b) => String(a).replace(/[^가-힣a-zA-Z0-9]/g, "") === String(b).replace(/[^가-힣a-zA-Z0-9]/g, "");
const 우리주소 = (domain) => (r) => (r.citations ?? []).some((s) => s?.domain === domain || String(s?.domain ?? "").endsWith(`.${domain}`));

/**
 * @param questions 승인 질문 [{prompt_id, stage, text}]
 * @param rows      최근 21일 자동·화면 측정 [{prompt_id, day, collection_method, cited, mentioned, citations, answer}] (탐침 표 p* 포함)
 * @param 판정rows  daily-agent 판정용 rows(70일, 자동 측정만) — stalled 의 전·후 건수를 판정과 같은 행으로 센다
 * @param runs      geo.agent_runs 행동 [{run_day, status, action_kind, target_prompt, verdict, effective_on}]
 * @param posts     [{slug, title, published, archived}]
 * @param probes    academy.ai_probe_questions [{prompt_id, source_prompt, radius, text, active, form}] — 표가 없으면 []
 * @param 적중      daily-agent 의 적중 판정 (brand 는 인용 또는 「석촌」)
 * @param 새탐침한도 오늘 더 넓혀도 되는 탐침 수 (검색어 씨앗은 안 센다)
 * @param 탐침      true 넓힘 탐침(widen, 반경 사다리·씨앗이 송파 말이라 학원만) · "variants" 검색어 변형(D43) · false 끔 (clients.mjs loop.probes)
 * @param 변형      탐침 "variants" 의 틀 (clients.mjs loop.probeVariants)
 * @param 확장들    확장 질문 글(pilot_questions stage extend) — 변형이 이것과 같으면 안 만든다
 * @returns probes  [{source_prompt, radius, text, form, seed?}] — 씨앗은 source_prompt 가 null
 * @returns regress [{prompt_id, 곳들: [{method, engine, 앞:[h,n], 뒤:[h,n]}], urls}] · regressUnknown [{prompt_id, method, engine, 왜}]
 * @returns promote [{prompt_id, text, method, hit, n}] · gaps [{prompt_id, text, radius, method, n, root}]
 */
export function 자기점검({ questions, rows, 판정rows = rows, runs, posts, today, domain, probes = [], 적중, 새탐침한도 = 2, 탐침 = true, 변형 = null, 확장들 = [] }) {
  const findings = [];
  const skipContent = new Set();
  const stageOf = Object.fromEntries(questions.map((x) => [x.prompt_id, x.stage]));
  const 묶음of = (pid) => 묶음[stageOf[pid]];
  const 곳별 = (list) => Object.entries(list.reduce((m, r) => {
    (m[r.collection_method] ??= [0, 0])[0] += 적중(r) ? 1 : 0;
    m[r.collection_method][1]++;
    return m;
  }, {})).sort((a, b) => b[1][1] - a[1][1]);
  const 곳글 = (entries) => entries.map(([m, [h, n]]) => `${곳(m)} ${h}/${n}`).join(" · ");
  const 묶음들 = [...new Set(questions.map((x) => 묶음[x.stage]).filter(Boolean))];

  // ── narrow: 한 묶음이 곳마다 전부 0 인데 다른 묶음은 나온다
  const 두주 = rows.filter((r) => r.day >= 날더하기(today, -13) && stageOf[r.prompt_id]);
  const 묶음표 = Object.fromEntries(묶음들.map((g) => [g, 곳별(두주.filter((r) => 묶음of(r.prompt_id) === g))]));
  for (const g of 묶음들) {
    const t = 묶음표[g];
    const 합 = t.reduce((s, [, [h]]) => s + h, 0);
    const 나온다른 = 묶음들.filter((o) => o !== g && 묶음표[o].some(([, [h]]) => h > 0));
    // 표본이 10건 안 되는 곳은 「어느 AI 에도」의 근거로 안 쓴다
    const 큰곳 = t.filter(([, [, n]]) => n >= 10);
    if (합 !== 0 || !큰곳.length || !나온다른.length) continue;
    const 개수 = questions.filter((x) => 묶음[x.stage] === g).length;
    findings.push({
      code: "narrow",
      title: `${묶음이름[g]} ${개수}개는 어느 AI 에도 안 나옵니다`,
      evidence: `${묶음이름[g]} ${개수}개 — ${곳글(큰곳)} (14일). ` +
        나온다른.map((o) => `${묶음이름[o]} ${곳글(묶음표[o].filter(([, [h]]) => h > 0).slice(0, 1))}`).join(" · "),
      action: "질문 하나씩 고치지 않고 묶음 전체의 원인(검색 결과에 뜨는지)부터 봅니다.",
    });
  }

  // ── stalled: 끝낸 지 14일이 넘었는데 판정 전. 원인은 문장으로 짐작하지 않고 곳(엔진)별 전·후 건수로 적는다
  const 멈춤 = runs.filter((r) => r.status === "완료" && r.verdict === "판정 전" && r.effective_on && r.effective_on <= 날더하기(today, -14));
  const 전후 = (r) => {
    const 전 = 판정rows.filter((x) => x.prompt_id === r.target_prompt && x.day >= 날더하기(r.effective_on, -14) && x.day < r.effective_on);
    const 후 = 판정rows.filter((x) => x.prompt_id === r.target_prompt && x.day >= 날더하기(r.effective_on, 7));
    const 엔진 = [...new Set([...전, ...후].map((x) => x.engine))].sort();
    return 엔진.length
      ? 엔진.map((e) => `${e} 전 ${전.filter((x) => x.engine === e).length}건 · 후 ${후.filter((x) => x.engine === e).length}건`).join(", ")
      : "전·후 측정 0건";
  };
  if (멈춤.length) {
    findings.push({
      code: "stalled",
      title: `끝낸 행동 ${멈춤.length}건이 14일 넘게 효과 판정을 못 받았습니다`,
      evidence: 멈춤.map((r) => `${r.target_prompt} ${r.action_kind} ${r.effective_on}: ${전후(r)}`).join(" / "),
      action: "후 5건이 전부 0 이면 기준선 없이 「효과 없음」으로 닫습니다. 35일이 지나면 「표본 부족」으로 닫습니다.",
    });
  }

  // ── repeat + discover: 같은 처방을 되풀이했는데 검색 결과에 우리 주소가 없다
  const 삼주 = 날더하기(today, -20);
  const 발행글 = posts.filter((p) => p.published && !p.archived);
  const 발견성 = [];
  for (const g of 묶음들) {
    const 처방 = runs.filter((r) => r.action_kind === "content" && r.status === "완료" && r.run_day >= 삼주 && 묶음of(r.target_prompt) === g);
    if (처방.length < 3) continue;
    const 측정 = rows.filter((r) => 묶음of(r.prompt_id) === g);
    const 뜬횟수 = 측정.filter(우리주소(domain)).length;
    // 잰 게 없으면 「0번」은 근거가 아니다
    if (측정.length < 10 || 뜬횟수 > 0) continue;
    for (const [s, gg] of Object.entries(묶음)) if (gg === g && questions.some((x) => x.stage === s)) skipContent.add(s);
    const 질문들 = [...new Set(처방.map((r) => r.target_prompt))];
    findings.push({
      code: "repeat",
      title: `${묶음이름[g]}에 글 고치기·재색인을 ${처방.length}번 했는데 오른 게 없습니다`,
      evidence: `${질문들.join("·")} · 21일 동안 content ${처방.length}건 · 같은 기간 적중 ${곳글(곳별(측정))}`,
      action: `${묶음이름[g]}은 글 고치기를 건너뛰고 다음 칸(바깥 지면)으로 넘어갑니다.`,
    });
    const 맞는글 = new Set();
    for (const x of questions.filter((q) => 묶음[q.stage] === g)) {
      for (const p of 발행글) if (겹침(x.text, p.title) >= 0.4) 맞는글.add(p.slug);
    }
    const slugs = [...맞는글].sort();
    // finding 은 같은 객체다. daily-agent 가 일감 상태(이미 있음·7일 안에 봄)를 action 에 덧붙인다
    const finding = {
      code: "discover",
      title: `${묶음이름[g]}의 글이 AI 검색 결과에 안 뜹니다`,
      evidence: `측정 ${측정.length}건에서 AI 가 받아 본 검색 결과에 ${domain} 이 0번 — 글을 고쳐도 못 읽습니다 · 맞는 발행 글 ${slugs.length}편`,
      action: slugs.length
        ? `원장 PC 가 이 글 ${slugs.length}편이 Brave 색인에 있는지 확인합니다(Claude 검색이 Brave 를 씁니다).`
        : "맞는 발행 글이 없어 색인 확인할 글이 없습니다. 글부터 필요합니다.",
    };
    findings.push(finding);
    발견성.push({ group: g, slugs, finding });
  }

  // ── regress (D39): 앞 14일 ≥50% 이던 질문이 최근 7일 ≤25%. 같은 곳·같은 엔진끼리만, 양쪽 5건 이상일 때만 말한다
  const 앞끝 = 날더하기(today, -7), 뒤처음 = 날더하기(today, -6), 앞처음 = 날더하기(today, -20);
  const 후퇴 = [], 모름 = [];
  const 셈2 = (list) => [list.filter(적중).length, list.length];
  for (const x of questions) {
    const mine = rows.filter((r) => r.prompt_id === x.prompt_id && r.day >= 앞처음);
    const 곳들 = [];
    for (const k of [...new Set(mine.map((r) => `${r.collection_method}\t${r.engine}`))]) {
      const [m, e] = k.split("\t");
      const 같은 = mine.filter((r) => r.collection_method === m && r.engine === e);
      const 앞 = 같은.filter((r) => r.day <= 앞끝), 뒤 = 같은.filter((r) => r.day >= 뒤처음);
      const [ah, an] = 셈2(앞);
      if (an < 5 || ah * 2 < an) continue;
      if (뒤.length < 5) {
        // 같은 곳에서 다른 엔진으로 최근 5건이 넘으면 엔진이 바뀐 것이다 — 비교하지 않는다
        const 딴엔진 = mine.filter((r) => r.collection_method === m && r.engine !== e && r.day >= 뒤처음).length >= 5;
        모름.push({ prompt_id: x.prompt_id, method: m, engine: e, 왜: 딴엔진 ? "엔진 바뀜" : "최근 표본 모자람" });
        continue;
      }
      const [bh, bn] = 셈2(뒤);
      if (bh * 4 <= bn) 곳들.push({ method: m, engine: e, 앞: [ah, an], 뒤: [bh, bn], 앞rows: 앞 });
    }
    if (!곳들.length) continue;
    // 불리던 글: 앞 창에서 AI 가 인용한 우리 주소. 많이 인용된 것부터
    const 주소 = {};
    for (const g of 곳들) for (const r of g.앞rows) for (const s of r.citations ?? []) {
      if (우리주소(domain)({ citations: [s] }) && s.url) 주소[s.url] = (주소[s.url] ?? 0) + 1;
    }
    후퇴.push({
      prompt_id: x.prompt_id, stage: x.stage, text: x.text,
      곳들: 곳들.map(({ 앞rows, ...g }) => g),
      urls: Object.entries(주소).sort((a, b) => b[1] - a[1]).map(([u]) => u),
    });
  }
  if (후퇴.length) {
    findings.push({
      code: "regress",
      title: `불리던 질문 ${후퇴.length}개가 최근 7일에 떨어졌습니다`,
      evidence: 후퇴.map((r) => `${r.prompt_id} ${r.곳들.map((g) => `${곳(g.method)} 앞 14일 ${g.앞[0]}/${g.앞[1]} → 최근 7일 ${g.뒤[0]}/${g.뒤[1]}`).join(", ")}`).join(" / ") +
        (모름.length ? ` · 비교 못 함: ${모름.map((u) => `${u.prompt_id} ${곳(u.method)}(${u.왜})`).join(", ")}` : ""),
      action: "이 질문을 오늘 후보 맨 앞에 둡니다. 불리던 글부터 색인 알림으로 다시 밉니다.",
    });
  } else if (모름.length) {
    // 떨어졌는지 모르는 것도 적는다(Richard 31) — 후보 순서는 안 바꾼다
    findings.push({
      code: "regress-unknown",
      title: `불리던 질문 ${new Set(모름.map((u) => u.prompt_id)).size}개는 최근에 떨어졌는지 모릅니다`,
      evidence: `비교 못 함 — ${모름.map((u) => `${u.prompt_id} ${곳(u.method)}(${u.왜})`).join(", ")}`,
      action: "같은 곳·같은 엔진으로 최근 7일 5건이 모이면 다시 봅니다. 그때까지 후보 순서는 그대로입니다.",
    });
  }

  // ── promote (D40): 탐침이 14일 안 한 곳에서 4번 넘게 재서 절반 넘게 불렸다(Arch 31 — 7일이면 탐침 몫으로 4번에 못 닿는다). 곳끼리 합치지 않는다
  const 칠일 = 날더하기(today, -6);
  const 두주일 = 날더하기(today, -13);
  const 승격 = [];
  for (const p of probes.filter((x) => x.active !== false)) {
    const w = rows.filter((r) => r.prompt_id === p.prompt_id && r.day >= 두주일);
    const 좋은 = [...new Set(w.map((r) => r.collection_method))]
      .map((m) => { const l = w.filter((r) => r.collection_method === m); return { method: m, hit: l.filter(적중).length, n: l.length }; })
      .filter((s) => s.n >= 4 && s.hit * 2 >= s.n)
      .sort((a, b) => b.n - a.n || b.hit - a.hit)[0];
    if (좋은) 승격.push({ prompt_id: p.prompt_id, text: p.text, ...좋은 });
  }
  const 더 = { regress: 후퇴, regressUnknown: 모름, promote: 승격, gaps: [] };

  if (탐침 === "variants" && 변형) {
    // ── variant (D43): 넓힐 동네가 없다. 승인 검색어의 기능 말로 「{기능} 앱·프로그램·무료」 변형을 하루 한도 안에서 만든다
    // 승인·확장 질문과 꼬리말(추천·좀·해줘 …)을 뺀 뒤 같으면 사실상 같은 검색어다 — 만들지 않는다(Richard 31)
    const 있는글 = [...questions.map((x) => x.text), ...확장들, ...probes.map((p) => p.text)].map(꼬리뺀);
    const 새것 = [];
    for (const v of 변형후보(questions, 변형)) {
      if (새것.length >= 새탐침한도) break;
      if (있는글.includes(꼬리뺀(v.text))) continue;
      새것.push({ source_prompt: v.source_prompt, radius: "변형", text: v.text, form: "keyword" });
      있는글.push(꼬리뺀(v.text));
    }
    // gaps (D41, Arch 31): 한 곳에서 14일 4번 넘게 재서 한 번도 안 나온 변형 — 탐침 순서대로 처음 것
    for (const p of probes.filter((x) => x.active !== false && x.source_prompt)) {
      const w = rows.filter((r) => r.prompt_id === p.prompt_id && r.day >= 두주일);
      const 빈곳 = [...new Set(w.map((r) => r.collection_method))]
        .map((m) => ({ method: m, l: w.filter((r) => r.collection_method === m) }))
        .find((s) => s.l.length >= 4 && !s.l.some(적중));
      if (빈곳) 더.gaps.push({ prompt_id: p.prompt_id, text: p.text, radius: p.radius, method: 빈곳.method, n: 빈곳.l.length, root: p.source_prompt });
    }
    const 잰것 = probes.map((p) => {
      const w = rows.filter((r) => r.prompt_id === p.prompt_id && r.collection_method === 탐침곳 && r.day >= 칠일);
      return { p, hit: w.filter(적중).length, n: w.length };
    }).filter((x) => x.n);
    if (잰것.length || 새것.length) {
      findings.push({
        code: "variant",
        title: "검색어를 바꿔 어디서 이름이 나오는지 잽니다",
        evidence: (잰것.length ? `${곳(탐침곳)} 7일: ${잰것.map((x) => `「${x.p.text}」 ${x.hit}/${x.n}`).join(" · ")}` : "아직 잰 변형 없음") +
          (새것.length ? ` · 오늘 새로: ${새것.map((p) => `${p.source_prompt}→「${p.text}」`).join(", ")}` : ""),
        action: "변형은 승인 검색어에 나온 기능 말로만 하루 2개까지 만들고, 측정은 하루 탐침 몫 안에서 Claude 로 합니다. 적중률 계산·효과 판정에는 쓰지 않습니다.",
      });
    }
    return { findings, skipContent, probes: 새것, discover: 발견성, ...더 };
  }
  if (!탐침) return { findings, skipContent, probes: [], discover: 발견성, ...더 };

  // ── widen: 맞는 질문을 한 칸 넓힌다. 탐침 결과는 반경을 재는 것뿐, 판정에 안 쓴다
  // 모양이 둘이다 — 문장(승인 동네 질문에서 출발)과 검색어(송파구 씨앗 3개에서 출발). 모양·곳끼리 합치지 않는다
  const 주전 = 날더하기(today, -6);
  const 탐침율 = (pid, method = 탐침곳, from = 주전) => {
    const w = rows.filter((r) => r.prompt_id === pid && r.collection_method === method && r.day >= from);
    return { hit: w.filter(적중).length, n: w.length };
  };
  const 모양 = (p) => p.form ?? "sentence";
  const 있는글 = [...questions.map((x) => x.text), ...probes.map((p) => p.text)];
  const 자식있음 = new Set(probes.map((p) => p.source_prompt).filter(Boolean));
  const 새탐침 = [];

  // 씨앗: 원장이 직접 본 「송파구 코딩학원 추천」 자리. 적중과 상관없이 한 번 만든다. 하루 한도에 안 센다
  for (const 틀 of 검색어틀) {
    const text = 검색어("송파구", 틀);
    if (있는글.some((t) => 같은글(t, text))) continue;
    새탐침.push({ source_prompt: null, radius: "송파구", text, form: "keyword", seed: true });
    있는글.push(text);
  }

  const 출발 = [
    ...probes.filter((p) => p.active !== false).map((p) => ({ pid: p.prompt_id, text: p.text, radius: p.radius, form: 모양(p) })),
    ...questions.filter((x) => x.stage === "local").map((x) => ({ pid: x.prompt_id, text: x.text, radius: 반경(x.text), form: "sentence" })),
  ];
  let 넓힌수 = 0;
  for (const s of 출발) {
    if (넓힌수 >= 새탐침한도) break;
    if (자식있음.has(s.pid)) continue;
    const { hit, n } = 탐침율(s.pid);
    // 한 번 맞은 것(1/1)으로 넓히지 않는다. 두 번은 재 봐야 한다
    if (n < 2 || hit / n < 0.5) continue;
    const w = s.form === "keyword" ? 검색어넓히기(s) : 넓히기(s.text);
    if (!w || 있는글.some((t) => 같은글(t, w.text))) continue;
    새탐침.push({ source_prompt: s.pid, radius: w.radius, text: w.text, form: s.form });
    있는글.push(w.text);
    넓힌수++;
  }

  /** 뿌리에서 자식을 따라가며 「반경 id 적중/n」 을 잇는다 */
  const 칸들 = (pid, radius, text) => {
    const out = [{ id: pid, radius, text }];
    for (let cur = pid, guard = 0; guard < 5; guard++) {
      const child = probes.find((p) => p.source_prompt === cur);
      if (!child) break;
      out.push({ id: child.prompt_id, radius: child.radius, text: child.text });
      cur = child.prompt_id;
    }
    return out;
  };
  const 사슬 = (pid, radius, method) => 칸들(pid, radius).map((c) => {
    const { hit, n } = 탐침율(c.id, method);
    return `${c.radius} ${c.id} ${n ? `${hit}/${n}` : "안 잼"}`;
  }).join(" → ");
  /**
   * gaps (D41): 뿌리 다음 칸부터 따라가 처음 0 이 된 칸. 14일 4건 넘게 재서 전부 0 일 때만 — 덜 쟀으면 기다린다.
   * 7일로는 하루 2개씩 돌려 재는 탐침이 4건을 못 채워 영영 안 걸린다(Arch 31, 승격 문턱과 같은 14일)
   * 안 잰 칸을 만나면 멈춘다(모르는 칸 뒤는 못 본다)
   */
  const 빈칸 = [];
  const 빈칸보기 = (root, cells, method) => {
    for (const c of cells.slice(1)) {
      const { hit, n } = 탐침율(c.id, method, 날더하기(today, -13));
      if (!n) return;
      if (hit) continue;
      if (n >= 4 && !빈칸.some((g) => g.prompt_id === c.id)) 빈칸.push({ prompt_id: c.id, text: c.text, radius: c.radius, method, n, root });
      return;
    }
  };
  const 문장뿌리 = questions.filter((x) => x.stage === "local" && 자식있음.has(x.prompt_id));
  for (const x of 문장뿌리) 빈칸보기(x.prompt_id, 칸들(x.prompt_id, 반경(x.text), x.text), 탐침곳);
  const 문장사슬 = 문장뿌리.map((x) => 사슬(x.prompt_id, 반경(x.text), 탐침곳));
  const 검색어뿌리 = probes.filter((p) => 모양(p) === "keyword" && !p.source_prompt);
  const 검색어id = new Set(probes.filter((p) => 모양(p) === "keyword").map((p) => p.prompt_id));
  // 검색어 탐침은 Claude 말고 다른 곳(구글 AI 모드 등)에서도 잰다. 곳마다 따로 적는다
  const 검색어곳 = [탐침곳, ...new Set(rows.filter((r) => 검색어id.has(r.prompt_id) && r.collection_method !== 탐침곳).map((r) => r.collection_method))];
  for (const m of 검색어곳) for (const p of 검색어뿌리) 빈칸보기(p.prompt_id, 칸들(p.prompt_id, p.radius, p.text), m);
  더.gaps = 빈칸;
  const 줄들 = [
    ...(문장사슬.length ? [`문장 · ${곳(탐침곳)} 7일: ${문장사슬.join(" / ")}`] : []),
    ...(검색어뿌리.length ? 검색어곳.map((m) => `검색어 · ${곳(m)} 7일: ${검색어뿌리.map((p) => 사슬(p.prompt_id, p.radius, m)).join(" / ")}`) : []),
  ];
  if (줄들.length || 새탐침.length) {
    findings.push({
      code: "widen",
      title: "동네 질문을 한 칸씩 넓혀 어디서 빠지는지 잽니다",
      evidence: (줄들.length ? 줄들.join(" · ") : "아직 잰 탐침 없음") +
        (새탐침.length ? ` · 오늘 새로: ${새탐침.map((p) => `${p.seed ? "씨앗 " : `${p.source_prompt}→`}${p.radius}「${p.text}」`).join(", ")}` : ""),
      action: "새 탐침은 하루 2개까지 만들고(검색어 씨앗 3개는 따로), 측정은 하루 2개씩 Claude 로 합니다. 적중률 계산·효과 판정에는 쓰지 않습니다.",
    });
  }

  return { findings, skipContent, probes: 새탐침, discover: 발견성, ...더 };
}

/** 진단 맨 앞에 붙일 한 줄. 가장 무거운 것 하나 — 후퇴는 잃고 있는 것이라 맨 앞 */
const 무게 = ["regress", "repeat", "narrow", "stalled", "discover", "widen", "variant", "regress-unknown"];
export const 점검요약 = (findings) => {
  const top = [...findings].sort((a, b) => 무게.indexOf(a.code) - 무게.indexOf(b.code))[0];
  if (!top) return "";
  const 외 = findings.length > 1 ? ` (외 ${findings.length - 1}건)` : "";
  const 줄 = `자기 점검: ${top.title}`;
  return 줄.length + 외.length > 80 ? `${줄.slice(0, 79 - 외.length)}…${외}` : `${줄}${외}`;
};
