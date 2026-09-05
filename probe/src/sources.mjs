/**
 * 인용 소스 분류.
 *
 * 왜 필요한가: ERP 분야는 비교 전문 매체(korea-erp.com)가 있지만 다른 분야는 없다.
 * 병의원은 네이버 블로그·카페, 산업재는 전문지, 소비재는 커뮤니티가 인용된다.
 * "AI 가 뭘 읽는가"는 분야마다 다르므로, 도메인 목록만 봐서는 무엇을 해야 할지 모른다.
 *
 * 그래서 유형과 함께 **진입 방법**을 낸다. 유형을 아는 것 자체는 쓸모가 없고,
 * "그래서 거기에 어떻게 들어가는가"가 나와야 실행 계획이 된다.
 */

const COMMUNITY = [
  "clien.net", "okky.kr", "i-boss.co.kr", "ppomppu.co.kr", "dcinside.com",
  "ruliweb.com", "bobaedream.co.kr", "quasarzone.com", "damoang.net",
  "sharedit.co.kr", "cafe.naver.com", "kin.naver.com", "arca.live",
  "reddit.com", "stackoverflow.com", "threads.com", "x.com", "twitter.com",
];

const WIKI = ["namu.wiki", "wikipedia.org", "wikidata.org", "namuwiki.com", "fandom.com"];

const MEDIA = [
  "etnews.com", "zdnet.co.kr", "ddaily.co.kr", "bloter.net", "itworld.co.kr",
  "inews24.com", "dt.co.kr", "byline.network", "platum.kr", "venturesquare.net",
  "thebell.co.kr", "hankyung.com", "mk.co.kr", "sedaily.com", "mt.co.kr",
  "edaily.co.kr", "newsis.com", "yna.co.kr", "chosun.com", "joongang.co.kr",
  "donga.com", "news.naver.com", "gttkorea.com", "cio.com", "techcrunch.com",
  "industrynews.co.kr", "epnc.co.kr", "aitimes.com",
];

const BLOG_PLATFORM = [
  "blog.naver.com", "post.naver.com", "tistory.com", "brunch.co.kr",
  "medium.com", "velog.io", "notion.site", "oopy.io", "maily.so", "substack.com",
];

const DIRECTORY = [
  "g2.com", "capterra.com", "producthunt.com", "thevc.kr", "wanted.co.kr",
  "saramin.co.kr", "jobkorea.co.kr", "getapp.com", "softwareadvice.com",
  "trustradius.com", "innoforest.co.kr", "kstartup.go.kr",
];

const GOV = [".go.kr", ".or.kr", ".re.kr", ".ac.kr"];

/** 유형별 진입 방법 — 이게 이 모듈의 본체다 */
export const ENTRY = {
  own:          { label: "자사",          how: "직접 수정",                          effort: "낮음" },
  competitor:   { label: "경쟁사",        how: "진입 불가 — 경쟁사 소유 지면",        effort: "—" },
  comparison:   { label: "비교·리뷰 매체", how: "편집자 컨택 → 제품 자료 제공 → 등재",  effort: "중간" },
  media:        { label: "언론·전문지",    how: "보도자료 배포 또는 기고 제안",         effort: "중간" },
  wiki:         { label: "위키",          how: "사실 기반 서술·정정 (홍보성은 삭제됨)", effort: "중간" },
  community:    { label: "커뮤니티",       how: "자체 데이터·리서치 공유 (직접 홍보는 역효과)", effort: "높음" },
  blogplatform: { label: "블로그 플랫폼",   how: "기고자 섭외 또는 자체 채널 운영",      effort: "중간" },
  directory:    { label: "디렉터리·플랫폼", how: "프로필 등록 + 고객 리뷰 확보",         effort: "낮음" },
  gov:          { label: "기관·학술",      how: "인증·사업 참여로 자연 등재",           effort: "높음" },
  corporate:    { label: "기업 블로그",     how: "기고 제안 또는 공동 콘텐츠",           effort: "중간" },
  thirdparty:   { label: "제3자 문서",      how: "운영사 확인 → 편집자 컨택 → 등재 요청", effort: "중간" },
};

const endsAny = (d, list) => list.some((x) => d === x || d.endsWith("." + x) || d.endsWith(x));

/**
 * @param domain      인용된 도메인
 * @param ownDomains  고객사 도메인 집합
 * @param compDomains 경쟁사 도메인 집합
 */
export function classify(domain, ownDomains = new Set(), compDomains = new Set()) {
  const d = String(domain || "").toLowerCase().replace(/^www\./, "");
  if (!d) return "thirdparty";

  const base = d.split(".").slice(-2).join(".");
  if ([...ownDomains].some((o) => o && (d === o || d.endsWith("." + o) || base === o))) return "own";
  if ([...compDomains].some((c) => c && (d === c || d.endsWith("." + c) || base === c))) return "competitor";

  if (endsAny(d, WIKI)) return "wiki";
  if (endsAny(d, COMMUNITY)) return "community";
  if (endsAny(d, MEDIA)) return "media";
  if (endsAny(d, BLOG_PLATFORM)) return "blogplatform";
  if (endsAny(d, DIRECTORY)) return "directory";
  if (GOV.some((g) => d.endsWith(g))) return "gov";

  // 비교 전문 매체 — 도메인에 의도가 드러나는 경우
  if (/(^|[.-])(compare|review|best|top|vs|rank|guide)([.-]|$)/.test(d) ||
      /-?(erp|saas|crm|tool|soft)s?[.-]?(compare|review|guide|rank)/.test(d)) return "comparison";

  // blog.* 서브도메인이면 기업 블로그로 본다
  if (/^blog\./.test(d) || /^(insight|resource|magazine)\./.test(d)) return "corporate";

  // 분류가 안 되는 제3자 도메인도 결국 "남이 쓴 문서"다.
  // "기타"로 버리면 진입 대상에서 빠지는데, 실제로는 가장 흔한 진입 대상이다.
  return "thirdparty";
}

/**
 * 인용 도메인 목록을 유형별로 집계한다.
 * @param counts  { domain: 인용횟수 }
 */
export function profile(counts, ownDomains = new Set(), compDomains = new Set()) {
  const byType = {};
  let total = 0;
  for (const [domain, n] of Object.entries(counts)) {
    const t = classify(domain, ownDomains, compDomains);
    (byType[t] ??= { type: t, count: 0, domains: [] });
    byType[t].count += n;
    byType[t].domains.push({ domain, n });
    total += n;
  }
  for (const v of Object.values(byType)) {
    v.share = total ? v.count / total : 0;
    v.domains.sort((a, b) => b.n - a.n);
  }
  const rows = Object.values(byType).sort((a, b) => b.count - a.count);

  // 진입 가능한(= 우리가 손댈 수 있는) 지면의 비중
  const REACHABLE = ["comparison", "media", "wiki", "community", "blogplatform", "directory", "corporate", "thirdparty"];
  const reachable = rows.filter((r) => REACHABLE.includes(r.type)).reduce((s, r) => s + r.count, 0);

  return { total, rows, reachableShare: total ? reachable / total : 0 };
}
