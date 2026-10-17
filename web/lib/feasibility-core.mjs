/**
 * 착수 판정(Step 58) — 이 고객, 해볼 만한가. 잰 숫자로만. DB 없이 시험하는 순수 함수. 시험 academy/scripts/test-feasibility-core.mjs.
 *
 * 지난 성공률은 없다(유료 0곳, 파일럿 전부 리허설). 그래서 퍼센트를 만들지 않는다(D261).
 * 잰 요인 5개 → 요인마다 실제 숫자 + 좋음/보통/어려움 → 고정 규칙으로 종합(해볼 만함/시간이 걸림/어려움, 잰 날 0 이면 아직).
 * 등급 기준은 정한 기준이지 잰 성공률이 아니다 — 화면 아래에 그렇게 적는다. 비율 비교는 곱셈(나눗셈 반올림 없음, pilot-report-core 처럼).
 * 이 판 전체에 퍼센트 기호·「성공률」「확률」「가능」+「성」 글자 0 — 시험이 무작위 입력으로 돈다.
 * 성공 정의는 academy/pilot-report-core.mjs 판정() — 약속한 곳 하나라도 7일 언급 비율 증가, 또는 상담 AI·검색 유입 1건+.
 */
import { 낱말들, 낱말업종, 업종말, 업종표, 이름흔함 } from "./auto-setup-words.mjs";

/** 약속한 네 곳 — academy/pilot-report-core.mjs 곳정보와 키·이름이 같아야 한다(web 은 academy 를 import 하지 않는다. 시험이 맞춘다) */
export const 곳정보 = {
  "chatgpt-web-logged-out": { 이름: "ChatGPT" },
  "perplexity-web-logged-out": { 이름: "Perplexity" },
  "gemini-web-logged-out": { 이름: "Gemini" },
  "claude-code-headless-websearch": { 이름: "Claude" },
};
export const 약속한곳들 = Object.keys(곳정보);
/** pilot-report-core 브랜드문항 과 같은 규칙(복사 — 시험이 맞춘다) */
export const 브랜드문항 = (stage) => stage === "brand" || stage === "브랜드";

/** 기준선 창에서 곳마다 이만큼 날을 못 재면 그 곳은 못 잼 — pilot-report-core 최소잰날과 같다(D267) */
export const 최소잰날 = 4;
export const 기준선날수 = 7;
/** 「지난 n곳 중 m곳 성공」은 n 이 이만큼일 때부터(D265) — 밑에선 한 곳이 비율을 20칸 넘게 흔들고, 그 고객이 특정된다 */
export const 지난기록문턱 = 5;
/** 업체 이름 뽑기를 믿는가 — 품질 관문(학원 창 무작위 30개 중 틀린 것 30% 넘음)에 걸리면 false 로 B·C 를 못 잼으로 낸다(D268) */
export const 이름뽑기켬 = true;

/** 등급 기준 — 정한 기준, 잰 성공률 아님(D263). [곱, 곱] 은 「앞×k ≥ 뒤×n」 */
export const 기준 = {
  /** A 어려움: 잰 모든 곳이 5k ≥ 4n — 성공 정의가 「늘었다」라 늘 자리가 없다 */
  A꽉참: [5, 4],
  /** B 좋음: 2k ≥ n · 보통: 5k ≥ n · 그 밑 어려움 */
  B좋음: 2,
  B보통: 5,
  /** C: T < 10 이면 좋음 · T ≥ 10 이고 5·t2 ≥ 3·T 면 어려움(두 곳이 다 차지) · d ≥ 15 면 보통(붐빔) */
  C적음: 10,
  C지배: [5, 3],
  C붐빔: 15,
  /** 종합: 보통이 이만큼이면 시간이 걸림(D264) */
  보통많음: 3,
};

export const 등급 = { 좋음: "좋음", 보통: "보통", 어려움: "어려움", 못: "못 잼" };
export const 판정말 = { 아직: "아직", 해볼: "해볼 만함", 시간: "시간이 걸림", 어려움: "어려움" };

// ─────────────────────────────────────────── 업체 이름 뽑기 (D268)
const 조사 = /(에서는|에서|으로|에게|이나|처럼|까지|부터|은|는|이|가|을|를|의|에|와|과|도|로|만)$/;
const 업종표말 = new Set(업종표.map((x) => x.업종));
/** 업종표에 있는 업종인가 — 없으면 이름 자리를 못 센다(앱 고객 등) */
export const 아는업종 = (업종) => 업종표말.has(String(업종 ?? ""));

/** 낱말 하나 → 업체 이름 또는 null. 조사를 0·1·2번 뗀 꼴 중 처음 맞는 것(「태권도」처럼 끝 글자가 조사와 같은 말을 지키려고) */
function 낱말이름(token, 말들) {
  let w = String(token).replace(/[^가-힣A-Za-z0-9]/g, "");
  for (let i = 0; i < 3 && w; i++) {
    const hit = 낱말업종(w);
    if (hit && 말들.includes(hit.말) && w.length >= 3 && !이름흔함(w)) return w;
    const 뗀 = w.replace(조사, "");
    if (뗀 === w) break;
    w = 뗀;
  }
  return null;
}

/**
 * 답 하나 → 업체 이름들. 고객 업종의 말(업종말들)로 끝나는 낱말 중 흔한 말이 아닌 것. 답 하나 안의 같은 이름은 1번.
 * 우리Re(고객 자신 — answer_pattern)에 걸리는 이름은 남(경쟁)에서 뺀다. → { 전부, 남 }
 */
export function 업체이름들(답, 업종말들, 우리Re) {
  const 말들 = Array.isArray(업종말들) ? 업종말들 : [];
  const 전부 = [...new Set(낱말들(답).map((t) => 낱말이름(t, 말들)).filter(Boolean))];
  const 우리 = (x) => { if (!우리Re) return false; 우리Re.lastIndex = 0; return 우리Re.test(x); };
  return { 전부, 남: 전부.filter((x) => !우리(x)) };
}

// ─────────────────────────────────────────── 창 (D267)
/** 잰 날들(글자 YYYY-MM-DD) → 창. from 이 있으면 그 앞 날은 뺀다(유료 고객은 started_on 부터) */
export function 창고르기(잰날들, from = null) {
  const 날 = [...new Set((잰날들 ?? []).map(String))].filter((d) => !from || d >= from).sort();
  if (!날.length) return { 단계: "아직", 날들: [] };
  if (날.length < 기준선날수) return { 단계: "대강", 날들: 날 };
  return { 단계: "기준선", 날들: 날.slice(0, 기준선날수) };
}
/** 최근 7 잰 날 — 레퍼런스 줄의 둘째 창 */
export function 최근창(잰날들) {
  const 날 = [...new Set((잰날들 ?? []).map(String))].sort();
  return 날.length < 기준선날수 ? { 단계: 날.length ? "대강" : "아직", 날들: 날 } : { 단계: "기준선", 날들: 날.slice(-기준선날수) };
}
export const 단계말 = (창) => (창.단계 === "아직" ? "아직" : 창.단계 === "대강" ? `대강 — ${창.날들.length}일 잰 것` : "기준선 판정");

// ─────────────────────────────────────────── 요인들 (D262·D263)
const 사이트말 = { none: "구축 없음", setup: "손보기", build: "홈페이지 없음" };

/**
 * rows: [{ d, collection_method, stage, mentioned, answer, prompt_id? }] · 창: 창고르기() 결과 ·
 * 사이트상태: none|setup|build|null · 플랫폼: derived.platform 또는 null · intake상태: 착수순서 intake 줄 상태 ·
 * 사실: { 업종, 지역 } 값 · 업종: 이름 뽑기에 쓸 업종 · 우리Re: 고객 자신 정규식(없으면 C 못 잼)
 * → [{ id, 이름, 숫자말, 등급, 이유말, 고객말 }]  (고객말은 못 잼이면 null)
 */
export function 요인들({ rows = [], 창, 사이트상태 = null, 플랫폼 = null, intake상태 = null, 사실 = {}, 업종 = null, 우리Re = null }) {
  const 날들 = new Set(창?.날들 ?? []);
  const 안 = rows.filter((r) => 날들.has(String(r.d)) && 약속한곳들.includes(r.collection_method) && !브랜드문항(r.stage));
  return [요인A(안, 창), ...요인BC(안, 업종, 우리Re), 요인D(사이트상태, 플랫폼), 요인E(intake상태, 사실)];
}

function 요인A(rows, 창) {
  const 기준선 = 창?.단계 === "기준선";
  const 곳 = 약속한곳들.map((m) => {
    const mine = rows.filter((r) => r.collection_method === m);
    const 잰날 = new Set(mine.map((r) => String(r.d))).size;
    const 셈됨 = 기준선 ? 잰날 >= 최소잰날 : 잰날 >= 1;
    return { m, 이름: 곳정보[m].이름, 잰날, n: mine.length, k: mine.filter((r) => r.mentioned).length, 셈됨 };
  });
  const 잰 = 곳.filter((x) => x.셈됨);
  const 숫자말 = 곳.map((x) => (x.셈됨 ? `${x.이름} ${x.n}번 중 ${x.k}번` : `${x.이름} 못 잼(잰 날 ${x.잰날}일)`)).join(" · ");
  const base = { id: "A", 이름: "AI가 이미 이름을 부르나", 숫자말 };
  if (!잰.length) return { ...base, 등급: 등급.못, 이유말: "아직 잰 곳이 없습니다", 고객말: null };
  const [a, b] = 기준.A꽉참;
  const N = 잰.reduce((s, x) => s + x.n, 0), K = 잰.reduce((s, x) => s + x.k, 0);
  const 잰행 = rows.filter((r) => 잰.some((x) => x.m === r.collection_method));
  const 질문 = new Set(잰행.map((r) => r.prompt_id).filter(Boolean)).size;
  const 날수 = new Set(잰행.map((r) => String(r.d))).size;
  const 못곳 = 곳.filter((x) => !x.셈됨);
  const 고객앞 = `AI ${잰.length}곳에 ${질문 ? `질문 ${질문}개를 ` : ""}${날수}일 동안 물어, 답 ${N}개 중 ${K}개에 이름이 나왔습니다`
    + ` (${잰.map((x) => `${x.이름} ${x.n}개 중 ${x.k}개`).join(" · ")}${못곳.length ? ` · ${못곳.map((x) => x.이름).join(", ")}는 잰 날이 모자라 뺐습니다` : ""}).`;
  if (잰.every((x) => a * x.k >= b * x.n)) {
    return { ...base, 등급: 등급.어려움, 이유말: "잰 곳 모두 답 5번 중 4번 이상 이미 이름이 나옵니다 — 더 늘 자리가 거의 없습니다",
      고객말: `${고객앞} 이미 대부분의 답에 이름이 나와, 더 늘릴 자리가 좁습니다.` };
  }
  if (잰.every((x) => x.k === 0)) {
    return { ...base, 등급: 등급.보통, 이유말: "아직 어느 AI 답에도 이름이 안 나옵니다 — 0에서 시작합니다",
      고객말: `${고객앞} 아직 이름이 나오지 않아 0에서 시작합니다.` };
  }
  const 나온곳 = 잰.filter((x) => x.k > 0).map((x) => x.이름).join(", ");
  return { ...base, 등급: 등급.좋음, 이유말: `${나온곳} 답에 이미 이름이 나옵니다 — 늘릴 출발점이 있습니다`,
    고객말: `${고객앞} 이미 이름이 나오는 곳이 있어 늘릴 출발점이 있습니다.` };
}

function 요인BC(rows, 업종, 우리Re) {
  const B = { id: "B", 이름: "AI가 업체를 꼽아 주나" }, C = { id: "C", 이름: "경쟁" };
  const 못 = (이유말) => [{ ...B, 숫자말: "못 잼", 등급: 등급.못, 이유말, 고객말: null }, { ...C, 숫자말: "못 잼", 등급: 등급.못, 이유말, 고객말: null }];
  if (!이름뽑기켬) return 못("이름 뽑기를 아직 안 믿습니다");
  if (!업종) return 못("업종을 몰라 이름 자리를 못 셉니다");
  if (!아는업종(업종)) return 못("업종표에 없는 업종이라 이름 자리를 못 셉니다");
  const 답행 = rows.filter((r) => typeof r.answer === "string" && r.answer.trim());
  if (!답행.length) return 못("아직 잰 답이 없습니다");
  const 말들 = 업종말(업종);
  const 뽑음 = 답행.map((r) => 업체이름들(r.answer, 말들, 우리Re));
  // 고객 이름이 나온 답(mentioned)도 업체 이름이 나온 답이다 — 낱말 뽑기는 「상호 업종」 띄어 쓴 꼴과 과목이 든 상호를 놓친다(Step 58 Bob, 학원 실측)
  const n = 답행.length, k = 답행.filter((r, i) => r.mentioned || 뽑음[i].전부.length).length;
  const b숫자 = `답 ${n}개 중 업체 이름이 나온 답 ${k}개`;
  const b고객 = `같은 답 ${n}개 중 ${k}개에 업체 이름이 들어 있었습니다.`;
  const b = 기준.B좋음 * k >= n
    ? { ...B, 숫자말: b숫자, 등급: 등급.좋음, 이유말: "답에 업체 이름이 자주 나옵니다 — 이름이 들어갈 자리가 있습니다", 고객말: `${b고객} AI 가 업체를 골라 알려 주는 질문이 많습니다.` }
    : 기준.B보통 * k >= n
      ? { ...B, 숫자말: b숫자, 등급: 등급.보통, 이유말: "답에 업체 이름이 가끔 나옵니다", 고객말: `${b고객} 업체 이름이 가끔 들어갑니다.` }
      : { ...B, 숫자말: b숫자, 등급: 등급.어려움, 이유말: "답이 거의 일반 설명이라 업체 이름이 들어갈 자리가 없습니다", 고객말: `${b고객} 대부분 일반 설명이라 업체 이름이 들어갈 자리가 적습니다.` };
  if (!우리Re) return [b, { ...C, 숫자말: "못 잼", 등급: 등급.못, 이유말: "고객 이름을 몰라 다른 업체와 가르지 못합니다", 고객말: null }];
  const 셈 = new Map();
  for (const x of 뽑음) for (const name of x.남) 셈.set(name, (셈.get(name) ?? 0) + 1);
  const 수들 = [...셈.values()].sort((p, q) => q - p);
  const d = 수들.length, T = 수들.reduce((s, x) => s + x, 0), t2 = (수들[0] ?? 0) + (수들[1] ?? 0);
  const c숫자 = `다른 업체 이름 ${d}곳 · 많이 나온 두 곳이 전체 ${T}번 중 ${t2}번`;
  const c고객 = `답에 나온 다른 업체는 ${d}곳이고, 가장 많이 나온 두 곳이 ${T}번 중 ${t2}번이었습니다.`;
  const [p, q] = 기준.C지배;
  const c = T < 기준.C적음
    ? { ...C, 숫자말: c숫자, 등급: 등급.좋음, 이유말: "답에 나오는 다른 업체가 적습니다", 고객말: `${c고객} 자리를 차지한 업체가 적습니다.` }
    : p * t2 >= q * T
      ? { ...C, 숫자말: c숫자, 등급: 등급.어려움, 이유말: "두 업체가 답 자리를 거의 다 차지합니다", 고객말: `${c고객} 두 업체가 자리를 거의 다 차지하고 있습니다.` }
      : d >= 기준.C붐빔
        ? { ...C, 숫자말: c숫자, 등급: 등급.보통, 이유말: "답에 나오는 다른 업체가 많아 붐빕니다", 고객말: `${c고객} 이름이 나오는 업체가 많아 붐빕니다.` }
        : { ...C, 숫자말: c숫자, 등급: 등급.좋음, 이유말: "한두 곳이 자리를 다 차지하지 않았습니다", 고객말: `${c고객} 한두 곳이 자리를 다 차지하지는 않았습니다.` };
  return [b, c];
}

function 요인D(사이트상태, 플랫폼) {
  const base = { id: "D", 이름: "홈페이지" };
  if (!(사이트상태 in 사이트말)) return { ...base, 숫자말: "모름", 등급: 등급.못, 이유말: "홈페이지 상태를 아직 안 골랐습니다", 고객말: null };
  const page = 플랫폼?.page;
  const 덧 = 사이트상태 === "build" && page && typeof page.fetched === "boolean" ? `(채널 ${page.fetched ? "열림" : "못 엶"})` : "";
  const 숫자말 = `${사이트말[사이트상태]}${덧}`;
  if (사이트상태 === "none") return { ...base, 숫자말, 등급: 등급.좋음, 이유말: "지금 홈페이지를 그대로 씁니다", 고객말: "지금 홈페이지를 그대로 씁니다." };
  if (사이트상태 === "setup") return { ...base, 숫자말, 등급: 등급.보통, 이유말: "지금 홈페이지를 손봐서 씁니다", 고객말: "지금 홈페이지를 조금 손봐서 씁니다." };
  return { ...base, 숫자말, 등급: 등급.어려움, 이유말: "홈페이지를 새로 만들어야 해서 길어집니다", 고객말: "홈페이지를 새로 만들어야 해서, 만드는 기간만큼 시작이 뒤로 밀립니다." };
}

function 요인E(intake상태, 사실) {
  const 받음 = intake상태 === "됨";
  const 업종 = !!String(사실?.업종 ?? "").trim(), 지역 = !!String(사실?.지역 ?? "").trim();
  const base = { id: "E", 이름: "AI가 쓸 재료", 숫자말: `받을 것 ${받음 ? "됨" : "아직"} · 업종 ${업종 ? "앎" : "모름"} · 지역 ${지역 ? "앎" : "모름"}` };
  if (받음) return { ...base, 등급: 등급.좋음, 이유말: "상호·주소·전화 같은 기본 정보를 받았습니다", 고객말: "상호·주소·전화 같은 기본 정보를 받았습니다." };
  if (업종 && 지역) return { ...base, 등급: 등급.보통, 이유말: "업종·지역은 알고, 기본 정보는 아직 못 받았습니다", 고객말: "업종과 지역은 확인했고, 기본 정보는 아직 받기 전입니다." };
  return { ...base, 등급: 등급.어려움, 이유말: "업종이나 지역을 아직 모릅니다 — 글에 쓸 사실이 모자랍니다", 고객말: "업종이나 지역을 아직 확인하지 못해, 글에 쓸 사실이 모자랍니다." };
}

// ─────────────────────────────────────────── 종합 (D264)
const 줄말 = (x) => `${x.이름}: ${x.이유말}`;
/** 요인들 → { 판정, 이유들, 못잰것, 이유id } — 위에서부터 첫 번째 맞는 규칙. 못 잼은 세지 않는다 */
export function 종합(요인) {
  const by = Object.fromEntries(요인.map((x) => [x.id, x]));
  const 못잰것 = 요인.filter((x) => x.등급 === 등급.못).map(줄말);
  const 끝 = (판정, xs) => ({ 판정, 이유들: xs.map(줄말), 이유id: xs.map((x) => x.id), 못잰것 });
  const 어 = (id) => by[id]?.등급 === 등급.어려움;
  if (by.A?.등급 === 등급.못 && by.B?.등급 === 등급.못) return { 판정: 판정말.아직, 이유들: ["첫 측정이 끝나면 대강 나옵니다"], 이유id: [], 못잰것 };
  if (어("B") || 어("A") || (어("C") && 어("D"))) {
    const xs = [...(어("B") ? [by.B] : []), ...(어("A") ? [by.A] : []), ...(어("C") && 어("D") ? [by.C, by.D] : [])];
    return 끝(판정말.어려움, xs);
  }
  const 어려운 = 요인.filter((x) => x.등급 === 등급.어려움);
  const 보통 = 요인.filter((x) => x.등급 === 등급.보통);
  if (어려운.length) return 끝(판정말.시간, 어려운);
  if (보통.length >= 기준.보통많음) return 끝(판정말.시간, 보통);
  return 끝(판정말.해볼, 요인.filter((x) => x.등급 === 등급.좋음));
}

// ─────────────────────────────────────────── 지난 기록 (D265·D266)
const 판정값 = ["성공", "실패", "판정 보류"];
/** 지난 기록에 넣을 파일럿인가 — 유료(paid_on)·리허설 아님·판정 있음·자사 아님 */
export const 지난기록대상 = (p) => !!p && !!p.paid_on && p.status !== "리허설" && 판정값.includes(p.verdict) && p.relation !== "자사";
/** n·m → 한 줄. n 이 문턱 밑이면 성공 수를 안 쓴다. 퍼센트는 n 이 커도 안 쓴다 */
export function 지난기록({ n, m }) {
  const N = Math.max(0, Math.trunc(Number(n) || 0));
  if (N < 지난기록문턱) return `판정 끝난 유료 고객 ${N}곳 — ${지난기록문턱}곳부터 성공 수를 적습니다`;
  return `지난 ${N}곳 중 ${Math.max(0, Math.min(N, Math.trunc(Number(m) || 0)))}곳 성공`;
}
/** 끝난 결론을 geo.pilots.verdict 에 쓸까 — 유료·리허설 아님·끝남만(D266, D251 과 같은 선) */
export const 판정저장할까 = (p, 끝났나) => !!p && !!p.paid_on && p.status !== "리허설" && !!끝났나;

export const 기준안내 = "기준은 정해 둔 것입니다. 유료 고객 판정이 쌓이면 다시 맞춥니다";

// ─────────────────────────────────────────── 고객에게 보낼 요약 (D273)
const 고객판정 = { [판정말.해볼]: "해볼 만합니다", [판정말.시간]: "해볼 수 있지만 시간이 걸립니다", [판정말.어려움]: "지금 조건으로는 어렵습니다" };
const 짧은날 = (d) => `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}`;
/**
 * 착수 때 고객에게 보일 글 — 판정과 까닭(잰 숫자 문장). 경쟁 업체 이름 없음, 퍼센트 없음. 아직이면 null.
 * 마지막 줄은 늘 「기준은 저희 규칙이지 잰 성공 비율이 아니다」
 */
export function 고객요약({ 창, 요인, 종합: 결과 }) {
  if (!결과 || 결과.판정 === 판정말.아직 || !창?.날들?.length) return null;
  const by = Object.fromEntries(요인.map((x) => [x.id, x]));
  // 첫 줄은 늘 「AI n곳에 물어 몇 번 이름이 나왔나」(잰 경우) — 그다음 판정을 움직인 요인
  const 까닭 = [...new Set(["A", ...결과.이유id])].map((id) => by[id]?.고객말).filter(Boolean);
  const 날 = 창.날들;
  const 기간 = `${짧은날(날[0])}~${짧은날(날[날.length - 1])}, ${날.length}일`;
  return [
    `AI 답 첫 측정 요약 (${기간})`,
    "",
    `판단: ${고객판정[결과.판정]}`,
    ...(창.단계 === "대강" ? [`아직 ${날.length}일만 잰 대강입니다. 7일을 재면 다시 봅니다.`] : []),
    "",
    "이렇게 본 까닭",
    ...까닭.map((x) => `- ${x}`),
    "",
    "이 판단의 기준은 저희가 정해 둔 규칙입니다. 지난 고객 결과를 세어 낸 숫자가 아닙니다.",
  ].join("\n");
}

// ─────────────────────────────────────────── 레퍼런스 줄 (D272)
export const 학원시작 = "2026-09-05";
export const 학원비교시작 = "2026-09-24";
const 며칠째 = (from, d) => Math.round((Date.parse(`${d}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000) + 1;
/** 학원 한 창 → 한 줄. 이름·동네·도메인·경쟁 이름 없음 */
function 창줄(제목, 창, 요인, 결과) {
  if (!창.날들.length) return `${제목}: 잰 날 없음`;
  const 기간 = `${짧은날(창.날들[0])}~${짧은날(창.날들[창.날들.length - 1])}`;
  return `${제목}(${기간}) — ${결과.판정} · ${요인.map((x) => `${x.이름} ${x.등급}: ${x.숫자말}`).join(" · ")}`;
}
/** 첫 레퍼런스(학원) 두 창 → 줄들. 첫 창 = 9/24 부터 첫 7 잰 날, 둘째 = 최근 7 잰 날 */
export function 레퍼런스줄({ 첫, 최근 }) {
  const 째 = 첫.창.날들.length ? 며칠째(학원시작, 첫.창.날들[0]) : null;
  return [
    `첫 레퍼런스(학원) — 손대기 전 AI 숫자는 없습니다. AI 매일 측정은 시작 ${며칠째(학원시작, 학원비교시작)}일째부터입니다`,
    "시작 날 검색 상태: 학부모가 칠 만한 검색어 6개 모두 학원이 안 나왔습니다(케이스 리포트)",
    창줄(`시작 ${째 ?? "?"}일째부터 잰 첫 7일`, 첫.창, 첫.요인, 첫.종합),
    창줄("최근 7일", 최근.창, 최근.요인, 최근.종합),
  ];
}
