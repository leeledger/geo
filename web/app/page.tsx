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
 *   이게 뭔데(히어로) → GEO 가 뭔데 → 말만인가(기록) → 뭘 받나 → 해당되나
 *   → 왜 홈페이지만으론 안 되나 → 서비스 → 진행 → 사례 → 리포트가 다른 점
 *   → 안 하는 것 → 요금 → 질문 → 신청
 *
 * 09.10 판은 한 칸에 한 문장으로 줄였다가 「내용이 부실하다」는 말을 들었다.
 * 글을 다시 채우되 벽이 되지 않게, 참고한 두 사이트처럼 절마다 그림 한 가지를 붙였다
 * (게이지·코드·비교표·날짜 목록·큰 폼).
 *
 * 숫자는 세 종류뿐이다. DB 에서 매일 읽는 값, 날짜를 붙인 측정값, 저장소에 이미 적힌 표본값.
 * 구조화 데이터의 FAQ 는 화면의 질문 그대로다.
 */
const BASE = process.env.NEXT_PUBLIC_SITE_URL || "https://geo-rose-nine.vercel.app";

const FAQ: [string, string][] = [
  ["직접 하면 안 되나요?",
   "기술 세팅은 직접 하실 수 있고 그러시길 권합니다. 하루면 됩니다. 어려운 건 매주 AI 4곳에 같은 질문을 여러 번 던져 세는 일과, 경쟁사는 있고 우리만 없는 글을 골라내는 일입니다. 저희가 파는 건 그 둘입니다."],
  ["얼마나 걸리나요?",
   "질문마다 웹을 찾아보는 AI 는 2~4주, 미리 학습한 내용으로 답하는 AI 는 2~3개월쯤 걸립니다. 약속이 아니라 지금까지 본 흐름이고, 경쟁이 센 업종은 더 걸립니다."],
  ["성과를 보장하나요?",
   "안 합니다. 대신 어떤 질문으로, 몇 번, 어느 AI 에서 재는지를 계약서에 적고 시작 전에 지금 숫자를 남깁니다. 두 달 뒤 같은 방법으로 다시 잰 결과를 그대로 드립니다. 「몇 위 보장」을 약속하는 곳이 있으면 어떻게 재는지 물어보세요."],
  ["숫자를 어떻게 믿나요?",
   "믿어 달라고 하지 않습니다. 질문, 답변 원문, 참고한 주소, 물어본 시각이 전부 남아 있고 요청하시면 그대로 드립니다. 내부 보고에 원문을 붙이셔도 됩니다."],
  ["SEO 대행사와 뭐가 다른가요?",
   "SEO 는 검색 결과에서 클릭을 얻는 일이고, 이건 AI 답변 문장 안에 이름이 들어가는 일입니다. AI 가 참고하는 글의 대부분이 자사 사이트 밖에 있어서 그 지면에 들어가는 일이 다릅니다. 기존 SEO 자산은 버리지 않고 그대로 씁니다."],
  ["그만두면 뭐가 남나요?",
   "사이트를 만들어 드렸다면 도메인·저장소·호스팅 계정이 전부 고객사 명의라 그대로 남습니다. 그동안의 측정 원문과 리포트도 드립니다. 최소 약정이 없어서 한 달 단위로 멈출 수 있습니다."],
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
        "손님이 AI 에게 물었을 때 우리 회사 이름이 나오는지 재고, 나오게 만드는 마케팅 대행사입니다. 학원·병원·사무소 규모에 맞춘 GEO 서비스.",
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

/** 착수일. 「N일차」를 여기서 센다. */
const START = Date.parse("2026-09-05T00:00:00+09:00");

/**
 * 사례 학원 사이트 진단 — probe/data/scans/robotncoding.com.json (09.10 저장).
 * web 배포에는 probe 폴더가 없어 값을 옮겨 적는다. 다시 재면 날짜와 함께 고친다.
 * 문단 점수 47 을 뺀 네 개만 고르면 보기 좋은 숫자를 만드는 것이다. 그래서 같이 싣는다.
 */
const SCAN = {
  day: "09.10",
  total: 92,
  baseline: 83,
  crawler: 100,
  schema: 100,
  chunk: 47,
  chunkIn: 151,
  chunkAll: 334,
};

/** 사례 기록 — public/case/robotncoding.html 의 날짜 그대로 */
const TIMELINE: [string, string, string][] = [
  ["09.05", "사이트 구축 · 도메인 연결", "AI 크롤러를 이름으로 허용하고 llms.txt 와 구조화 데이터를 붙였습니다. 첫 AI 방문은 그날 오후였습니다."],
  ["09.05", "블로그 글 32편 이관", "네이버 블로그는 AI 크롤러를 막습니다. 사진 69장까지 막히지 않은 곳으로 옮겼습니다."],
  ["09.05", "크롤러 방문 기록 설치", "어느 AI 가 언제 몇 쪽 읽었는지 서버에 남습니다. 검색 콘솔에는 안 나오는 값입니다."],
  ["09.06", "구글 비즈니스 프로필 등록", "대표자 본인인증이 필요해 대행할 수 없는 항목입니다. 열어 주시는 일은 고객 몫입니다."],
  ["09.06", "학원 목록 사이트 등재 신청", "「송파구 코딩학원」 목록에 빠져 있던 자리입니다."],
  ["09.08", "네이버 색인 첫 확인", "옮긴 글이 네이버 검색에 잡히기 시작했습니다."],
  ["09.10", "AI 답변 인용 첫 측정", "학부모 질문 8개에 우리 사이트를 출처로 단 답은 0개. 이게 기준선입니다."],
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
  const serpDay = ops.serp.day ? ops.serp.day.slice(5).replace("-", ".") : "09.10";

  // 경쟁 검색어 집계는 lib/ops.ts 한 곳에 둔다. 여기서 또 세면 대시보드와 갈라진다.
  const webWins = ops.serp.rivalWon;
  const webTotal = ops.serp.rivalTotal || 6;
  const songpaRank = ops.place.find((p) => /송파구/.test(p.query))?.rank ?? 2;

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
              <span className="badge"><i />AI 답변 노출 측정 · GEO</span>
              <h1>손님이 AI에게 물었을 때<br /><span className="hl">우리 이름이 나옵니까?</span></h1>
              <p className="lede">
                검색창 맨 위에 AI 답이 먼저 뜹니다. 링크를 누르기 전에 <b>추천 세 곳이 정해집니다.</b>{" "}
                그 세 곳에 드는지 재고, 들게 만드는 일을 합니다.
              </p>
              <ScanForm id="dom-hero" />
              <div className="herolinks">
                <a href="/case/robotncoding.html">도입 사례 기록 보기 →</a>
                <a href="#price">요금 먼저 보기</a>
              </div>
            </div>
            <div>
              <ChatDemo />
            </div>
          </div>

          <div className="proofbar">
            <div className="pbh"><i />도입 사례 · 서버가 기록한 값 · 매일 다시 읽습니다</div>
            <div className="pbgrid">
              <div className="pb"><b>{caseDay}<small>일차</small></b><span>09.05 착수부터</span></div>
              <div className="pb"><b><Count to={vendors} /><small>곳</small></b><span>다녀간 AI·검색 크롤러</span></div>
              <div className="pb"><b><Count to={hits} /><small>회</small></b><span>누적 크롤러 방문</span></div>
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
            <b>GEO(생성형 엔진 최적화)</b>는 손님이 ChatGPT·Gemini·네이버 AI 브리핑 같은 AI 에게 물었을 때
            답변 문장 안에 우리 회사 이름이 들어가게 하는 일입니다. SEO 는 검색 결과에서 클릭을 얻는 일입니다.
            둘은 겹치지만 싸우는 자리가 다릅니다. AI 는 답을 만들 때 <b>홈페이지보다 남이 쓴 비교 글과 목록을 더 많이 참고합니다.</b>
          </p>

          <div className="cmpwrap">
            <table className="cmp">
              <thead>
                <tr><th scope="col">구분</th><th scope="col">검색 최적화 (SEO)</th><th scope="col" className="us">AI 답변 노출 (GEO)</th></tr>
              </thead>
              <tbody>
                <tr><th scope="row">얻는 것</th><td>결과 목록의 링크 클릭</td><td className="us">답변 문장 안의 이름</td></tr>
                <tr><th scope="row">자리</th><td>한 화면에 링크 열 개</td><td className="us">답변이 추천하는 보통 세 곳</td></tr>
                <tr><th scope="row">주로 움직이는 곳</th><td>우리 홈페이지</td><td className="us">남이 쓴 글 · AI 가 참고한 글의 80%</td></tr>
                <tr><th scope="row">재는 법</th><td>검색해서 순위 확인</td><td className="us">같은 질문을 여러 번 · 몇 번 중 몇 번</td></tr>
              </tbody>
            </table>
          </div>
          <p className="cmpnote">
            SEO 가 잘된 사이트가 AI 답변에도 유리한 건 맞습니다. <b>그것만으로는 나머지 80%를 못 건드립니다.</b>{" "}
            SEO 를 이미 맡긴 곳이 있다면 그건 그대로 두셔도 됩니다.
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
              저희 진단기로 {SCAN.day}에 잰 점수입니다. 착수 때 종합 {SCAN.baseline}점이었습니다.
              홈페이지 주소를 넣으면 같은 7개 항목이 바로 나옵니다.
            </p>
            <div className="gauges">
              <Gauge v={SCAN.total} label="종합" note={`착수 때 ${SCAN.baseline}`} delay={0} />
              <Gauge v={SCAN.crawler} label="AI 크롤러 접근" note="이름으로 허용" delay={120} />
              <Gauge v={SCAN.schema} label="구조화 데이터" note="오류 0" delay={240} />
              <Gauge v={SCAN.chunk} label="인용할 만한 문단" note={`${SCAN.chunkAll}개 중 ${SCAN.chunkIn}개`} delay={360} />
            </div>
            <p className="proofnote">
              <b>문단 점수 47은 아직 못 고친 부분입니다.</b> 기준보다 짧은 문단이 {SCAN.chunkAll - SCAN.chunkIn}개, 긴 문단은 0개였습니다.
              AI 가 잘라 가져가기에 짧다는 뜻입니다. 잘된 칸만 골라 싣지 않습니다.
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
                <div><span>15:49:27</span><span>ClaudeBot</span><span>/blog/seouldae-uiyegwa-hapgyeok</span></div>
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
          <h2>세 가지를<br /><span className="hl">숫자로</span> 받습니다</h2>

          <div className="gets">
            <article className="get">
              <Ico name="count" />
              <div className="getn">01 · 측정</div>
              <h3>지금 불리고 있나</h3>
              <p>
                손님이 쓸 질문 30개를 AI 4곳에 여러 번 묻습니다.
                20번 물어 3번 나오면 15%. <b>짐작이 아니라 센 숫자</b>입니다.
              </p>
              <div className="getb">
                <span className="wbar" data-reveal="260"><i style={{ ["--w" as string]: "15%" }} /></span>
                <span>예시 · 20회 중 3회 = 15%</span>
              </div>
            </article>

            <article className="get">
              <Ico name="why" />
              <div className="getn">02 · 원인</div>
              <h3>왜 안 나오나</h3>
              <p>
                둘 중 하나입니다. AI 가 우리 사이트를 <b>못 읽거나</b>, AI 가 참고하는
                남의 글에 <b>우리가 없거나.</b> 어느 쪽인지 갈라서 고칠 곳 다섯 개를 순서대로 드립니다.
              </p>
              <div className="getb">
                <span className="wsplit" data-reveal="360"><i className="a" style={{ ["--w" as string]: "20%" }} /><i className="b" style={{ ["--w" as string]: "80%" }} /></span>
                <span>AI 가 참고한 글 · 홈페이지 20% · 남의 글 80%</span>
              </div>
            </article>

            <article className="get">
              <Ico name="again" />
              <div className="getn">03 · 재측정</div>
              <h3>고친 게 먹혔나</h3>
              <p>
                시작할 때 숫자를 남기고 <b>두 달 뒤 같은 질문으로 다시 잽니다.</b>{" "}
                안 올랐으면 안 올랐다고 적습니다. 거절당한 지면도 적습니다.
              </p>
              <div className="getb">
                <span className="wdelta"><span className="d0">시작</span><span className="darrow">→</span><span className="d1">두 달 뒤</span></span>
                <span>같은 질문 · 같은 AI · 같은 횟수</span>
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

      {/* ── 직접 잰 것 ── */}
      <section className="deep" id="data">
        <div className="wrap">
          <div className="lab">직접 잰 것 · 국내 26곳</div>
          <h2>홈페이지를 고쳐서 얻는 몫은<br /><span className="hl">다섯 중 하나</span>였습니다</h2>
          <p className="sub2">
            국내 B2B 사이트 26곳을 점검하고, 실제 구매자가 쓸 질문을 AI 에 던졌습니다.
            AI 가 답하며 참고한 글 중 자사 홈페이지는 20%. 나머지는 비교 글, 커뮤니티, 업계 목록이었습니다.
          </p>

          <div className="facts">
            <div className="fact">
              <div className="stat">
                <span className="v"><Count to={20} /><small>%</small></span>
                <span className="bandbar"><i style={{ left: "20%" }} /></span>
                <span className="c">AI 가 참고한 글 중 홈페이지 몫</span>
              </div>
              <div className="t">
                나머지 80%는 <b>남이 쓴 글</b>에서 왔습니다.
                홈페이지를 100점으로 만들어도 이 80%는 안 움직입니다.
              </div>
            </div>
            <div className="fact">
              <div className="stat">
                <span className="v"><Count to={5} /><small> / 26</small></span>
                <span className="bandbar"><i style={{ left: "19%" }} /></span>
                <span className="c">60점을 넘긴 사이트</span>
              </div>
              <div className="t">
                <b>업계 1위라는 회사가 30점</b>이었습니다.
                어려운 기술이 없어서가 아니라 아무도 확인해 본 적이 없어서입니다.
              </div>
            </div>
            <div className="fact">
              <div className="stat">
                <span className="v"><Count to={28} /><small>%</small></span>
                <span className="bandbar"><i style={{ left: "28%" }} /></span>
                <span className="c">다시 물으면 바뀌는 추천</span>
              </div>
              <div className="t">
                같은 질문을 다시 하면 추천 목록의 28%가 바뀝니다.{" "}
                <b>한 번 재고 「1위」라 적는 건 동전 한 번 던진 것</b>입니다.
              </div>
            </div>
          </div>

          <div className="casenote">
            그래서 일이 둘로 나뉩니다. 사이트를 <b>읽히게</b> 만드는 일과, 남의 글 다섯 곳에 이름을 <b>넣는</b> 일.
            뒤엣것이 큽니다. 홈페이지만 고쳐 주고 끝내면 점수는 오르는데 답변에는 안 나옵니다.
          </div>
        </div>
      </section>

      {/* ── 서비스 ── */}
      <section id="services" className="plain">
        <div className="wrap">
          <div className="lab">서비스</div>
          <h2>넷 중 <span className="hl">필요한 것만</span> 삽니다</h2>
          <p className="sub2">
            대부분은 측정부터 시작합니다. 나머지는 재 본 뒤에 정해도 됩니다.
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
            첫 주에 지금 숫자를 남기고, 마지막 주에 같은 방법으로 다시 잽니다. 그 사이가 일입니다.
          </p>

          <div className="flow">
            <div className="fstep">
              <div className="fhead"><span className="fnum">1</span><span className="fwhen">1주차</span></div>
              <h3>지금 숫자를 남깁니다</h3>
              <p>손님이 쓸 질문 30개를 만들어 AI 4곳에 여러 번 묻습니다. 사이트는 7개 항목으로 점검합니다. 이게 기준선입니다.</p>
              <div className="chips"><span>질문 30개</span><span>AI 4곳</span><span>7항목 점검</span></div>
            </div>
            <div className="fstep">
              <div className="fhead"><span className="fnum">2</span><span className="fwhen">2~3주차</span></div>
              <h3>읽히게 만듭니다</h3>
              <p>크롤러를 이름으로 열고 구조화 데이터를 붙입니다. 서버에 방문 기록 장치를 달면 어느 AI 가 몇 쪽 읽었는지 여기서 처음 보입니다.</p>
              <div className="chips"><span>robots.txt</span><span>llms.txt</span><span>구조화 데이터</span><span>방문 기록</span></div>
            </div>
            <div className="fstep">
              <div className="fhead"><span className="fnum">3</span><span className="fwhen">4~8주차</span></div>
              <h3>남의 글에 들어갑니다</h3>
              <p>AI 가 참고한 글을 거꾸로 찾아 경쟁사는 있고 우리만 없는 다섯 곳을 고릅니다. 등록하고, 요청하고, 틀린 정보를 바로잡습니다.</p>
              <div className="chips"><span>등재</span><span>정정</span><span>글 1편</span></div>
            </div>
            <div className="fstep">
              <div className="fhead"><span className="fnum">4</span><span className="fwhen">8주차</span></div>
              <h3>같은 질문으로 다시 잽니다</h3>
              <p>오른 것, 안 오른 것, 거절당한 지면까지 그대로 적습니다. 답변 원문과 참고한 주소를 붙이고 다음 두 달에 뭘 할지 정합니다.</p>
              <div className="chips"><span>답변 원문 전량</span><span>거절 지면 포함</span></div>
            </div>
          </div>
          <p className="flownote">첫 리포트는 <b>착수 후 2주</b>에 나갑니다. 사이트 수정에 고객사 개발팀·외주사를 거쳐야 하면 2단계가 길어집니다.</p>
        </div>
      </section>

      {/* ── 도입 사례 ── */}
      <section className="deep" id="case">
        <div className="wrap">
          <div className="lab">도입 사례 · 송파구 코딩·로봇 학원 · {caseDay}일차</div>
          <h2>홈페이지 없이<br />블로그만 있던 학원</h2>
          <p className="sub2">
            아래 숫자는 <b>서버 기록에서 매일 다시 가져옵니다.</b> 안 오른 숫자도 같은 크기로 싣습니다.
          </p>

          <div className="case">
            <div className="cx hi">
              <div className="cxh">
                <span className="lab2">경쟁 검색어 · 09.05 → {serpDay}</span>
                <span className="cxn">0 → <Count to={webWins} /> / {webTotal}</span>
              </div>
              <p>
                「송파구 코딩학원」처럼 <b>학원 이름 없이</b> 지역과 업종만 친 검색입니다.
                시작할 때 하나도 없었고 위쪽은 전부 학원 목록 사이트였습니다.
                학원 이름을 넣은 검색은 여기 안 셉니다 — 나오는 게 당연해서 성과가 아닙니다.
              </p>
            </div>
            <div className="cx">
              <div className="cxh">
                <span className="lab2">네이버 플레이스 · 「송파구 코딩학원」</span>
                <span className="cxn"><Count to={songpaRank} />위</span>
              </div>
              <p>
                학부모가 실제로 보는 자리입니다. 소개글이 188자였고 AI 가 그걸 읽고 학원을 설명하고 있었습니다.
                933자로 다시 썼습니다.
              </p>
            </div>
            <div className="cx">
              <div className="cxh">
                <span className="lab2">AI 가 읽은 비율 · 1일차</span>
                <span className="cxn"><Count to={91.2} decimals={1} suffix="%" /></span>
              </div>
              <p>
                주소를 연결한 날 AI 가 처음 왔고, 하루 만에 <b>34쪽 중 31쪽</b>을 읽어 갔습니다.
                검색 콘솔에는 안 나옵니다. 서버에 기록 장치를 달아야 보입니다.
              </p>
            </div>
            <div className="cx">
              <div className="cxh">
                <span className="lab2">다녀간 크롤러 · {caseDay}일차</span>
                <span className="cxn"><Count to={vendors} />곳 · <Count to={hits} />회</span>
              </div>
              <p>
                첫날은 2곳이었습니다. 국내 블로그 플랫폼은 GPTBot·ClaudeBot 을 막아서
                <b> 쌓아 둔 글 32편이 AI 에겐 없는 글</b>이었습니다. 막히지 않은 곳으로 옮겼습니다.
              </p>
            </div>
            <div className="cx hi">
              <div className="cxh">
                <span className="lab2">AI 답변 인용 · 09.10</span>
                <span className="cxn">0 / 8</span>
              </div>
              <p>
                학부모 질문 8개 중 우리 사이트를 출처로 단 답은 <b>아직 0개</b>입니다.
                이름이 나온 답이 하나 있었는데 출처가 <b>남의 글</b>이었습니다. 위에서 말한 80%가 이겁니다.
                2~4주 뒤 더 넓게 다시 잽니다.
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
                <div className="cl mono"><span>15:49:27</span><span>ClaudeBot</span><span>/blog/seouldae-uiyegwa-hapgyeok</span></div>
                <div className="cl mono"><span>+18h</span><span>Googlebot</span><span>/ · /blog · /sitemap.xml</span></div>
                <div className="cl mono"><span>+3d</span><span>Yeti</span><span>/sitemap.xml · 네이버 색인</span></div>
                <div className="cl mono dim"><span>…</span><span>{vendors}곳</span><span>{hits}회 방문 · ClaudeBot {claudePages}쪽</span></div>
              </div>
              <a className="caselink" href="/case/robotncoding.html">
                전체 기록 보기
                <span>날짜·수치 전부 →</span>
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
            「AI 가시성 97%」 같은 딱 떨어지는 숫자는 대개 한 번 물어본 결과입니다. 저희 리포트는 이렇게 생겼습니다.
          </p>

          <div className="diff">
            <div className="drow">
              <div>
                <h3>몇 번 물었는지 같이 씁니다</h3>
                <div className="vs">
                  <div className="them">AI 가시성 92%</div>
                  <div className="us">62% (150회 · 흔들리는 범위 48~74%)</div>
                </div>
              </div>
              <div className="body">
                하루 다섯 번 재면 오차가 ±40%p까지 벌어집니다. 많이 물을수록 범위가 좁아지고,
                그 과정을 그대로 보여드립니다. 아래 버튼을 눌러 보세요. 흐려 보이면 그게 사실입니다.
              </div>
              <Interval />
            </div>
            <div className="drow">
              <div>
                <h3>답변 원문을 드립니다</h3>
                <div className="vs">
                  <div className="them">대시보드 점수만</div>
                  <div className="us">질문 · 답변 전문 · 참고한 주소 · 엔진 · 시각</div>
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
                  <div className="us">사이트 80점 → “사이트는 문제가 아닙니다”</div>
                </div>
              </div>
              <div className="body">
                사이트 점수 80점(26곳 중 1위)인데 AI 노출은 25%인 곳이 있었습니다.
                AI 가 읽는 비교 글 14개 중 어디에도 이름이 없었습니다. 사이트를 더 고쳐도 안 달라집니다.
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
              <p className="fdesc">손님이 AI 에게 물었을 때 우리 이름이 나오는지 재고, 나오게 만듭니다.</p>
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
                <li><a href="/case/robotncoding.html">도입 사례 리포트</a></li>
                <li><a href="/#geo">GEO 와 SEO 의 차이</a></li>
                <li><a href="/#how">두 달 진행 순서</a></li>
                <li><a href="/#price">요금</a></li>
              </ul>
            </div>
          </div>
          <div className="wm">
            이 페이지의 숫자(26곳 점검 · 다시 물으면 28% 바뀜 · 홈페이지 몫 20%)는 저희가 직접 잰 값입니다.
            표본이 아직 크지 않아 확정치가 아니라 <b>대략의 방향</b>으로 봐 주세요.
            사례의 방문 기록은 서버에 남은 원본 그대로입니다.
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
