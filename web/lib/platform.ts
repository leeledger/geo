/**
 * 사이트 운영 형태 감지.
 *
 * 왜 필요한가: 진단에서 "llms.txt 를 넣으세요"라고 해도 카페24 는 루트 파일을 못 올린다.
 * 그리고 국내 B2B 사이트는 대부분 빌더가 아니라 자체 개발이라, 파일 하나 올리는 데도
 * 외주사 티켓이 필요하다. 이걸 모르면 견적과 리드타임을 잘못 잡는다.
 *
 * 그래서 "플랫폼 이름"보다 세 가지를 답하는 데 집중한다.
 *   1) 루트 파일(robots.txt·llms.txt)을 올릴 수 있는가
 *   2) 구조화 데이터를 넣을 수 있는가
 *   3) 그 작업을 누가 하는가 — 담당자 / 개발팀 / 외주사
 *
 * 오탐이 미상보다 나쁘다. 명명된 플랫폼은 확실한 시그니처만 쓰고,
 * 나머지는 "자체 개발"로 분류하되 근거를 함께 남긴다.
 */

export type Capability = "yes" | "limited" | "no";
export type Owner = "담당자" | "개발팀" | "외주사 가능성" | "확인 필요";

export type Platform = {
  id: string;
  name: string;
  kind: "빌더" | "CMS" | "프레임워크" | "자체개발" | "블로그";
  rootFile: Capability;
  schema: Capability;
  publish: "easy" | "medium" | "hard";
  /** 누가 이 작업을 하게 되는가 — 리드타임을 좌우한다 */
  owner: Owner;
  /** 감지 근거. 오탐을 사용자가 판단할 수 있게 남긴다 */
  evidence: string;
  /** 상담에서 그대로 읽어줄 수 있는 한 문장 */
  note: string;
};

type Named = Omit<Platform, "evidence"> & {
  sig: string[];
  headerSig?: string[];
};

const NAMED: Named[] = [
  { id: "cafe24", name: "카페24", kind: "빌더", rootFile: "no", schema: "limited", publish: "medium", owner: "담당자",
    sig: ["cafe24.com", "cafe24img.com", "/web/upload/"], headerSig: ["cafe24"],
    note: "루트 파일 직접 수정이 막혀 있습니다. 기술 세팅보다 외부 인용 확보를 우선해야 합니다." },
  { id: "imweb", name: "아임웹", kind: "빌더", rootFile: "limited", schema: "limited", publish: "medium", owner: "담당자",
    sig: ["imweb.me", "cdn.imweb.me"],
    note: "일부 설정만 제공됩니다. 가능한 범위를 확인하고 외부 인용을 병행하세요." },
  { id: "sixshop", name: "식스샵", kind: "빌더", rootFile: "no", schema: "limited", publish: "medium", owner: "담당자",
    sig: ["sixshop.com", "sixshop.co.kr"],
    note: "루트 파일 수정이 어렵습니다. 외부 인용 중심 전략이 현실적입니다." },
  { id: "makeshop", name: "메이크샵", kind: "빌더", rootFile: "limited", schema: "limited", publish: "medium", owner: "담당자",
    sig: ["makeshop.co.kr"],
    note: "스킨 편집으로 일부 가능하나 제약이 있습니다." },
  { id: "wix", name: "Wix", kind: "빌더", rootFile: "limited", schema: "yes", publish: "medium", owner: "담당자",
    sig: ["wixstatic.com"], headerSig: ["x-wix"],
    note: "SEO 패널로 상당 부분 가능합니다. 관리자 계정만 있으면 됩니다." },
  { id: "squarespace", name: "Squarespace", kind: "빌더", rootFile: "limited", schema: "yes", publish: "easy", owner: "담당자",
    sig: ["static1.squarespace.com"],
    note: "코드 삽입으로 스키마는 가능하나 루트 파일은 제한적입니다." },
  { id: "shopify", name: "Shopify", kind: "빌더", rootFile: "limited", schema: "yes", publish: "easy", owner: "담당자",
    sig: ["cdn.shopify.com", "myshopify.com"],
    note: "테마 편집으로 스키마 가능. robots.txt 는 템플릿으로만 수정됩니다." },
  { id: "webflow", name: "Webflow", kind: "빌더", rootFile: "yes", schema: "yes", publish: "easy", owner: "담당자",
    sig: ["assets.website-files.com", "cdn.prod.website-files.com"],
    note: "커스텀 코드·robots.txt 모두 지원합니다. 기술 세팅이 수월합니다." },
  { id: "wordpress", name: "워드프레스", kind: "CMS", rootFile: "yes", schema: "yes", publish: "easy", owner: "담당자",
    sig: ["/wp-content/", "/wp-includes/", 'content="WordPress'],
    note: "플러그인으로 전부 가능합니다. 관리자 계정이 없어도 기고자 계정만 받으면 콘텐츠 발행이 됩니다." },
  { id: "tistory", name: "티스토리", kind: "블로그", rootFile: "no", schema: "limited", publish: "easy", owner: "담당자",
    sig: ["tistory.com"],
    note: "블로그 플랫폼입니다. 자체 도메인 사이트가 따로 있는지 확인이 필요합니다." },
  { id: "nextjs", name: "Next.js", kind: "프레임워크", rootFile: "yes", schema: "yes", publish: "medium", owner: "개발팀",
    sig: ["__NEXT_DATA__", "/_next/static/", 'id="__next"'],
    note: "기술적으로는 전부 가능합니다. 다만 배포 절차를 타므로 콘텐츠 발행 경로(CMS 연동 여부)를 확인하세요." },
  { id: "nuxt", name: "Nuxt", kind: "프레임워크", rootFile: "yes", schema: "yes", publish: "medium", owner: "개발팀",
    sig: ["__NUXT__", "/_nuxt/"],
    note: "기술적으로는 전부 가능합니다. 배포 절차를 확인하세요." },
  { id: "gatsby", name: "Gatsby", kind: "프레임워크", rootFile: "yes", schema: "yes", publish: "medium", owner: "개발팀",
    sig: ["___gatsby", "/page-data/"],
    note: "기술적으로는 전부 가능하나 빌드 배포가 필요합니다." },
];

/** 명명된 플랫폼이 아닐 때 — 무엇으로 만들어졌는지 최소한의 단서를 잡는다 */
const CUSTOM_SIG: [RegExp, string][] = [
  [/\.jsp\b|jsessionid/i, "JSP (Java)"],
  [/__VIEWSTATE|\.aspx\b/i, "ASP.NET"],
  [/\.php\b/i, "PHP"],
  [/\/dist\/[a-z0-9.-]*\.js/i, "SPA 번들"],
  [/<div[^>]+id=["'](root|app)["']/i, "SPA 컨테이너"],
];

export function detectPlatform(
  html: string,
  headers: Record<string, string>,
  url: string,
): Platform {
  const h = html.toLowerCase();
  const hdrBlob = Object.entries(headers).map(([k, v]) => `${k}:${v}`).join(" ").toLowerCase();

  for (const n of NAMED) {
    const bySig = n.sig.find((x) => h.includes(x.toLowerCase()) || url.toLowerCase().includes(x.toLowerCase()));
    const byHdr = n.headerSig?.find((x) => hdrBlob.includes(x));
    if (bySig || byHdr) {
      const { sig, headerSig, ...p } = n;
      return { ...p, evidence: bySig ?? `헤더 ${byHdr}` };
    }
  }

  // 명명된 플랫폼이 아니면 자체 개발로 본다 — 국내 B2B 에서 가장 흔한 경우다
  const clue = CUSTOM_SIG.find(([re]) => re.test(html));
  const server = headers["server"] ?? "";
  const powered = headers["x-powered-by"] ?? "";
  const evidence = [clue?.[1], server && `server: ${server}`, powered && `x-powered-by: ${powered}`]
    .filter(Boolean).join(" · ") || "알려진 플랫폼 시그니처 없음";

  return {
    id: "custom", name: "자체 개발", kind: "자체개발",
    rootFile: "yes", schema: "yes", publish: "hard", owner: "확인 필요",
    evidence,
    note: "기술적으로는 전부 가능하지만, 실제 작업을 누가 하는지에 따라 리드타임이 크게 달라집니다. 내부 개발팀이면 며칠, 외주 유지보수사를 거치면 몇 주가 걸립니다.",
  };
}

/** 감지 결과에 따라 조치 안내를 바꾼다 — 못 하는 걸 하라고 하지 않기 위해 */
export function platformAdvice(p: Platform): { pri: 1 | 2 | 3; msg: string } {
  if (p.rootFile === "no") {
    return { pri: 2, msg:
      `${p.name} 감지 — ${p.note} llms.txt·robots.txt 항목은 플랫폼 제약이므로 감점으로 보지 마시고, 남이 쓴 비교·추천 문서에 이름을 넣는 쪽에 예산을 쓰는 편이 낫습니다.` };
  }
  if (p.kind === "자체개발") {
    return { pri: 3, msg:
      `자체 개발 사이트로 보입니다 (${p.evidence}). ${p.note} 착수 전에 사이트를 누가 관리하는지부터 확인하세요 — 여기서 일정이 갈립니다.` };
  }
  return { pri: 3, msg: `${p.name} 감지 — ${p.note}` };
}

export const CAP_LABEL: Record<Capability, string> = { yes: "가능", limited: "제한적", no: "불가" };
export const PUBLISH_LABEL: Record<Platform["publish"], string> = { easy: "수월", medium: "보통", hard: "확인 필요" };
