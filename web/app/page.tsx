import ScanForm from "./ScanForm";
import AskForm from "./AskForm";
import Reveal from "./Reveal";
import SiteNav from "./SiteNav";
import Count from "./Count";
import ChatDemo from "./ChatDemo";
import Link from "next/link";
import { SERVICES } from "@/lib/services";
import { readOps } from "@/lib/ops";

/**
 * 사는 사람 순서로 읽힌다.
 *   이게 뭔데 → 뭘 받나 → 해당되나 → 왜 홈페이지만으론 안 되나 → 진행 → 사례 → 요금 → 안 하는 것 → 신청
 *
 * 한 칸에 한 문장. 설명은 각 서비스 페이지와 사례 페이지로 내린다.
 * 전 판은 한글 12,000자였다. 읽기 전에 나간다.
 *
 * 구조화 데이터의 FAQ 는 화면의 질문 그대로다.
 */
const BASE = process.env.NEXT_PUBLIC_SITE_URL || "https://geo-rose-nine.vercel.app";

const FAQ: [string, string][] = [
  ["직접 하면 안 되나요?",
   "기술 세팅은 직접 하실 수 있고 그러시길 권합니다. 매주 AI 4곳에 같은 질문을 던져 세는 일과 어느 글에 들어갈지 고르는 일이 어렵습니다. 저희가 파는 건 그 둘입니다."],
  ["얼마나 걸리나요?",
   "웹을 찾아보고 답하는 AI 는 2~4주, 학습한 내용으로 답하는 AI 는 2~3개월쯤. 약속이 아니라 지금까지 본 흐름입니다."],
  ["성과를 보장하나요?",
   "안 합니다. 대신 어떤 질문으로 몇 번 어느 AI 에서 재는지를 계약서에 적고, 시작 전 숫자와 두 달 뒤 숫자를 그대로 드립니다."],
  ["SEO 대행사와 뭐가 다른가요?",
   "SEO 는 검색 결과에서 클릭을 얻는 일, 이건 AI 답변 안에 이름이 들어가는 일입니다. AI 가 참고하는 글의 대부분이 자사 사이트 밖에 있어서 그 지면에 들어가는 일이 다릅니다."],
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
  const caseDay = Math.max(1, Math.floor((Date.now() - START) / 86400000) + 1);

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
              AI는 <b>세 곳만</b> 답합니다. 그 세 곳에 드는 일을 합니다.
            </p>
            <ScanForm id="dom-hero" />
          </div>

          <div>
            <ChatDemo />
          </div>
        </div>
      </header>

      <section id="why">
        <div className="wrap">
          <div className="lab">맡기면 받는 것</div>
          <h2>숫자 세 개</h2>

          <div className="whys">
            <article className="w" data-reveal="0">
              <div className="wq">지금 불리고 있나</div>
              <div className="wa">20번 물어 3번 나오면 15%. <b>짐작이 아니라 센 숫자.</b></div>
              <div className="wb mono">
                <span className="wbar" data-reveal="260"><i style={{ ["--w" as string]: "15%" }} /></span>
                <span>15% · 20회 중 3회</span>
              </div>
            </article>

            <article className="w" data-reveal="110">
              <div className="wq">왜 안 나오나</div>
              <div className="wa">사이트를 <b>못 읽어서</b>인지, AI가 보는 남의 글에 <b>우리가 없어서</b>인지.</div>
              <div className="wb mono">
                <span className="wsplit" data-reveal="360"><i className="a" style={{ ["--w" as string]: "20%" }} /><i className="b" style={{ ["--w" as string]: "80%" }} /></span>
                <span>홈페이지 20% · 남의 글 80%</span>
              </div>
            </article>

            <article className="w" data-reveal="220">
              <div className="wq">고친 게 먹혔나</div>
              <div className="wa">두 달 뒤 <b>같은 질문으로 다시</b> 잽니다. 안 올랐으면 안 올랐다고.</div>
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
            <b>「몇 위 보장」은 없습니다.</b> AI 답은 물을 때마다 바뀝니다. 그래서 여러 번 묻고 몇 번 물었는지 같이 적습니다.
          </p>
        </div>
      </section>

      <section id="who">
        <div className="wrap">
          <div className="lab">해당하는 곳</div>
          <h2>손님이 고르기 전에<br />한 번은 물어보는 업종</h2>

          <div className="fit">
            <div className="fitc">
              <div className="fith">맞습니다</div>
              <ul>
                <li>학원 · 병원 · 치과 · 세무·법무 사무소 · 인테리어 · 소프트웨어</li>
                <li>「○○구 코딩학원」처럼 지역과 업종으로 검색되는 곳</li>
                <li>손님이 서너 군데 견주고 고르는 곳</li>
              </ul>
            </div>
            <div className="fitc no">
              <div className="fith">안 맞습니다</div>
              <ul>
                <li>이름을 알고 찾아오는 브랜드</li>
                <li>한 번 사고 끝나는 물건</li>
                <li>밖에 내놓을 사실이 없는 회사</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section className="deep" id="data">
        <div className="wrap">
          <div className="lab">직접 잰 것 · 국내 26곳</div>
          <h2>홈페이지를 고쳐서 얻는 몫은<br />다섯 중 하나</h2>

          <div className="facts">
            <div className="fact">
              <div className="stat">
                <span className="v">
                  <Count to={20} /><small style={{ fontSize: 20, fontWeight: 400 }}>%</small>
                </span>
                <span className="bandbar"><i style={{ left: "20%" }} /></span>
                <span className="c">홈페이지가 차지한 몫</span>
              </div>
              <div className="t">나머지 80%는 비교 글, 커뮤니티, 업계 목록. <b>남이 쓴 글</b>입니다.</div>
            </div>
            <div className="fact">
              <div className="stat">
                <span className="v">
                  <Count to={5} /><small style={{ fontSize: 20, fontWeight: 400 }}> / 26</small>
                </span>
                <span className="bandbar"><i style={{ left: "19%" }} /></span>
                <span className="c">AI가 읽을 수 있는 사이트</span>
              </div>
              <div className="t"><b>업계 1위라는 회사가 30점.</b> 아무도 확인해 본 적이 없어서입니다.</div>
            </div>
            <div className="fact">
              <div className="stat">
                <span className="v">
                  <Count to={28} /><small style={{ fontSize: 20, fontWeight: 400 }}>%</small>
                </span>
                <span className="bandbar"><i style={{ left: "28%" }} /></span>
                <span className="c">두 번 물으면 바뀌는 추천</span>
              </div>
              <div className="t">한 번 재고 「1위」라 적는 건 <b>동전 한 번 던진 것</b>입니다.</div>
            </div>
          </div>

          <div className="casenote">
            그래서 일이 둘입니다. 사이트를 <b>읽히게</b> 만들기, 남의 글 다섯 곳에 이름 <b>넣기</b>. 뒤엣것이 큽니다.
          </div>
        </div>
      </section>

      <section id="how">
        <div className="wrap">
          <div className="lab">진행</div>
          <h2>두 달</h2>

          <div className="steps">
            <div className="step">
              <div className="n">1주차</div>
              <h3>지금 숫자를 남깁니다</h3>
              <p>손님이 쓸 질문 30개 · AI 4곳 · 사이트 7항목 점검</p>
            </div>
            <div className="step">
              <div className="n">2~3주차</div>
              <h3>읽히게 만듭니다</h3>
              <p>크롤러 허용 · llms.txt · 구조화 데이터 · 방문 기록 장치</p>
            </div>
            <div className="step">
              <div className="n">4~8주차</div>
              <h3>남의 글에 들어갑니다</h3>
              <p>경쟁사는 있고 우리만 없는 다섯 곳 · 등재 · 정정 · 글 1편</p>
            </div>
            <div className="step">
              <div className="n">8주차</div>
              <h3>같은 질문으로 다시 잽니다</h3>
              <p>오른 것 · 안 오른 것 · 거절당한 지면까지 그대로</p>
            </div>
          </div>

          <p className="sub2" style={{ marginTop: 40 }}>넷 중 <b>필요한 것만</b>. 대부분은 측정부터.</p>
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
          <div className="lab">도입 사례 · 송파구 코딩·로봇 학원 · {caseDay}일차</div>
          <h2>홈페이지 없이 블로그만 있던 학원</h2>
          <p className="sub2">숫자는 서버 기록에서 매일 다시 가져옵니다.</p>

          <div className="case">
            <div className="cx hi">
              <div className="cxh">
                <span className="lab2">경쟁 검색어 노출</span>
                <span className="mono cxn">0 → <Count to={webWins} /> / {webTotal}</span>
              </div>
              <p>「송파구 코딩학원」처럼 <b>학원 이름 없이</b> 친 검색 6개. 시작할 땐 하나도 없었습니다.</p>
            </div>
            <div className="cx">
              <div className="cxh">
                <span className="lab2">네이버 플레이스 · 「송파구 코딩학원」</span>
                <span className="mono cxn"><Count to={songpaRank} />위</span>
              </div>
              <p>소개글 188자를 933자로. AI가 그 글을 읽고 학원을 설명합니다.</p>
            </div>
            <div className="cx">
              <div className="cxh">
                <span className="lab2">AI가 읽은 비율 · 1일차</span>
                <span className="mono cxn"><Count to={91.2} decimals={1} suffix="%" /></span>
              </div>
              <p>34쪽 중 31쪽. 첫 방문까지 2시간. 지금까지 <b>{vendors}곳 · {hits}회</b>.</p>
            </div>
            <div className="cx hi">
              <div className="cxh">
                <span className="lab2">AI 답변 인용 · 09.10</span>
                <span className="mono cxn">0 / 8</span>
              </div>
              <p>아직 0. 이름이 나온 답 하나의 출처는 <b>남의 글</b>이었습니다. 2~4주 뒤 다시 잽니다.</p>
            </div>
          </div>

          <a className="caselink" href="/case/robotncoding.html">
            전체 기록 보기
            <span>날짜·수치 전부</span>
          </a>
        </div>
      </section>

      <section id="nots">
        <div className="wrap">
          <div className="lab">하지 않는 일</div>
          <h2>계약서에 넣어도 되는 네 줄</h2>

          <div className="nots">
            <div className="nt"><span className="x">✕</span><div>
              <b>링크를 사지 않습니다</b>
            </div></div>
            <div className="nt"><span className="x">✕</span><div>
              <b>댓글·후기를 만들지 않습니다</b>
            </div></div>
            <div className="nt"><span className="x">✕</span><div>
              <b>없는 사실을 쓰지 않습니다</b>
            </div></div>
            <div className="nt"><span className="x">✕</span><div>
              <b>계정을 대신 만들지 않습니다</b>
            </div></div>
          </div>
        </div>
      </section>

      <section id="price">
        <div className="wrap">
          <div className="lab">요금</div>
          <h2>한 번 내는 돈, 매달 내는 돈</h2>

          <div className="ponce">
            <div className="poh">
              <span className="mono pok">한 번 · 시작할 때</span>
              <span className="pod">진단 결과에 따라 필요한 것만</span>
            </div>
            <div className="porow">
              <div className="po">
                <div className="pot">진단</div>
                <div className="pop mono">0원</div>
                <p>7개 항목 자동 점검</p>
              </div>
              <div className="po">
                <div className="pot">기술 세팅</div>
                <div className="pop mono">80만원</div>
                <p>쓸 만한 사이트가 있을 때</p>
              </div>
              <div className="po">
                <div className="pot">사이트 구축</div>
                <div className="pop mono">250만원</div>
                <p>없거나 못 쓸 때. 세팅 포함</p>
              </div>
              <div className="po">
                <div className="pot">블로그 글 이관</div>
                <div className="pop mono">+80만원</div>
                <p>30편 기준</p>
              </div>
            </div>
          </div>

          <div className="plans two">
            <div className="plan hi">
              <div className="pn">리포트</div>
              <div className="pp">39<small>만원 / 월</small></div>
              <div className="for">숫자를 보고 직접 고치실 팀</div>
              <ul>
                <li>질문 30개 × AI 4곳 · 월 2회</li>
                <li>AI 방문 기록</li>
                <li>답변 원문 전량</li>
                <li>경쟁사 3곳 비교</li>
                <li>고칠 곳 다섯, 순서대로</li>
              </ul>
              <div className="cta"><AskForm wants="리포트" compact /></div>
            </div>

            <div className="plan">
              <div className="pn">관리</div>
              <div className="pp">79<small>만원 / 월</small></div>
              <div className="for">고치는 일까지 맡기실 팀</div>
              <ul>
                <li>리포트 전부</li>
                <li>글 월 1편 작성·발행</li>
                <li>목록·디렉터리 등재</li>
                <li>틀린 정보 정정</li>
                <li>월 1회 통화</li>
              </ul>
              <div className="cta"><AskForm wants="관리" compact /></div>
            </div>
          </div>

          <p className="pcompare">
            대기업용 GEO 컨설팅은 월 500만원부터. 저희는 <b>학원·병원·사무소 한 곳 규모</b>에 맞췄습니다.
          </p>

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
          <h2>홈페이지 주소부터</h2>
          <ScanForm id="dom-start" placeholder="회사 홈페이지 주소" />
          <div style={{ marginTop: 36 }}>
            <div className="lab" style={{ marginBottom: 12 }}>홈페이지가 없어도 됩니다</div>
            <AskForm wants="상담" />
            <p className="formnote">메일로 답장드립니다. 영업 전화는 하지 않습니다.</p>
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
            <span className="mono" style={{ marginLeft: "auto" }}>2026</span>
            <a className="fadmin" href="/admin/login" rel="nofollow">관리자</a>
          </div>
          <div className="wm">
            이 페이지의 숫자는 저희가 직접 잰 값입니다. 표본이 아직 작아 <b>대략의 방향</b>으로 봐 주세요.
          </div>
        </div>
      </footer>
    </>
  );
}
