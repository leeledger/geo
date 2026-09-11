// ============================================================================
// 구조화 데이터 (JSON-LD)
// ----------------------------------------------------------------------------
// AI 가 「아이로그가 뭐 하는 서비스냐」에 답할 때, 본문을 읽어 추측하는 대신
// 사실을 그대로 읽게 만든다.
//
// 값은 코드에서 확인한 것만 쓴다 (2026-09-11). 여기 적힌 문장은 AI 답변에 그대로 인용된다.
//   - 기본 관리 기능은 무료. 학부모 알림(알림톡 19원·문자 24원)과 AI 기능은 건당 과금
//   - 리포트는 자동 발송이 아니라 선생님이 카카오톡 공유·이메일로 보낸다
// 없는 실적·수상은 넣지 않는다 — 다른 문서와 어긋나면 오히려 손해다.
//
// 쓰는 곳: app/layout.tsx 의 <body> 안 맨 앞
// ============================================================================

const DATA = {
    '@context': 'https://schema.org',
    '@graph': [
        {
            '@type': 'SoftwareApplication',
            '@id': 'https://ilog.ai.kr/#app',
            name: '아이로그',
            alternateName: ['iLog', '아이 로그', '아이로그 학원관리', '아이로그 학원 관리 프로그램'],
            // 같은 이름이 둘 더 있다 — (주)아이로그(ilog.co.kr, SI 회사), ILOG(ilog.kr).
            // 네이버 「아이로그」 첫 화면이 전부 그쪽이고, AI 도 도메인을 줘야 구분했다.
            disambiguatingDescription:
                'ilog.ai.kr 의 학원 운영 관리 프로그램입니다. (주)아이로그(ilog.co.kr)·ILOG(ilog.kr)와는 다른 서비스입니다.',
            applicationCategory: 'BusinessApplication',
            applicationSubCategory: '학원 운영 관리',
            operatingSystem: 'Web',
            url: 'https://ilog.ai.kr/',
            inLanguage: 'ko-KR',
            description:
                '학원 운영 관리 프로그램입니다. 학생이 출결 키패드에 번호를 누르면 등원·하원이 기록되고 학부모에게 알림톡이나 문자로 나갑니다. ' +
                '선생님이 태그를 고르면 AI 가 수업 피드백을 쓰고, 학교별 영어 기출을 올리면 5지선다 예상 문제를 최대 30문항까지 만듭니다. ' +
                '기본 관리 기능은 학생 수 제한 없이 무료이고, 알림 발송과 AI 기능은 쓴 만큼 냅니다.',
            offers: [
                {
                    '@type': 'Offer',
                    name: '기본 관리 기능',
                    price: '0',
                    priceCurrency: 'KRW',
                    description: '출결 기록, 학생·반 관리, 선생님 업무 공유, 수납 체크. 학생 수 제한 없음.',
                },
                {
                    '@type': 'Offer',
                    name: 'AI 무제한 패스 S (재원생 30명 이하)',
                    price: '19000',
                    priceCurrency: 'KRW',
                    description:
                        '월 이용권. 100명 이하 39,000원, 300명 이하 59,000원, 300명 초과 99,000원. ' +
                        '예상 문제 출제와 다시 뽑기(1문항 20원)는 패스가 있어도 차감됩니다.',
                },
            ],
            featureList: [
                '출결 키패드 — 학생이 4자리 번호로 등원·하원 기록',
                '학부모 출결 알림 — 카카오 알림톡 1건 19원, 문자 1건 24원(부가세 포함, 선불 충전)',
                '선생님 업무 공유 — 담당자 지정, 진행 상태, 댓글',
                'AI 수업 피드백 — 태그와 메모로 한두 문장 작성, 1건 50원',
                '종합 리포트 — 월간·분기·기간 지정, 1건 200원, 카카오톡 공유·이메일 발송',
                '학생전용페이지 — 성장 프로필 차트, 시험 결과, 리포트 모음, 학습 플랜',
                'AI 영어 시험 출제 — 학교별 기출 분석 후 5지선다 예상 문제 최대 30문항, A4 PDF',
                '엑셀 학생 일괄 등록, 학년 진급',
            ],
            audience: { '@type': 'Audience', audienceType: '학원 원장 및 강사' },
            provider: { '@id': 'https://ilog.ai.kr/#org' },
        },
        {
            '@type': 'Organization',
            '@id': 'https://ilog.ai.kr/#org',
            name: '아이로그',
            alternateName: 'iLog',
            url: 'https://ilog.ai.kr/',
            email: 'ilog.ai@kakao.com',
            slogan: '학원 선생님들이 학생의 성장에만 집중할 수 있도록',
            description:
                '기술로 학원의 복잡한 운영 업무를 대신 처리하는 서비스입니다.',
            contactPoint: {
                '@type': 'ContactPoint',
                email: 'ilog.ai@kakao.com',
                contactType: '문의',
                availableLanguage: 'Korean',
            },
        },
        {
            '@type': 'WebSite',
            '@id': 'https://ilog.ai.kr/#site',
            url: 'https://ilog.ai.kr/',
            name: '아이로그',
            inLanguage: 'ko-KR',
            publisher: { '@id': 'https://ilog.ai.kr/#org' },
        },
        {
            // 질문과 답이 한 덩어리라 AI 가 잘라 쓰기 좋다. 화면 FAQ(components/seo/Faq.tsx)와 같은 사실.
            '@type': 'FAQPage',
            '@id': 'https://ilog.ai.kr/#faq',
            mainEntity: [
                {
                    '@type': 'Question',
                    name: '아이로그는 얼마인가요?',
                    acceptedAnswer: {
                        '@type': 'Answer',
                        text:
                            '출결 기록, 학생·반 관리, 업무 공유 같은 기본 관리 기능은 학생 수 제한 없이 무료입니다. ' +
                            '학부모 알림은 알림톡 1건 19원·문자 24원, AI 수업 피드백은 1건 50원입니다. 발송 잔액과 AI 크레딧은 따로 충전합니다.',
                    },
                },
                {
                    '@type': 'Question',
                    name: '학원 출결 알림을 카카오톡으로 보낼 수 있나요?',
                    acceptedAnswer: {
                        '@type': 'Answer',
                        text:
                            '보낼 수 있습니다. 학생이 출결 키패드에 번호를 누르면 등원·하원 알림이 카카오 알림톡이나 문자로 나갑니다. ' +
                            '알림톡은 학원 카카오 채널 연동 승인 후 쓰고, 발송비는 선불로 충전합니다.',
                    },
                },
                {
                    '@type': 'Question',
                    name: '수업 리포트를 AI 가 대신 써주나요?',
                    acceptedAnswer: {
                        '@type': 'Answer',
                        text:
                            '선생님이 태그를 고르고 메모를 적으면 AI 가 한두 문장의 수업 피드백을 씁니다. 월간·분기 종합 리포트도 만듭니다. ' +
                            '학부모에게는 선생님이 카카오톡 공유나 이메일로 보냅니다. 카카오톡 링크는 7일 동안 열리고, 이메일은 리포트 내용이 본문으로 갑니다.',
                    },
                },
                {
                    '@type': 'Question',
                    name: '학교별 기출로 영어 예상 문제를 만들 수 있나요?',
                    acceptedAnswer: {
                        '@type': 'Answer',
                        text:
                            '기출 이미지나 PDF 를 올리면 AI 가 분석하고, 학교 기출 전체·최근 3년·특정 연도 중 범위를 골라 ' +
                            '5지선다 예상 문제를 1~30문항 만듭니다. 문항 하나만 다시 뽑을 수 있고 A4 PDF 로 내려받습니다. 영어 전용 기능입니다.',
                    },
                },
                {
                    '@type': 'Question',
                    name: '학생 수가 많으면 요금이 올라가나요?',
                    acceptedAnswer: {
                        '@type': 'Answer',
                        text:
                            '기본 관리 기능은 올라가지 않습니다. AI 무제한 패스만 재원생 수에 따라 월 19,000원~99,000원 네 구간으로 나뉩니다. ' +
                            '예상 문제 출제와 다시 뽑기(1문항 20원)는 패스가 있어도 차감됩니다.',
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
            // 값에 </script> 가 섞이는 사고를 막는다
            dangerouslySetInnerHTML={{ __html: JSON.stringify(DATA).replace(/</g, '\\u003c') }}
        />
    );
}
