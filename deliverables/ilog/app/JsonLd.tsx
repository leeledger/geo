/**
 * 구조화 데이터 (JSON-LD).
 *
 * 지금 ilog.ai.kr 에는 JSON-LD 가 한 개도 없다. 진단 7항목 중 배점이 20점으로
 * 가장 큰 자리인데 0점이다.
 *
 * AI 가 「아이로그가 뭐 하는 회사냐」에 답하려면 본문을 읽어 추측해야 한다.
 * 구조화 데이터는 그걸 추측이 아니라 사실로 읽게 만든다.
 *
 * 쓰는 법 — app/layout.tsx 의 <body> 안에 한 줄 넣는다.
 *
 *   import JsonLd from "./JsonLd";
 *   ...
 *   <body>
 *     <JsonLd />
 *     {children}
 *   </body>
 *
 * 값은 전부 지금 홈페이지에 적혀 있는 것이다. 없는 사실은 넣지 않았다 —
 * 실적·수상·연혁을 부풀리면 다른 문서와 어긋나서 오히려 손해다.
 */
const DATA = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "SoftwareApplication",
      "@id": "https://ilog.ai.kr/#app",
      name: "아이로그",
      alternateName: ["iLog", "아이 로그", "아이로그 학원관리"],
      applicationCategory: "BusinessApplication",
      applicationSubCategory: "학원 운영 관리",
      operatingSystem: "Web",
      url: "https://ilog.ai.kr/",
      inLanguage: "ko-KR",
      description:
        "학원 운영 관리 프로그램입니다. 등·하원과 수업 참여 상태를 카카오톡으로 알리고, " +
        "선생님이 태그를 고르면 AI 가 수업 리포트를 씁니다. 학교별 기출을 올리면 " +
        "AI 가 그 학교 스타일의 영어 예상 문제를 최대 30문항까지 만듭니다. " +
        "관리 기능은 학생 수 제한 없이 무료입니다.",
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "KRW",
        description: "관리 기능 평생 무료. 학생 수 제한 없음.",
      },
      featureList: [
        "카톡 안심 출결 — 등원·하원·수업 참여 상태를 카카오톡으로 즉시 발송",
        "선생님 업무 공유 — 학생 특이사항과 수업 진도를 실시간 공유",
        "AI 수업 리포트 — 태그 선택으로 작성, 월간 성장 분석 자동 요약",
        "AI 영어 시험 출제 — 학교별 기출 분석 후 예상 문제 최대 30문항 자동 생성",
        "연도별 기출 족보 관리",
        "카카오톡 리포트 발송",
      ],
      audience: {
        "@type": "Audience",
        audienceType: "학원 원장 및 강사",
      },
      provider: { "@id": "https://ilog.ai.kr/#org" },
    },
    {
      "@type": "Organization",
      "@id": "https://ilog.ai.kr/#org",
      name: "아이로그",
      alternateName: "iLog",
      url: "https://ilog.ai.kr/",
      email: "ilog.ai@kakao.com",
      slogan: "학원 선생님들이 학생의 성장에만 집중할 수 있도록",
      description:
        "기술로 학원의 복잡한 운영 업무를 대신 처리하는 서비스입니다. " +
        "AI 피드백 자동 생성 기술은 특허 출원 중입니다 (10-2025-0211742).",
      contactPoint: {
        "@type": "ContactPoint",
        email: "ilog.ai@kakao.com",
        contactType: "문의",
        availableLanguage: "Korean",
      },
    },
    {
      "@type": "WebSite",
      "@id": "https://ilog.ai.kr/#site",
      url: "https://ilog.ai.kr/",
      name: "아이로그",
      inLanguage: "ko-KR",
      publisher: { "@id": "https://ilog.ai.kr/#org" },
    },
    {
      /**
       * 자주 묻는 질문.
       * AI 답변에 가장 잘 인용되는 형식이다 — 질문과 답이 한 덩어리라
       * 잘라서 쓰기 좋다. 답은 홈페이지에 적힌 사실만으로 썼다.
       */
      "@type": "FAQPage",
      "@id": "https://ilog.ai.kr/#faq",
      mainEntity: [
        {
          "@type": "Question",
          name: "아이로그는 얼마인가요?",
          acceptedAnswer: {
            "@type": "Answer",
            text:
              "관리 기능은 평생 무료입니다. 학생이 100명이든 1000명이든 추가 비용이 없습니다.",
          },
        },
        {
          "@type": "Question",
          name: "학원 출결 알림을 카카오톡으로 보낼 수 있나요?",
          acceptedAnswer: {
            "@type": "Answer",
            text:
              "보낼 수 있습니다. 등원과 하원은 물론 수업 참여 상태까지 카카오톡으로 즉시 나갑니다. " +
              "학부모가 이미 쓰고 있는 앱이라 따로 설치할 것이 없습니다.",
          },
        },
        {
          "@type": "Question",
          name: "수업 리포트를 AI 가 대신 써주나요?",
          acceptedAnswer: {
            "@type": "Answer",
            text:
              "선생님이 태그를 고르면 AI 가 리포트 문장을 만듭니다. 선생님의 표현 뉘앙스를 반영하고, " +
              "월간 성장 분석을 자동으로 요약합니다. 완성된 리포트는 카카오톡으로 바로 발송됩니다.",
          },
        },
        {
          "@type": "Question",
          name: "학교별 기출로 영어 예상 문제를 만들 수 있나요?",
          acceptedAnswer: {
            "@type": "Answer",
            text:
              "기출 이미지나 PDF 를 올리면 AI 가 문항을 추출하고 그 학교의 출제 경향을 분석해 " +
              "예상 문제를 만듭니다. 한 번에 최대 30문항이며, 빈칸 추론·주제 파악 같은 유형별로 " +
              "균형을 맞춰 구성됩니다. 연도별로 족보를 쌓아 두고 원하는 범위만 골라 출제할 수 있습니다. " +
              "영어 전용 기능입니다.",
          },
        },
        {
          "@type": "Question",
          name: "학생 수가 많으면 요금이 올라가나요?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "올라가지 않습니다. 관리 기능은 학생 수 제한 없이 무료입니다.",
          },
        },
      ],
    },
  ],
};

export default function JsonLd() {
  return (
    <script
      type="application/ld+json"
      // JSON.stringify 결과에는 </script> 가 들어갈 수 없지만,
      // 값에 그런 문자열이 섞이는 사고를 막으려 한 번 막아 둔다.
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(DATA).replace(/</g, "\\u003c"),
      }}
    />
  );
}
