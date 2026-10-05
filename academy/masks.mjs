/**
 * 케이스 리포트 공개본의 가림 규칙 — case-report.mjs(가린다)와 sales.mjs(가렸는지 검사한다)가 같이 쓴다.
 *
 * 전에는 목록이 두 곳에 손으로 있었다. sales.mjs 쪽이 절반(경쟁 브랜드·지역 사이트·다른 지점)을 빼먹어
 * 가려진 경쟁 학원 이름이 드러나도 검사가 안 멈췄다(2026-09-22 Richard). 한 곳에서만 고친다.
 *
 * 긴 말부터 — 「송파런」을 「송파」보다 먼저 바꿔야 한다.
 */
export const MASKS = [
  [/로봇\s*(?:&|앤)\s*코딩\s*학원/g, "[학원명]"],
  [/로봇앤코딩|로봇&코딩/g, "[학원명]"],
  [/(?:www\.)?robotncoding\.com/g, "[사이트]"],
  [/강남점 카카오채널/g, "같은 이름 다른 지점 카카오채널"],
  [/learns\.academy 대치동/g, "다른 지역 학원 목록"],
  [/송파런/g, "지역 학원 정보 사이트"],
  [/로보티즈/g, "학원 브랜드 A"],
  [/디랩/g, "학원 브랜드 B"],
  [/글로벌리더센터/g, "학원 브랜드 C"],
  [/서울(?:특별시)?\s*/g, ""],
  [/송파구|송파/g, "[구]"],
  [/석촌동|석촌/g, "[동]"],
  [/잠실|헬리오시티|가락/g, "[생활권]"],
  [/\/blog\/[a-z0-9-]+/g, "/blog/(글)"],
];

/**
 * 공개본에 원문으로 남으면 안 되는 말 — 위 MASKS 가 가리는 말의 원문 쪽.
 * 영문 표기(robot&coding 등)는 MASKS 가 만들어 내지 않지만, 누가 손으로 넣으면 잡아야 한다
 */
export const 가릴원문 = [
  "로봇&코딩학원", "로봇&코딩", "로봇앤코딩", "robotncoding.com", "robotncoding", "robot&coding", "robotcoding", "robot and coding",
  "강남점 카카오채널", "learns.academy", "대치동", "송파런", "로보티즈", "디랩", "글로벌리더센터",
  "서울", "송파", "석촌", "잠실", "헬리오시티", "가락",
];
/** 모양으로 잡을 것 — 글 주소는 「/blog/(글)」로 가려져야 한다 */
export const 가릴모양 = [/\/blog\/[a-z0-9-]{3,}/];

/**
 * 영업 전화에서 「같은 지역」으로 보는 구. 이 구의 학원에 케이스 리포트 링크를 보내거나 운영자가 학원을 한다는 말을 하면,
 * 받는 쪽이 「근처 코딩·로봇 학원 원장이 하는 회사」로 좁힐 수 있다 — 조합되면 특정된다(9/22 Arch).
 * 학원 수요는 구 경계를 넘는다. 강동은 붙어 있는 생활권이라 같이 본다
 */
export const 같은지역구 = ["송파", "강동"];

// ─────────────────────────────────────────── 검사 — sales.mjs(초안·공개본)와 illustrate.mjs(도해)가 같이 쓴다
export const 전화 = /(?<!\d)(?:0\d{1,2}[-.\s)]\s*\d{3,4}[-.\s]\d{4}|01[016789]\d{7,8}|1[5-9]\d{2}-\d{4})(?!\d)/;

/** 태그를 떼고(쪼갠 이름이 붙게) 엔티티·URL 인코딩을 푼다 */
export const 풀기 = (s) => {
  let t = String(s).replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, "")
    .replace(/&#x([0-9a-f]+);?/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);?/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&amp;/g, "&").replace(/&nbsp;/g, " ").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"');
  t = t.replace(/(?:%[0-9A-Fa-f]{2})+/g, (m) => { try { return decodeURIComponent(m); } catch { return m; } });
  return t;
};
/** 띄어쓰기·구두점을 지우고 &·and 를 「앤」으로 — 「로봇 & 코딩」「robot and coding」을 같은 말로 본다 */
const 정규화 = (s) => String(s).toLowerCase().replace(/\band\b/g, "앤").replace(/&/g, "앤").replace(/[^0-9a-z가-힣]/g, "");

/** 걸린 말 목록을 돌려준다. 비었으면 통과. 원문 → 푼 글 → 정규화본 세 번 본다 */
export const 가림검사 = (text, 말들) => {
  const 원문 = String(text);
  // 주소 속 URL 인코딩은 태그 안(href)에 있다 — 태그를 떼기 전에도 한 번 푼다
  const 원문풀림 = 원문.replace(/(?:%[0-9A-Fa-f]{2})+/g, (m) => { try { return decodeURIComponent(m); } catch { return m; } });
  const 푼글 = 풀기(원문);
  const 접힌 = 정규화(푼글);
  const 걸림 = new Set();
  const 글들 = [원문, 원문풀림, 푼글].map((x) => x.toLowerCase());
  for (const m of 말들) {
    const low = m.toLowerCase();
    // 두 글자 한글(가락·송파 등)은 앞 글자가 한글이면 남의 낱말이다(손가락). 그때는 안 센다
    const 있음 = /^[가-힣]{2}$/.test(m)
      ? 글들.some((g) => new RegExp(`(?<![가-힣])${m}`).test(g))
      : 글들.some((g) => g.includes(low));
    if (있음) { 걸림.add(m); continue; }
    // 정규화본은 네 글자 이상만 — 두 글자 지역어를 공백까지 지운 글에서 찾으면 남의 낱말(「손가락」 등)에 걸린다. 짧은 말은 위 두 번으로 본다
    const n = 정규화(m);
    if (n.length >= 4 && 접힌.includes(n)) 걸림.add(`${m} (띄어쓰기·표기 바꿈)`);
  }
  for (const re of 가릴모양) { const x = 푼글.match(re); if (x) 걸림.add(`모양 ${x[0]}`); }
  for (const x of 푼글.match(new RegExp(전화.source, "g")) ?? []) 걸림.add(`전화번호 ${x}`);
  return [...걸림];
};

/**
 * 고객사를 알아보게 하는 말 — 이름·도메인·표기(brandRe)·주소·전화 끝자리(presenceRe). 정규식 원문에서 글자만 꺼낸다.
 * clients 는 clients.mjs loadClients 결과(코드 덩어리·고객설정 모양 — brandRe·presenceRe 는 없어도 된다)
 */
export const 고객사말 = (clients) => {
  const 말 = new Set();
  for (const c of clients) {
    말.add(c.name);
    말.add(c.domain);
    if (c.name.includes("&")) {
      const 줄기 = c.name.replace(/학원$/, "");
      for (const x of [c.name, 줄기]) { 말.add(x.replace("&", "&amp;")); 말.add(x.replace("&", "앤")); 말.add(x); }
    }
    for (const p of [String(c.brandRe?.source ?? ""), String(c.presenceRe?.source ?? "")].join("|").split("|")) {
      const t = p.replace(/\\s\*/g, " ").replace(/-\?/g, "-").replace(/[\\^$()?*+[\]{}]/g, "").trim();
      if (t.length >= 4) 말.add(t);
    }
  }
  return [...말].filter(Boolean);
};

/**
 * 지어낸 숫자를 잡는다. 전에는 `재료.includes(n)` 이라 「30%」도 재료 어딘가의 「30」 에 붙어 통과했다(Richard 9/22).
 *   숫자는 재료의 숫자 토큰 집합에 통째로 있어야 하고,
 *   단위가 붙은 수(「30%」「세 배」「두 달」)는 그 구절이 재료에 그대로 있어야 한다
 * 재료에 없는 숫자·구절 목록을 돌려준다. 비었으면 통과. 예외 = 말투로 쓰는 구절(띄어쓰기 없이)
 */
const 숫자토큰 = (s) => new Set([...String(s).matchAll(/\d+(?:[.,]\d+)*/g)].map((m) => m[0].replace(/,/g, "")));
const 한글수 = "다섯|여섯|일곱|여덟|아홉|스무|서른|마흔|수십|수백|수천|수만|몇십|몇|한|두|세|석|네|넉|열|쉰|백|천|만";
const 단위 = "퍼센트|개월|주일|시간|군데|가지|%|배|명|건|곳|개|번|회|일|주|달|년|쪽|편|위|점|분";
// 한글 수 앞에 한글이 붙어 있으면 수가 아니다 — 「중요한 점」「간단한 일」의 「한」 (도해 글자에서 흔하다, Step 12)
const 단위구절 = new RegExp(`(?:\\d+(?:[.,]\\d+)*|(?<![가-힣])(?:${한글수}))\\s*(?:${단위})`, "g");
const 접기 = (s) => String(s).replace(/\s+/g, "");
export const 수검사 = (글, 재료, 예외 = new Set()) => {
  const 재료수 = 숫자토큰(재료);
  const 재료접힘 = 접기(재료);
  const 모르는 = [...숫자토큰(글)].filter((n) => !재료수.has(n));
  const 구절 = [...new Set([...String(글).matchAll(단위구절)].map((m) => 접기(m[0])))].filter((p) => !예외.has(p) && !재료접힘.includes(p));
  return [...모르는, ...구절];
};
