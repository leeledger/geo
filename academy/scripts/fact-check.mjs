/**
 * 글에 든 숫자를 전부 끄집어내 사람 앞에 놓는다(CLI). 그리고 자동 감수의 첫 관문 「출처 대조」(Step 43)를 내보낸다.
 *
 * slop-check 는 어휘만 본다. 그래서 「우리 지역 30개 학원을 대상으로 한 설문에서
 * 응답자의 40%가」 같은 문장이 0곳 통과로 나온다. 없는 설문이다.
 * 지어낸 숫자 하나가 다른 문서와 어긋나면 레퍼런스 전체가 죽는다 — CLAUDE.md 첫 규칙이다.
 *
 * CLI 는 숫자가 있는 줄을 빠짐없이 댄다. 판단은 그 줄을 읽는 쪽이 한다.
 * 출처대조() 는 판단까지 한다 — 글이 단 출처를 실제로 가져와, 숫자·이름·제도어가 든 문장마다
 * 원문 창을 찾고 판정 모델에 맞춰 보게 한 뒤, 원문이 받쳐 주지 않는 문장은 지운다(D85).
 * 근거는 원문 창 안에 그대로 있어야 한다 — 판정 모델이 근거를 지어내면 「없음」으로 떨어진다.
 *
 *   node scripts/fact-check.mjs <슬러그>
 */
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { 주장뽑기, 본문문장, 창찾기, 판정읽기, 문장지우기, 접기, 학원표지 } from "../../web/lib/post-auto-core.mjs";

/** 설문·조사·통계를 들먹이는 문장. 우리는 설문을 한 적이 없다. */
const 조사표현 = /설문|조사에 따르면|통계|응답자|리서치|연구 결과|자료에 따르면/;

// ─────────────────────────────────────────── 출처 가져오기 (D86)
const UA = "Mozilla/5.0 (compatible; CitedFactCheck/1.0; +https://robotncoding.com)";
const 네트워크오류 = /ENOTFOUND|EAI_AGAIN|ECONNREFUSED|ECONNRESET|ETIMEDOUT|UND_ERR_CONNECT_TIMEOUT|UND_ERR_SOCKET|aborted|timeout/i;

const 엔티티 = (s) => s
  .replace(/&#x([0-9a-f]+);?/gi, (_, h) => { try { return String.fromCodePoint(parseInt(h, 16)); } catch { return " "; } })
  .replace(/&#(\d+);?/g, (_, d) => { try { return String.fromCodePoint(Number(d)); } catch { return " "; } })
  .replace(/&nbsp;/g, " ").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&middot;/g, "·").replace(/&amp;/g, "&");
/** HTML → 글자. script·style·noscript·svg 는 통째로, 나머지 태그는 공백으로 */
export const 글만 = (html) => 엔티티(String(html)
  .replace(/<(script|style|noscript|svg|template)[\s\S]*?<\/\1>/gi, " ")
  .replace(/<!--[\s\S]*?-->/g, " ")
  .replace(/<br\s*\/?>|<\/(p|div|li|h\d|tr|td|section|article)>/gi, "\n")
  .replace(/<[^>]+>/g, " "))
  .replace(/[ \t\f\v]+/g, " ").replace(/\s*\n\s*/g, "\n").trim();

/**
 * PDF 텍스트층만 읽는다(D96). 스캔본(글자가 그림)은 텍스트가 거의 안 나와 「못 읽음」 그대로다.
 * pdfjs-dist 가 없으면(설치 안 된 환경) 던진다 — 부르는 쪽이 「못 읽음」으로 적는다
 */
export const PDF상한 = { 바이트: 5 * 1024 * 1024, 쪽: 50 };
export async function PDF글(바이트, { 쪽 = PDF상한.쪽 } = {}) {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const 작업 = pdfjs.getDocument({ data: new Uint8Array(바이트), isEvalSupported: false, disableFontFace: true, useSystemFonts: false, verbosity: 0 });
  const doc = await 작업.promise;
  try {
    const 줄 = [];
    for (let i = 1; i <= Math.min(doc.numPages, 쪽); i++) {
      const page = await doc.getPage(i);
      const t = await page.getTextContent();
      줄.push(t.items.map((it) => `${it.str ?? ""}${it.hasEOL ? "\n" : ""}`).join(" "));
      page.cleanup();
    }
    return { 글: 줄.join("\n").replace(/[ \t]+/g, " ").trim(), 쪽수: doc.numPages };
  } finally {
    await 작업.destroy().catch(() => {});
  }
}

/**
 * 주소 하나를 가져온다. 15초·2MB·리다이렉트 따라감(그라운딩 리다이렉트 포함). 최종 주소를 남긴다.
 * PDF 는 따로 30초·5MB·50쪽까지 텍스트층을 읽는다(D96) — 스캔본·상한 넘음은 「못 읽음」.
 * HTML·PDF 아닌 것 = 「못 읽음」(근거 아님). DNS·타임아웃 = 「네트워크」(전부 그러면 미룸)
 */
export async function 출처가져오기(주소, { fetch: f = fetch, 시간 = 15000, 상한 = 2 * 1024 * 1024, pdf = PDF글 } = {}) {
  const 끝 = (상태, 왜, 덧 = {}) => ({ 주소, 최종: 덧.최종 ?? 주소, 상태, 왜, 글: 덧.글 ?? "", ...(덧.PDF ? { PDF: true } : {}) });
  const ac = new AbortController();
  let 타이머 = setTimeout(() => ac.abort(), 시간);
  try {
    const res = await f(주소, { redirect: "follow", signal: ac.signal, headers: { "user-agent": UA, accept: "text/html,application/xhtml+xml,application/pdf;q=0.9,*/*;q=0.5", "accept-language": "ko,en;q=0.5" } });
    const 최종 = res.url || 주소;
    if (!res.ok) return 끝("못 읽음", `HTTP ${res.status}`, { 최종 });
    const 종류 = String(res.headers.get("content-type") ?? "").toLowerCase();
    const PDF같음 = /pdf/.test(종류) || /\.pdf(?:$|[?#])/i.test(최종);
    // 글자 아닌 것(octet-stream 등)은 PDF 일 수 있어 PDF 상한으로 받아 머리를 본다
    const 글자종류 = !종류 || /html|text\/plain|xml/.test(종류);
    if (!PDF같음 && !글자종류 && !/octet-stream|download|force-download/.test(종류)) return 끝("못 읽음", `HTML 아님(${종류.split(";")[0]})`, { 최종 });
    const 이번상한 = 글자종류 && !PDF같음 ? 상한 : PDF상한.바이트;
    if (이번상한 !== 상한) { clearTimeout(타이머); 타이머 = setTimeout(() => ac.abort(), Math.max(시간, 30000)); }
    const 조각 = [];
    let 크기 = 0;
    let 넘음 = false;
    const r = res.body?.getReader?.();
    if (r) {
      for (;;) {
        const { done, value } = await r.read();
        if (done) break;
        조각.push(value);
        크기 += value.length;
        if (크기 >= 이번상한) { 넘음 = true; await r.cancel().catch(() => {}); break; }
      }
    } else {
      const b = new Uint8Array(await res.arrayBuffer());
      넘음 = b.length > 이번상한;
      조각.push(b.slice(0, 이번상한));
    }
    const 바이트 = Buffer.concat(조각.map((x) => Buffer.from(x)));
    if (바이트.subarray(0, 5).toString("latin1") === "%PDF-") {
      if (넘음) return 끝("못 읽음", `PDF 가 ${PDF상한.바이트 / 1024 / 1024}MB 를 넘음`, { 최종, PDF: true });
      try {
        const { 글, 쪽수 } = await pdf(바이트);
        if (글.replace(/\s/g, "").length < 200) return 끝("못 읽음", "PDF 에 글자층이 없음(스캔본)", { 최종, PDF: true });
        return 끝("읽음", 쪽수 > PDF상한.쪽 ? `PDF ${쪽수}쪽 중 앞 ${PDF상한.쪽}쪽만` : "", { 최종, 글, PDF: true });
      } catch (e) {
        return 끝("못 읽음", `PDF 를 못 읽음(${String(e?.message ?? e).slice(0, 60)})`, { 최종, PDF: true });
      }
    }
    if (!글자종류) return 끝("못 읽음", `HTML 아님(${종류.split(";")[0]})`, { 최종 });
    const 머리 = 바이트.subarray(0, 4096).toString("latin1");
    const 인코딩 = (/charset=([\w-]+)/i.exec(종류)?.[1] ?? /<meta[^>]+charset=["']?([\w-]+)/i.exec(머리)?.[1] ?? "utf-8").toLowerCase();
    let 원문;
    try { 원문 = new TextDecoder(/^(euc-kr|ks_c_5601-1987|cp949|x-windows-949)$/.test(인코딩) ? "euc-kr" : 인코딩).decode(바이트); } catch { 원문 = 바이트.toString("utf8"); }
    const 글 = /html|xml/.test(종류) || /<html|<body/i.test(원문.slice(0, 2000)) ? 글만(원문) : 원문;
    if (글.length < 200) return 끝("못 읽음", "본문이 거의 없음(스크립트로 그리는 쪽일 수 있음)", { 최종, 글 });
    return 끝("읽음", "", { 최종, 글 });
  } catch (e) {
    const 말 = `${e?.name ?? ""} ${e?.message ?? ""} ${e?.cause?.code ?? ""} ${e?.cause?.message ?? ""}`;
    return 끝(네트워크오류.test(말) ? "네트워크" : "못 읽음", 말.replace(/\s+/g, " ").trim().slice(0, 120));
  } finally {
    clearTimeout(타이머);
  }
}

const 주소다듬기 = (u) => String(u).trim().replace(/[.,;:]+$/, "").replace(/#.*$/, "");
/** 글이 단 출처 주소 — notes.출처 · notes.주장[].출처 · 본문 속 주소. 자기 사이트는 뺀다 */
export function 출처주소들(body, notes = {}) {
  const 모음 = [
    ...(Array.isArray(notes.출처) ? notes.출처 : []),
    ...(Array.isArray(notes.주장) ? notes.주장.flatMap((c) => (Array.isArray(c?.출처) ? c.출처 : [])) : []),
    ...(String(body ?? "").match(/https?:\/\/[^\s)\]>"'<]+/g) ?? []),
  ].map(주소다듬기).filter((u) => /^https?:\/\//.test(u) && !/robotncoding\.com/i.test(u));
  const 본 = new Set();
  return 모음.filter((u) => { const k = u.toLowerCase().replace(/\/+$/, ""); if (본.has(k)) return false; 본.add(k); return true; });
}

const 접은 = (s) => 접기(s).글;
const 그림없이 = (b) => String(b ?? "").replace(/^\s*!\[[^\]]*\]\([^)]*\)\s*$/gm, "").trim();

/**
 * 출처 대조(Step 43 (a)). post {title, body} · notes = review_notes.
 *   fetch  주소 가져오기(시험에서는 가짜) · 클로드(prompt, opts) → {ok, text, 한도, error}
 *   최소   지운 뒤 본문 하한(사실 1,500 · 재료 1,800)
 * 돌려줌 { 결과: 통과|실패|미룸, 왜, body, 지운것[], 첫문단지움, 출처표[], 문장[] }
 */
export async function 출처대조(post, notes = {}, { fetch: f = fetch, 클로드, 최소 = notes?.모드 === "재료" ? 1800 : 1500 } = {}) {
  const body = String(post?.body ?? "");
  const 재료 = new Map((Array.isArray(notes.재료표) ? notes.재료표 : []).map((m) => [String(m.라벨), String(m.원문 ?? "")]));
  const 주소들 = 출처주소들(body, notes);
  const 출처표 = await Promise.all(주소들.map((u) => 출처가져오기(u, { fetch: f })));
  const 출처표밖 = 출처표.map(({ 글, ...x }) => ({ ...x, 맞음: 0, 길이: 글.length }));
  if (주소들.length && 출처표.every((x) => x.상태 === "네트워크")) {
    return { 결과: "미룸", 왜: `출처 ${주소들.length}곳 전부 네트워크 오류`, body, 지운것: [], 첫문단지움: false, 출처표: 출처표밖, 문장: [] };
  }
  const 읽은 = 출처표.map((x, i) => ({ i, 글: x.상태 === "읽음" ? x.글 : "" })).filter((x) => x.글);

  // 대상 — 주장뽑기 전부 ∪ notes.주장 중 바깥·학원(본문 문장에 맞춰 붙인다)
  const 대상 = new Map();
  for (const c of 주장뽑기(body)) 대상.set(c.문장, { ...c, 종류: "", 출처: [], 재료: [] });
  const 문장들 = 본문문장(body);
  const 안맞음 = [];
  for (const n of Array.isArray(notes.주장) ? notes.주장 : []) {
    if (n?.종류 !== "바깥" && n?.종류 !== "학원") continue;
    const k = 접은(n.문장 ?? "");
    if (k.length < 10) continue;
    const s = 문장들.find((x) => { const y = 접은(x.문장); return y.length >= 10 && (y.includes(k) || k.includes(y)); });
    if (!s) { 안맞음.push(String(n.문장).slice(0, 60)); continue; }
    const d = 대상.get(s.문장) ?? { ...(주장뽑기(s.문장)[0] ?? { 문장: s.문장, 숫자: [], 고유명사: [], 제도어: [] }), 문장: s.문장, 출처: [], 재료: [] };
    d.종류 = n.종류;
    d.출처 = [...d.출처, ...(Array.isArray(n.출처) ? n.출처.map(주소다듬기) : [])];
    d.재료 = [...d.재료, ...(Array.isArray(n.재료) ? n.재료.map(String) : [])];
    대상.set(s.문장, d);
  }
  // 학원 1인칭 표지(우리 반·상담에서 …)가 든 문장은 주장 목록과 상관없이 「학원」 — 라벨 재료가 없으면 창 0 → 지움
  for (const { 문장: s } of 문장들) {
    if (!학원표지.test(s)) continue;
    const d = 대상.get(s) ?? { 문장: s, 숫자: [], 고유명사: [], 제도어: [], 출처: [], 재료: [] };
    d.종류 = "학원";
    대상.set(s, d);
  }

  // 창 — 학원 문장은 라벨 재료 원문이 곧 창(짧다). 나머지는 지정 출처(없으면 모든 출처·재료)에서 창찾기
  const 목록 = [...대상.values()].map((d, n) => ({ ...d, id: `s${n + 1}`, 창들: [], 창출처: [] }));
  for (const d of 목록) {
    if (d.종류 === "학원") {
      for (const l of d.재료) if (재료.has(l)) { d.창들.push(재료.get(l).slice(0, 600)); d.창출처.push(`재료 ${l}`); }
      continue;
    }
    const 지정 = new Set(d.출처.map((u) => u.toLowerCase().replace(/\/+$/, "")));
    const 후보 = [
      ...읽은.filter((x) => !지정.size || 지정.has(주소들[x.i].toLowerCase().replace(/\/+$/, ""))).map((x) => ({ 글: x.글, 어디: x.i })),
      ...(d.종류 === "바깥" ? [] : [...재료].map(([l, 글]) => ({ 글, 어디: `재료 ${l}` }))),
    ];
    // 출처마다 창을 찾고, 주장의 숫자·이름이 가장 많이 든 창 3개를 고른다 — 앞 출처의 메뉴·날짜 창이 자리를 다 차지하지 않게
    const 단서 = [...(d.숫자 ?? []), ...(d.고유명사 ?? []), ...(d.제도어 ?? []), ...(d.빌린말?.고유명사 ?? [])].map(접은).filter(Boolean);
    const 모은 = 후보.flatMap((c, n) => 창찾기(c.글, d).map((w) => ({ w, 어디: c.어디, n, 점수: 단서.filter((k) => 접은(w).includes(k)).length })));
    for (const x of 모은.sort((a, b) => b.점수 - a.점수 || a.n - b.n).slice(0, 3)) { d.창들.push(x.w); d.창출처.push(x.어디); }
  }

  const 물을것 = 목록.filter((d) => d.창들.length);
  let 판 = new Map();
  if (물을것.length) {
    if (!클로드) return { 결과: "미룸", 왜: "판정 모델이 없음", body, 지운것: [], 첫문단지움: false, 출처표: 출처표밖, 문장: [] };
    const prompt = [
      "너는 사실 확인 담당이다. 아래 문장마다 함께 준 원문 조각(창)이 그 문장을 받쳐 주는지 판정한다.",
      "- 맞음: 창 안에 문장의 숫자·이름·제도 변화가 같은 뜻으로 있다",
      "- 다름: 창에 같은 대상의 다른 숫자·다른 사실이 있다",
      "- 없음: 창만으로는 알 수 없다(계산·추론·일반론 포함)",
      "근거 에는 창에서 그대로 베낀 한 줄(20~150자)을 넣는다. 고쳐 쓰거나 줄이거나 합치지 마라. 없음이면 빈 문자열.",
      "창에 없는 지식으로 판정하지 마라. 확실하지 않으면 없음.",
      '형식: JSON 하나만 {"판정":[{"id":"s1","판정":"맞음","근거":"..."}]}',
      "",
      ...물을것.flatMap((d) => [`# ${d.id}`, `문장: ${d.문장}`, ...d.창들.map((w, i) => `창 ${i + 1}: ${w.replace(/\s+/g, " ")}`), ""]),
    ].join("\n");
    const r = await 클로드(prompt, { purpose: "출처대조", capRequired: true, timeoutMs: 8 * 60 * 1000, maxTurns: 2 });
    if (r?.한도) return { 결과: "미룸", 왜: `판정 한도 — ${String(r.error ?? "").slice(0, 80)}`, body, 지운것: [], 첫문단지움: false, 출처표: 출처표밖, 문장: [] };
    if (!r?.ok) return { 결과: "미룸", 왜: `판정 호출 실패 — ${String(r?.error ?? "").slice(0, 80)}`, body, 지운것: [], 첫문단지움: false, 출처표: 출처표밖, 문장: [] };
    판 = 판정읽기(r.text, 물을것);
    // 답을 못 읽은 것은 판정이 아니다 — 전부 지우지 말고 미룬다(회차 안 셈). 원인을 잡게 답 앞 500자를 남긴다
    if (판.못읽음) {
      return { 결과: "미룸", 왜: "판정 답을 못 읽음(JSON 아님)", 답원문: String(r.text ?? "").slice(0, 500), body, 지운것: [], 첫문단지움: false, 출처표: 출처표밖, 문장: [] };
    }
  }

  const 문장 = 목록.map((d) => {
    const p = 판.get(d.id) ?? { 판정: "없음", 근거: "", 왜: d.창들.length ? "판정 없음" : "원문에서 창을 못 찾음" };
    if (p.판정 === "맞음") {
      const w = d.창들.findIndex((x) => 접은(x).includes(접은(p.근거)));
      const 어디 = d.창출처[w];
      if (typeof 어디 === "number") 출처표밖[어디].맞음++;
    }
    return { 문장: d.문장, 종류: d.종류 || "본문", 판정: p.판정, 근거: p.근거, 왜: p.왜 ?? "", 창수: d.창들.length };
  });
  const 지울것 = 문장.filter((x) => x.판정 !== "맞음").map((x) => x.문장);
  const 지움 = 문장지우기(body, 지울것);
  const 길이 = 그림없이(지움.body).length;
  const 실패 = 지움.첫문단지움 ? "첫 문단이 지워짐" : 길이 < 최소 ? `지우고 나니 ${길이.toLocaleString("en-US")}자 — ${최소.toLocaleString("en-US")}자에 못 미침` : "";
  const 맞음수 = 문장.filter((x) => x.판정 === "맞음").length;
  return {
    결과: 실패 ? "실패" : "통과",
    왜: 실패 || `대조 ${문장.length}문장 중 ${맞음수} 맞음 · ${지움.지운것.length ? `원문에 없는 문장 ${지울것.length}곳 지움` : "지운 문장 없음"}`,
    body: 지움.body, 지운것: 지움.지운것, 첫문단지움: 지움.첫문단지움, 출처표: 출처표밖, 문장, 안맞은주장: 안맞음,
  };
}

// ─────────────────────────────────────────── CLI — 숫자가 있는 줄을 빠짐없이 댄다
async function cli() {
  for (const l of fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8").split(/\r?\n/)) {
    const m = /^([A-Z_]+)=(.*)$/.exec(l);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }

  const slug = process.argv.slice(2).find((a) => !a.startsWith("--"));
  if (!slug) {
    console.log("슬러그를 주세요:  node scripts/fact-check.mjs <슬러그>");
    process.exit(1);
  }

  const { Pool } = (await import("pg")).default;
  const u = new URL(process.env.DATABASE_URL);
  u.searchParams.delete("sslmode");
  const pool = new Pool({ connectionString: u.toString(), ssl: { rejectUnauthorized: false } });

  const { rows } = await pool.query(
    `select title, body from academy.posts where slug = $1`, [slug],
  );
  if (!rows.length) {
    console.log(`${slug} 를 못 찾았습니다.`);
    await pool.end();
    process.exit(1);
  }

  await pool.end();

  // 쓸 수 있는 숫자는 없다. write-draft 프롬프트가 「숫자를 쓰지 마라」로 바뀌었다 —
  // 공개 글 수와 크롤러 방문 수를 줬더니 그걸 글 소재로 썼기 때문이다(2026-09-12).
  // 여기도 같이 비운다. 안 그러면 43·659 가 되살아나도 이 도구가 통과시킨다.
  // 초안에 숫자가 있으면 하나도 빠짐없이 사람 앞에 놓는다.
  const 허용 = new Set();
  const body = rows[0].body ?? "";

  console.log(rows[0].title);
  console.log(`잰 숫자(써도 되는 것): ${[...허용].join(", ") || "없음"}\n`);

  const 줄들 = body.split(/\n+/).map((s) => s.trim()).filter(Boolean);
  let 숫자줄 = 0;
  let 조사줄 = 0;

  for (const 줄 of 줄들) {
    // 목록 번호는 숫자가 아니다. 「1. 반 인원수를」의 1 을 지어낸 숫자로 세면
    // 헛것이 대부분이 되고, 그러면 진짜 한 줄을 놓친다.
    // 「3단계」는 지어낸 숫자가 아니라 이름표다. 목록 번호와 같은 종류의 오탐이고,
    // 커리큘럼 글에서는 줄마다 나와서 진짜 한 줄을 덮어 버린다.
    // 다만 「초등 5학년 이상」의 학년은 확인할 사실이라 그대로 둔다.
    const 본문 = 줄
      .replace(/^\s*\d+[.)]\s/, "")
      .replace(/\(\s*\d+\s*\)/g, "")
      .replace(/\d+\s*단계/g, "");
    const nums = 본문.match(/\d+(?:[.,]\d+)?/g);
    const 조사 = 조사표현.test(줄);
    if (!nums && !조사) continue;

    const 밖의것 = (nums ?? []).filter((n) => !허용.has(n));
    if (!밖의것.length && !조사) continue;

    숫자줄++;
    if (조사) 조사줄++;
    const 보임 = 줄.length > 150 ? 줄.slice(0, 150) + "…" : 줄;
    console.log(`  ${조사 ? "‼" : "·"} ${보임}`);
    if (밖의것.length) console.log(`      잰 적 없는 숫자: ${[...new Set(밖의것)].join(", ")}`);
    if (조사) console.log(`      ‼ 설문·조사를 들먹입니다. 우리는 설문을 한 적이 없습니다`);
    console.log();
  }

  console.log("─".repeat(56));
  if (!숫자줄) {
    console.log("  잰 적 없는 숫자가 없습니다. 그래도 겪은 일인지는 사람이 봐야 합니다.");
  } else {
    console.log(`  확인할 줄 ${숫자줄}개${조사줄 ? ` · 그중 ${조사줄}개는 없는 조사를 인용합니다` : ""}`);
    console.log("  겪은 일이 아니면 지우거나, 숫자를 빼고 판단 기준만 남깁니다.");
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === fs.realpathSync(process.argv[1])) await cli();
