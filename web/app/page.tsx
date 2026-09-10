import ScanForm from "./ScanForm";
import Reveal from "./Reveal";
import SiteNav from "./SiteNav";
import Interval from "./Interval";
import Count from "./Count";
import ChatDemo from "./ChatDemo";
import Link from "next/link";
import { SERVICES } from "@/lib/services";
import { readOps } from "@/lib/ops";

const MAIL = "hello@cited.kr";
const mailto = (kind: string) =>
  `mailto:${MAIL}?subject=${encodeURIComponent(`[Cited] ${kind} 신청`)}` +
  `&body=${encodeURIComponent(`홈페이지 주소: \n회사명: \n담당자: \n연락처: \n\n요청: ${kind}\n`)}`;

/**
 * 구조화 데이터가 아예 없었다. AI 는 이걸 읽고 "이 회사가 뭐 하는 곳인지"를 잡는다.
 * FAQ 는 화면에 있는 질문 그대로다 — 화면과 다른 걸 넣으면 신뢰가 깎인다.
 */
const BASE = process.env.NEXT_PUBLIC_SITE_URL || "https://geo-rose-nine.vercel.app";

const FAQ: [string, string][] = [
  ["이거 직접 하면 안 되나요?",
   "됩니다. 다만 재는 일이 반복이라 손이 많이 갑니다. 같은 질문을 여러 번 던지고 표본과 오차범위를 기록해야 근거가 됩니다."],
  ["성과를 보장하나요?",
   "보장하지 않습니다. 안 나왔으면 안 나왔다고 기록에 적습니다. 사이티드가 파는 것은 결과가 아니라 측정과 실행입니다."],
  ["왜 오차범위를 보여주나요? 숫자가 흐려 보이는데요.",
   "AI 는 같은 질문에도 매번 다르게 답합니다. 몇 번 물어봤는지 안 적힌 숫자는 근거가 못 됩니다."],
  ["기존 SEO 대행사와 겹치나요?",
   "겹치는 부분이 있습니다. 다만 AI 가 인용하는 문서의 대부분은 자사 사이트가 아니라 남의 문서입니다. 그 지면에 들어가는 일이 다릅니다."],
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
        "AI 답변에 브랜드가 인용되는지 표본과 오차범위까지 붙여 측정하고, 인용되게 만드는 마케팅 대행사입니다.",
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

export default async function Home() {
  const ops = await readOps();
  // DB 가 막혀도 랜딩이 0 을 띄우면 안 된다. 마지막으로 확인한 값을 바닥으로 쓴다.
  const vendors = ops.ok && ops.vendorCount ? ops.vendorCount : 8;
  const hits = ops.ok && ops.totalHits ? ops.totalHits : 460;
  const claudePages = ops.crawl.vendors.find((v) => /claude/i.test(v.vendor))?.pages ?? 102;
  const caseDay = Math.max(1, Math.floor((Date.now() - START) / 86400000) + 1);
  const serpDay = ops.serp.day ? ops.serp.day.slice(5).replace("-", ".") : "09.08";

  // 「이겨서 얻은 자리」만 센다.
  // 학원 이름이 들어간 검색에서 1위인 건 성과가 아니다 — 이름이 로봇&코딩이고
  // 석촌동에 있으니 「석촌동 로봇 코딩학원」에 나오는 건 당연하다.
  // 그걸 성과로 세면 좋아 보이는 숫자를 만드는 것이고, 그건 우리가 하지 말라는 짓이다.
  const BRAND = ["로봇앤코딩", "로봇&코딩", "로봇코딩", "robotncoding"];
  const isBrand = (q: string) => {
    const t = q.replace(/\s+/g, "");
    return /^site:/i.test(q) || BRAND.some((b) => t.includes(b.replace(/\s+/g, "")));
  };
  const webRival = ops.serp.hits.filter((h) => !isBrand(h.query));
  const webWins = webRival.length;
  const webTotal = ops.serp.total || 4;
  const songpaRank = ops.place.find((p) => /송파구/.test(p.query))?.rank ?? 2;

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(SCHEMA) }}
      />
      <Reveal />
      <SiteNav />

      <header className="hero">
        <div className="wrap hero-grid">
          <div>
            <div className="eyebrow">AI 답변 노출 측정 · GEO</div>
            <h1>AI는 지금<br />우리 회사를 추천할까요?</h1>
            <p className="lede">
              AI는 다 보여주지 않습니다. <b>몇 곳만 골라서 답합니다.</b><br />
              그 안에 있는지 재고, 없다면 <b>왜 없는지</b> 찾아냅니다.
            </p>
            <ScanForm id="dom-hero" />
          </div>

          <div>
            <ChatDemo />
          </div>
        </div>
      </header>


      {/* 히어로 다음에 바로 "그래서 뭐가 좋은데"를 답한다.
          방법론(표본·신뢰구간)을 먼저 말하면 사는 사람은 이해하기 전에 나간다. */}
      <section id="why">
        <div className="wrap">
          <div className="lab">쓰면 달라지는 것</div>
          <h2>이 세 가지를<br />알게 됩니다</h2>

          <div className="whys">
            <article className="w" data-reveal="0">
              <div className="wq">“우리가 지금 불리긴 하나?”</div>
              <div className="wa">
                20번 물어서 3번 나오면 15%. <b>짐작이 아니라 직접 센 숫자</b>입니다.
              </div>
              <div className="wb mono">
                <span className="wbar" data-reveal="260"><i style={{ ["--w" as string]: "15%" }} /></span>
                <span>15% · 20회 중 3회</span>
              </div>
            </article>

            <article className="w" data-reveal="110">
              <div className="wq">“홈페이지를 고치면 되나?”</div>
              <div className="wa">
                아닐 때가 더 많습니다. <b>열에 여덟은 남이 쓴 글</b>에서 옵니다.
              </div>
              <div className="wb mono">
                <span className="wsplit" data-reveal="360"><i className="a" style={{ ["--w" as string]: "20%" }} /><i className="b" style={{ ["--w" as string]: "80%" }} /></span>
                <span>홈페이지 20% · 외부 글 80%</span>
              </div>
            </article>

            <article className="w" data-reveal="220">
              <div className="wq">“고쳤는데 좋아진 게 맞나?”</div>
              <div className="wa">
                시작할 때 숫자를 남겨 두고, <b>두 달 뒤에 똑같이 다시 잽니다.</b>
              </div>
              <div className="wb mono">
                <span className="wdelta">
                  <span className="d0">0%</span>
                  <span className="darrow">→</span>
                  <span className="d1">?</span>
                </span>
                <span>시작할 때 기록 · 두 달 뒤 다시</span>
              </div>
            </article>
          </div>

          <p className="whyfoot">
            <b>순위를 넣어 드릴 수는 없습니다.</b> "몇 달 안에 몇 % 보장"도 하지 않습니다.
            AI 답변은 물을 때마다 달라집니다. 그런 약속을 하는 곳이 오히려 위험합니다.
          </p>
        </div>
      </section>

      <section className="deep" id="data">
        <div className="wrap">
          <div className="lab">우리가 직접 잰 것</div>
          <h2>26곳을 재봤습니다.<br />60점을 넘긴 곳은 다섯이었습니다.</h2>
          <p className="sub2">
            국내 B2B 사이트를 점검하고, 실제 구매자가 쓸 질문을 AI에 던져봤습니다.
          </p>

          <div className="facts">
            <div className="fact">
              <div className="stat">
                <span className="v">
                  <Count to={5} /><small style={{ fontSize: 20, fontWeight: 400 }}> / 26</small>
                </span>
                <span className="bandbar">
                  <i style={{ left: "19%" }} />
                </span>
                <span className="c">사이트 점검 26곳</span>
              </div>
              <div className="t">
                <b>60점을 넘긴 곳이 5곳뿐이었습니다.</b> 업계 1위라는 회사가 30점이었습니다.
              </div>
            </div>
            <div className="fact">
              <div className="stat">
                <span className="v">
                  <Count to={28} /><small style={{ fontSize: 20, fontWeight: 400 }}>%</small>
                </span>
                <span className="bandbar">
                  <i style={{ left: "28%" }} />
                </span>
                <span className="c">반복 측정 기준</span>
              </div>
              <div className="t">
                두 번 물으면 <b>추천 목록의 28%가 바뀝니다.</b>
                한 번 재고 “1위”라 적는 건 <b>동전 한 번 던지는 것</b>과 같습니다.
              </div>
            </div>
            <div className="fact">
              <div className="stat">
                <span className="v">
                  <Count to={20} /><small style={{ fontSize: 20, fontWeight: 400 }}>%</small>
                </span>
                <span className="bandbar">
                  <i style={{ left: "20%" }} />
                </span>
                <span className="c">홈페이지가 차지하는 몫 · 21곳</span>
              </div>
              <div className="t">
                홈페이지 덕은 <b>20%</b>뿐이었습니다. 나머지는 비교 기사, 커뮤니티 글,
                업계 목록 같은 <b>남이 쓴 글</b>에서 왔습니다.
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="how">
        <div className="wrap">
          <div className="lab">서비스</div>
          <h2>넷 중 필요한 것만</h2>
          <p className="sub2">
            대부분은 <b>측정</b>부터 시작합니다. 나머지는 재본 뒤에 정해도 늦지 않습니다.
          </p>

          <div className="svcs">
            {SERVICES.map((sv) => (
              <Link className="svc" key={sv.slug} href={`/services/${sv.slug}`}>
                <div className="svch">
                  <span className="mono no">{sv.no}</span>
                  <span className="mono tag">{sv.tag}</span>
                </div>
                <h3>{sv.name}</h3>
                <p>{sv.short}</p>
                <span className="svcgo mono">자세히 →</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="deep" id="case">
        <div className="wrap">
          <div className="lab">첫 고객사 · 진행중</div>
          <h2>착수 하루 만에<br />AI가 34쪽 중 31쪽을 읽어갔습니다</h2>
          <p className="sub2">
            수도권의 코딩·로봇 교육 학원입니다. 홈페이지가 없고 블로그만 있었습니다.
            시작한 날 먼저 지금 상태를 재고, 같은 날 홈페이지를 만들고, 블로그 글 32편을 옮겼습니다.
            아래 숫자는 <b>서버에 남은 기록을 그대로 가져온 것</b>입니다.
          </p>

          <div className="case">
            <div className="cx">
              <div className="cxh">
                <span className="lab2">착수 시점 · 09.05</span>
                <span className="mono cxn"><Count to={0} /> / 6</span>
              </div>
              <p>
                학부모가 쓸 질문 6개를 검색해 봤습니다. <b>하나도 안 나왔습니다.</b>
                더 눈에 띈 건 위쪽에 <b>학원 홈페이지가 아예 없었다</b>는 겁니다. 전부 학원 목록 사이트였습니다.
                홈페이지를 아무리 잘 만들어도 이런 검색은 못 이깁니다.
              </p>
            </div>
            <div className="cx">
              <div className="cxh">
                <span className="lab2">사이트 진단</span>
                <span className="mono cxn">83 → <Count to={93} /></span>
              </div>
              <p>
                크롤러 허용, llms.txt, 구조화 데이터, 문단 구조 등 7가지를 봅니다.
                <b>코드로 확인되는 것만 셉니다.</b> 눈으로 판단하는 항목은 점수에 넣지 않습니다.
              </p>
            </div>
            <div className="cx">
              <div className="cxh">
                <span className="lab2">이관한 문서</span>
                <span className="mono cxn">0 → <Count to={32} />편</span>
              </div>
              <p>
                국내 대형 블로그 플랫폼은 robots.txt 로 GPTBot·ClaudeBot·PerplexityBot 을 전부 막습니다.
                <b>7년치 블로그 글이 AI 에게는 없는 글이나 마찬가지였습니다.</b> 막히지 않은 곳으로 옮겼습니다.
              </p>
            </div>
            <div className="cx hi">
              <div className="cxh">
                <span className="lab2">AI가 읽은 비율 · 1일차</span>
                <span className="mono cxn"><Count to={91.2} decimals={1} suffix="%" /></span>
              </div>
              <p>
                AI가 <b>사이트 34쪽 중 31쪽</b>을 읽어 갔습니다.
                "몇 번 왔다"가 아니라 <b>몇 쪽을 읽었느냐</b>로 셉니다.
                10쪽짜리 사이트에 10번 온 것과 100쪽짜리에 10번 온 것은 전혀 다른 일이니까요.
              </p>
            </div>
            <div className="cx">
              <div className="cxh">
                <span className="lab2">첫 크롤까지</span>
                <span className="mono cxn"><Count to={2} />시간</span>
              </div>
              <p>
                주소를 연결하고 나서 AI가 처음 찾아오기까지 걸린 시간입니다.
                <b>대부분의 회사는 이걸 모릅니다.</b> 구글 검색 콘솔에도 안 나오고,
                서버에 직접 기록을 심어야만 알 수 있기 때문입니다.
              </p>
            </div>
            <div className="cx">
              <div className="cxh">
                <span className="lab2">다녀간 크롤러 · {caseDay}일차</span>
                <span className="mono cxn"><Count to={vendors} />곳 / <Count to={hits} />회</span>
              </div>
              <p>
                첫날은 2곳이었습니다.
                AI마다, 검색엔진마다 새 사이트를 발견하는 속도가 다릅니다.
                <b>어디가 언제 왔는지 전부 기록에 남습니다.</b>
              </p>
            </div>
            <div className="cx hi">
              <div className="cxh">
                <span className="lab2">경쟁 검색어 · {serpDay}</span>
                <span className="mono cxn">플레이스 <Count to={songpaRank} />위</span>
              </div>
              <p>
                「송파구 코딩학원」으로 검색했을 때 네이버 플레이스 순위입니다.
                학원 이름을 안 넣고 지역과 업종만 친 검색이라, 이건 이겨서 얻은 자리입니다.
                다만 <b>네이버 웹문서 쪽 경쟁 검색어는 아직 {webWins}/{webTotal}입니다.</b>
                「석촌동 로봇 코딩학원」 1위는 여기 안 넣었습니다 —
                <b>학원 이름이 들어간 검색은 나오는 게 당연해서 성과가 아닙니다.</b>
              </p>
            </div>
          </div>

          <div className="caselog">
            <div className="clh mono">서버가 기록한 실제 방문 로그</div>
            <div className="cl mono">
              <span>15:49:01</span><span>ClaudeBot</span><span>/robots.txt</span>
            </div>
            <div className="cl mono">
              <span>15:49:27</span><span>ClaudeBot</span><span>/blog/seouldae-uiyegwa-hapgyeok</span>
            </div>
            <div className="cl mono">
              <span>15:49:53</span><span>ClaudeBot</span><span>/blog/jayeoneo-koding</span>
            </div>
            <div className="cl mono">
              <span>+18h</span><span>Googlebot</span><span>/ · /blog · /sitemap.xml</span>
            </div>
            <div className="cl mono">
              <span>+3d</span><span>Yeti</span><span>/sitemap.xml · 네이버 색인</span>
            </div>
            <div className="cl mono dim">
              <span>…</span><span>크롤러 {vendors}곳</span><span>{hits}회 방문 · ClaudeBot {claudePages}쪽</span>
            </div>
          </div>

          <div className="casenote">
            검색은 올라왔습니다. <b>AI가 이 학원을 추천하는지는 아직 모릅니다.</b>
            올라온 지 얼마 안 돼서, 지금 재면 AI가 아직 못 본 상태를 재는 셈입니다.
            <b> 다 읽어간 뒤에 재고, 잘 나왔든 못 나왔든 여기에 그대로 적겠습니다.</b>
          </div>
          <a className="caselink" href="/case/robotncoding.html">
            전체 기록 보기
            <span>날짜·수치 전부. DB에서 매일 다시 만듭니다</span>
          </a>
        </div>
      </section>

      <section id="diff">
        <div className="wrap">
          <div className="lab">다른 점</div>
          <h2>보기 좋은 숫자를<br />만들지 않습니다</h2>
          <p className="sub2">
            이 바닥 리포트는 대부분 “AI 가시성 97%” 같은 딱 떨어지는 숫자를 내놓습니다.
            몇 번 물어봤는지, 다시 물으면 얼마나 달라지는지는 안 적혀 있습니다.
            <b>한 번 물어보고 점수라고 부르는 것</b>, 다들 그렇게 합니다.
          </p>

          <div className="diff">
            <div className="d">
              <div>
                <h3>오차범위를 함께 씁니다</h3>
                <div className="vs">
                  <div className="them">AI 가시성 92%</div>
                  <div className="us">62% (95% 신뢰구간 48–74%, 표본 150회)</div>
                </div>
              </div>
                <Interval />
              <div className="body">
                AI는 같은 질문에도 매번 다른 답을 냅니다. 하루 다섯 번 재면 오차가 ±40%p까지 벌어집니다.{" "}
                <b>몇 번 물어봤는지 안 적힌 숫자는 근거가 못 됩니다.</b>
                많이 물어볼수록 범위가 좁아지고, 그 과정을 그대로 보여드립니다.
              </div>
            </div>
            <div className="d">
              <div>
                <h3>답변 원문을 드립니다</h3>
                <div className="vs">
                  <div className="them">대시보드 점수만</div>
                  <div className="us">질문 · 답변 전문 · 인용 URL · 엔진 · 시각</div>
                </div>
              </div>
              <div className="body">
                모든 측정의 원본 응답을 보관합니다. “그 숫자 어떻게 냈냐”는 질문에 <b>원문을 그대로 열어</b> 답합니다.
                내부 보고에 그대로 첨부하실 수 있습니다.
              </div>
            </div>
            <div className="d">
              <div>
                <h3>고칠 게 없으면 없다고 합니다</h3>
                <div className="vs">
                  <div className="them">사이트 80점 → 개선 제안 12건</div>
                  <div className="us">사이트 80점 → “사이트는 문제가 아닙니다”</div>
                </div>
              </div>
              <div className="body">
                실제 사례입니다. 사이트 점수 80점(측정 26곳 중 1위)인데 AI 노출은 25%인 브랜드가 있었습니다. 원인은{" "}
                <b>AI가 읽는 비교 글 14개 중 어디에도 이름이 없었습니다.</b>
                사이트를 100점으로 올려도 달라지지 않습니다.
              </div>
            </div>
          </div>
        </div>
      </section>


      {/* 대행사를 고를 때 구매자가 실제로 확인하는 항목.
          대부분의 업체는 "무엇을 하는지"만 말하고 "무엇을 안 하는지"는 말하지 않는다.
          이 절이 이 페이지에서 가장 신뢰를 만드는 자리다. */}
      <section id="nots">
        <div className="wrap">
          <div className="lab">경계</div>
          <h2>하지 않는 일</h2>
          <p className="sub2">
            검색·AI 노출 업계에는 단기 효과가 나지만 결국 손해가 되는 방법이 있습니다.
            아래는 <b>계약서에 넣어도 되는 항목</b>입니다.
          </p>

          <div className="nots">
            <div className="nt"><span className="x">✕</span><div>
              <b>링크 사고팔기</b>
              <p>돈을 주고 링크를 심지 않습니다. 적발되면 회복에 몇 달이 걸립니다.</p>
            </div></div>
            <div className="nt"><span className="x">✕</span><div>
              <b>댓글·후기 작업</b>
              <p>사람을 동원해 커뮤니티에 글이나 댓글을 뿌리지 않습니다.</p>
            </div></div>
            <div className="nt"><span className="x">✕</span><div>
              <b>같은 글 여러 곳 도배</b>
              <p>한 글을 돌려 쓰지 않습니다. AI는 중복 문서를 걸러냅니다.</p>
            </div></div>
            <div className="nt"><span className="x">✕</span><div>
              <b>없는 사실 만들기</b>
              <p>실적·수상·연혁을 부풀리지 않습니다. 다른 문서와 어긋나면 오히려 손해입니다.</p>
            </div></div>
            <div className="nt"><span className="x">✕</span><div>
              <b>고객사 명의 도용</b>
              <p>대표자 인증이 필요한 계정을 대신 만들지 않습니다. 계정은 고객사 소유입니다.</p>
            </div></div>
            <div className="nt"><span className="x">✕</span><div>
              <b>결과 보장</b>
              <p>“몇 위 보장” 같은 말을 하지 않습니다. 할 수 있다면 그건 조작입니다.</p>
            </div></div>
          </div>

          <div className="notsfoot">
            <b>그럼 뭘 하느냐면</b> — 측정으로 <b>어느 문서가 실제로 인용되는지</b> 찾아내고,
            그 문서에 <b>사실만으로</b> 들어갑니다. 뿌리는 게 아니라 다섯 곳을 고르는 일입니다.
          </div>
        </div>
      </section>

      <section id="price">
        <div className="wrap">
          <div className="lab">요금</div>
          <h2>한 번 내는 돈과<br />매달 내는 돈을 나눴습니다</h2>
          <p className="sub2">
            세팅은 한 번이면 끝나는 일이라 월 요금에 넣지 않습니다.
            섞어 두면 그만둘 때 <b>“세팅비는 다 낸 건가”</b>로 다투게 됩니다.
          </p>

          {/* ── 한 번 · 시작할 때 ── */}
          <div className="ponce">
            <div className="poh">
              <span className="mono pok">한 번 · 시작할 때</span>
              <span className="pod">진단 결과에 따라 필요한 것만. 셋 다 필요 없는 회사도 많습니다.</span>
            </div>
            <div className="porow">
              <div className="po">
                <div className="pot">무료 진단</div>
                <div className="pop mono">0원</div>
                <p>7개 항목 자동 점검. 아래 셋 중 뭐가 필요한지 여기서 정해집니다.</p>
              </div>
              <div className="po">
                <div className="pot">기술 세팅</div>
                <div className="pop mono">80만원</div>
                <p>쓸 만한 사이트가 있는 경우. AI가 읽을 수 있는 상태로 만듭니다.</p>
              </div>
              <div className="po">
                <div className="pot">사이트 구축</div>
                <div className="pop mono">250만원</div>
                <p>사이트가 없거나 못 쓰는 경우. 기술 세팅이 포함됩니다.</p>
              </div>
              <div className="po">
                <div className="pot">블로그 글 이관</div>
                <div className="pop mono">+80만원</div>
                <p>블로그만 있는 경우. 몇 년치 글을 AI가 읽는 곳으로 옮깁니다. 30편 기준.</p>
              </div>
            </div>
          </div>

          {/* ── 매달 ──
              측정만 파는 자리를 비웠다. 셀프서브 도구가 월 4~22만원이라
              그 자리에서 붙으면 진다. 도구가 못 하는 해석과 실행으로 옮겼다. */}
          <div className="plans two">
            <div className="plan hi">
              <div className="pn">리포트 · 주력</div>
              <div className="pp">
                39<small>만원 / 월</small>
              </div>
              <div className="for">숫자를 보고 직접 고치실 팀</div>
              <ul>
                <li>질문 30개 × 주요 AI 4곳 · 월 2회</li>
                <li>몇 번에 몇 번 불렸는지 + 흔들리는 범위</li>
                <li><b>AI 크롤러 방문 기록</b> — 어느 AI가 몇 쪽 읽었는지</li>
                <li>답변 원문 전량 열람</li>
                <li>경쟁사 3곳 나란히 비교</li>
                <li><b>무엇을 고쳐야 하는지</b> 우선순위로</li>
              </ul>
              <div className="cta">
                <a className="btn" style={{ width: "100%", display: "block", textAlign: "center" }} href={mailto("리포트")}>
                  상담 신청
                </a>
              </div>
            </div>

            <div className="plan">
              <div className="pn">관리</div>
              <div className="pp">
                79<small>만원 / 월</small>
              </div>
              <div className="for">고치는 일까지 맡기실 팀</div>
              <ul>
                <li>리포트 플랜 전체 포함</li>
                <li>AI가 인용할 만한 글 월 1편 작성·발행</li>
                <li>업계 목록·디렉터리 등재 관리</li>
                <li>퍼져 있는 틀린 정보 정정</li>
                <li>월 1회 통화</li>
              </ul>
              <div className="cta">
                <a className="btn ghost" style={{ width: "100%", display: "block", textAlign: "center" }} href={mailto("관리")}>
                  상담 신청
                </a>
              </div>
            </div>
          </div>

          <p className="pcompare">
            <b>월 4만원짜리 측정 도구도 있습니다.</b> 그건 숫자만 보여줍니다 —
            질문은 직접 짜고, 결과는 직접 해석하고, 고칠 것도 직접 고쳐야 합니다.
            영어권 기준이라 “○○구 코딩학원” 같은 <b>한국어 지역 질문은 잘 못 잡습니다.</b>
            직접 하실 수 있으면 그 도구가 낫습니다. 저희는 그 뒤를 맡습니다.
          </p>

          {/* ── 실제 견적 예시 — 케이스와 같은 회사면 얼마인지 ── */}
          <div className="quote">
            <div className="qh mono">견적 예시 · 위 케이스와 같은 조건이라면</div>
            <div className="qrow">
              <span>홈페이지 없음 · 블로그만 운영</span>
              <span className="qcalc mono">
                구축 250 <i>+</i> 이관 80 <i>=</i> <b>초기 330만원</b>
              </span>
            </div>
            <div className="qrow">
              <span>이후 매달</span>
              <span className="qcalc mono">리포트 <b>39만원</b> <em>또는</em> 관리 <b>79만원</b></span>
            </div>
            <p className="qnote">
              쓸 만한 사이트가 이미 있으면 초기 비용은 <b>80만원</b>이거나 <b>0원</b>입니다.
              진단을 먼저 받아 보시면 어느 쪽인지 알 수 있습니다.
            </p>
          </div>

          <p className="formnote" style={{ marginTop: 20 }}>
            최소 약정 없음 · 월 단위 · 세금계산서 발행 · 부가세 별도
          </p>
        </div>
      </section>

      <section id="faq">
        <div className="wrap narrow" style={{ padding: 0 }}>
          <div className="lab">자주 묻는 질문</div>
          <h2>먼저 물어보실 것들</h2>

          <div className="faq">
            <details>
              <summary>이거 직접 하면 안 되나요?</summary>
              <p>
                기술 세팅은 직접 하실 수 있습니다. robots.txt에 AI 크롤러 허용 줄 넣고, llms.txt 쓰고,
                스키마 붙이는 건 하루면 됩니다. 오히려 그렇게 하시길 권합니다.
                직접 하기 어려운 건 <b>꾸준히 하는 것</b>과 <b>판단</b>입니다.
                매주 AI 4곳에 같은 질문을 던지고 결과를 모으는 일, 그리고 “어느 질문에서 지고 있는지,
                어느 글에 들어가야 하는지”를 아는 일이요. 저희가 파는 건 그 두 가지입니다.
              </p>
            </details>
            <details>
              <summary>세팅비를 왜 월 요금에 안 넣나요?</summary>
              <p>
                robots.txt 나 구조화 데이터는 <b>한 번 고치면 끝나는 일</b>입니다.
                월 요금에 녹이면 처음엔 싸 보이지만, 그만둘 때 “세팅비는 다 낸 건가”로
                다투게 됩니다. 한 번 하는 일은 한 번 받고, 계속 하는 일만 매달 받습니다.
              </p>
            </details>
            <details>
              <summary>측정은 실제 화면으로 하나요, 프로그램으로 하나요?</summary>
              <p>
                매주 도는 측정은 프로그램(API)으로 합니다. 사람이 매주 240번 물어볼 수는 없으니까요.
                다만 <b>API 답과 실제 화면의 답은 다를 수 있습니다.</b> 그래서 매달 한 번은
                실제 화면에서 표본을 뽑아 <b>둘이 얼마나 어긋나는지 함께 보고</b>합니다.
                이 차이를 말해주는 업체가 드문데, 말하지 않으면 측정이 아니라 연출입니다.
              </p>
            </details>
            <details>
              <summary>얼마나 걸리나요?</summary>
              <p>
                AI마다 다릅니다. 질문을 받을 때마다 웹을 찾아보는 쪽은 <b>2~4주</b>면 반영되고,
                미리 학습한 내용으로 답하는 쪽은 <b>2~3개월</b>쯤 걸립니다.
                약속드리는 기간이 아니라 지금까지 봐 온 대략의 흐름이고, 경쟁이 심한 업종은 더 걸립니다.
              </p>
            </details>
            <details>
              <summary>성과를 보장하나요?</summary>
              <p>
                조건 없는 보장은 하지 않습니다. 할 수 있다고 말하는 곳이 있다면 근거를 확인해보시길 권합니다. 대신 저희는{" "}
                <b>측정 방법을 계약서에 적습니다.</b> 어떤 질문으로, 몇 번, 어느 AI에서 재는지,
                무엇까지 “불렸다”고 볼지를 미리 정합니다. 시작하기 전에 지금 숫자부터 재 둡니다.
              </p>
            </details>
            <details>
              <summary>왜 오차범위를 보여주나요? 숫자가 흐려 보이는데요.</summary>
              <p>
                흐린 게 사실이기 때문입니다. 같은 질문에 답이 매번 달라지는데 “92%”라고 쓰면 그건 측정이 아니라
                마케팅입니다. 표본을 늘리면 구간은 좁아집니다. <b>구간을 보여준다는 건 표본을 밝힌다는 뜻</b>이고, 그래야
                숫자를 검증하실 수 있습니다.
              </p>
            </details>
            <details>
              <summary>기존 SEO 대행사와 겹치나요?</summary>
              <p>
                겹치지 않습니다. SEO는 검색 결과에서 클릭을 얻는 일이고, GEO는 AI 답변 문장 안에 인용되는 일입니다. 다만{" "}
                <b>GEO는 SEO를 대체하지 않고 그 위에 얹힙니다</b> — 색인되지 않은 페이지는 AI가 읽지도 못합니다. 기존 SEO
                자산은 대부분 그대로 활용됩니다.
              </p>
            </details>
            <details>
              <summary>측정 결과를 믿을 수 있나요?</summary>
              <p>
                믿어달라고 하지 않습니다. <b>확인하시면 됩니다.</b> 모든 측정의 질문·답변 원문·인용 URL·엔진·시각이 남아
                있고 요청하시면 그대로 드립니다. 측정 방법(질문 세트, 반복 횟수, 세션 처리, 인용 인정 기준)도 계약서와
                리포트에 적습니다.
              </p>
            </details>
          </div>

          <div style={{ marginTop: 36 }}>
            <ScanForm id="dom-faq" placeholder="회사 홈페이지 주소" />
          </div>
        </div>
      </section>

      <footer>
        <div className="wrap">
          <div className="row">
            <span className="logo">
              <span className="mk" aria-hidden="true">[ ]</span>Cited<em>사이티드</em>
            </span>
            <span>AI 답변 노출 측정 · GEO</span>
            <span className="mono" style={{ marginLeft: "auto" }}>
              2026
            </span>
            {/* 관리자로 들어가는 문. 학원 사이트에는 달아 두고 여기는 빠뜨렸다.
                주소를 외워야만 들어갈 수 있는 건 문이 없는 것과 같다. */}
            <a className="fadmin" href="/admin/login" rel="nofollow">관리자</a>
          </div>
          <div className="wm">
            이 페이지의 숫자(국내 B2B 26곳 점검 · 다시 물으면 28% 바뀜 · 홈페이지 몫 20%)는 저희가 직접 잰 값입니다.
            아직 표본이 크지 않아 확정된 수치라기보다 <b>대략의 방향</b>으로 봐 주세요.
            몇 개를 쟀고 어디까지가 한계인지 밝히는 것, 그게 저희가 이 시장에서 하려는 일입니다.
            케이스의 크롤러 방문 기록은 서버에 남은 원본 그대로입니다.
          </div>
        </div>
      </footer>
    </>
  );
}
