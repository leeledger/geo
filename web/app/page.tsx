import ScanForm from "./ScanForm";

const MAIL = "hello@example.co.kr";
const mailto = (kind: string) =>
  `mailto:${MAIL}?subject=${encodeURIComponent(`[사이트밴드] ${kind} 신청`)}` +
  `&body=${encodeURIComponent(`홈페이지 주소: \n회사명: \n담당자: \n연락처: \n\n요청: ${kind}\n`)}`;

export default function Home() {
  return (
    <>
      <nav>
        <div className="wrap">
          <span className="logo">
            사이트<em>밴드</em>
          </span>
          <span className="links">
            <a href="#how">작동 방식</a>
            <a href="#data">실측 데이터</a>
            <a href="#diff">다른 점</a>
            <a href="#price">요금</a>
            <a href="#faq">FAQ</a>
          </span>
        </div>
      </nav>

      <header className="hero">
        <div className="wrap hero-grid">
          <div>
            <div className="eyebrow">AI 답변 노출 측정 · GEO</div>
            <h1>ChatGPT는 당신 브랜드를 추천하고 있습니까?</h1>
            <p className="lede">
              고객은 이제 검색창이 아니라 AI에게 묻습니다. 답변에 이름이 없으면 후보에서 아예 빠집니다. 사이트밴드는 그
              노출을 <b>표본과 오차범위까지 붙여</b> 재고, 원인이 사이트인지 남의 문서인지 갈라냅니다.
            </p>
            <ScanForm id="dom-hero" />
          </div>

          <div>
            <figure className="spec">
              <figcaption className="spec-hd">
                <span className="dots">
                  <i /><i /><i />
                </span>
                <span>“중소기업 ERP 세 개만 골라서 비교해줘”</span>
              </figcaption>
              <div className="spec-b">
                <b>1회차</b> — 더존 iCUBE / 영림원 K-System / <mark>도토</mark>
                <br />
                <b>2회차</b> — 더존 iCUBE / 영림원 K-System / <mark>이카운트</mark>
              </div>
              <div className="spec-ft">
                같은 질문 · 같은 날 · <b>3순위가 교체됨</b>
              </div>
            </figure>
            <div className="runs">
              <span>반복 측정</span>
              <span className="chip hit">1</span>
              <span className="chip hit">2</span>
              <span className="chip">3</span>
              <span className="chip hit">4</span>
              <span className="chip">5</span>
              <span className="chip hit">6</span>
              <span className="chip">7</span>
              <span className="chip hit">8</span>
              <span style={{ marginLeft: 6 }}>
                → 노출률은 순위가 아니라 <b style={{ color: "var(--accent)" }}>확률</b>입니다
              </span>
            </div>
          </div>
        </div>
      </header>

      <section className="deep" id="data">
        <div className="wrap">
          <div className="lab">우리가 직접 잰 것</div>
          <h2>추측이 아니라 실측입니다</h2>
          <p className="sub2">
            국내 B2B 업무 솔루션 26곳의 사이트를 점검하고, 실제 구매자가 쓸 법한 질문을 AI에 던져 브랜드 노출을
            측정했습니다.
          </p>

          <div className="facts">
            <div className="fact">
              <div className="stat">
                <span className="v">
                  5<small style={{ fontSize: 20, fontWeight: 400 }}> / 26</small>
                </span>
                <span className="bandbar">
                  <i style={{ left: "19%" }} />
                </span>
                <span className="c">사이트 점검 26곳</span>
              </div>
              <div className="t">
                <b>사이트 GEO 점수 60점을 넘긴 곳은 5곳뿐</b>이었습니다. 시장 1위를 자처하는 그룹웨어가 30점이었습니다.
              </div>
            </div>
            <div className="fact">
              <div className="stat">
                <span className="v">
                  28<small style={{ fontSize: 20, fontWeight: 400 }}>%</small>
                </span>
                <span className="bandbar">
                  <i style={{ left: "28%" }} />
                </span>
                <span className="c">반복 측정 기준</span>
              </div>
              <div className="t">
                같은 질문을 다시 물으면 <b>추천 브랜드의 28%가 바뀝니다.</b> 한 번 조회한 결과를 “순위”라 부르는 리포트는
                소음입니다.
              </div>
            </div>
            <div className="fact">
              <div className="stat">
                <span className="v">
                  20<small style={{ fontSize: 20, fontWeight: 400 }}>%</small>
                </span>
                <span className="bandbar">
                  <i style={{ left: "20%" }} />
                </span>
                <span className="c">설명된 분산 · 브랜드 21곳</span>
              </div>
              <div className="t">
                사이트 점수가 AI 노출을 설명하는 비율은 <b>20%뿐</b>입니다. 나머지 80%는 사이트 밖, 남이 쓴 문서에
                있습니다.
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="how">
        <div className="wrap">
          <div className="lab">작동 방식</div>
          <h2>재고, 원인을 가르고, 순서를 정합니다</h2>
          <div className="steps">
            <div className="step">
              <div className="n">STEP 01</div>
              <h3>진단</h3>
              <p>
                AI 크롤러 접근 허용, 자바스크립트 없이 본문이 나오는지, 구조화 데이터, 문단 길이 등 7개 항목을 코드로
                점검합니다. 브랜드 권위 같은 주관적 항목은 점수에 넣지 않습니다.
              </p>
            </div>
            <div className="step">
              <div className="n">STEP 02</div>
              <h3>측정</h3>
              <p>
                실제 구매자가 쓸 질문 세트를 4개 엔진에 반복 질의합니다. 매번 새 세션으로 개인화를 배제하고,
                노출률·점유율·답변 내 순서를 표본 수와 함께 기록합니다.
              </p>
            </div>
            <div className="step">
              <div className="n">STEP 03</div>
              <h3>판정</h3>
              <p>
                사이트 점수와 노출률을 교차해 <b>원인이 사이트인지, 남의 문서인지</b> 가릅니다. 사이트가 문제가 아니면
                “사이트는 문제가 아닙니다”라고 말합니다.
              </p>
            </div>
            <div className="step">
              <div className="n">STEP 04</div>
              <h3>실행</h3>
              <p>
                AI가 실제로 인용하는 문서를 역추적해, 경쟁사는 실려 있고 당신은 빠진 문서를 우선순위로 제시합니다.
                원하시면 진입과 콘텐츠 제작까지 대행합니다.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section id="diff">
        <div className="wrap">
          <div className="lab">다른 점</div>
          <h2>숫자를 크게 보이게 만들지 않습니다</h2>
          <p className="sub2">
            이 시장의 리포트는 대부분 “AI 가시성 97%” 같은 확정값을 내놓습니다. 표본이 몇 개인지, 오차가 얼마인지는 적지
            않습니다.
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
              <div className="body">
                생성형 AI는 같은 질문에도 매번 다른 답을 냅니다. 하루 5회 측정한 값의 오차는 ±40%p대입니다.{" "}
                <b>표본을 밝히지 않은 단일 숫자는 근거가 아닙니다.</b> 표본을 늘리면 구간이 좁아지고, 그 과정을 그대로
                보여드립니다.
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
                <b>AI가 읽는 비교 문서 14건 중 0건에만 등장</b>한다는 것이었습니다. 사이트를 100점으로 올려도 오르지
                않습니다.
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="price">
        <div className="wrap">
          <div className="lab">요금</div>
          <h2>측정이 포함된 유일한 구간</h2>
          <p className="sub2">
            국내 GEO 대행은 측정 없이 콘텐츠만 발행하는 월 100~300만원대와, 측정을 갖춘 월 500만원 이상으로 갈려 있습니다.
            사이트밴드는 그 사이를 채웁니다.
          </p>

          <div className="plans">
            <div className="plan">
              <div className="pn">진단</div>
              <div className="pp">
                0<small>원</small>
              </div>
              <div className="for">지금 상태를 알고 싶은 분</div>
              <ul>
                <li>사이트 7개 항목 점검</li>
                <li>우선 조치 항목 제시</li>
                <li>가입·결제 없음</li>
                <li>즉시 결과 확인</li>
              </ul>
              <div className="cta">
                <a className="btn ghost" style={{ width: "100%", display: "block", textAlign: "center" }} href="#dom-hero">
                  위에서 바로 받기
                </a>
              </div>
            </div>

            <div className="plan hi">
              <div className="pn">측정 · 주력</div>
              <div className="pp">
                89<small>만원 / 월</small>
              </div>
              <div className="for">실행은 직접 하시는 팀</div>
              <ul>
                <li>질문 60개 × 4엔진 주간 측정</li>
                <li>
                  노출률·점유율·순서 + <b>신뢰구간</b>
                </li>
                <li>답변 원문 전량 열람</li>
                <li>경쟁사 5곳 추적</li>
                <li>인용 소스 분석 · 진입 우선순위</li>
                <li>월간 리포트 · 이상 알림</li>
              </ul>
              <div className="cta">
                <a className="btn" style={{ width: "100%", display: "block", textAlign: "center" }} href={mailto("측정")}>
                  상담 신청
                </a>
              </div>
            </div>

            <div className="plan">
              <div className="pn">측정 + 실행</div>
              <div className="pp">
                249<small>만원 / 월</small>
              </div>
              <div className="for">실행까지 맡기실 팀</div>
              <ul>
                <li>측정 플랜 전체 포함</li>
                <li>기술 세팅 (robots·스키마·llms.txt)</li>
                <li>인용용 콘텐츠 월 2~3건 제작·발행</li>
                <li>제3자 매체 진입 월 1~2건</li>
                <li>사실 오류 정정</li>
                <li>월 1회 전략 리뷰</li>
              </ul>
              <div className="cta">
                <a className="btn ghost" style={{ width: "100%", display: "block", textAlign: "center" }} href={mailto("측정+실행")}>
                  상담 신청
                </a>
              </div>
            </div>

            <div className="plan">
              <div className="pn">엔터프라이즈</div>
              <div className="pp">
                별도<small> 견적</small>
              </div>
              <div className="for">다국어 · 다브랜드 · 대행사</div>
              <ul>
                <li>브랜드 다중 · 계정 분리</li>
                <li>영어·일본어 답변 측정</li>
                <li>화이트라벨 리포트</li>
                <li>데이터 API</li>
              </ul>
              <div className="cta">
                <a className="btn ghost" style={{ width: "100%", display: "block", textAlign: "center" }} href={mailto("엔터프라이즈")}>
                  문의
                </a>
              </div>
            </div>
          </div>
          <p className="formnote" style={{ marginTop: 18 }}>
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
                기술 세팅은 직접 하실 수 있습니다. robots.txt에 AI 크롤러 허용 줄을 넣고, llms.txt를 쓰고, 스키마를 붙이는
                건 하루면 됩니다. 오히려 그렇게 하시길 권합니다. 직접 하기 어려운 건 <b>지속</b>과 <b>판단</b>입니다. 4개
                엔진에 매주 반복 질의해 집계하는 일, 그리고 “어느 질문에서 지고 있고 어느 문서에 들어가야 하는가”를 아는
                일입니다. 저희가 파는 건 그 두 가지입니다.
              </p>
            </details>
            <details>
              <summary>얼마나 걸리나요?</summary>
              <p>
                엔진마다 다릅니다. Perplexity처럼 실시간 검색 비중이 큰 엔진은 2~4주, ChatGPT는 모델 갱신 주기 때문에
                2~3개월가량 걸리는 경향이 있습니다. <b>보장 수치가 아니라 관찰되는 경향</b>이며, 업종 경쟁도와 기존 신뢰
                신호에 따라 달라집니다.
              </p>
            </details>
            <details>
              <summary>성과를 보장하나요?</summary>
              <p>
                조건 없는 보장은 하지 않습니다. 할 수 있다고 말하는 곳이 있다면 근거를 확인해보시길 권합니다. 대신 저희는{" "}
                <b>측정 기준을 계약서에 명시</b>합니다 — 어떤 질문 세트를, 몇 회, 어떤 엔진에서 측정하며, 무엇을 인용으로
                인정하는지. 착수 전 기준선을 먼저 재고 시작합니다.
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
              사이트<em>밴드</em>
            </span>
            <span>AI 답변 노출 측정 · GEO</span>
            <span className="mono" style={{ marginLeft: "auto" }}>
              2026
            </span>
          </div>
          <div className="wm">
            <b>내부 검토용 초안입니다.</b> “사이트밴드”는 가안이며 확정 브랜드명이 아닙니다. 페이지의 실측 수치(26곳 점검 ·
            반복 시 28% 변동 · 설명력 20%)는 자체 측정값이며, 표본이 작아 확정치가 아닌 방향 신호입니다. 대외 발행 전 표본
            확대가 필요합니다.
          </div>
        </div>
      </footer>
    </>
  );
}
