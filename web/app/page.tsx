import ScanForm from "./ScanForm";
import AskForm from "./AskForm";
import Reveal from "./Reveal";
import SiteNav from "./SiteNav";
import Interval from "./Interval";
import Count from "./Count";
import ChatDemo from "./ChatDemo";
import Link from "next/link";
import { SERVICES } from "@/lib/services";
import { readOps } from "@/lib/ops";

/**
 * 이 페이지는 사는 사람 순서로 읽힌다.
 *   이게 뭔데 → 나한테 해당되나 → 맡기면 뭘 받나 → 왜 홈페이지만으론 안 되나
 *   → 어떻게 진행되나 → 증거 → 얼마 → 안 하는 것 → 질문 → 신청
 *
 * 전 판은 오차범위·표본·보장 없음을 여섯 번 넘게 말했다. 우리 양심을 달래는 글이지
 * 사는 사람을 위한 글이 아니었다. 그 말은 이제 한 자리에서 한 번만 한다.
 *
 * 구조화 데이터의 FAQ 는 화면의 질문 그대로다. 화면과 다르면 신뢰가 깎인다.
 */
const BASE = process.env.NEXT_PUBLIC_SITE_URL || "https://geo-rose-nine.vercel.app";

const FAQ: [string, string][] = [
  ["직접 하면 안 되나요?",
   "기술 세팅은 직접 하실 수 있고 그러시길 권합니다. 하루면 됩니다. 직접 하기 어려운 건 매주 AI 4곳에 같은 질문을 던져 세는 일과, 어느 글에 들어가야 하는지 고르는 일입니다. 저희가 파는 건 그 둘입니다."],
  ["얼마나 걸리나요?",
   "질문마다 웹을 찾아보는 AI 는 2~4주, 미리 학습한 내용으로 답하는 AI 는 2~3개월쯤 걸립니다. 약속이 아니라 지금까지 본 흐름이고, 경쟁이 센 업종은 더 걸립니다."],
  ["성과를 보장하나요?",
   "안 합니다. 대신 어떤 질문으로, 몇 번, 어느 AI 에서 재는지를 계약서에 적고 시작 전에 지금 숫자를 남깁니다. 두 달 뒤 같은 방법으로 다시 잰 결과를 그대로 드립니다."],
  ["숫자를 어떻게 믿나요?",
   "믿어 달라고 하지 않습니다. 질문·답변 원문·참고한 주소·시각이 전부 남아 있고 요청하시면 그대로 드립니다."],
  ["SEO 대행사와 뭐가 다른가요?",
   "SEO 는 검색 결과에서 클릭을 얻는 일이고, 이건 AI 답변 문장 안에 이름이 들어가는 일입니다. AI 가 참고하는 글의 대부분이 자사 사이트 밖에 있어서, 그 지면에 들어가는 일이 다릅니다. 기존 SEO 자산은 그대로 씁니다."],
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

export default async function Home() {
  const ops = await readOps();
  // DB 가 막혀도 랜딩이 0 을 띄우면 안 된다. 마지막으로 확인한 값을 바닥으로 쓴다.
  const vendors = ops.ok && ops.vendorCount ? ops.vendorCount : 8;
  const hits = ops.ok && ops.totalHits ? ops.totalHits : 460;
  const claudePages = ops.crawl.vendors.find((v) => /claude/i.test(v.vendor))?.pages ?? 102;
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

      <header className="hero">
        <div className="wrap hero-grid">
          <div>
            <div className="eyebrow">AI 답변 노출 · GEO</div>
            <h1>손님이 AI에게 물었을 때<br />우리 이름이 나옵니까?</h1>
            <p className="lede">
              검색창 맨 위에 AI 답이 먼저 뜹니다. 링크를 누르기 전에 <b>세 곳이 정해집니다.</b><br />
              그 세 곳에 드는 일을 합니다. 지금 드는지부터 재 드립니다.
            </p>
            <ScanForm id="dom-hero" />
          </div>

          <div>
            <ChatDemo />
          </div>
        </div>
      </header>

      {/* 「그래서 뭘 받는데」를 히어로 바로 다음에 답한다.
          방법론부터 말하면 사는 사람은 이해하기 전에 나간다. */}
      <section id="why">
        <div className="wrap">
          <div className="lab">맡기면 받는 것</div>
          <h2>세 가지를<br />숫자로 받습니다</h2>

          <div className="whys">
            <article className="w" data-reveal="0">
              <div className="wq">지금 불리고 있나</div>
              <div className="wa">
                손님이 쓸 질문 30개를 AI 4곳에 여러 번 묻습니다.
                20번 물어 3번 나오면 15%. <b>짐작이 아니라 센 숫자</b>입니다.
              </div>
              <div className="wb mono">
                <span className="wbar" data-reveal="260"><i style={{ ["--w" as string]: "15%" }} /></span>
                <span>15% · 20회 중 3회</span>
              </div>
            </article>

            <article className="w" data-reveal="110">
              <div className="wq">왜 안 나오나</div>
              <div className="wa">
                둘 중 하나입니다. AI가 우리 사이트를 <b>못 읽거나</b>, AI가 참고하는
                남의 글에 <b>우리가 없거나.</b> 어느 쪽인지 갈라서 고칠 곳 다섯 개를 순서대로 드립니다.
              </div>
              <div className="wb mono">
                <span className="wsplit" data-reveal="360"><i className="a" style={{ ["--w" as string]: "20%" }} /><i className="b" style={{ ["--w" as string]: "80%" }} /></span>
                <span>홈페이지 20% · 남의 글 80%</span>
              </div>
            </article>

            <article className="w" data-reveal="220">
              <div className="wq">고친 게 먹혔나</div>
              <div className="wa">
                시작할 때 숫자를 남기고 <b>두 달 뒤 같은 질문으로 다시 잽니다.</b>
                안 올랐으면 안 올랐다고 적습니다.
              </div>
              <div className="wb mono">
                <span className="wdelta">
                  <span className="d0">0%</span>
                  <span className="darrow">→</span>
                  <span className="d1">?</span>
                </span>
                <span>시작할 때 · 두 달 뒤</span>
              </div>
            </article>
          </div>

          <p className="whyfoot">
            <b>「몇 위 보장」은 없습니다.</b> AI 답은 물을 때마다 바뀝니다.
            그 약속을 하는 곳이 있으면 어떻게 재는지 물어보세요.
          </p>
        </div>
      </section>

      <section id="who">
        <div className="wrap">
          <div className="lab">해당하는 곳</div>
          <h2>손님이 고르기 전에<br />한 번은 물어보는 업종이면 됩니다</h2>
          <p className="sub2">
            학원, 병원·치과, 세무·법무 사무소, 인테리어, 소프트웨어 회사.
            계약하기 전에 「어디가 괜찮아?」를 누군가에게 묻는 곳입니다. 그 누군가가 AI로 바뀌고 있습니다.
          </p>

          <div className="fit">
            <div className="fitc">
              <div className="fith">이런 곳에 맞습니다</div>
              <ul>
                <li>지역 이름과 업종으로 검색되는 곳 — 「○○구 코딩학원」「△△동 치과」</li>
                <li>비교당하는 곳 — 손님이 서너 군데 견주고 고르는 업종</li>
                <li>밖에 내놓을 사실이 있는 곳 — 연차·건수·가격·방식처럼 적을 수 있는 것</li>
              </ul>
            </div>
            <div className="fitc no">
              <div className="fith">이런 곳은 안 맞습니다</div>
              <ul>
                <li>이름을 이미 알고 찾아오는 브랜드 — 제품명으로 검색되면 이 일이 필요 없습니다</li>
                <li>한 번 사고 끝나는 물건 — 묻지 않고 삽니다</li>
                <li>적을 사실이 없는 회사 — 할 말이 없으면 들어갈 글도 없습니다</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section className="deep" id="data">
        <div className="wrap">
          <div className="lab">직접 잰 것</div>
          <h2>홈페이지를 고쳐서 얻는 몫은<br />다섯 중 하나였습니다</h2>
          <p className="sub2">
            국내 B2B 사이트 26곳을 점검하고, 실제 구매자가 쓸 질문을 AI에 던졌습니다.
            AI가 답하며 참고한 글 중 자사 홈페이지는 20%. 나머지는 비교 글, 커뮤니티, 업계 목록이었습니다.
          </p>

          <div className="facts">
            <div className="fact">
              <div className="stat">
                <span className="v">
                  <Count to={20} /><small style={{ fontSize: 20, fontWeight: 400 }}>%</small>
                </span>
                <span className="bandbar">
                  <i style={{ left: "20%" }} />
                </span>
                <span className="c">홈페이지가 차지한 몫 · 21곳</span>
              </div>
              <div className="t">
                나머지 80%는 <b>남이 쓴 글</b>에서 왔습니다.
                홈페이지를 100점으로 만들어도 이 80%는 안 움직입니다.
              </div>
            </div>
            <div className="fact">
              <div className="stat">
                <span className="v">
                  <Count to={5} /><small style={{ fontSize: 20, fontWeight: 400 }}> / 26</small>
                </span>
                <span className="bandbar">
                  <i style={{ left: "19%" }} />
                </span>
                <span className="c">AI가 읽을 수 있는 사이트</span>
              </div>
              <div className="t">
                60점을 넘긴 곳이 다섯뿐이었습니다. <b>업계 1위라는 회사가 30점</b>이었습니다.
                어려운 기술이 없어서가 아니라 아무도 확인해 본 적이 없어서입니다.
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
                <span className="c">두 번 물으면 바뀌는 추천</span>
              </div>
              <div className="t">
                같은 질문을 다시 하면 추천 목록의 28%가 바뀝니다.
                <b>한 번 재고 「1위」라 적는 건 동전 한 번 던진 것</b>입니다. 그래서 여러 번 묻습니다.
              </div>
            </div>
          </div>

          <div className="casenote">
            그래서 일이 둘로 나뉩니다. 사이트를 <b>읽히게</b> 만드는 일과, 남의 글 다섯 곳에 이름을 <b>넣는</b> 일.
            뒤엣것이 큽니다. 홈페이지만 고쳐 주고 끝내는 곳이 많은데, 그러면 점수는 오르는데 답변에는 안 나옵니다.
          </div>
        </div>
      </section>

      <section id="how">
        <div className="wrap">
          <div className="lab">진행</div>
          <h2>두 달을 이렇게 씁니다</h2>
          <p className="sub2">
            첫 주에 지금 숫자를 남기고, 마지막 주에 같은 방법으로 다시 잽니다. 그 사이가 일입니다.
          </p>

          <div className="steps">
            <div className="step">
              <div className="n">1주차</div>
              <h3>지금 숫자를 남깁니다</h3>
              <p>
                손님이 쓸 질문 30개를 만듭니다. AI 4곳에 여러 번 묻고 몇 번 중 몇 번 나왔는지 셉니다.
                사이트는 7개 항목으로 점검합니다. 이게 기준선입니다.
              </p>
            </div>
            <div className="step">
              <div className="n">2~3주차</div>
              <h3>읽히게 만듭니다</h3>
              <p>
                크롤러 허용, llms.txt, 구조화 데이터. 서버에 방문 기록 장치를 답니다 —
                어느 AI가 언제 몇 쪽 읽어 갔는지 여기서 처음 보입니다.
              </p>
            </div>
            <div className="step">
              <div className="n">4~8주차</div>
              <h3>남의 글에 들어갑니다</h3>
              <p>
                AI가 참고한 글을 거꾸로 찾습니다. 경쟁사는 있는데 우리만 없는 다섯 곳을 골라
                등록하고, 요청하고, 틀린 정보를 바로잡습니다. AI가 가져다 쓸 글 한 편을 씁니다.
              </p>
            </div>
            <div className="step">
              <div className="n">8주차</div>
              <h3>같은 질문으로 다시 잽니다</h3>
              <p>
                오른 것, 안 오른 것, 거절당한 지면까지 그대로 적습니다.
                답변 원문과 참고한 주소를 전부 붙입니다. 다음 두 달에 뭘 할지 여기서 정합니다.
              </p>
            </div>
          </div>

          <p className="sub2" style={{ marginTop: 44 }}>
            넷 중 <b>필요한 것만</b> 삽니다. 대부분은 측정부터 시작합니다. 나머지는 재 본 뒤에 정해도 됩니다.
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
          <div className="lab">첫 레퍼런스 · {caseDay}일차</div>
          <h2>우리 학원으로<br />먼저 해봤습니다</h2>
          <p className="sub2">
            {/*
              직접 운영하는 학원이라는 걸 먼저 밝힌다.
              「첫 고객사」라고만 적으면 나중에 알려졌을 때 앞의 숫자까지 의심받는다.
              밝히고 나면 오히려 강해진다 — 남에게 팔기 전에 자기 것으로 먼저 해봤다는 뜻이다.
            */}
            <b>저희가 직접 운영하는 코딩·로봇 학원입니다.</b> 남에게 권하기 전에 우리 것으로 했습니다.
            홈페이지가 없고 블로그만 있었습니다. 아래 숫자는 <b>서버 기록에서 매일 다시 가져옵니다.</b>
          </p>

          <div className="case">
            <div className="cx hi">
              <div className="cxh">
                <span className="lab2">경쟁 검색어 · 09.05 → {serpDay}</span>
                <span className="mono cxn">0 → <Count to={webWins} /> / {webTotal}</span>
              </div>
              <p>
                「송파구 코딩학원」처럼 <b>학원 이름 없이</b> 지역과 업종만 친 검색 6개입니다.
                시작할 때 하나도 없었습니다. 위쪽은 전부 학원 목록 사이트였습니다.
                학원 이름을 넣은 검색은 여기 안 셉니다 — 나오는 게 당연해서 성과가 아닙니다.
              </p>
            </div>
            <div className="cx">
              <div className="cxh">
                <span className="lab2">네이버 플레이스 · 「송파구 코딩학원」</span>
                <span className="mono cxn"><Count to={songpaRank} />위</span>
              </div>
              <p>
                네이버에서 학부모가 실제로 보는 자리입니다. 검색창 아래 지도에 붙는 목록.
                소개글이 188자였습니다. AI가 그걸 읽고 학원을 설명하고 있었습니다. 933자로 다시 썼습니다.
              </p>
            </div>
            <div className="cx">
              <div className="cxh">
                <span className="lab2">AI가 읽은 비율 · 1일차</span>
                <span className="mono cxn"><Count to={91.2} decimals={1} suffix="%" /></span>
              </div>
              <p>
                주소를 연결하고 2시간 뒤 AI가 처음 왔습니다. 하루 만에 <b>34쪽 중 31쪽</b>을 읽어 갔습니다.
                이건 검색 콘솔에 안 나옵니다. 서버에 기록 장치를 달아야 보입니다.
              </p>
            </div>
            <div className="cx">
              <div className="cxh">
                <span className="lab2">다녀간 크롤러 · {caseDay}일차</span>
                <span className="mono cxn"><Count to={vendors} />곳 · <Count to={hits} />회</span>
              </div>
              <p>
                첫날은 2곳이었습니다. 어느 AI가 언제 왔는지 전부 남습니다.
                국내 블로그 플랫폼은 GPTBot·ClaudeBot 을 막아서 <b>7년치 글 32편이 AI에겐 없는 글</b>이었습니다.
                막히지 않은 곳으로 옮겼습니다.
              </p>
            </div>
            <div className="cx hi">
              <div className="cxh">
                <span className="lab2">AI 답변 인용 · 09.10</span>
                <span className="mono cxn">0 / 8</span>
              </div>
              <p>
                학부모 질문 8개 중 우리 사이트를 출처로 단 답은 <b>아직 0개</b>입니다.
                이름이 나온 답이 하나 있었는데, 출처가 우리 사이트가 아니라 <b>남의 글</b>이었습니다.
                위에서 말한 80%가 이겁니다. AI 하나로 한 번씩 잰 기준선이라 2~4주 뒤 더 넓게 다시 잽니다. 결과가 어떻든 여기 적습니다.
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
              <span>+18h</span><span>Googlebot</span><span>/ · /blog · /sitemap.xml</span>
            </div>
            <div className="cl mono">
              <span>+3d</span><span>Yeti</span><span>/sitemap.xml · 네이버 색인</span>
            </div>
            <div className="cl mono dim">
              <span>…</span><span>크롤러 {vendors}곳</span><span>{hits}회 방문 · ClaudeBot {claudePages}쪽</span>
            </div>
          </div>

          <a className="caselink" href="/case/robotncoding.html">
            전체 기록 보기
            <span>날짜·수치 전부. DB에서 매일 다시 만듭니다</span>
          </a>
        </div>
      </section>

      <section id="diff">
        <div className="wrap">
          <div className="lab">리포트가 다른 점</div>
          <h2>보기 좋은 숫자를<br />만들지 않습니다</h2>
          <p className="sub2">
            「AI 가시성 97%」 같은 딱 떨어지는 숫자는 대개 한 번 물어본 결과입니다.
            저희 리포트는 이렇게 생겼습니다.
          </p>

          <div className="diff">
            <div className="d">
              <div>
                <h3>몇 번 물었는지 같이 씁니다</h3>
                <div className="vs">
                  <div className="them">AI 가시성 92%</div>
                  <div className="us">62% (150회 · 흔들리는 범위 48~74%)</div>
                </div>
              </div>
              <Interval />
              <div className="body">
                하루 다섯 번 재면 오차가 ±40%p까지 벌어집니다. 많이 물을수록 범위가 좁아지고,
                그 과정을 그대로 보여드립니다. 흐려 보이면 그게 사실입니다.
              </div>
            </div>
            <div className="d">
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
            <div className="d">
              <div>
                <h3>고칠 게 없으면 없다고 합니다</h3>
                <div className="vs">
                  <div className="them">사이트 80점 → 개선 제안 12건</div>
                  <div className="us">사이트 80점 → “사이트는 문제가 아닙니다”</div>
                </div>
              </div>
              <div className="body">
                사이트 점수 80점(26곳 중 1위)인데 AI 노출은 25%인 곳이 있었습니다.
                AI가 읽는 비교 글 14개 중 어디에도 이름이 없었습니다. 사이트를 더 고쳐도 안 달라집니다.
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 무엇을 안 하는지는 한 번만, 여기서. */}
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
              <p>적발되면 회복에 몇 달이 걸립니다.</p>
            </div></div>
            <div className="nt"><span className="x">✕</span><div>
              <b>댓글·후기를 만들지 않습니다</b>
              <p>사람을 동원해 커뮤니티에 글을 뿌리거나 같은 글을 여러 곳에 돌리지 않습니다. AI는 중복을 걸러냅니다.</p>
            </div></div>
            <div className="nt"><span className="x">✕</span><div>
              <b>없는 사실을 쓰지 않습니다</b>
              <p>실적·수상·연혁을 부풀리지 않습니다. 다른 글과 어긋나면 AI가 다른 회사로 봅니다.</p>
            </div></div>
            <div className="nt"><span className="x">✕</span><div>
              <b>계정을 대신 만들지 않습니다</b>
              <p>대표자 인증이 필요한 계정은 고객사 소유입니다. 열어만 주시면 됩니다.</p>
            </div></div>
          </div>
        </div>
      </section>

      <section id="price">
        <div className="wrap">
          <div className="lab">요금</div>
          <h2>한 번 내는 돈과<br />매달 내는 돈을 나눴습니다</h2>
          <p className="sub2">
            세팅은 한 번이면 끝나서 월 요금에 안 넣습니다. 섞어 두면 그만둘 때
            「세팅비는 다 낸 건가」로 다투게 됩니다.
          </p>

          <div className="ponce">
            <div className="poh">
              <span className="mono pok">한 번 · 시작할 때</span>
              <span className="pod">진단 결과에 따라 필요한 것만. 셋 다 필요 없는 회사도 많습니다.</span>
            </div>
            <div className="porow">
              <div className="po">
                <div className="pot">진단</div>
                <div className="pop mono">0원</div>
                <p>7개 항목을 자동으로 봅니다. 아래 셋 중 뭐가 필요한지 여기서 정해집니다.</p>
              </div>
              <div className="po">
                <div className="pot">기술 세팅</div>
                <div className="pop mono">80만원</div>
                <p>쓸 만한 사이트가 있는 경우. AI가 읽을 수 있게 만들고 방문 기록 장치를 답니다.</p>
              </div>
              <div className="po">
                <div className="pot">사이트 구축</div>
                <div className="pop mono">250만원</div>
                <p>사이트가 없거나 못 쓰는 경우. 기술 세팅이 들어 있습니다.</p>
              </div>
              <div className="po">
                <div className="pot">블로그 글 이관</div>
                <div className="pop mono">+80만원</div>
                <p>블로그만 있는 경우. 몇 년치 글을 AI가 읽는 곳으로 옮깁니다. 30편 기준.</p>
              </div>
            </div>
          </div>

          <div className="plans two">
            <div className="plan hi">
              <div className="pn">리포트</div>
              <div className="pp">
                39<small>만원 / 월</small>
              </div>
              <div className="for">숫자를 보고 직접 고치실 팀</div>
              <ul>
                <li>질문 30개 × AI 4곳 · 월 2회</li>
                <li>몇 번 중 몇 번 불렸는지 + 흔들리는 범위</li>
                <li>AI 방문 기록 — 어느 AI가 몇 쪽 읽었는지</li>
                <li>답변 원문 전량</li>
                <li>경쟁사 3곳 나란히</li>
                <li>고칠 곳 다섯 개, 순서대로</li>
              </ul>
              <div className="cta">
                <AskForm wants="리포트" compact />
              </div>
            </div>

            <div className="plan">
              <div className="pn">관리</div>
              <div className="pp">
                79<small>만원 / 월</small>
              </div>
              <div className="for">고치는 일까지 맡기실 팀</div>
              <ul>
                <li>리포트 전부</li>
                <li>AI가 가져다 쓸 글 월 1편 작성·발행</li>
                <li>업계 목록·디렉터리 등재</li>
                <li>퍼져 있는 틀린 정보 정정</li>
                <li>월 1회 통화</li>
              </ul>
              <div className="cta">
                <AskForm wants="관리" compact />
              </div>
            </div>
          </div>

          <p className="pcompare">
            대기업 대상 GEO 컨설팅은 월 500만원부터 시작합니다. 저희는 <b>학원·병원·사무소 한 곳 규모</b>에 맞췄습니다.
            월 4만원짜리 측정 도구도 있는데, 질문을 직접 짜고 결과를 직접 읽고 직접 고쳐야 합니다.
            영어권 기준이라 「○○구 코딩학원」 같은 한국어 지역 질문은 잘 못 잡습니다.
            직접 하실 수 있으면 그 도구가 낫습니다.
          </p>

          <div className="quote">
            <div className="qh mono">견적 예시 · 위 레퍼런스와 같은 조건이라면</div>
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
              진단을 먼저 받아 보시면 어느 쪽인지 나옵니다.
            </p>
          </div>

          <p className="formnote" style={{ marginTop: 20 }}>
            최소 약정 없음 · 월 단위 · 세금계산서 발행 · 부가세 별도
          </p>
        </div>
      </section>

      <section id="faq">
        <div className="wrap narrow" style={{ padding: 0 }}>
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

      <section id="start">
        <div className="wrap narrow" style={{ padding: 0 }}>
          <div className="lab">시작</div>
          <h2>홈페이지 주소부터<br />넣어 보세요</h2>
          <p className="sub2">
            30초 안에 AI가 읽을 수 있는 상태인지 나옵니다. 그다음이 필요하면 아래에 연락처를 남겨 주세요.
          </p>
          <ScanForm id="dom-start" placeholder="회사 홈페이지 주소" />
          <div style={{ marginTop: 36 }}>
            <div className="lab" style={{ marginBottom: 12 }}>홈페이지가 없어도 됩니다</div>
            <AskForm wants="상담" />
            <p className="formnote">
              메일로 답장드립니다. 영업 전화는 하지 않습니다.
            </p>
          </div>
        </div>
      </section>

      <footer>
        <div className="wrap">
          <div className="row">
            <span className="logo">
              <span className="mk" aria-hidden="true">[ ]</span>Cited<em>사이티드</em>
            </span>
            <span>AI 답변 노출 · GEO</span>
            <span className="mono" style={{ marginLeft: "auto" }}>
              2026
            </span>
            <a className="fadmin" href="/admin/login" rel="nofollow">관리자</a>
          </div>
          <div className="wm">
            이 페이지의 숫자(26곳 점검 · 다시 물으면 28% 바뀜 · 홈페이지 몫 20%)는 저희가 직접 잰 값입니다.
            표본이 아직 크지 않아 확정치가 아니라 <b>대략의 방향</b>으로 봐 주세요.
            레퍼런스의 방문 기록은 서버에 남은 원본 그대로입니다.
          </div>
        </div>
      </footer>
    </>
  );
}
