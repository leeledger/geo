import ScanForm from "./ScanForm";
import AskForm from "./AskForm";
import ContactForm from "./ContactForm";
import Reveal from "./Reveal";
import SiteNav from "./SiteNav";
import Interval from "./Interval";
import Count from "./Count";
import ChatDemo from "./ChatDemo";
import Link from "next/link";
import { SERVICES } from "@/lib/services";
import { readOps } from "@/lib/ops";

/**
 * 사는 사람 순서로 읽힌다.
 *   이게 뭔데(히어로) → GEO 가 뭔데 → 말만인가(기록) → 뭘 받나(실제 기록 세 장) → 해당되나
 *   → 사이트 점수와 AI 노출은 따로 논다 → 서비스 → 진행 → 사례 → 리포트가 다른 점
 *   → 안 하는 것 → 요금 → 질문 → 신청
 *
 * 받은 말 셋을 반영했다.
 *   「추상적이다」 — 설명 대신 실제로 남긴 기록을 싣는다. 질문 원문, 회사별 횟수, 비교 글 제목, 고친 이유.
 *   「날짜를 특정하지 마라」 — 달력 날짜는 늙는다. 사례는 착수 기준 「N일차」로 적는다.
 *   「재 본다는 말이 어색하다」 — 묻는다·센다·확인한다·진단한다로 쓴다.
 *
 * 사례 학원은 가린다 — 이름·지역·사이트 주소·글 주소. 조합되면 특정된다.
 * 시장 숫자의 출처는 probe/data (사이트 진단 34곳 · ERP 질문 12개 × 15회 · 진단 리포트).
 * 회사 이름은 A·B·C 로 쓴다. 우리 고객이 아니어도 남의 회사 점수를 이름 붙여 걸지 않는다.
 * 구조화 데이터의 FAQ 는 화면의 질문 그대로다.
 */
const BASE = process.env.NEXT_PUBLIC_SITE_URL || "https://geo-rose-nine.vercel.app";
const CASE_URL = "/case/academy.html";

const FAQ: [string, string][] = [
  ["직접 하면 안 되나요?",
   "기술 세팅은 직접 하실 수 있고 그러시길 권합니다. 하루면 됩니다. 어려운 건 AI 4곳에 같은 질문을 여러 번 물어 세는 일과, 경쟁사는 있고 우리만 없는 비교 글을 찾아내는 일입니다. 저희가 파는 건 그 둘입니다."],
  ["얼마나 걸리나요?",
   "사례 학원은 착수 넷째 날 네이버 검색에 사이트가 처음 잡혔고, 여섯째 날 학원 이름 없이 친 지역 검색어에 나오기 시작했습니다. AI 답변에 이름이 붙기까지 얼마나 걸리는지는 아직 모릅니다. 결과가 나오면 사례 기록에 그대로 적습니다."],
  ["성과를 보장하나요?",
   "안 합니다. 대신 어떤 질문을, 어느 AI 에, 몇 번 묻는지를 계약서에 적고 시작할 때 숫자를 남깁니다. 두 달 뒤 같은 방법으로 다시 센 결과를 그대로 드립니다. 「몇 위 보장」을 약속하는 곳이 있으면 몇 번 물어서 나온 숫자인지 물어보세요."],
  ["숫자를 어떻게 믿나요?",
   "믿어 달라고 하지 않습니다. 질문, 답변 원문, 답에 붙은 출처 주소, 물어본 시각이 전부 남아 있고 요청하시면 그대로 드립니다. 내부 보고에 원문을 붙이셔도 됩니다."],
  ["SEO 대행사와 뭐가 다른가요?",
   "SEO 는 검색 결과에서 클릭을 얻는 일이고, 이건 AI 답 속에 이름이 나오게 하는 일입니다. AI 는 회사 홈페이지보다 비교 글과 업체 목록을 더 많이 읽습니다. 그래서 손봐야 할 곳이 다릅니다. 해 둔 SEO 는 버리지 않고 그대로 씁니다."],
  ["그만두면 뭐가 남나요?",
   "사이트를 만들어 드렸다면 도메인·저장소·호스팅 계정이 전부 고객사 명의라 그대로 남습니다. 그동안의 답변 원문과 리포트도 드립니다. 최소 약정이 없어서 한 달 단위로 멈출 수 있습니다."],
];

const SCHEMA = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${BASE}/#org`,
      name: "Cited 사이티드",
      url: BASE,
      description:
        "손님이 AI 에게 물었을 때 답변에 회사 이름이 나오는지 확인하고, 나오게 만드는 마케팅 대행사입니다. 학원·병원·사무소 규모에 맞춘 GEO 서비스.",
      areaServed: "KR",
      knowsAbout: ["AEO", "GEO", "AI 검색 최적화", "생성형 엔진 최적화", "AI 인용률 측정"],
    },
    {
      "@type": "Service",
      "@id": `${BASE}/#service`,
      name: "AI 답변 인용 측정 및 최적화",
      provider: { "@id": `${BASE}/#org` },
      areaServed: "KR",
      hasOfferCatalog: {
        "@type": "OfferCatalog",
        name: "서비스",
        itemListElement: SERVICES.map((s) => ({
          "@type": "Offer",
          itemOffered: { "@type": "Service", name: s.name, description: s.short, url: `${BASE}/services/${s.slug}` },
        })),
      },
    },
    {
      "@type": "FAQPage",
      "@id": `${BASE}/#faq`,
      mainEntity: FAQ.map(([q, a]) => ({
        "@type": "Question",
        name: q,
        acceptedAnswer: { "@type": "Answer", text: a },
      })),
    },
  ],
};

export const revalidate = 3600;

/** 착수일. 「N일차」를 여기서 센다. 화면에는 날짜를 내지 않는다. */
const START = Date.parse("2026-09-05T00:00:00+09:00");

/**
 * 사례 학원 사이트 진단 — probe/data/scans/robotncoding.com.json (착수 6일차 저장).
 * web 배포에는 probe 폴더가 없어 값을 옮겨 적는다. 다시 진단하면 여기도 고친다.
 * 문단 점수 47 을 뺀 네 개만 고르면 보기 좋은 숫자를 만드는 것이다. 그래서 같이 싣는다.
 */
const SCAN = { total: 92, baseline: 83, crawler: 100, schema: 100, chunk: 47, chunkIn: 151, chunkAll: 334 };

/**
 * ERP 측정 — probe/data/report.websearch.txt · diagnoses/doto.json.
 * 질문 12개, 웹 검색을 켠 AI 에 15회. 노출률 × 15 = 횟수.
 * 「진단한 회사」는 34곳 중 사이트 점수 1위(80점).
 */
const ERP_BARS: [string, number, boolean][] = [
  ["A사", 9, false], ["B사", 8, false], ["C사", 8, false], ["D사", 4, false], ["이 회사", 3, true],
];
const ERP_DOCS = [
  "국내 ERP 업체 순위 Top5",
  "중견·중소기업 ERP 프로그램 비교 가이드",
  "회사 규모별 ERP 추천",
];

/** 사례 기록 — 공개 케이스 리포트와 같은 내용. 날짜 대신 일차. */
const TIMELINE: [string, string, string][] = [
  ["1일차", "사이트 구축 · 도메인 연결", "AI 크롤러를 이름으로 허용하고 llms.txt 와 구조화 데이터를 붙였습니다."],
  ["1일차", "블로그 글 32편 이관", "AI 크롤러를 막는 블로그에서 사진 69장까지 옮겼습니다."],
  ["1일차", "첫 AI 방문", "주소를 연결한 날 오후 3시 49분. ClaudeBot 이 robots.txt 부터 읽었습니다."],
  ["2일차", "구글 비즈니스 프로필 등록", "대표자 본인인증이 필요해 대행할 수 없는 항목입니다."],
  ["2일차", "학원 목록 사이트 등재 신청", "「○○구 코딩학원」 목록에 빠져 있던 자리입니다."],
  ["4일차", "네이버 검색에 사이트가 처음 잡힘", "옮긴 글이 네이버 검색 결과에 나오기 시작했습니다."],
  ["6일차", "학원 이름 없이 친 검색어에 첫 노출", "네이버 통합검색에서 「○○구 코딩학원」에 사이트가 나왔습니다."],
  ["6일차", "플레이스 소개글 188자 → 933자", "네이버 AI 가 화장실 안내만 읽고 학원을 소개하고 있어서입니다."],
];

const ICON: Record<string, React.ReactNode> = {
  count: <path d="M4 20V11M10 20V5M16 20v-6M21 20H3" />,
  why: <><circle cx="11" cy="11" r="6.5" /><path d="m20 20-4.2-4.2" /></>,
  again: <><path d="M20 12a8 8 0 1 1-2.35-5.65" /><path d="M20 4v5h-5" /></>,
  measure: <path d="M4 20V11M10 20V5M16 20v-6M21 20H3" />,
  technical: <path d="m8 8-5 4 5 4M16 8l5 4-5 4M13.5 5l-3 14" />,
  placement: <><path d="M14 3H6.5A1.5 1.5 0 0 0 5 4.5v15A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5V8z" /><path d="M14 3v5h5M9 13h6M9 17h4" /></>,
  build: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 9h18M9 20V9" /></>,
};

function Ico({ name }: { name: string }) {
  return (
    <span className="ico" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
        {ICON[name]}
      </svg>
    </span>
  );
}

const RING = 213.6; // 2π × 34

function Gauge({ v, label, note, delay }: { v: number; label: string; note: string; delay: number }) {
  return (
    <div
      className={`gauge${v < 60 ? " low" : ""}`}
      data-reveal={delay}
      style={{ ["--off" as string]: `${(RING * (1 - v / 100)).toFixed(1)}px` }}
    >
      <svg viewBox="0 0 80 80" role="img" aria-label={`${label} ${v}점`}>
        <circle className="trk" cx="40" cy="40" r="34" fill="none" strokeWidth="7" />
        <circle className="arc" cx="40" cy="40" r="34" fill="none" strokeWidth="7" strokeLinecap="round"
          strokeDasharray={RING} transform="rotate(-90 40 40)" />
        <text x="40" y="41" textAnchor="middle" dominantBaseline="central">{v}</text>
      </svg>
      <div className="gl">{label}</div>
      <div className="gn">{note}</div>
    </div>
  );
}

export default async function Home() {
  const ops = await readOps();
  // DB 가 막혀도 랜딩이 0 을 띄우면 안 된다. 마지막으로 확인한 값을 바닥으로 쓴다.
  const vendors = ops.ok && ops.vendorCount ? ops.vendorCount : 8;
  const hits = ops.ok && ops.totalHits ? ops.totalHits : 460;
  const posts = ops.ok && ops.posts.published ? ops.posts.published : 43;
  const claudePages = ops.crawl.vendors.find((v) => /anthropic|claude/i.test(v.vendor))?.pages ?? 43;
  const caseDay = Math.max(1, Math.floor((Date.now() - START) / 86400000) + 1);

  // 경쟁 검색어 집계는 lib/ops.ts 한 곳에 둔다. 여기서 또 세면 대시보드와 갈라진다.
  const webWins = ops.serp.rivalWon;
  const webTotal = ops.serp.rivalTotal || 6;
  // 플레이스는 「구 + 코딩학원」 검색어의 순위. 검색어 자체는 화면에 내지 않는다.
  const placeRank = ops.place.find((p) => /구 코딩학원$/.test(p.query))?.rank ?? 2;

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(SCHEMA) }}
      />
      <Reveal />
      <SiteNav />

      {/* ── 히어로 ── */}
      <header className="hero">
        <div className="wrap">
          <div className="hero-grid">
            <div>
              <span className="badge"><i />AI 답변 노출 · GEO</span>
              <h1>손님이 AI에게 물었을 때<br /><span className="hl">우리 이름이 나옵니까?</span></h1>
              <p className="lede">
                「마포구에서 임플란트 잘하는 치과 추천해줘」. 이렇게 물으면 AI 는 링크 대신
                <b> 이름 세 개쯤</b>으로 답합니다. 거기 우리가 있는지 여러 번 물어 세고, 없으면 들어가게 만듭니다.
              </p>
              <ScanForm id="dom-hero" />
              <div className="herolinks">
                <a href={CASE_URL}>도입 사례 기록 보기 →</a>
                <a href="#price">요금 먼저 보기</a>
              </div>
            </div>
            <div>
              <ChatDemo />
            </div>
          </div>

          <div className="proofbar">
            <div className="pbh"><i />도입 사례 · 서버가 기록한 값 · 매일 갱신</div>
            <div className="pbgrid">
              <div className="pb"><b>{caseDay}<small>일차</small></b><span>착수일부터 센 날</span></div>
              <div className="pb"><b><Count to={vendors} /><small>곳</small></b><span>다녀간 AI·검색 크롤러</span></div>
              <div className="pb"><b><Count to={hits} /><small>회</small></b><span>크롤러 누적 방문</span></div>
              <div className="pb"><b><Count to={posts} /><small>편</small></b><span>AI 가 읽을 수 있게 된 글</span></div>
            </div>
          </div>
        </div>
      </header>

      {/* ── GEO 란 ── */}
      <section id="geo" className="plain">
        <div className="wrap">
          <div className="lab">GEO 가 뭔가요</div>
          <h2>검색 결과의 링크가 아니라<br /><span className="hl">답변 문장 안의 이름</span></h2>
          <p className="define">
            손님이 ChatGPT 에 「아이 보낼 영어학원 추천해줘」라고 물으면, 링크 목록 대신 학원 이름 몇 개가 답으로 나옵니다.
            그 답에 우리 이름이 들어가게 만드는 일이 <b>GEO(생성형 엔진 최적화)</b>입니다.
            AI 는 우리 홈페이지만 보고 답하지 않습니다. <b>비교 글, 후기, 업체 목록</b>을 같이 읽고 이름을 고릅니다.
          </p>

          <div className="cmpwrap">
            <table className="cmp">
              <thead>
                <tr><th scope="col">구분</th><th scope="col">검색 최적화 (SEO)</th><th scope="col" className="us">AI 답변 노출 (GEO)</th></tr>
              </thead>
              <tbody>
                <tr><th scope="row">얻는 것</th><td>검색 결과에서 클릭</td><td className="us">AI 답 속에 이름이 나옴</td></tr>
                <tr><th scope="row">손님 눈에 보이는 것</th><td>링크 열 개</td><td className="us">추천 이름 두세 개</td></tr>
                <tr><th scope="row">손봐야 할 곳</th><td>우리 홈페이지</td><td className="us">홈페이지와 AI 가 읽는 남의 글</td></tr>
                <tr><th scope="row">잘됐는지 보는 법</th><td>검색해서 순위 확인</td><td className="us">같은 질문을 여러 번 해서 몇 번 나오는지</td></tr>
              </tbody>
            </table>
          </div>
          <p className="cmpnote">
            그래서 홈페이지를 잘 만들어도 비교 글과 목록에 이름이 없으면 답에서 빠집니다.
            반대로 홈페이지는 허술한데 여기저기 이름이 올라 있는 회사가 자주 나옵니다. <b>아래에 실제 기록이 있습니다.</b>{" "}
            SEO 를 이미 맡긴 곳이 있다면 그대로 두셔도 됩니다.
          </p>
        </div>
      </section>

      {/* ── 기록으로 보여주기 ── */}
      <section id="proof">
        <div className="wrap proof">
          <div>
            <div className="lab">말 대신 기록</div>
            <h2>사례 학원 사이트,<br /><span className="hl">7개 항목 중 6개가 90점 넘게</span></h2>
            <p className="sub2">
              홈페이지 주소를 넣으면 나오는 무료 진단과 같은 7개 항목입니다.
              착수할 때 종합 {SCAN.baseline}점이던 사이트를 첫 주에 고친 뒤 다시 돌린 결과입니다.
            </p>
            <div className="gauges">
              <Gauge v={SCAN.total} label="종합" note={`착수 때 ${SCAN.baseline}`} delay={0} />
              <Gauge v={SCAN.crawler} label="AI 크롤러 접근" note="봇 이름으로 허용" delay={120} />
              <Gauge v={SCAN.schema} label="구조화 데이터" note="6쪽 전부 · 오류 0" delay={240} />
              <Gauge v={SCAN.chunk} label="인용할 만한 문단" note={`${SCAN.chunkAll}개 중 ${SCAN.chunkIn}개`} delay={360} />
            </div>
            <p className="proofnote">
              <b>문단 점수 47은 아직 못 고친 부분입니다.</b> 80자가 안 되는 짧은 문단이 {SCAN.chunkAll - SCAN.chunkIn}개였고
              400자 넘는 문단은 0개였습니다. AI 가 잘라 가져가기엔 짧다는 뜻입니다. 잘된 칸만 골라 싣지 않습니다.
            </p>
          </div>

          <div className="code">
            <div className="codehd"><span className="dots"><i /><i /><i /></span>robots.txt · 사례 학원</div>
            <pre className="codeb">
<span className="c"># AI 크롤러를 User-agent 별로 명시 허용한다.</span>{"\n"}
<span className="c"># 네이버 블로그는 이 봇들을 전부 차단한다.</span>{"\n\n"}
<span className="k">User-agent:</span> <span className="v">OAI-SearchBot</span>{"\n"}
<span className="k">Allow:</span> /{"\n\n"}
<span className="k">User-agent:</span> <span className="v">GPTBot</span>{"\n"}
<span className="k">Allow:</span> /{"\n\n"}
<span className="k">User-agent:</span> <span className="v">ClaudeBot</span>{"\n"}
<span className="k">Allow:</span> /{"\n\n"}
<span className="k">User-agent:</span> <span className="v">PerplexityBot</span>{"\n"}
<span className="k">Allow:</span> /{"\n\n"}
<span className="k">User-agent:</span> <span className="v">Yeti</span>{"\n"}
<span className="k">Allow:</span> /{"\n"}
<span className="c"># … 이하 생략</span>
            </pre>
            <div className="codeft">
              <div className="codelog">
                <div><span>15:49:01</span><span>ClaudeBot</span><span>/robots.txt</span></div>
                <div><span>15:49:27</span><span>ClaudeBot</span><span>/blog/(옮긴 글)</span></div>
                <div><span>+18h</span><span>Googlebot</span><span>/ · /blog · /sitemap.xml</span></div>
                <div><span>+3d</span><span>Yeti</span><span>/sitemap.xml</span></div>
              </div>
              <span className="passed">✓ 서버 기록 · 크롤러 {vendors}곳 · {hits}회</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── 맡기면 받는 것 ── */}
      <section id="why" className="plain">
        <div className="wrap">
          <div className="lab">맡기면 받는 것</div>
          <h2>리포트에 들어가는 것을<br /><span className="hl">실제 기록</span>으로 보여 드립니다</h2>
          <p className="sub2">
            아래 세 장은 실제로 남긴 기록입니다. 앞의 두 장은 소프트웨어 회사 한 곳을 진단한 리포트,
            마지막 장은 사례 학원의 작업 기록입니다. 회사 이름은 가렸습니다.
          </p>

          <div className="gets">
            <article className="get">
              <Ico name="count" />
              <div className="getn">01 · 몇 번 중 몇 번</div>
              <h3>지금 불리고 있나</h3>
              <p>
                그 업계 손님이 물어볼 질문을 AI 에게 15번 묻고, 회사마다 이름이 몇 번 나왔는지 셌습니다.
                홈페이지 점수가 가장 높았던 이 회사는 <b>15번 중 3번</b>이었습니다.
              </p>
              <div className="getb">
                <div className="mbars">
                  {ERP_BARS.map(([name, n, me]) => (
                    <div className={`mbar${me ? " me" : ""}`} key={name}>
                      <span>{name}</span>
                      <span className="t"><i style={{ ["--w" as string]: `${(n / 15) * 100}%` }} /></span>
                      <b>{n}/15</b>
                    </div>
                  ))}
                </div>
              </div>
            </article>

            <article className="get">
              <Ico name="why" />
              <div className="getn">02 · 빠진 자리</div>
              <h3>왜 안 나오나</h3>
              <p>
                AI 가 답할 때 참고한 비교 글 14개를 하나씩 열어 봤습니다. A·B·C사는 대부분 있었고
                <b> 이 회사 이름은 한 번도 없었습니다.</b> 고칠 곳은 홈페이지가 아니라 이 글들이었습니다.
              </p>
              <div className="getb">
                <div className="docs">
                  {ERP_DOCS.map((t) => (
                    <div className="doc" key={t}>
                      <span>「{t}」</span>
                      <span className="yn">A·B·C 있음 · <em>이 회사 없음</em></span>
                    </div>
                  ))}
                </div>
              </div>
            </article>

            <article className="get">
              <Ico name="again" />
              <div className="getn">03 · 고친 이유</div>
              <h3>고친 게 먹혔나</h3>
              <p>
                고칠 때마다 무엇을, 왜, 무엇을 기대하는지 적어 둡니다.
                <b> 같은 질문으로 다시 물었을 때</b> 무엇이 달라졌는지 견줄 기준이 됩니다.
              </p>
              <div className="getb">
                <dl className="rec">
                  <dt>무엇</dt><dd>네이버 플레이스 소개글 188자 → 933자</dd>
                  <dt>왜</dt><dd>네이버 AI 가 학원을 「무선 인터넷과 남녀 구분 화장실을 제공합니다」라고 소개하고 있었음</dd>
                  <dt>기대</dt><dd>무엇을 가르치는 학원인지 답에 들어간다</dd>
                </dl>
              </div>
            </article>
          </div>

          <p className="whyfoot">
            <b>「몇 위 보장」은 없습니다.</b> AI 답은 물을 때마다 바뀝니다.
            그래서 여러 번 묻고, 몇 번 물었는지를 숫자 옆에 같이 적습니다.
          </p>
        </div>
      </section>

      {/* ── 해당하는 곳 ── */}
      <section id="who">
        <div className="wrap">
          <div className="lab">해당하는 곳</div>
          <h2>손님이 고르기 전에<br />한 번은 물어보는 업종이면 됩니다</h2>
          <p className="sub2">
            학원, 병원·치과, 세무·법무 사무소, 인테리어, 소프트웨어 회사.
            계약하기 전에 「어디가 괜찮아?」를 누군가에게 묻는 곳입니다. 그 누군가가 AI 로 바뀌고 있습니다.
          </p>

          <div className="fit">
            <div className="fitc">
              <div className="fith"><i>✓</i>이런 곳에 맞습니다</div>
              <ul>
                <li><b>지역 이름과 업종으로 검색되는 곳</b> — 「○○구 코딩학원」「△△동 치과」</li>
                <li><b>비교당하는 곳</b> — 손님이 서너 군데 견주고 고르는 업종</li>
                <li><b>밖에 내놓을 사실이 있는 곳</b> — 연차·건수·가격·방식처럼 적을 수 있는 것</li>
              </ul>
            </div>
            <div className="fitc no">
              <div className="fith"><i>✕</i>이런 곳은 안 맞습니다</div>
              <ul>
                <li>이름을 이미 알고 찾아오는 브랜드 — 제품명으로 검색되면 이 일이 필요 없습니다</li>
                <li>한 번 사고 끝나는 물건 — 묻지 않고 삽니다</li>
                <li>적을 사실이 없는 회사 — 할 말이 없으면 들어갈 글도 없습니다</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ── 직접 측정한 것 ── */}
      <section className="deep" id="data">
        <div className="wrap">
          <div className="lab">직접 측정한 것 · B2B 소프트웨어 34곳</div>
          <h2>사이트 점수와 AI 노출은<br /><span className="hl">따로 움직였습니다</span></h2>
          <p className="sub2">
            국내 소프트웨어 회사 34곳의 홈페이지를 진단했습니다. 그중 한 업계는 AI 에게 직접 물어 회사마다 몇 번 나오는지도 셌습니다.
          </p>

          <div className="facts">
            <div className="fact">
              <div className="stat">
                <span className="v"><Count to={8} /><small> / 15</small></span>
                <span className="bandbar"><i style={{ left: "53%" }} /></span>
                <span className="c">사이트 19점 회사의 AI 노출</span>
              </div>
              <div className="t">
                홈페이지는 AI 가 읽기 어려운 상태였는데 <b>비교 글 14개 중 9개에 이름이 있었습니다.</b>{" "}
                15번 물으면 8번 나왔습니다.
              </div>
            </div>
            <div className="fact">
              <div className="stat">
                <span className="v"><Count to={7} /><small> / 34</small></span>
                <span className="bandbar"><i style={{ left: "21%" }} /></span>
                <span className="c">60점을 넘긴 사이트</span>
              </div>
              <div className="t">
                절반인 <b>17곳은 40점 아래</b>였습니다. AI 크롤러 접근 점수가 0점인 곳도 있었습니다.
              </div>
            </div>
            <div className="fact">
              <div className="stat">
                <span className="v"><Count to={28} /><small>%</small></span>
                <span className="bandbar"><i style={{ left: "28%" }} /></span>
                <span className="c">다시 물으면 바뀐 추천 목록</span>
              </div>
              <div className="t">
                같은 질문을 한 번 더 했을 때 나온 회사 목록의 28%가 달랐습니다.
                <b> 한 번 물어보고 「1위」라 적는 건 동전 한 번 던진 것</b>입니다.
              </div>
            </div>
          </div>

          <div className="casenote">
            그래서 일이 둘로 나뉩니다. 사이트를 AI 가 <b>읽을 수 있게</b> 만드는 일과, AI 가 참고하는 비교 글·목록에 이름을 <b>넣는</b> 일.
            사이트 점수가 1위여도 뒤엣것이 없으면 답에 안 나옵니다.
          </div>
        </div>
      </section>

      {/* ── 서비스 ── */}
      <section id="services" className="plain">
        <div className="wrap">
          <div className="lab">서비스</div>
          <h2>넷 중 <span className="hl">필요한 것만</span> 삽니다</h2>
          <p className="sub2">
            대부분은 측정부터 시작합니다. 나머지는 진단해 본 뒤에 정해도 됩니다.
            쓸 만한 사이트가 이미 있으면 구축은 필요 없습니다.
          </p>
          <div className="svcs">
            {SERVICES.map((sv) => (
              <Link className="svc" key={sv.slug} href={`/services/${sv.slug}`}>
                <div className="svch">
                  <Ico name={sv.slug} />
                  <span className="tag">{sv.no} · {sv.tag}</span>
                </div>
                <h3>{sv.name}</h3>
                <div className="svcask2">{sv.question}</div>
                <p>{sv.short}</p>
                <ul className="svcdo">
                  {sv.does.slice(0, 3).map((d) => <li key={d.t}>{d.t}</li>)}
                </ul>
                <div className="svcterm">{sv.terms.map((t) => `${t.k} ${t.v}`).slice(0, 2).join(" · ")}</div>
                <span className="svcgo">자세히 보기 →</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── 진행 ── */}
      <section id="how">
        <div className="wrap">
          <div className="lab">진행</div>
          <h2>두 달을 이렇게 씁니다</h2>
          <p className="sub2">
            첫 주에 지금 숫자를 남기고, 마지막 주에 같은 질문으로 다시 셉니다. 그 사이가 일입니다.
          </p>

          <div className="flow">
            <div className="fstep">
              <div className="fhead"><span className="fnum">1</span><span className="fwhen">1주차</span></div>
              <h3>지금 상태를 숫자로 남깁니다</h3>
              <p>손님이 실제로 칠 질문 30개를 만들어 AI 4곳에 여러 번 묻습니다. 학원이면 「○○구 초등 코딩학원 추천」, 치과면 「△△동 임플란트 잘하는 곳」 같은 말입니다.</p>
              <div className="chips"><span>질문 30개</span><span>AI 4곳</span><span>사이트 7항목 진단</span></div>
            </div>
            <div className="fstep">
              <div className="fhead"><span className="fnum">2</span><span className="fwhen">2~3주차</span></div>
              <h3>AI 가 읽을 수 있게 만듭니다</h3>
              <p>robots.txt 에 GPTBot·ClaudeBot 을 이름으로 열고 회사 정보를 구조화 데이터로 붙입니다. AI 크롤러를 막는 블로그에만 있던 글은 옮깁니다.</p>
              <div className="chips"><span>robots.txt</span><span>llms.txt</span><span>구조화 데이터</span><span>방문 기록</span></div>
            </div>
            <div className="fstep">
              <div className="fhead"><span className="fnum">3</span><span className="fwhen">4~8주차</span></div>
              <h3>비교 글·목록에 들어갑니다</h3>
              <p>AI 답에 붙은 출처를 모아 경쟁사는 있고 우리만 없는 글 다섯 곳을 고릅니다. 목록 사이트에 등재하고, 플레이스 소개글을 채우고, 틀린 정보를 고칩니다.</p>
              <div className="chips"><span>등재</span><span>소개글</span><span>정정</span><span>글 1편</span></div>
            </div>
            <div className="fstep">
              <div className="fhead"><span className="fnum">4</span><span className="fwhen">8주차</span></div>
              <h3>같은 질문으로 다시 셉니다</h3>
              <p>1단계와 같은 질문, 같은 AI, 같은 횟수로 다시 묻습니다. 오른 것, 안 오른 것, 거절당한 등재까지 적고 다음 두 달에 할 일을 정합니다.</p>
              <div className="chips"><span>답변 원문 전량</span><span>거절된 곳 포함</span></div>
            </div>
          </div>
          <p className="flownote">
            첫 리포트는 <b>착수 후 2주</b>에 나갑니다. 플레이스·구글 비즈니스 프로필처럼 대표자 인증이 필요한 곳은
            사장님이 권한을 열어 주셔야 진행됩니다.
          </p>
        </div>
      </section>

      {/* ── 도입 사례 ── */}
      <section className="deep" id="case">
        <div className="wrap">
          <div className="lab">도입 사례 · 수도권 코딩·로봇 학원 · {caseDay}일차</div>
          <h2>홈페이지 없이<br />블로그만 있던 학원</h2>
          <p className="sub2">
            학원 이름과 지역은 가렸습니다. 숫자는 <b>서버 기록에서 매일 다시 가져오고</b>, 안 오른 숫자도 같은 크기로 싣습니다.
          </p>

          <div className="case">
            <div className="cx hi">
              <div className="cxh">
                <span className="lab2">경쟁 검색어 · 착수 때 → 지금</span>
                <span className="cxn">0 → <Count to={webWins} /> / {webTotal}</span>
              </div>
              <p>
                「○○구 코딩학원」처럼 <b>학원 이름 없이</b> 친 검색 {webTotal}개입니다.
                착수 때는 위쪽이 전부 오늘학교·순위닷 같은 학원 목록 사이트였고 학원 홈페이지는 한 곳도 없었습니다.
                학원 이름을 넣은 검색은 세지 않습니다. 나오는 게 당연해서입니다.
              </p>
            </div>
            <div className="cx">
              <div className="cxh">
                <span className="lab2">네이버 플레이스 · 「○○구 코딩학원」</span>
                <span className="cxn"><Count to={placeRank} />위</span>
              </div>
              <p>
                네이버 AI 가 이 학원을 <b>「무선 인터넷과 남녀 구분 화장실을 제공합니다」</b>라고 소개하고 있었습니다.
                소개글 188자가 대부분 의무 게시 안내문이라 AI 가 쓸 문장이 없었습니다. 933자로 다시 썼습니다.
              </p>
            </div>
            <div className="cx">
              <div className="cxh">
                <span className="lab2">다녀간 크롤러 · {caseDay}일차</span>
                <span className="cxn"><Count to={vendors} />곳 · <Count to={hits} />회</span>
              </div>
              <p>
                첫날은 구글과 Anthropic 두 곳이었습니다. 네이버 블로그는 GPTBot·ClaudeBot 을 막아서
                <b> 쌓아 둔 글 32편이 AI 에겐 없는 글</b>이었습니다. 사진 69장까지 막히지 않은 곳으로 옮겼습니다.
              </p>
            </div>
            <div className="cx hi">
              <div className="cxh">
                <span className="lab2">AI 답변 인용</span>
                <span className="cxn">아직 모름</span>
              </div>
              <p>
                검색에 올라온 지 며칠 안 돼서 지금 물어보면 AI 가 아직 못 본 상태를 세게 됩니다.
                <b> 질문 33개를 AI 마다 5번씩 묻는 준비</b>는 끝났습니다. 결과가 0이어도 여기 적습니다.
              </p>
            </div>
          </div>

          <div className="casetwo">
            <div>
              <div className="minih">날짜별로 한 일</div>
              <div className="logrows">
                {TIMELINE.map(([d, t, p]) => (
                  <div className="lr" key={d + t}>
                    <span className="lrd">{d}</span>
                    <div><b>{t}</b><p>{p}</p></div>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <div className="minih">서버가 기록한 실제 방문 로그</div>
              <div className="caselog">
                <div className="clh">첫날 · 이후 누적</div>
                <div className="cl mono"><span>15:49:01</span><span>ClaudeBot</span><span>/robots.txt</span></div>
                <div className="cl mono"><span>15:49:27</span><span>ClaudeBot</span><span>/blog/(옮긴 글)</span></div>
                <div className="cl mono"><span>+18h</span><span>Googlebot</span><span>/ · /blog · /sitemap.xml</span></div>
                <div className="cl mono"><span>+3d</span><span>Yeti</span><span>/sitemap.xml · 네이버 색인</span></div>
                <div className="cl mono dim"><span>…</span><span>{vendors}곳</span><span>{hits}회 방문 · ClaudeBot {claudePages}쪽</span></div>
              </div>
              <a className="caselink" href={CASE_URL}>
                전체 기록 보기
                <span>이름·지역을 가린 원본 →</span>
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ── 리포트가 다른 점 ── */}
      <section id="diff" className="plain">
        <div className="wrap">
          <div className="lab">리포트가 다른 점</div>
          <h2>보기 좋은 숫자를<br />만들지 않습니다</h2>
          <p className="sub2">
            「AI 가시성 92%」 같은 딱 떨어지는 숫자는 몇 번 물었는지가 빠져 있기 쉽습니다. 저희 리포트는 이렇게 적습니다.
          </p>

          <div className="diff">
            <div className="drow">
              <div>
                <h3>몇 번 물었는지 같이 씁니다</h3>
                <div className="vs">
                  <div className="them">AI 가시성 62%</div>
                  <div className="us">62% · 150번 중 93번 · 흔들리는 범위 54~69%</div>
                </div>
              </div>
              <div className="body">
                같은 62%라도 5번만 물었다면 실제 값은 <b>24%에서 89% 사이</b> 어디든 될 수 있습니다.
                물어본 횟수를 늘릴수록 범위가 좁아집니다. 아래 버튼으로 바꿔 보세요.
              </div>
              <Interval />
            </div>
            <div className="drow">
              <div>
                <h3>답변 원문을 드립니다</h3>
                <div className="vs">
                  <div className="them">대시보드 점수만</div>
                  <div className="us">질문 · 답변 전문 · 답에 붙은 출처 · 엔진 · 시각</div>
                </div>
              </div>
              <div className="body">
                「그 숫자 어떻게 냈냐」에 원문을 열어 답합니다. 내부 보고에 그대로 붙이실 수 있습니다.
              </div>
            </div>
            <div className="drow">
              <div>
                <h3>고칠 게 없으면 없다고 합니다</h3>
                <div className="vs">
                  <div className="them">사이트 80점 → 개선 제안 12건</div>
                  <div className="us">사이트 80점 → 「사이트는 됐는데 안 불립니다」</div>
                </div>
              </div>
              <div className="body">
                위에서 본 사이트 점수 1위 회사의 실제 진단 결론입니다. 사이트를 더 고치라고 하지 않았습니다.
                대신 경쟁 3사는 있고 이 회사만 빠진 비교 글 세 곳을 먼저 들어갈 곳으로 적었습니다.
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 하지 않는 일 ── */}
      <section id="nots">
        <div className="wrap">
          <div className="lab">하지 않는 일</div>
          <h2>계약서에 넣어도 되는 네 줄</h2>
          <p className="sub2">
            이 바닥에는 몇 달은 효과가 나고 그 뒤에 손해가 되는 방법이 있습니다. 안 씁니다.
          </p>

          <div className="nots">
            <div className="nt"><span className="x">✕</span><div>
              <b>링크를 사지 않습니다</b>
              <p>적발되면 회복에 몇 달이 걸립니다. 그 몇 달의 손해는 고객사가 집니다.</p>
            </div></div>
            <div className="nt"><span className="x">✕</span><div>
              <b>댓글·후기를 만들지 않습니다</b>
              <p>사람을 동원해 커뮤니티에 글을 뿌리거나 같은 글을 여러 곳에 돌리지 않습니다. AI 는 중복을 걸러냅니다.</p>
            </div></div>
            <div className="nt"><span className="x">✕</span><div>
              <b>없는 사실을 쓰지 않습니다</b>
              <p>실적·수상·연혁을 부풀리지 않습니다. 다른 글과 어긋나면 AI 가 다른 회사로 봅니다.</p>
            </div></div>
            <div className="nt"><span className="x">✕</span><div>
              <b>계정을 대신 만들지 않습니다</b>
              <p>대표자 인증이 필요한 계정은 고객사 소유입니다. 열어만 주시면 됩니다.</p>
            </div></div>
          </div>
        </div>
      </section>

      {/* ── 요금 ── */}
      <section id="price" className="plain">
        <div className="wrap">
          <div className="lab">요금</div>
          <h2>한 번 내는 돈과<br />매달 내는 돈을 나눴습니다</h2>
          <p className="sub2">
            세팅은 한 번이면 끝나서 월 요금에 안 넣습니다. 섞어 두면 그만둘 때
            「세팅비는 다 낸 건가」로 다투게 됩니다.
          </p>

          <div className="ponce">
            <div className="poh">
              <span className="pok">한 번 · 시작할 때</span>
              <span className="pod">진단 결과에 따라 필요한 것만. 셋 다 필요 없는 회사도 많습니다.</span>
            </div>
            <div className="porow">
              <div className="po">
                <div className="pot">진단</div>
                <div className="pop">0원</div>
                <p>7개 항목을 자동으로 봅니다. 아래 셋 중 뭐가 필요한지 여기서 정해집니다.</p>
              </div>
              <div className="po">
                <div className="pot">기술 세팅</div>
                <div className="pop">80만원</div>
                <p>쓸 만한 사이트가 있는 경우. AI 가 읽을 수 있게 만들고 방문 기록 장치를 답니다.</p>
              </div>
              <div className="po">
                <div className="pot">사이트 구축</div>
                <div className="pop">250만원</div>
                <p>사이트가 없거나 못 쓰는 경우. 기술 세팅이 들어 있습니다.</p>
              </div>
              <div className="po">
                <div className="pot">블로그 글 이관</div>
                <div className="pop">+80만원</div>
                <p>블로그만 있는 경우. 몇 년치 글을 AI 가 읽는 곳으로 옮깁니다. 30편 기준.</p>
              </div>
            </div>
          </div>

          <div className="plans">
            <div className="plan hi">
              <div className="pn">리포트</div>
              <div className="pp">39<small>만원 / 월</small></div>
              <div className="for">숫자를 보고 직접 고치실 팀</div>
              <ul>
                <li>질문 30개 × AI 4곳 · 월 2회</li>
                <li>몇 번 중 몇 번 불렸는지 + 흔들리는 범위</li>
                <li>AI 방문 기록 — 어느 AI 가 몇 쪽 읽었는지</li>
                <li>답변 원문 전량</li>
                <li>경쟁사 3곳 나란히</li>
                <li>고칠 곳 다섯 개, 순서대로</li>
              </ul>
              <div className="cta"><AskForm wants="리포트" compact /></div>
            </div>

            <div className="plan">
              <div className="pn">관리</div>
              <div className="pp">79<small>만원 / 월</small></div>
              <div className="for">고치는 일까지 맡기실 팀</div>
              <ul>
                <li>리포트 전부</li>
                <li>AI 가 가져다 쓸 글 월 1편 작성·발행</li>
                <li>업계 목록·디렉터리 등재</li>
                <li>퍼져 있는 틀린 정보 정정</li>
                <li>월 1회 통화</li>
              </ul>
              <div className="cta"><AskForm wants="관리" compact /></div>
            </div>
          </div>

          <div className="quote">
            <div className="qh">견적 예시 · 위 사례와 같은 조건이라면</div>
            <div className="qrow">
              <span>홈페이지 없음 · 블로그만 운영</span>
              <span className="qcalc">구축 250 <i>+</i> 이관 80 <i>=</i> <b>초기 330만원</b></span>
            </div>
            <div className="qrow">
              <span>이후 매달</span>
              <span className="qcalc">리포트 <b>39만원</b> <em>또는</em> 관리 <b>79만원</b></span>
            </div>
            <p className="qnote">
              쓸 만한 사이트가 이미 있으면 초기 비용은 <b>80만원</b>이거나 <b>0원</b>입니다.
              진단을 먼저 받아 보시면 어느 쪽인지 나옵니다.
            </p>
          </div>

          <p className="pcompare">
            대기업 대상 GEO 컨설팅은 월 500만원부터 시작합니다. 저희는 <b>학원·병원·사무소 한 곳 규모</b>에 맞췄습니다.
            월 4만원짜리 측정 도구도 있는데, 질문을 직접 짜고 결과를 직접 읽고 직접 고쳐야 합니다.
            영어권 기준이라 「○○구 코딩학원」 같은 한국어 지역 질문은 잘 못 잡습니다.
            <b> 직접 하실 수 있으면 그 도구가 낫습니다.</b>
          </p>

          <p className="formnote" style={{ marginTop: 18 }}>
            최소 약정 없음 · 월 단위 · 세금계산서 발행 · 부가세 별도
          </p>
        </div>
      </section>

      {/* ── 자주 묻는 것 ── */}
      <section id="faq">
        <div className="wrap narrow">
          <div className="lab">자주 묻는 것</div>
          <h2>상담에서 먼저 나오는 질문</h2>
          <div className="faq">
            {FAQ.map(([q, a]) => (
              <details key={q}>
                <summary>{q}</summary>
                <p>{a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ── 시작 ── */}
      <section className="deep" id="start">
        <div className="wrap narrow">
          <div className="center">
            <div className="lab">시작</div>
            <h2>홈페이지 주소부터<br /><span className="hl">넣어 보세요</span></h2>
            <p className="sub2">
              AI 가 읽을 수 있는 상태인지 7개 항목 점수가 바로 나옵니다.
              그다음이 필요하면 아래에 남겨 주세요. 홈페이지가 없어도 됩니다.
            </p>
          </div>

          <div className="cpanel">
            <h3>무료 진단</h3>
            <p className="cpsub">주소만 넣으면 됩니다. 연락처는 결과를 본 뒤에 남기셔도 됩니다.</p>
            <ScanForm id="dom-start" placeholder="회사 홈페이지 주소" />
          </div>

          <div className="cpanel">
            <h3>상담 신청</h3>
            <p className="cpsub">어떻게 알고 오셨는지 꼭 여쭙습니다. 저희가 하는 일이 실제로 닿는지 확인하는 유일한 방법이라서입니다.</p>
            <ContactForm />
          </div>
          <p className="cfoot">메일로 답장드립니다. 영업 전화는 하지 않습니다.</p>
        </div>
      </section>

      <footer>
        <div className="wrap">
          <div className="fgrid">
            <div>
              <span className="logo"><span className="mk" aria-hidden="true">[ ]</span>Cited<em>사이티드</em></span>
              <p className="fdesc">손님이 AI 에게 물었을 때 우리 이름이 나오는지 확인하고, 나오게 만듭니다.</p>
            </div>
            <div>
              <h4>서비스</h4>
              <ul>
                {SERVICES.map((s) => <li key={s.slug}><Link href={`/services/${s.slug}`}>{s.name}</Link></li>)}
              </ul>
            </div>
            <div>
              <h4>기록</h4>
              <ul>
                <li><a href={CASE_URL}>도입 사례 리포트</a></li>
                <li><a href="/#geo">GEO 와 SEO 의 차이</a></li>
                <li><a href="/#how">두 달 진행 순서</a></li>
                <li><a href="/#price">요금</a></li>
              </ul>
            </div>
          </div>
          <div className="wm">
            이 페이지의 시장 숫자(홈페이지 34곳 진단 · 한 업계 질문을 AI 에게 15번 물은 결과)는 저희가 직접 측정한 값입니다.
            표본이 작아 <b>대략의 방향</b>으로 봐 주세요. 사례의 방문 기록은 서버에 남은 원본이고, 학원 이름과 지역만 가렸습니다.
          </div>
          <div className="fbottom">
            <span>© 2026 Cited 사이티드</span>
            <span>AI 답변 노출 · GEO</span>
            <a className="fadmin" href="/admin/login" rel="nofollow">관리자</a>
          </div>
        </div>
      </footer>
    </>
  );
}
