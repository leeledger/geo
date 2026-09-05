import ScanForm from "./ScanForm";
import Reveal from "./Reveal";
import SiteNav from "./SiteNav";
import Interval from "./Interval";
import Count from "./Count";
import Link from "next/link";
import { SERVICES } from "@/lib/services";

const MAIL = "hello@cited.kr";
const mailto = (kind: string) =>
  `mailto:${MAIL}?subject=${encodeURIComponent(`[Cited] ${kind} 신청`)}` +
  `&body=${encodeURIComponent(`홈페이지 주소: \n회사명: \n담당자: \n연락처: \n\n요청: ${kind}\n`)}`;

export default function Home() {
  return (
    <>
      <Reveal />
      <SiteNav />

      <header className="hero">
        <div className="wrap hero-grid">
          <div>
            <div className="eyebrow">AI 답변 노출 측정 · GEO</div>
            <h1>AI가 추천하는 목록에<br />당신 회사가 있습니까?</h1>
            <p className="lede">
              AI는 세 곳만 말합니다. 거기 없으면 <b>비교 대상에도 오르지 못합니다.</b><br />
              지금 몇 번에 한 번 불리는지 재고, <b>왜 안 불리는지</b> 찾아냅니다.
            </p>
            <ScanForm id="dom-hero" />
          </div>

          <div>
            {/* 히어로는 방법이 아니라 문제를 보여준다.
                오차막대·표본 같은 방법론은 "다른 점" 절로 내렸다.
                여기서 읽는 사람이 알아야 할 것은 하나다 — 내 이름이 저 목록에 없다. */}
            <figure className="ask">
              <figcaption className="askq">
                <span className="dots"><i /><i /><i /></span>
                <span>“이 분야 괜찮은 곳 세 군데만 알려줘”</span>
              </figcaption>

              <div className="askbody">
                <div className="asklead mono">AI 답변</div>
                <ol className="asklist">
                  <li><span className="rk mono">1</span> 경쟁사 A</li>
                  <li><span className="rk mono">2</span> 경쟁사 B</li>
                  <li><span className="rk mono">3</span> 경쟁사 C</li>
                </ol>
                <div className="askme">
                  <span className="mek">우리 회사</span>
                  <span className="mev">목록에 없음</span>
                </div>
              </div>

              <figcaption className="askft">
                고객은 세 곳만 봅니다. <b>검색과 달리 2페이지가 없습니다.</b>
              </figcaption>
            </figure>

            <div className="again">
              <div className="againh mono">같은 질문을 한 번 더 물으면</div>
              <div className="againrow mono">
                <span className="rn">1회차</span>
                <span>A</span><span>B</span><span className="sw">C</span>
              </div>
              <div className="againrow mono">
                <span className="rn">2회차</span>
                <span>A</span><span>B</span><span className="sw alt">D</span>
              </div>
              <div className="againf">
                세 번째 자리는 물어볼 때마다 바뀝니다.
                <b>한 번 물어보고 “우리가 3위”라고 적으면 그건 우연을 기록한 것</b>입니다.
              </div>
            </div>
          </div>
        </div>
      </header>


      {/* 히어로 다음에 바로 "그래서 뭐가 좋은데"를 답한다.
          방법론(표본·신뢰구간)을 먼저 말하면 사는 사람은 이해하기 전에 나간다. */}
      <section id="why">
        <div className="wrap">
          <div className="lab">쓰면 달라지는 것</div>
          <h2>모르던 것 세 가지를<br />알게 됩니다</h2>

          <div className="whys">
            <article className="w" data-reveal="0">
              <div className="wq">“우리가 지금 불리긴 하나?”</div>
              <div className="wa">
                20번 물어서 3번 불리면 15%. <b>짐작이 아니라 센 값</b>입니다.
              </div>
              <div className="wb mono">
                <span className="wbar" data-reveal="260"><i style={{ ["--w" as string]: "15%" }} /></span>
                <span>15% · 20회 중 3회</span>
              </div>
            </article>

            <article className="w" data-reveal="110">
              <div className="wq">“홈페이지를 고치면 되나?”</div>
              <div className="wa">
                아닐 때가 더 많습니다. 효과의 <b>80%는 다른 사람이 쓴 글</b>에서 옵니다.
              </div>
              <div className="wb mono">
                <span className="wsplit" data-reveal="360"><i className="a" style={{ ["--w" as string]: "20%" }} /><i className="b" style={{ ["--w" as string]: "80%" }} /></span>
                <span>홈페이지 20% · 외부 글 80%</span>
              </div>
            </article>

            <article className="w" data-reveal="220">
              <div className="wq">“고쳤는데 좋아진 게 맞나?”</div>
              <div className="wa">
                착수 전 값을 남겨 두고, <b>두 달 뒤 같은 방식으로 다시 잽니다.</b>
              </div>
              <div className="wb mono">
                <span className="wdelta">
                  <span className="d0">0%</span>
                  <span className="darrow">→</span>
                  <span className="d1">?</span>
                </span>
                <span>착수일 기록 · 재측정</span>
              </div>
            </article>
          </div>

          <p className="whyfoot">
            <b>순위를 넣어 드릴 수는 없습니다.</b> "몇 달 안에 몇 % 보장"도 하지 않습니다.
            AI 답변은 매번 달라지기 때문에, 그런 약속을 하는 쪽이 오히려 위험합니다.
          </p>
        </div>
      </section>

      <section className="deep" id="data">
        <div className="wrap">
          <div className="lab">우리가 직접 잰 것</div>
          <h2>직접 재봤습니다.<br />결과는 예상과 달랐습니다.</h2>
          <p className="sub2">
            국내 B2B 26곳을 점검하고, 실제 구매자가 쓸 질문을 AI에 던져봤습니다.
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
                <b>60점을 넘긴 곳이 5곳뿐.</b> 업계 선두를 표방하는 회사가 30점이었습니다.
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
                <span className="c">설명된 분산 · 브랜드 21곳</span>
              </div>
              <div className="t">
                홈페이지의 기여는 <b>20%</b>. 나머지 80%는 비교 기사·커뮤니티 글·업계 목록
                같은 <b>남이 쓴 글</b>에서 왔습니다.
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
          <h2>착수 하루 만에<br />AI가 사이트를 다 읽어갔습니다</h2>
          <p className="sub2">
            수도권의 코딩·로봇 교육 학원입니다. 홈페이지가 없고 블로그만 있었습니다.
            착수한 날 지금 상태를 먼저 재고, 같은 날 홈페이지를 만들고, 블로그 글 32편을 옮겼습니다.
            아래 숫자는 <b>서버에 남은 기록을 그대로 가져온 것</b>입니다.
          </p>

          <div className="case">
            <div className="cx">
              <div className="cxh">
                <span className="lab2">착수 시점 · 09.05</span>
                <span className="mono cxn"><Count to={0} /> / 6</span>
              </div>
              <p>
                학부모가 쓸 질문 6개를 검색엔진에 넣었습니다. <b>전부 미노출.</b>
                더 중요한 건 상위 결과에 <b>개별 학원 홈페이지가 하나도 없었다</b>는 점입니다 — 전부 디렉터리였습니다.
                홈페이지를 아무리 잘 만들어도 이 질의는 못 이깁니다.
              </p>
            </div>
            <div className="cx">
              <div className="cxh">
                <span className="lab2">사이트 진단</span>
                <span className="mono cxn">83 → <Count to={91} /></span>
              </div>
              <p>
                크롤러 허용·llms.txt·구조화 데이터·문단 구조 7개 항목. 전부 코드로 확인 가능한 사실만 셉니다.
                <b>브랜드 권위 같은 판단 항목은 점수에 넣지 않습니다.</b>
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
                <span className="lab2">읽은 엔진</span>
                <span className="mono cxn"><Count to={2} /> / 6</span>
              </div>
              <p>
                주요 AI 6곳 중 2곳이 다녀갔습니다. 나머지 4곳은 아직입니다.
                <b>AI마다 새 사이트를 찾아오는 시점이 다릅니다.</b>
                이 숫자가 언제 6이 되는지가 다음 달에 볼 것입니다.
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
            <div className="cl mono dim">
              <span>…</span><span>AI 2곳</span><span>34쪽 중 31쪽을 읽어감 · 91.2%</span>
            </div>
          </div>

          <div className="casenote">
            <b>여기까지가 지금 확인된 전부입니다.</b> AI가 이 학원을 실제로 추천하는지는
            아직 모릅니다. 검색에 다 올라가기 전에 물어보면 어차피 “모른다”는 답만 나오기 때문에,
            <b> 다음 달에 다시 물어보고 그 결과를 이 자리에 그대로 적겠습니다.</b>
            <br />
            좋아진 것만 골라 보여주는 사례는 만들지 않습니다.
          </div>
        </div>
      </section>

      <section id="diff">
        <div className="wrap">
          <div className="lab">다른 점</div>
          <h2>보기 좋은 숫자를<br />만들지 않습니다</h2>
          <p className="sub2">
            이 시장의 리포트는 대부분 “AI 가시성 97%” 같은 딱 떨어지는 숫자를 내놓습니다.
            몇 번 물어봤는지, 다시 물으면 얼마나 달라지는지는 적혀 있지 않습니다.
            <b>한 번 물어본 결과를 점수라고 부르는 것</b>이 지금 이 업계의 표준입니다.
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
          <h2>재는 값이 포함된 요금</h2>
          <p className="sub2">
            국내 GEO 대행은 측정 없이 콘텐츠만 발행하는 월 100~300만원대와, 측정을 갖춘 월 500만원 이상으로 갈려 있습니다.
            Cited는 그 사이에 있습니다 — 재는 값을 넣되 실행까지 합니다.
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
                <li>AI가 참고하는 글 분석 · 어디부터 실릴지 순서</li>
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
                <li>AI가 인용할 만한 글 월 2~3건 작성·발행</li>
                <li>외부 매체·목록에 싣기 월 1~2건</li>
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
                AI마다 다릅니다. 질문을 받을 때마다 웹을 찾아보는 쪽은 <b>2~4주</b>면 반영되고,
                미리 학습한 내용으로 답하는 쪽은 <b>2~3개월</b>쯤 걸립니다.
                보장하는 기간이 아니라 지금까지 관찰된 대략의 흐름이며, 업종 경쟁이 심하면 더 걸립니다.
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
              <span className="mk" aria-hidden="true">[ ]</span>Cited<em>사이티드</em>
            </span>
            <span>AI 답변 노출 측정 · GEO</span>
            <span className="mono" style={{ marginLeft: "auto" }}>
              2026
            </span>
          </div>
          <div className="wm">
            이 페이지의 수치(국내 B2B 26곳 점검 · 다시 물었을 때 28% 변동 · 홈페이지 기여도 20%)는 저희가 직접 잰 값입니다.
            표본이 크지 않아 확정된 수치가 아니라 <b>대략의 방향</b>으로 읽어 주십시오 — 표본과 한계를 밝히는 것이
            저희가 이 시장에서 하려는 일이기도 합니다. 케이스 스터디의 크롤러 방문 기록은 서버 원본입니다.
          </div>
        </div>
      </footer>
    </>
  );
}
