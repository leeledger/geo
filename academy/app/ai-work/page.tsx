import Link from "next/link";
import Nav from "@/components/Nav";
import type { Metadata } from "next";

/**
 * 성인 AI 업무자동화반.
 *
 * 근거는 두 곳뿐이다.
 *   학원   홈 수강료 표(성인 월 4회·120분 200,000원), 원장 이력(schema.json)
 *   조사   handoff/research/ai-work-course-2026-09-28.md — 경쟁 강의 가격·공공 무료 교육
 * 반 정원·요일은 원장이 정하지 않아 「상담 시 안내」로 둔다. 지어 넣지 말 것.
 */

export const metadata: Metadata = {
  title: "직장인·사장님 AI 업무자동화 수업 | 송파 석촌동 성인반",
  description:
    "AI 강의를 듣고도 일이 그대로라면. 내 반복 업무 한 건을 들고 와서 돌아가는 자동화로 들고 가는 오프라인 성인반입니다. 의료정보·ERP·금융 시스템을 만든 개발자 출신 원장이 직접 지도합니다. 서울 송파구 석촌동 로봇&코딩학원.",
  alternates: { canonical: "/ai-work" },
};

const FAQ: [string, string][] = [
  [
    "코딩을 전혀 몰라도 되나요?",
    "됩니다. 필요한 코드는 AI 가 씁니다. 수강생은 무엇을 시킬지 정하고, 돌아온 결과가 맞는지 확인하는 법을 배웁니다. 다만 결과를 확인하는 일은 빼지 않습니다. 그걸 빼면 틀린 자동화가 조용히 돌아갑니다.",
  ],
  [
    "회사 파일은 보안 때문에 못 가져가는데요.",
    "실제 파일 대신 칸 모양만 같은 가짜 데이터로 만듭니다. 열 이름과 형식이 같으면 자동화는 그대로 옮겨집니다. 회사에 돌아가서 파일만 바꿔 끼우면 됩니다.",
  ],
  [
    "유료 AI 를 결제해야 하나요?",
    "처음엔 무료 요금제로 시작합니다. 무료 한도에 실제로 걸리는 지점이 오면 그때 어떤 결제가 필요한지 같이 따져 봅니다. 미리 여러 개를 결제하지 마세요.",
  ],
  [
    "노트북을 가져가야 하나요?",
    "가져오시길 권합니다. 자동화는 결국 본인 계정과 본인 컴퓨터에서 돌아야 합니다. 수업에서 만든 것이 집에 가서도 그대로 돌아야 수업이 끝난 겁니다.",
  ],
  [
    "수강료는 얼마인가요?",
    "성인 수강료 기준을 따릅니다. 월 4회, 회당 120분, 200,000원(부가세 포함)입니다. 반 편성과 시간표는 상담 시 안내해 드립니다.",
  ],
];

/**
 * 커리큘럼 뼈대는 경쟁 과정 목차에서 겹치는 순서를 따랐다 (handoff/research/ai-work-course-2026-09-28.md §8).
 * 프롬프트 → 문서 → 엑셀 함수·피벗 → VBA·취합 → 구글 시트·Apps Script → n8n·Make → AI 비서·작은 도구 → 내 업무 완성·시연
 */
const CURRICULUM: { title: string; learn: string[]; out: string; tools: string }[] = [
  {
    title: "AI 업무 활용 시작 · 자동화할 업무 고르기",
    learn: [
      "ChatGPT·Claude·Gemini 가입과 화면, 무료와 유료의 차이",
      "프롬프트 기본 구조: 역할 · 맥락 · 조건 · 출력 형식",
      "내 업무 목록 적기 — 한 주 몇 번, 한 번에 몇 분",
      "과정 끝까지 가져갈 내 업무 1가지 정하기",
    ],
    out: "내 업무 목록표, 자주 쓰는 지시문 모음",
    tools: "ChatGPT · Claude · Gemini",
  },
  {
    title: "문서 업무: 회의록 · 보고서 · 이메일",
    learn: [
      "녹음 파일을 받아쓰고 회의록으로 요약하기",
      "PDF·긴 문서 요약, 보고서 초안 만들기",
      "상황별 이메일 초안 (거래처 회신 · 일정 조율 · 안내문)",
      "AI 가 지어낸 내용 찾아내는 법",
    ],
    out: "회의록 요약 양식, 상황별 메일 초안 모음",
    tools: "클로바노트 · ChatGPT · NotebookLM",
  },
  {
    title: "엑셀 ①: 함수 · 정리 · 현황판",
    learn: [
      "AI 에게 상황을 설명해 맞는 함수 받기 (IF · SUMIFS · XLOOKUP)",
      "정렬 · 필터 · 조건부서식으로 데이터 정리",
      "중복값 · 빈칸 한 번에 찾기",
      "피벗테이블과 차트로 월별 현황판 만들기",
    ],
    out: "월별 매출·업무 현황판",
    tools: "엑셀 · 구글 스프레드시트 · ChatGPT",
  },
  {
    title: "엑셀 ②: 매크로 · VBA 로 반복 작업 없애기",
    learn: [
      "매크로 기록과 실행, VBA 편집기 쓰는 법",
      "AI 가 짜 준 VBA 코드를 붙여넣고 돌려 보기",
      "같은 양식 파일 여러 개를 하나로 합치기",
      "명단으로 계약서 · 안내문 · 수료증 한꺼번에 만들기",
    ],
    out: "파일 취합 매크로, 명단 기반 문서 대량 생성",
    tools: "엑셀 VBA · ChatGPT",
  },
  {
    title: "구글 시트 + Apps Script",
    learn: [
      "구글 폼으로 받은 신청 · 문의를 시트에 쌓기",
      "시트 명단으로 Gmail 개별 메일 보내기",
      "시트 안에서 AI 로 문의 분류 · 답장 초안 만들기",
      "정해진 시각에 저절로 돌게 예약(트리거) 걸기",
    ],
    out: "문의 접수 → 분류 → 답장 초안 메일",
    tools: "구글 폼 · 스프레드시트 · Apps Script · Gmail",
  },
  {
    title: "노코드 자동화: n8n · Make",
    learn: [
      "트리거 · 노드 · 실행 기록 개념",
      "받은 메일 분류해서 시트에 기록하고 알림 보내기",
      "뉴스 · 블로그 RSS 모아 요약 리포트 만들기",
      "영수증 메일에서 금액 뽑아 장부 시트에 적기",
    ],
    out: "매일 아침 도착하는 요약 리포트, 영수증 → 장부 자동 기록",
    tools: "n8n 또는 Make · Gmail · 구글 시트 · 텔레그램",
  },
  {
    title: "나만의 AI 비서 · 작은 도구 만들기",
    learn: [
      "업무 매뉴얼 · FAQ 를 넣은 맞춤형 GPT(GPTs) · Gems 만들기",
      "사내 문서를 근거로 답하게 하기 (NotebookLM)",
      "말로 설명해서 화면 있는 웹 도구 만들기 (바이브코딩)",
    ],
    out: "우리 업무 FAQ 비서, 나만 쓰는 계산·정리 도구",
    tools: "GPTs · Gems · NotebookLM · Claude",
  },
  {
    title: "내 업무 자동화 완성 · 시연",
    learn: [
      "1회에 고른 업무를 끝까지 완성하기",
      "멈췄을 때 실행 기록 읽고 고치는 법",
      "개인정보 · 결제 확정은 자동화하지 않는 기준",
      "본인 컴퓨터에서 실제로 돌리는 3분 시연",
    ],
    out: "매주 쓰는 내 업무 자동화 1개",
    tools: "과정에서 쓴 도구 중 내 업무에 맞는 것",
  },
];

const SCHEMA = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Course",
      "@id": "https://robotncoding.com/ai-work#course",
      name: "성인 AI 업무자동화반",
      description:
        "직장인과 1인 사업자가 자신의 반복 업무 한 건을 가져와 AI 로 돌아가는 자동화를 만드는 오프라인 수업. 업무 고르기, AI 에게 지시하기, 문서·엑셀 정리, 메일·시트 연결, 작은 도구 만들기, 예약 실행, 오류 대응과 개인정보 기준을 다룬다.",
      url: "https://robotncoding.com/ai-work",
      inLanguage: "ko",
      provider: { "@id": "https://robotncoding.com/#org" },
      audience: { "@type": "Audience", audienceType: "직장인, 자영업자, 1인 사업자" },
      teaches: ["AI 업무 활용", "업무 자동화", "엑셀 자동화", "노코드 자동화", "AI 에이전트"],
      syllabusSections: CURRICULUM.map((c, i) => ({
        "@type": "Syllabus",
        name: `${i + 1}회 ${c.title}`,
        description: `${c.learn.join(", ")}. 실습: ${c.out}`,
      })),
      hasCourseInstance: {
        "@type": "CourseInstance",
        courseMode: "Onsite",
        location: {
          "@type": "Place",
          name: "로봇&코딩학원",
          address: "서울 송파구 석촌동 274-8 2층",
        },
        courseSchedule: { "@type": "Schedule", repeatFrequency: "P1W", duration: "PT2H" },
      },
      offers: {
        "@type": "Offer",
        price: 200000,
        priceCurrency: "KRW",
        category: "월 4회 · 회당 120분",
      },
    },
    {
      "@type": "FAQPage",
      mainEntity: FAQ.map(([q, a]) => ({
        "@type": "Question",
        name: q,
        acceptedAnswer: { "@type": "Answer", text: a },
      })),
    },
  ],
};

const CSS = `
.aw{padding:72px 0;border-bottom:1px solid rgba(255,255,255,.06)}
.aw h1{font-size:clamp(28px,5vw,46px);line-height:1.25;font-weight:900;margin:14px 0 20px;word-break:keep-all}
.aw h2{font-size:clamp(22px,3.4vw,32px);line-height:1.35;font-weight:800;margin:10px 0 18px;word-break:keep-all}
.aw h3{font-size:18px;font-weight:800;margin:0 0 8px;word-break:keep-all}
.aw p,.aw li,.aw td,.aw th{word-break:keep-all;line-height:1.75}
.aw .lead{max-width:760px}
.aw .hl{color:var(--amber)}
.aw-grid{display:grid;gap:14px;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));margin-top:26px}
.aw-card{border:1px solid rgba(255,255,255,.1);border-radius:14px;padding:20px 20px 16px;background:rgba(255,255,255,.02)}
.aw-card p{margin:0;color:var(--fg-2)}
.aw-card .k{font-size:12px;letter-spacing:.08em;color:var(--cyan);margin-bottom:8px}
.aw-card.no{border-color:rgba(245,166,35,.35)}
.aw-card.no .k{color:var(--amber)}
.aw-steps{counter-reset:s;list-style:none;padding:0;margin:26px 0 0;display:grid;gap:10px}
.aw-steps li{counter-increment:s;display:grid;grid-template-columns:56px 1fr;gap:14px;align-items:start;border-top:1px solid rgba(255,255,255,.08);padding:14px 0}
.aw-steps li::before{content:counter(s,decimal-leading-zero);font-family:'IBM Plex Mono',monospace;color:var(--amber);font-size:20px}
.aw-steps b{display:block;margin-bottom:2px}
.aw-steps span{color:var(--fg-2)}
.paper .aw-card{border-color:var(--paper-line);background:var(--paper-card)}
.paper .aw-card p{color:var(--paper-ink-2)}
.paper .aw-card .k{color:#B5760A}
.aw-cur{list-style:none;padding:0;margin:26px 0 0}
.aw-cur>li{display:grid;grid-template-columns:64px 1fr;gap:16px;border-top:1px solid var(--paper-line);padding:20px 0}
.aw-cur .n{color:#B5760A;font-size:18px;padding-top:2px}
.aw-cur ul{margin:6px 0 10px;padding-left:18px}
.aw-cur ul li{color:var(--paper-ink-2);margin:2px 0}
.aw-cur .out{margin:0 0 4px}
.aw-cur .out b{display:inline-block;font-size:12px;padding:2px 8px;border-radius:6px;background:var(--amber);color:#0B0F16;margin-right:6px}
.aw-cur .tools{margin:0;font-size:13px;color:var(--paper-ink-2)}
.aw-tw{overflow-x:auto;margin-top:22px}
.aw-tw table{border-collapse:collapse;min-width:640px;width:100%}
.aw-tw th,.aw-tw td{border-bottom:1px solid rgba(255,255,255,.1);padding:12px 10px;text-align:left;vertical-align:top;font-size:15px}
.aw-tw th{color:var(--fg-3);font-weight:500;font-size:13px}
.aw-tw td.me{color:var(--fg);background:rgba(61,214,196,.06)}
.aw-src{font-size:12.5px;color:var(--fg-3);margin-top:10px}
.aw-src a{color:var(--fg-3)}
.aw-faq details{border-top:1px solid rgba(255,255,255,.1);padding:16px 0}
.aw-faq summary{cursor:pointer;font-weight:700;word-break:keep-all}
.aw-faq details p{margin:10px 0 0;color:var(--fg-2)}
.aw-cta{display:flex;flex-wrap:wrap;gap:12px;margin-top:24px}
.aw-cta a{display:inline-block;padding:14px 20px;border-radius:12px;border:1px solid rgba(255,255,255,.18);text-decoration:none;font-weight:700}
.aw-cta a.pri{background:var(--amber);color:#0B0F16;border-color:var(--amber)}
.paper .aw-steps span,.paper .aw-faq details p,.paper blockquote,.paper .aw-src,.paper .aw-src a{color:var(--paper-ink-2)}
.paper.aw,.paper .aw-steps li,.paper .aw-faq details{border-color:var(--paper-line)}
.aw-faq summary:hover{background:transparent}
.aw blockquote{margin:18px 0;padding:4px 0 4px 16px;border-left:3px solid var(--amber);color:var(--fg-2)}
@media (max-width:600px){.aw{padding:52px 0}.aw-steps li{grid-template-columns:40px 1fr}}
`;

export default function AiWork() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(SCHEMA) }} />
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <Nav />

      <section className="aw">
        <div className="wrap">
          <div className="lab">AI for Work · 성인반</div>
          <h1>
            AI 강의를 들었는데
            <br />
            <span className="hl">왜 내 일은 그대로일까요?</span>
          </h1>
          <p className="lead">
            도구를 배웠지 내 일에 붙여 보지 않아서입니다. 강의 속 예제는 강사의 일입니다.
            이 반은 순서를 뒤집습니다. <b>본인의 반복 업무 한 건을 들고 오시고, 돌아가는 자동화로 들고 가십니다.</b>
          </p>
          <p className="lead">
            대상은 직장인, 혼자 가게나 사무실을 꾸리는 사장님입니다. 서울 송파구 석촌동 학원에서 직접 만나 수업합니다.
            지도는 의료정보시스템·ERP·금융 콜센터 시스템을 만들어 온 개발자 출신 원장이 합니다.
          </p>
          <div className="aw-cta">
            <a className="pri" href="tel:02-422-0525">전화 상담 02-422-0525</a>
            <a href="http://pf.kakao.com/_Bxhxbxjxb/chat" target="_blank" rel="noopener">카카오톡으로 묻기</a>
          </div>
        </div>
      </section>

      <section className="aw paper">
        <div className="wrap">
          <div className="lab">Why</div>
          <h2>툴 서른 개가 아니라, 내 일 한 건</h2>
          <p className="lead">
            온라인 AI 자동화 강의는 대부분 양으로 팝니다. 툴 31개, 잡무 40가지, 프로젝트 18개. 들을 땐 다 됩니다. 끝나고 내 엑셀을 열면 어디서부터 붙일지 모릅니다.
          </p>
          <blockquote>
            「배운 것은 분명히 많아졌습니다… 그런데 이상하게도 실제 업무는 그만큼 달라지지 않았습니다.」
            <br />
            <span className="aw-src">— 웹핏 칼럼, 2026년 9월 7일</span>
          </blockquote>
          <p className="lead">
            막히는 곳도 대개 같습니다. 계정 연결, API 키, 예약 설정. 영상은 거기서 멈춰 주지 않습니다.
            옆에 앉은 사람이 몇 분이면 푸는 문제로 며칠을 버립니다. 그래서 이 수업은 오프라인이고, 결과물 기준은 하나입니다.
            <b> 수업이 끝난 뒤 본인 컴퓨터에서 그대로 돌아가는가.</b>
          </p>
        </div>
      </section>

      <section className="aw">
        <div className="wrap">
          <div className="lab">Bring your work</div>
          <h2>이런 일을 들고 오시면 됩니다</h2>
          <p className="lead">
            공통점이 있습니다. 매주 반복되고, 입력 모양이 정해져 있고, 틀렸을 때 사람이 한 번 보면 잡을 수 있는 일입니다.
          </p>
          <div className="aw-grid">
            <div className="aw-card"><div className="k mono">엑셀</div><h3>주문·매출 파일 정리</h3><p>여러 곳에서 받은 파일을 한 양식으로 모으고, 합계와 빠진 칸을 표시한다.</p></div>
            <div className="aw-card"><div className="k mono">메일</div><h3>거래처 메일 분류와 답장 초안</h3><p>들어온 메일을 종류별로 나누고 답장 초안까지. 보내는 건 사람이 누른다.</p></div>
            <div className="aw-card"><div className="k mono">보고</div><h3>주간 보고서 취합</h3><p>팀원들이 시트에 적은 내용을 모아 정해진 형식의 보고서 초안으로.</p></div>
            <div className="aw-card"><div className="k mono">문의</div><h3>예약·문의 응답 초안</h3><p>자주 오는 질문에 붙일 답을 미리 만들어 두고, 새 문의가 오면 맞는 답을 찾아 준다.</p></div>
            <div className="aw-card"><div className="k mono">견적</div><h3>견적서·계약서 초안</h3><p>품목과 수량만 넣으면 우리 양식에 맞춘 문서가 나온다.</p></div>
            <div className="aw-card"><div className="k mono">블로그</div><h3>글 한 번 쓰고 여러 곳에 올리기</h3><p>홈페이지에 쓴 글을 네이버 블로그 서식으로 옮기는 일. 이 학원이 실제로 이렇게 한다.</p></div>
          </div>
          <div className="aw-grid">
            <div className="aw-card no"><div className="k mono">맡기지 않는 일</div><h3>돈이 나가는 최종 결정</h3><p>결제·이체·발주 확정은 AI 가 초안까지만. 누르는 손은 사람 손이어야 합니다.</p></div>
            <div className="aw-card no"><div className="k mono">맡기지 않는 일</div><h3>항의 응대의 마지막 답</h3><p>예외가 많은 일은 자동화하면 예외에서 사고가 납니다. 초안까지만 씁니다.</p></div>
            <div className="aw-card no"><div className="k mono">맡기지 않는 일</div><h3>고객 개인정보가 도는 일</h3><p>주민번호·진료 기록·계좌는 외부 AI 에 넣지 않습니다. 이 선은 수업 첫날 긋습니다.</p></div>
          </div>
        </div>
      </section>

      <section className="aw paper">
        <div className="wrap">
          <div className="lab">Curriculum</div>
          <h2>8회 커리큘럼</h2>
          <p className="lead">
            회당 120분, 8회 과정입니다. 1~7회는 회차마다 실습 결과물을 하나씩 만들고,
            8회에는 첫 시간에 고른 <b>내 업무 1가지</b>를 자동화로 완성해 시연합니다.
          </p>
          <ol className="aw-cur">
            {CURRICULUM.map((c, i) => (
              <li key={c.title}>
                <div className="n mono">{String(i + 1).padStart(2, "0")}회</div>
                <div>
                  <h3>{c.title}</h3>
                  <ul>
                    {c.learn.map((l) => (
                      <li key={l}>{l}</li>
                    ))}
                  </ul>
                  <p className="out"><b>실습</b> {c.out}</p>
                  <p className="tools mono">{c.tools}</p>
                </div>
              </li>
            ))}
          </ol>
          <div className="aw-grid">
            <div className="aw-card"><div className="k mono">준비물</div><h3>노트북 · 구글 계정 · 내 업무 1가지</h3><p>자동화할 반복 업무 하나를 정해 오세요. 회사 파일을 못 가져오면 칸 모양만 같은 연습용 파일로 합니다.</p></div>
            <div className="aw-card"><div className="k mono">대상</div><h3>코딩을 몰라도 됩니다</h3><p>엑셀·메일·문서 작업을 매주 반복하는 직장인, 주문·예약·장부를 혼자 챙기는 사장님. 코드는 AI 가 쓰고, 붙여넣고 실행하는 법을 배웁니다.</p></div>
            <div className="aw-card"><div className="k mono">방식</div><h3>석촌동 학원에서 직접</h3><p>녹화 영상이 아닙니다. 계정 연결·API 키·설정에서 막히면 그 자리에서 같이 풉니다.</p></div>
          </div>
        </div>
      </section>

      <section className="aw">
        <div className="wrap">
          <div className="lab">Compare</div>
          <h2>다른 선택지와 무엇이 다른가요?</h2>
          <p className="lead">
            온라인 강의, 공공 교육과 나란히 놓고 보면 이렇습니다.
          </p>
          <div className="aw-tw">
            <table>
              <thead>
                <tr><th></th><th>온라인 VOD 패키지</th><th>공공 무료 교육</th><th>이 반</th></tr>
              </thead>
              <tbody>
                <tr><td><b>가격</b></td><td>할인가 20만~29만 원대가 많음</td><td>무료</td><td className="me">월 200,000원 (4회·회당 120분)</td></tr>
                <tr><td><b>형식</b></td><td>녹화 영상, 수십 시간</td><td>강의실 단체 수업, 4~6주 등</td><td className="me">석촌동 학원에서 직접</td></tr>
                <tr><td><b>만드는 것</b></td><td>강사가 정한 예제</td><td>생활·기초 활용, 홍보물</td><td className="me">본인 업무 한 건</td></tr>
                <tr><td><b>맞는 사람</b></td><td>혼자 끝까지 하는 사람</td><td>AI 가 처음인 사람</td><td className="me">써 봤는데 내 일이 안 바뀐 사람</td></tr>
              </tbody>
            </table>
          </div>
          <p className="aw-src">
            가격은 2026년 9월 28일 판매 페이지 기준입니다. 패스트캠퍼스 직장인 업무자동화 289,000원, n8n 224,000원, 스마트스토어 209,000원(모두 할인가).
            공공 과정: 송파구 디지털 문해학습장, 서울시50플러스재단 생성형 AI 교육, 소상공인시장진흥공단 2026 소상공인 AI 상생협업교육.
          </p>
        </div>
      </section>

      <section className="aw paper">
        <div className="wrap">
          <div className="lab">Principal</div>
          <h2>가르치는 사람도 이렇게 일합니다</h2>
          <p className="lead">
            원장은 의료정보시스템, 생산·물류 ERP, 쇼핑몰, 금융사·카드사 콜센터 시스템을 개발해 왔습니다.
            그래서 자동화하면 안 되는 일이 어디 있는지 압니다. 예외가 많고 책임이 걸린 곳입니다.
          </p>
          <p className="lead">
            지금도 혼자 일합니다. 이 학원 홈페이지에 쓴 글은 프로그램이 네이버 블로그로 옮기고 서식과 태그까지 붙입니다.
            검색엔진에 새 글을 알리는 일, AI 답변에 학원 이름이 나오는지 재는 일도 사람 손 없이 돕니다.
            원장이 따로 꾸리는 1인 회사는 일을 AI 직원 8개 역할로 나누고, 예약 작업 9개를 걸어 돌립니다.
          </p>
          <p className="lead">
            수업에서 보여 드리는 건 이 화면입니다. <b>잘 도는 곳과 자주 멈추는 곳을 같이 보여 드립니다.</b> 멈추는 곳이 더 배울 게 많습니다.
          </p>
        </div>
      </section>

      <section className="aw paper aw-faq">
        <div className="wrap">
          <div className="lab">FAQ</div>
          <h2>자주 묻는 것</h2>
          {FAQ.map(([q, a]) => (
            <details key={q}>
              <summary>{q}</summary>
              <p>{a}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="aw">
        <div className="wrap">
          <div className="lab">Before you call</div>
          <h2>상담 전에 하나만 적어 오세요</h2>
          <p className="lead">
            한 주에 몇 번 반복하는 일인지, 한 번에 몇 분 걸리는지. 두 숫자를 곱해 한 주 30분이 안 되면 자동화보다 그냥 하시는 게 빠를 수 있습니다.
            그 이상이고 매번 모양이 같다면 이 반에서 다룰 만한 일입니다.
          </p>
          <p className="lead">
            성인 수강료는 월 4회, 회당 120분, 200,000원(부가세 포함)입니다. 반 편성과 시간표는 상담 시 안내해 드립니다.
          </p>
          <div className="aw-cta">
            <a className="pri" href="tel:02-422-0525">02-422-0525</a>
            <a href="http://pf.kakao.com/_Bxhxbxjxb/chat" target="_blank" rel="noopener">카카오톡 채널</a>
            <Link href="/blog/ai-gangui-deureotneunde-eommu-geudaero">AI 강의를 듣고도 일이 그대로인 이유 →</Link>
          </div>
        </div>
      </section>
    </>
  );
}
