import { Fragment } from "react";
import Link from "next/link";
import ScanForm from "./ScanForm";
import ContactForm from "./ContactForm";
import Reveal from "./Reveal";
import SiteNav from "./SiteNav";
import Count from "./Count";
import HeroDemo from "./HeroDemo";
import RecordTabs from "./RecordTabs";
import PriceCalc from "./PriceCalc";
import FlowSteps from "./FlowSteps";
import Faq from "./Faq";
import { SERVICES, PILOT } from "@/lib/services";
import { GUIDES } from "@/lib/guides";
import { readOps } from "@/lib/ops";
import { readPlaceRank } from "@/lib/place";
import "./landing.css";

/**
 * 사는 사람 순서로 읽힌다. (design/cited-landing/Main.dc.html)
 *   이게 뭔데(히어로) → GEO 가 뭔데 → 말만인가(기록) → 뭘 받나(실제 기록 세 장) → 해당되나
 *   → 사이트 점수와 AI 노출은 따로 논다 → 서비스 → 요금 계산 → 진행 → 사례 → 리포트가 다른 점
 *   → 안 하는 것 → 질문 → 신청
 *
 * 받은 말 셋을 반영했다.
 *   「추상적이다」 — 설명 대신 실제로 남긴 기록을 싣는다. 질문 원문, 회사별 횟수, 비교 글 제목, 고친 이유.
 *   「날짜를 특정하지 마라」 — 달력 날짜는 늙는다. 사례는 착수 기준 「N일차」로 적는다.
 *   「재 본다는 말이 어색하다」 — 묻는다·센다·확인한다·진단한다로 쓴다.
 *
 * 사례 학원은 가린다 — 이름·지역·사이트 주소·글 주소. 조합되면 특정된다.
 * 시장 숫자의 출처는 probe/data (사이트 진단 34곳 · ERP 질문 12개로 받은 AI 답 15개(회사당 15회 표본) · 진단 리포트).
 * 28% 는 report.websearch.txt 반복 간 Jaccard 72.2% 의 나머지 — 두 번씩 물은 3문항뿐이라 「자체 측정 3문항 · 표본 작음」을 붙인다.
 * 회사 이름은 A·B·C 로 쓴다. 우리 고객이 아니어도 남의 회사 점수를 이름 붙여 걸지 않는다.
 * 구조화 데이터의 FAQ 는 화면의 질문 그대로다 — 같은 배열을 <Faq> 에 넘긴다.
 * 탭·아코디언에 가려진 내용도 HTML 에는 전부 들어 있다(hidden). 크롤러는 다 읽는다.
 */
const BASE = process.env.NEXT_PUBLIC_SITE_URL || "https://geo-rose-nine.vercel.app";
const CASE_URL = "/case/academy.html";

const FAQ: [string, string][] = [
  ["직접 하면 안 되나요?",
   "기술 세팅은 직접 하실 수 있고 그러시길 권합니다. 어려운 건 AI 네 곳에 같은 질문을 날마다 물어 세는 일과, 경쟁사는 있고 우리만 없는 비교 글을 찾아내는 일입니다. 저희가 파는 건 그 둘을 30일 동안 해 보는 파일럿입니다."],
  ["얼마나 걸리나요?",
   "사례 학원은 착수 넷째 날 네이버 검색에 사이트가 처음 잡혔고, 여섯째 날 학원 이름 없이 친 지역 검색어에 나오기 시작했습니다. AI 답변에 이름이 붙기까지 얼마나 걸리는지는 아직 모릅니다. 결과가 나오면 사례 기록에 그대로 적습니다."],
  ["성과를 보장하나요?",
   "노출·순위·문의를 보장하지 않습니다. 우리가 보장하는 것은 약속한 작업의 수행과 같은 조건의 재측정 보고입니다. 어떤 질문을 어느 AI 에 어떤 방법으로 묻는지 시작 전에 적고, 30일 차에 같은 방법으로 다시 센 결과를 그대로 드립니다."],
  ["중간에 그만두면 돌려받나요?",
   `${PILOT.refund.join(". ")}. ${PILOT.refundNote}`],
  ["숫자를 어떻게 믿나요?",
   "믿어 달라고 하지 않습니다. 질문, 답변 원문, 답에 붙은 출처 주소, 물어본 시각이 전부 남아 있고 요청하시면 그대로 드립니다."],
  ["SEO 대행사와 뭐가 다른가요?",
   "SEO 는 검색 결과에서 클릭을 얻는 일입니다. 이건 AI 답 속에 이름이 나오게 하는 일입니다. 저희가 잰 한 업계에서는 홈페이지 점수가 높은 회사보다 비교 글에 이름이 실린 회사가 AI 답에 더 자주 나왔습니다. 그래서 손볼 곳이 다릅니다. 두 회사를 본 것이라 법칙으로 말하진 않습니다."],
  ["그만두면 뭐가 남나요?",
   "그동안의 답변 원문과 보고서를 드립니다. 사이트를 손봤다면 도메인·저장소·호스팅 계정은 전부 고객사 명의라 그대로 남습니다. 파일럿은 30일로 끝나고, 이어갈지는 그 뒤에 정합니다."],
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
 * chunkIn 은 80~400자 범위에 든 문단 수. 진단기는 800자 넘는 문단을 「너무 길다」로 센다.
 */
const SCAN = { total: 92, baseline: 83, crawler: 100, schema: 100, chunk: 47, chunkIn: 151, chunkAll: 334 };

/**
 * 첫 방문 기록 — 서버 로그. 시각은 한국 시각(KST). 원본은 UTC 로 남아 있어 9시간을 더했다.
 */
const FIRST_VISITS: [string, string, string][] = [
  ["00:49:01", "ClaudeBot", "/robots.txt"],
  ["00:49:27", "ClaudeBot", "/blog/(옮긴 글)"],
  ["00:59:39", "Googlebot", "/robots.txt"],
  ["+26h", "Yeti", "/"],
];

/** 사례 기록 — 공개 케이스 리포트와 같은 내용. 날짜 대신 일차. */
const TIMELINE: [string, string, string][] = [
  ["1일차", "사이트 구축 · 도메인 연결", "AI 크롤러를 이름으로 허용하고 llms.txt 와 구조화 데이터를 붙였습니다."],
  ["1일차", "블로그 글 32편 이관", "AI 크롤러를 막는 블로그에서 사진 69장까지 옮겼습니다."],
  ["2일차", "첫 AI 방문", "0시 49분 ClaudeBot 이 robots.txt 부터 읽었고, 10분 뒤 Googlebot 이 왔습니다."],
  ["2일차", "구글 비즈니스 프로필 등록 · 학원 목록 사이트 등재 신청", "대표자 본인인증이 필요한 항목은 사장님이 직접 했습니다."],
  ["4일차", "네이버 검색에 사이트가 처음 잡힘", "옮긴 글이 네이버 검색 결과에 나오기 시작했습니다."],
  ["6일차", "학원 이름 없이 친 검색어에 첫 노출 · 플레이스 소개글 188자 → 933자", "네이버 통합검색 「○○구 코딩학원」에 사이트가 나왔습니다."],
];

/** 서비스 카드 아래 한 줄. 기간·비용은 값만, 나머지는 「이름 값」. 원본은 lib/services.ts. */
const termLine = (terms: { k: string; v: string }[]) =>
  terms.slice(0, 2).map((t) => (t.k === "기간" || t.k === "비용" ? t.v : `${t.k} ${t.v}`)).join(" · ");

function Check() {
  return (
    <svg className="lp-check" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
  );
}

function Cross() {
  return (
    <svg className="lp-cross" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
  );
}

const R = 35;
const RING = 2 * Math.PI * R; // 219.9

function Gauge({ v, label, note, delay }: { v: number; label: string; note: string; delay: number }) {
  return (
    <div
      className={`lp-gauge${v < 60 ? " low" : ""}`}
      data-reveal={delay}
      style={{ ["--off" as string]: `${(RING * (1 - v / 100)).toFixed(1)}px` }}
    >
      <svg viewBox="0 0 80 80" role="img" aria-label={`${label} ${v}점`}>
        <circle className="trk" cx="40" cy="40" r={R} fill="none" strokeWidth="9" />
        <circle className="arc" cx="40" cy="40" r={R} fill="none" strokeWidth="9" strokeLinecap="round"
          strokeDasharray={RING.toFixed(1)} transform="rotate(-90 40 40)" />
        <text x="40" y="41" textAnchor="middle" dominantBaseline="central">{v}</text>
      </svg>
      <div className="gl">{label}</div>
      <div className="gn">{note}</div>
    </div>
  );
}

export default async function Home() {
  const [ops, place] = await Promise.all([readOps(), readPlaceRank()]);
  // 못 읽은 값은 null 이다. 예전 값을 바닥으로 깔지 않는다 — 그건 지어낸 숫자다(9/22 정정).
  // null 이면 그 칸·그 문장을 숨긴다.
  const vendors = ops.ok ? ops.vendorCount : null;
  const hits = ops.ok ? ops.totalHits : null;
  const posts = ops.ok ? ops.posts.published : null;
  const claudePages = ops.ok ? ops.crawl.vendors.find((v) => /anthropic|claude/i.test(v.vendor))?.pages ?? null : null;
  const crawled = vendors !== null && hits !== null;
  const caseDay = Math.max(1, Math.floor((Date.now() - START) / 86400000) + 1);

  // 경쟁 검색어 집계는 lib/ops.ts 한 곳에 둔다. 여기서 또 세면 대시보드와 갈라진다.
  const webTotal = ops.ok && ops.serp.rivalTotal ? ops.serp.rivalTotal : null;
  const webWins = webTotal !== null ? ops.serp.rivalWon : null;
  // 플레이스는 「구 + 코딩학원」 검색어의 순위. 검색어 자체는 화면에 내지 않는다.
  // 14일 안에 잰 것만, 측정일을 붙여서. 없으면 칸을 숨긴다 (lib/place.ts)
  const placeDay = place ? `${Number(place.day.slice(5, 7))}/${place.day.slice(8, 10)}` : null;

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(SCHEMA) }}
      />
      <Reveal />
      <SiteNav tone="deep" />

      <div className="lp">
        {/* ── 히어로 ── */}
        <header className="lp-hero lp-deep">
          <div className="wrap">
            <HeroDemo>
              <ScanForm id="dom-hero" />
              <div className="lp-herolinks">
                <a href={CASE_URL}>도입 사례 기록 보기 →</a>
                <a href="#price">내 조건으로 요금 계산</a>
              </div>
            </HeroDemo>

            <div className="lp-proof">
              <div className="lp-proof-h"><i className="lp-live g" aria-hidden="true" />도입 사례 · 서버가 기록한 값 · 매일 갱신</div>
              <div className="lp-proof-grid">
                <div className="lp-glass lp-pb">
                  <div className="lp-pb-v"><b>{caseDay}</b><span>일차</span></div>
                  <div className="lp-pb-k">착수일부터 센 날</div>
                </div>
                {vendors !== null && (
                  <div className="lp-glass lp-pb">
                    <div className="lp-pb-v"><b><Count to={vendors} /></b><span>곳</span></div>
                    <div className="lp-pb-k">다녀간 AI·검색 크롤러</div>
                  </div>
                )}
                {hits !== null && (
                  <div className="lp-glass lp-pb">
                    <div className="lp-pb-v"><b><Count to={hits} /></b><span>회</span></div>
                    <div className="lp-pb-k">크롤러 누적 방문</div>
                  </div>
                )}
                {posts !== null && (
                  <div className="lp-glass lp-pb">
                    <div className="lp-pb-v"><b><Count to={posts} /></b><span>편</span></div>
                    <div className="lp-pb-k">AI 가 읽을 수 있게 된 글</div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* ── GEO 란 ── */}
        <section id="geo" className="lp-sec lp-white">
          <div className="wrap">
            <div className="lp-lab">GEO 가 뭔가요</div>
            <h2 className="lp-h2">검색 결과의 링크가 아니라<br /><span className="hl">답변 문장 안의 이름</span></h2>
            <p className="lp-define">
              손님이 ChatGPT 에 「아이 보낼 영어학원 추천해줘」라고 물으면, 링크 목록 대신 학원 이름 몇 개가 답으로 나옵니다.
              그 답에 우리 이름이 들어가게 만드는 일이 <b>GEO(생성형 엔진 최적화)</b>입니다.
              AI 는 우리 홈페이지만 보고 답하지 않습니다. <b>비교 글, 후기, 업체 목록</b>을 같이 읽고 이름을 고릅니다.
            </p>

            <div className="lp-vs">
              <div className="lp-vs-seo">
                <div className="lp-vs-hd">
                  <h3>검색 최적화 (SEO)</h3>
                  <span className="lp-pill">링크 열 개</span>
                </div>
                <div className="lp-mock lp-mock-seo" aria-hidden="true">
                  {[62, 48, 70, 40, 56].map((w, i) => (
                    <div key={i}><i /><span className="ln" style={{ width: `${w}%` }} /></div>
                  ))}
                </div>
                <dl className="lp-vs-dl">
                  <dt>얻는 것</dt><dd>검색 결과에서 클릭</dd>
                  <dt>손님 눈에 보이는 것</dt><dd>링크 열 개</dd>
                  <dt>손봐야 할 곳</dt><dd>우리 홈페이지</dd>
                  <dt>잘됐는지 보는 법</dt><dd>검색해서 순위 확인</dd>
                </dl>
              </div>

              <div className="lp-vs-geo">
                <div className="lp-vs-hd">
                  <h3>AI 답변 노출 (GEO)</h3>
                  <span className="lp-pill sky">추천 이름 두세 개</span>
                </div>
                <div className="lp-mock lp-mock-geo" aria-hidden="true">
                  <span className="ln" style={{ width: "58%" }} />
                  <div className="names">
                    <span className="nm">① A 학원</span>
                    <span className="nm">② B 학원</span>
                    <span className="nm us">③ 우리 학원?</span>
                  </div>
                  <span className="ln dim" style={{ width: "42%" }} />
                </div>
                <dl className="lp-vs-dl">
                  <dt>얻는 것</dt><dd>AI 답 속에 이름이 나옴</dd>
                  <dt>손님 눈에 보이는 것</dt><dd>추천 이름 두세 개</dd>
                  <dt>손봐야 할 곳</dt><dd>홈페이지와 AI 가 읽는 남의 글</dd>
                  <dt>잘됐는지 보는 법</dt><dd>같은 질문을 날마다 해서 몇 번 중 몇 번 나오는지</dd>
                </dl>
              </div>
            </div>

            <p className="lp-note">
              그래서 홈페이지를 잘 만들어도 비교 글과 목록에 이름이 없으면 답에서 빠집니다.
              반대로 홈페이지는 허술한데 여기저기 이름이 올라 있는 회사가 자주 나옵니다. <b>아래에 실제 기록이 있습니다.</b>{" "}
              SEO 를 이미 맡긴 곳이 있다면 그대로 두셔도 됩니다.
            </p>
          </div>
        </section>

        {/* ── 말 대신 기록 ── */}
        <section id="proof" className="lp-sec lp-ground">
          <div className="wrap lp-2col">
            <div>
              <div className="lp-lab">말 대신 기록</div>
              <h2 className="lp-h2">사례 학원 사이트,<br /><span className="hl">7개 항목 중 6개가 90점 넘게</span></h2>
              <p className="lp-sub">
                착수 첫날 새로 지은 사이트가 {SCAN.baseline}점이었고, 첫 주에 고친 뒤 다시 돌린 결과입니다.
                <b>채점 기준 바뀜(2026-09-29)</b> — 무료 진단은 이날부터 llms.txt 를 점수에서 뺍니다. 아래는 그 전 기준(llms.txt 포함 7개 항목)으로 잰 값이라 지금 무료 진단 점수와 바로 견주지 않습니다.
              </p>
              <div className="lp-gauges">
                <Gauge v={SCAN.total} label="종합" note={`착수 때 ${SCAN.baseline}`} delay={0} />
                <Gauge v={SCAN.crawler} label="AI 크롤러 접근" note="봇 이름으로 허용" delay={120} />
                <Gauge v={SCAN.schema} label="구조화 데이터" note="6쪽 전부 · 오류 0" delay={240} />
                <Gauge v={SCAN.chunk} label="인용할 만한 문단" note={`80~400자 ${SCAN.chunkIn}/${SCAN.chunkAll}`} delay={360} />
              </div>
              <div className="lp-warn">
                <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 8v5M12 16.5v.01" /></svg>
                <p>
                  <b>문단 점수 {SCAN.chunk}은 아직 못 고친 부분입니다.</b>{" "}
                  80~400자 범위에 든 문단이 {SCAN.chunkAll}개 중 {SCAN.chunkIn}개입니다.
                  AI 가 잘라 가져가기 좋은 길이가 절반이 안 된다는 뜻입니다. 잘된 칸만 골라 싣지 않습니다.
                </p>
              </div>
            </div>

            <div className="lp-code">
              <div className="lp-code-hd mono"><span className="d" aria-hidden="true"><i /><i /><i /></span>robots.txt · 사례 학원</div>
              <pre className="mono">
<span className="c"># AI 크롤러를 User-agent 별로 명시 허용한다.</span>{"\n"}
<span className="c"># 네이버 블로그는 GPTBot·ClaudeBot 같은 AI 크롤러를 막는다.</span>{"\n\n"}
<span className="k">User-agent:</span> <span className="v">OAI-SearchBot</span>{"\n"}
<span className="k">Allow:</span> /{"\n\n"}
<span className="k">User-agent:</span> <span className="v">GPTBot</span>{"\n"}
<span className="k">Allow:</span> /{"\n\n"}
<span className="k">User-agent:</span> <span className="v">ClaudeBot</span>{"\n"}
<span className="k">Allow:</span> /{"\n\n"}
<span className="k">User-agent:</span> <span className="v">PerplexityBot</span>{"\n"}
<span className="k">Allow:</span> /{"\n"}
<span className="c"># … 이하 생략</span>
              </pre>
              <div className="lp-code-ft">
                <div className="lp-code-log mono">
                  {FIRST_VISITS.map(([t, b, p]) => (
                    <Fragment key={t}>
                      <span>{t}</span><span className="b">{b}</span><span className="p">{p}</span>
                    </Fragment>
                  ))}
                </div>
                <span className="lp-passed">
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
                  {crawled ? `서버 기록 · 크롤러 ${vendors}곳 · ${hits}회` : "서버 기록 · 확인 중"}
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* ── 맡기면 받는 것 ── */}
        <section id="why" className="lp-sec lp-white">
          <div className="wrap">
            <div className="lp-lab">맡기면 받는 것</div>
            <h2 className="lp-h2">리포트에 들어가는 것을<br /><span className="hl">실제 기록</span>으로 보여 드립니다</h2>
            <p className="lp-sub">
              아래 세 장은 실제로 남긴 기록입니다. 앞의 두 장은 소프트웨어 회사 한 곳을 진단한 리포트,
              마지막 장은 사례 학원의 작업 기록입니다. 회사 이름은 가렸습니다.
            </p>
            <RecordTabs />
          </div>
        </section>

        {/* ── 해당하는 곳 ── */}
        <section id="who" className="lp-sec lp-ground">
          <div className="wrap">
            <div className="lp-lab">해당하는 곳</div>
            <h2 className="lp-h2">손님이 고르기 전에<br />한 번은 물어보는 업종이면 됩니다</h2>
            <p className="lp-sub">
              학원, 병원·치과, 세무·법무 사무소, 인테리어, 소프트웨어 회사.
              계약하기 전에 「어디가 괜찮아?」를 누군가에게 묻는 곳입니다. 그 질문을 AI 에게 하는 손님도 있습니다.
            </p>
            <div className="lp-fit">
              <div className="lp-card yes">
                <h3><span className="ic"><Check /></span>이런 곳에 맞습니다</h3>
                <ul>
                  <li><b>지역 이름과 업종으로 검색되는 곳</b> — 「○○구 코딩학원」「△△동 치과」</li>
                  <li><b>비교당하는 곳</b> — 손님이 서너 군데 견주고 고르는 업종</li>
                  <li><b>밖에 내놓을 사실이 있는 곳</b> — 연차·건수·가격·방식처럼 적을 수 있는 것</li>
                </ul>
              </div>
              <div className="no">
                <h3><span className="ic"><Cross /></span>이런 곳은 안 맞습니다</h3>
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
        <section id="data" className="lp-sec lp-deep">
          <div className="wrap">
            <div className="lp-lab">직접 측정한 것 · 소프트웨어 회사 34곳</div>
            <h2 className="lp-h2">사이트 점수와 AI 노출은<br /><span className="hl">따로 움직였습니다</span></h2>
            <p className="lp-sub">
              국내 소프트웨어 회사 34곳의 홈페이지를 진단했습니다. 그중 한 업계는 AI 에게 직접 물어 회사마다 몇 번 나오는지도 셌습니다.
              <b>회사당 15회 표본</b>이라 방향으로만 봐 주세요.
            </p>

            <div className="lp-glass lp-split">
              <div className="lp-split-grid">
                <div>
                  <div className="lp-co-hd"><b>홈페이지 19점 회사</b><span>비교 글 14개 중 9개에 이름</span></div>
                  <div className="lp-co-bars" data-reveal="0">
                    <span className="k">홈페이지</span>
                    <span className="tr" aria-hidden="true"><i style={{ ["--w" as string]: "19%" }} /></span>
                    <span className="v mono">19점</span>
                    <span className="k me">AI 답 노출</span>
                    <span className="tr" aria-hidden="true"><i className="sky" style={{ ["--w" as string]: "53%" }} /></span>
                    <span className="v sky mono">8/15</span>
                  </div>
                </div>
                <div>
                  <div className="lp-co-hd"><b>홈페이지 80점 회사</b><span>비교 글 14개 중 0개에 이름</span></div>
                  <div className="lp-co-bars" data-reveal="150">
                    <span className="k">홈페이지</span>
                    <span className="tr" aria-hidden="true"><i style={{ ["--w" as string]: "80%" }} /></span>
                    <span className="v mono">80점</span>
                    <span className="k me">AI 답 노출</span>
                    <span className="tr" aria-hidden="true"><i className="sky" style={{ ["--w" as string]: "20%" }} /></span>
                    <span className="v sky mono">3/15</span>
                  </div>
                </div>
              </div>
              <p className="lp-split-foot">
                그래서 일이 둘로 나뉩니다. 사이트를 AI 가 <b>읽을 수 있게</b> 만드는 일과, AI 가 참고하는 비교 글·목록에 이름을 <b>넣는</b> 일.
                사이트 점수가 가장 높아도 뒤엣것이 없으면 답에 안 나옵니다.
              </p>
            </div>

            <div className="lp-stats">
              <div className="lp-glass lp-stat">
                <div className="v"><b><Count to={7} /></b><span>/34</span></div>
                <p>60점을 넘긴 홈페이지. 절반인 <b>17곳은 40점 아래</b>였고 AI 크롤러 접근이 0점인 곳도 있었습니다.</p>
              </div>
              <div className="lp-glass lp-stat">
                <div className="v"><b><Count to={28} /></b><span>%</span></div>
                <p>같은 질문을 한 번 더 했을 때 바뀐 추천 목록. <b>자체 측정 3문항 · 표본 작음 · 방향 신호</b>입니다. 그래도 한 번 물어보고 「몇 위」라 적는 건 동전 한 번 던진 것입니다.</p>
              </div>
            </div>
          </div>
        </section>

        {/* ── 서비스 ── */}
        <section id="services" className="lp-sec lp-white lp-sec-svc">
          <div className="wrap">
            <div className="lp-lab">서비스</div>
            <h2 className="lp-h2">처음부터 <span className="hl">전부 맡기실 필요는</span> 없습니다</h2>
            <p className="lp-sub">
              시작은 30일 파일럿 하나입니다. 측정이 그 중심입니다. 아래 나머지는 파일럿 뒤 선택이고, 파일럿을 끝낸 곳에만 안내합니다.
              이미 쓸 만한 홈페이지가 있다면 새로 만들 필요도 없습니다.
            </p>
            <div className="lp-svcs">
              {SERVICES.map((sv) => (
                <Link className="lp-card lp-hov lp-svc" key={sv.slug} href={`/services/${sv.slug}`}>
                  <div className="lp-svc-hd">
                    <span className="mono no">{sv.no}</span>
                    <span className="tag">{sv.tag}</span>
                  </div>
                  <h3>{sv.name}</h3>
                  <div className="q">{sv.question}</div>
                  <p>{sv.short}</p>
                  <ul>
                    {sv.does.slice(0, 3).map((d) => <li key={d.t}><Check />{d.t}</li>)}
                  </ul>
                  <div className="terms">{termLine(sv.terms)}</div>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* ── 요금 ── */}
        <section id="price" className="lp-sec lp-ground lp-sec-price">
          <div className="wrap">
            <div className="lp-lab">요금</div>
            <h2 className="lp-h2">30일 파일럿<br /><span className="hl">하나로 시작합니다</span></h2>
            <p className="lp-sub">
              값은 {PILOT.price} 하나입니다. 30일 동안 할 일과 중간에 그만두실 때 돌려드리는 돈을 여기 그대로 적었습니다.
              같은 내용을 입금 전에 서면으로 드립니다.
            </p>
            <PriceCalc />
            <p className="lp-pcompare">
              공개 가격이 있는 국내 GEO 대행사 1곳 기준 월 500만원입니다(<a href="https://maily.so/georank/posts/32z8d2l1rn4" target="_blank" rel="noopener noreferrer">출처</a>). 저희는 <b>학원·병원·사무소 한 곳 규모</b>에 맞췄습니다.
              더 싼 해외 측정 도구도 있습니다. 대신 질문을 직접 짜고, 결과를 직접 읽고, 직접 고쳐야 합니다.
              영어권 도구라 「○○구 코딩학원」 같은 한국어 지역 질문도 직접 넣으셔야 합니다.
              <b> 직접 하실 수 있으면 그 도구가 낫습니다.</b>
            </p>
          </div>
        </section>

        {/* ── 진행 ── */}
        <section id="how" className="lp-sec lp-white">
          <div className="wrap">
            <div className="lp-lab">진행</div>
            <h2 className="lp-h2">30일을 이렇게 씁니다</h2>
            <p className="lp-sub">
              첫 7일로 지금 숫자를 남기고, 30일 차에 같은 질문으로 다시 셉니다. 그 사이가 일입니다.
            </p>
            <FlowSteps />
            <p className="lp-flownote">
              기준선 보고는 <b>착수 뒤 7일 안</b>에 나갑니다. 플레이스·구글 비즈니스 프로필처럼 대표자 인증이 필요한 곳은
              사장님이 권한을 열어 주셔야 진행됩니다.
            </p>
          </div>
        </section>

        {/* ── 도입 사례 ── */}
        <section id="case" className="lp-sec lp-deep">
          <div className="wrap">
            <div className="lp-lab">도입 사례 · 수도권 코딩·로봇 학원 · {caseDay}일차</div>
            <h2 className="lp-h2">홈페이지 없이<br />블로그만 있던 학원</h2>
            <p className="lp-sub">
              학원 이름과 지역은 가렸습니다. 숫자는 <b>서버 기록에서 매일 다시 가져오고</b>, 안 오른 숫자도 같은 크기로 싣습니다.
            </p>

            <div className="lp-case">
              {webTotal !== null && (
              <div className="lp-glass lp-cx hi">
                <div className="lp-cx-hd">
                  <span>경쟁 검색어 · 착수 때 → 지금</span>
                  <b>0 → <Count to={webWins} /> / {webTotal}</b>
                </div>
                <p>
                  「○○구 코딩학원」처럼 <b>학원 이름 없이</b> 친 검색 {webTotal}개입니다.
                  착수 때는 위쪽이 전부 오늘학교·순위닷 같은 학원 목록 사이트였고 학원 홈페이지는 한 곳도 없었습니다.
                </p>
              </div>
              )}
              {place && (
              <div className="lp-glass lp-cx">
                <div className="lp-cx-hd">
                  <span>네이버 플레이스 · 「○○구 코딩학원」 · {placeDay} 측정</span>
                  <b><Count to={place.rank} />위</b>
                </div>
                <p>
                  네이버 AI 가 이 학원을 <b>「무선 인터넷과 남녀 구분 화장실을 제공합니다」</b>라고 소개하고 있었습니다.
                  소개글 188자가 대부분 의무 게시 안내문이었습니다. 933자로 다시 썼습니다.
                </p>
              </div>
              )}
              {crawled && (
              <div className="lp-glass lp-cx">
                <div className="lp-cx-hd">
                  <span>다녀간 크롤러 · {caseDay}일차</span>
                  <b><Count to={vendors} />곳 · <Count to={hits} />회</b>
                </div>
                <p>
                  처음 한 시간 안에 온 곳은 Anthropic 과 구글 두 곳이었습니다. 네이버 블로그는 GPTBot·ClaudeBot 을 막아서
                  <b> 쌓아 둔 글 32편이 AI 에겐 없는 글</b>이었습니다. 사진 69장까지 막히지 않은 곳으로 옮겼습니다.
                </p>
              </div>
              )}
              <div className="lp-glass lp-cx hi">
                <div className="lp-cx-hd">
                  <span>AI 답변 인용 · 첫 기준선</span>
                  <b>0 / 8</b>
                </div>
                <p>
                  검색을 켠 AI 한 곳에 학부모 질문 8개를 한 번씩 물었습니다. 이 학원 사이트를 출처로 단 답은 <b>0개</b>였습니다.
                  학원 이름이 나온 답 2개의 출처는 <b>학원 목록 사이트</b>였습니다.
                </p>
              </div>
            </div>

            <div className="lp-case2">
              <div>
                <div className="lp-minih">날짜별로 한 일</div>
                <ol className="lp-tl">
                  {TIMELINE.map(([d, t, p]) => (
                    <li key={d + t}>
                      <span className="d mono">{d}</span>
                      <b>{t}</b>
                      <p>{p}</p>
                    </li>
                  ))}
                </ol>
              </div>
              <div>
                <div className="lp-minih">서버가 기록한 실제 방문 로그</div>
                <div className="lp-log mono">
                  {FIRST_VISITS.map(([t, b, p]) => (
                    <div key={t}><span>{t}</span><span>{b}</span><span>{p}</span></div>
                  ))}
                  {crawled && (
                    <div className="dim"><span>…</span><span>{vendors}곳</span><span>{hits}회 방문{claudePages !== null && ` · ClaudeBot ${claudePages}쪽`}</span></div>
                  )}
                </div>
                <a className="lp-caselink" href={CASE_URL}>
                  전체 기록 보기
                  <span>이름·지역을 가린 원본 →</span>
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* ── 리포트가 다른 점 ── */}
        <section id="diff" className="lp-sec lp-white">
          <div className="wrap">
            <div className="lp-lab">리포트가 다른 점</div>
            <h2 className="lp-h2">보기 좋은 숫자를<br />만들지 않습니다</h2>
            <p className="lp-sub">
              「AI 가시성 97%」 같은 딱 떨어지는 숫자는 몇 번 물었는지가 빠져 있기 쉽습니다. 저희 리포트는 이렇게 적습니다.
            </p>
            <div className="lp-diff2">
              <div className="lp-card flat">
                <h3>답변 원문을 드립니다</h3>
                <div className="them">대시보드 점수만</div>
                <div className="us">질문 · 답변 전문 · 답에 붙은 출처 · 엔진 · 시각</div>
                <p>「그 숫자 어떻게 냈냐」에 원문을 열어 답합니다. 내부 보고에 그대로 붙이실 수 있습니다.</p>
              </div>
              <div className="lp-card flat">
                <h3>고칠 게 없으면 없다고 합니다</h3>
                <div className="them">사이트 80점 → 개선 제안 12건</div>
                <div className="us">사이트 80점 → 「사이트는 됐는데 안 불립니다」</div>
                <p>위에서 본 사이트 점수가 가장 높은 회사의 실제 진단 결론입니다. 대신 경쟁 3사는 있고 이 회사만 빠진 비교 글 세 곳을 먼저 들어갈 곳으로 적었습니다.</p>
              </div>
            </div>
          </div>
        </section>

        {/* ── 하지 않는 일 ── */}
        <section id="nots" className="lp-sec lp-ground">
          <div className="wrap">
            <div className="lp-lab">하지 않는 일</div>
            <h2 className="lp-h2">계약서에 넣어도 되는 네 줄</h2>
            <p className="lp-sub">
              이 바닥에는 몇 달은 효과가 나고 그 뒤에 손해가 되는 방법이 있습니다. 안 씁니다.
            </p>
            <div className="lp-nots">
              {[
                ["링크를 사지 않습니다", "적발되면 회복에 몇 달이 걸립니다. 그 몇 달의 손해는 고객사가 집니다."],
                ["댓글·후기를 만들지 않습니다", "사람을 동원해 커뮤니티에 글을 뿌리거나 같은 글을 여러 곳에 돌리지 않습니다. AI 는 중복을 걸러냅니다."],
                ["없는 사실을 쓰지 않습니다", "실적·수상·연혁을 부풀리지 않습니다. 다른 글과 어긋나면 AI 가 다른 회사로 봅니다."],
                ["계정을 대신 만들지 않습니다", "대표자 인증이 필요한 계정은 고객사 소유입니다. 열어만 주시면 됩니다."],
              ].map(([t, p]) => (
                <div className="lp-card flat lp-nt" key={t}>
                  <span className="x"><Cross /></span>
                  <div>
                    <h3>{t}</h3>
                    <p>{p}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── 더 읽을 것 ──
            랜딩에 본문을 다 옮기면 지난주에 반으로 줄인 것이 도로아미타불이다.
            대신 가는 길을 놓는다. 검색어를 먹는 자리는 랜딩이 아니라 이 페이지들이다. */}
        <section id="guides" className="lp-sec lp-white">
          <div className="wrap">
            <div className="lp-lab">더 읽을 것</div>
            <h2 className="lp-h2">궁금한 것만 골라<br /><span className="hl">따로 읽으셔도 됩니다</span></h2>
            <p className="lp-sub">
              상담에서 자주 나오는 다섯 가지를 따로 적었습니다.
              남의 시장 전망이나 출처를 확인하지 못한 통계는 빼고, 저희가 직접 잰 숫자만 실었습니다.
            </p>
            <div className="lp-nots">
              {GUIDES.map((g) => (
                <Link className="lp-card flat lp-hov" key={g.slug} href={`/geo/${g.slug}`}>
                  <h3>{g.title}</h3>
                  <p>{g.short}</p>
                </Link>
              ))}
            </div>
            <p className="lp-note" style={{ marginTop: 20 }}>
              <Link href="/geo" style={{ color: "#B5760A", fontWeight: 700 }}>가이드 전체 보기 →</Link>
            </p>
          </div>
        </section>

        {/* ── 자주 묻는 것 ── */}
        <section id="faq" className="lp-sec lp-white">
          <div className="wrap lp-faqwrap">
            <div className="lp-lab">자주 묻는 것</div>
            <h2 className="lp-h2">상담에서 먼저 나오는 질문</h2>
            <Faq items={FAQ} />
          </div>
        </section>

        {/* ── 시작 ── */}
        <section id="start" className="lp-sec lp-deep lp-start">
          <div className="wrap">
            <div className="lp-start-hd">
              <div className="lp-lab">시작</div>
              <h2 className="lp-h2">홈페이지 주소부터<br /><span className="hl">넣어 보세요</span></h2>
              <p className="lp-sub">
                AI 가 읽을 수 있는 상태인지 점수가 바로 나옵니다(7개 항목을 보고, llms.txt 는 참고로만 보여 드립니다).
                그다음이 필요하면 아래에 남겨 주세요. 홈페이지가 없어도 됩니다.
              </p>
            </div>

            <div className="lp-panel">
              <h3>무료 진단</h3>
              <p className="ps">주소만 넣으면 됩니다. 연락처는 결과를 본 뒤에 남기셔도 됩니다.</p>
              <ScanForm id="dom-start" placeholder="회사 홈페이지 주소" />
            </div>

            <div className="lp-panel" id="contact">
              <h3>상담 신청</h3>
              <p className="ps">어떻게 알고 오셨는지 꼭 여쭙니다. 저희 일이 실제로 닿았는지 알 방법이 그것뿐입니다.</p>
              <ContactForm />
            </div>
            <p className="lp-start-foot">메일로 답장드립니다. 영업 전화는 하지 않습니다.</p>
          </div>
        </section>

        <footer className="lp-foot">
          <div className="wrap">
            <div className="grid">
              <div>
                <span className="logo"><span className="mk" aria-hidden="true">[ ]</span>Cited<em>사이티드</em></span>
                <p className="desc">손님이 AI 에게 물었을 때 우리 이름이 나오는지 확인하고, 나오게 만듭니다.</p>
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
                  <li><a href="/#how">30일 진행 순서</a></li>
                  <li><a href="/#price">요금</a></li>
                </ul>
              </div>
            </div>
            <div className="wm">
              이 페이지의 시장 숫자(홈페이지 34곳 진단 · 한 업계 질문을 AI 에게 15번 물은 결과 · 회사당 15회 표본)는 저희가 직접 측정한 값입니다.
              표본이 작아 <b>대략의 방향</b>으로 봐 주세요. 사례의 방문 기록은 서버에 남은 원본이고, 학원 이름과 지역만 가렸습니다.
            </div>
            <div className="bottom">
              <span>© 2026 Cited 사이티드</span>
              <span>AI 답변 노출 · GEO</span>
              <a className="admin" href="/admin/login" rel="nofollow">관리자</a>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}
