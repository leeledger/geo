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

/** 학부모가 보기엔 problem·consider 가 같은 「일반 질문」이다. 글 처방도 같아서 한 묶음으로 센다 */
const 묶음 = { local: "local", brand: "brand", problem: "general", consider: "general" };
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
const 곳 = (m) => 곳이름[m] ?? m;
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
 * @returns probes  [{source_prompt, radius, text, form, seed?}] — 씨앗은 source_prompt 가 null
 */
export function 자기점검({ questions, rows, 판정rows = rows, runs, posts, today, domain, probes = [], 적중, 새탐침한도 = 2 }) {
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
    for (const [s, gg] of Object.entries(묶음)) if (gg === g) skipContent.add(s);
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

  // ── widen: 맞는 질문을 한 칸 넓힌다. 탐침 결과는 반경을 재는 것뿐, 판정에 안 쓴다
  // 모양이 둘이다 — 문장(승인 동네 질문에서 출발)과 검색어(송파구 씨앗 3개에서 출발). 모양·곳끼리 합치지 않는다
  const 주전 = 날더하기(today, -6);
  const 탐침율 = (pid, method = 탐침곳) => {
    const w = rows.filter((r) => r.prompt_id === pid && r.collection_method === method && r.day >= 주전);
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
  const 사슬 = (pid, radius, method) => {
    const 칸 = [];
    const 적기 = (id, r) => {
      const { hit, n } = 탐침율(id, method);
      칸.push(`${r} ${id} ${n ? `${hit}/${n}` : "안 잼"}`);
    };
    적기(pid, radius);
    for (let cur = pid, guard = 0; guard < 5; guard++) {
      const child = probes.find((p) => p.source_prompt === cur);
      if (!child) break;
      적기(child.prompt_id, child.radius);
      cur = child.prompt_id;
    }
    return 칸.join(" → ");
  };
  const 문장사슬 = questions.filter((x) => x.stage === "local" && 자식있음.has(x.prompt_id))
    .map((x) => 사슬(x.prompt_id, 반경(x.text), 탐침곳));
  const 검색어뿌리 = probes.filter((p) => 모양(p) === "keyword" && !p.source_prompt);
  const 검색어id = new Set(probes.filter((p) => 모양(p) === "keyword").map((p) => p.prompt_id));
  // 검색어 탐침은 Claude 말고 다른 곳(구글 AI 모드 등)에서도 잰다. 곳마다 따로 적는다
  const 검색어곳 = [탐침곳, ...new Set(rows.filter((r) => 검색어id.has(r.prompt_id) && r.collection_method !== 탐침곳).map((r) => r.collection_method))];
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

  return { findings, skipContent, probes: 새탐침, discover: 발견성 };
}

/** 진단 맨 앞에 붙일 한 줄. 가장 무거운 것 하나 */
const 무게 = ["repeat", "narrow", "stalled", "discover", "widen"];
export const 점검요약 = (findings) => {
  const top = [...findings].sort((a, b) => 무게.indexOf(a.code) - 무게.indexOf(b.code))[0];
  if (!top) return "";
  const 외 = findings.length > 1 ? ` (외 ${findings.length - 1}건)` : "";
  const 줄 = `자기 점검: ${top.title}`;
  return 줄.length + 외.length > 80 ? `${줄.slice(0, 79 - 외.length)}…${외}` : `${줄}${외}`;
};
