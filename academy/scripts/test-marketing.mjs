// 바깥 글 초안(Step 35 D53·D56) 단위 시험 — 가짜 행·글자만, DB·네트워크·Claude 없음.
//   node scripts/test-marketing.mjs
import { CLIENTS, bySlug, 고객설정 } from "../clients.mjs";
import { 대상고르기, 관문, 대조표, 본문글, 대안찾기, 낯선문장, 프롬프트, 사실줄, 바깥글빠진칸 } from "./marketing-draft.mjs";
import { countUsed, normUrl, searchLink, spotsNote, readSpots } from "../../web/lib/marketing-core.mjs";

let 통과 = 0, 실패 = 0;
const 봄 = (이름, 참) => { if (참) 통과++; else { 실패++; console.log(`✗ ${이름}`); } };

const c = bySlug("docttak", CLIENTS);
const 맞는페이지 = (t) => c.marketing.pages.find((x) => x.re.test(t)) ?? null;

// 검색어 17개가 모두 페이지에 맞는다 — 맞는 줄이 없으면 그 질문은 영영 안 쓰인다
const 검색어 = ["pdf 합치기 무료", "아이폰 pdf 합치기", "pdf 합치기 방법", "안전한 pdf 합치기", "파일 안 올리는 pdf 합치기", "pdf 용량 줄이기",
  "정부24 pdf 용량", "사진 용량 줄이기", "사진 kb 줄이기", "증명사진 용량 줄이기", "여권사진 규격", "증명사진 사이즈", "공무원 시험 사진 규격",
  "큐넷 사진 규격", "한글파일 pdf로 변환", "hwp pdf 변환", "hwpx 열기"];
봄("검색어 17개 모두 페이지", 검색어.every((t) => 맞는페이지(t)));
봄("증명사진 용량은 증명사진 안내로", 맞는페이지("증명사진 용량 줄이기").guide === "/guide/id-photo-kb/");
봄("정부24 는 제출 용량 모음으로", 맞는페이지("정부24 pdf 용량").guide === "/guide/upload-limits/");
봄("hwpx 는 보기 도구로", 맞는페이지("hwpx 열기").tool === "/hwp-viewer/");

// 대상 고르기 — 이름 안 나온 것부터 · 채널별 14일 안 반복 금지 · 같은 날 두 채널은 다른 질문·다른 페이지
const 질문들 = 검색어.map((text, i) => ({ text, position: i + 1 }));
const 고름 = 대상고르기(질문들, new Map([["pdf 합치기 무료", 2]]), [
  { channel: "jisikin", target_query: "아이폰 pdf 합치기", created_on: "2026-10-01" },
], ["jisikin", "cafe", "blog"], 맞는페이지);
봄("세 채널 다 고름", 고름.size === 3);
봄("같은 날 같은 질문 없음", new Set(고름.values()).size === 3);
봄("같은 날 같은 페이지 없음", new Set([...고름.values()].map((t) => 맞는페이지(t).guide)).size === 3);
봄("이름 나온 질문은 뒤로", ![...고름.values()].includes("pdf 합치기 무료"));
봄("최근에 쓴 페이지는 뒤로", ![...고름.values()].some((t) => 맞는페이지(t).guide === "/guide/pdf-merge/"));
const 다씀 = 대상고르기(질문들, new Map(), 검색어.map((t) => ({ channel: "jisikin", target_query: t, created_on: "2026-10-01" })), ["jisikin"], 맞는페이지);
봄("14일 안에 다 쓰면 안 고름", !다씀.has("jisikin"));

// 본문 글자 — 엔티티 풀기·줄 남기기
const 글 = 본문글(`<html><main><h1>여권사진</h1><p>가로 3.5 cm·세로 4.5 cm, 413×531픽셀, 500 KB 이하</p><p>출처: 외교부 여권안내 (여권) · 확인일 2026-09-29</p><p>[파일 &gt; PDF로 저장]</p></main><script>x=1</script></html>`);
봄("본문 줄", 글.split("\n").length === 4 && 글.includes("[파일 > PDF로 저장]") && !글.includes("x=1"));

const p = {
  query: "여권사진 규격", 사실: "고정 사실: 안내 글 31편", 페이지: [{ url: "https://docttak.com/guide/passport-photo/", 글 }],
  사이트맵: new Set(["/id-photo/", "/guide/passport-photo/"]), 바깥: ["https://www.passport.go.kr/home/kor/contents.do?menuPos=31"],
  guide: "https://docttak.com/guide/passport-photo/", tool: "https://docttak.com/id-photo/", 기관: ["외교부"], 대안: ["외교부"], 근거: `고정 사실: 안내 글 31편\n${글}`,
};
const 좋은 = [
  "여권사진은 가로 3.5 cm·세로 4.5 cm예요. 온라인 신청 파일은 413×531픽셀, 500 KB 이하로 맞춰야 올라가요.",
  "외교부 여권안내에서 규격을 한 번 더 확인할 수 있어요. 문서딱은 사진을 자르고 크기와 용량만 맞추고, 얼굴이나 배경은 고치지 않아요.",
  "규격 맞추기는 https://docttak.com/id-photo/ 에서 해요. 안내 글은 31편 있어요.",
  c.marketing.disclosure,
].join("\n\n");
봄("좋은 지식iN 답 통과", 관문("jisikin", { title: "여권사진 규격이 어떻게 되나요?", body: 좋은 }, p, c).length === 0);
const 걸림 = (body, ch = "jisikin") => 관문(ch, { title: "여권사진 규격", body }, p, c).join(" / ");
봄("근거 없는 두 자리 숫자", /근거 없는 숫자: 600/.test(걸림(좋은.replace("500 KB", "600 KB"))));
봄("근거 없는 한 자리 규격", /근거 없는 규격 숫자: 5 MB/.test(걸림(좋은.replace("크기와 용량만", "5 MB 까지 크기와 용량만"))));
봄("공개 문장 없음", /공개 문장/.test(걸림(좋은.replace(c.marketing.disclosure, "끝."))));
봄("사이트맵에 없는 주소", /사이트맵에 없는 주소/.test(걸림(좋은.replace("/id-photo/", "/remove-background/"))));
봄("비공개 도구 말", /비공개 도구/.test(걸림(`${좋은}\n\n배경 지우기 도구도 있어요.`)));
봄("지식iN 링크 둘", /도구 주소 하나/.test(걸림(`${좋은}\n\nhttps://docttak.com/guide/passport-photo/`)));
봄("근거에 없는 바깥 주소", /근거에 없는 바깥 주소/.test(걸림(`${좋은}\n\nhttps://example.com/x`)));
봄("근거 페이지의 공식 주소는 됨", !/바깥 주소/.test(걸림(`${좋은}\n\nhttps://www.passport.go.kr/home/kor/contents.do?menuPos=31`)));
봄("다른 방법 안 알림(지식iN)", /다른 방법을 안 알렸습니다/.test(걸림(좋은.replace("외교부 여권안내에서", "다른 곳에서"))));
봄("다른 방법 안 알림(카페)", /다른 방법을 안 알렸습니다/.test(걸림(좋은.replace("외교부 여권안내에서", "다른 곳에서"), "cafe")));
const 대안없음 = { ...p, 대안: [] };
봄("원문에 대안이 없으면 공고 확인", /제출처 공고/.test(관문("jisikin", { title: "여권사진", body: 좋은.replace("외교부 여권안내에서", "다른 곳에서") }, 대안없음, c).join(" ")));
봄("원문에 대안이 없고 공고 확인 있음 → 통과", !/공고|다른 방법/.test(관문("jisikin", { title: "여권사진", body: 좋은.replace("외교부 여권안내에서", "제출처 공고에서") }, 대안없음, c).join(" ")));
봄("대안은 본론에서만 · 브라우저는 대안 아님", JSON.stringify(대안찾기(["한컴 안내\nSafari 로 열어요\n함께 보면 좋은 안내\n정부24 사진"], ["외교부"], c.marketing.alternatives)) === JSON.stringify(["외교부", "한컴"]));

// 읽을 자리 — 원문 겹침 낮은 문장만, 공개 문장은 비교 원문에 넣으면 안 걸림
const 낯 = 낯선문장(`${좋은}\n\n업로드가 안 되는 원인은 대부분 인터넷 속도 문제입니다.`, [p.근거, c.marketing.disclosure].join("\n"));
봄("읽을 자리 — 지어낸 원인", 낯.some((x) => x.문장.includes("인터넷 속도")));
봄("읽을 자리 — 원문 문장은 안 걸림", !낯.some((x) => x.문장.includes("가로 3.5")) && !낯.some((x) => x.문장.includes("제가 만든")));
봄("읽을 자리 note 왕복", JSON.stringify(readSpots(spotsNote(["가 ‖ 나", "다"]))) === JSON.stringify(["가 나", "다"]) && readSpots("게시 승인 10-02").length === 0 && spotsNote([]) === "" && JSON.stringify(readSpots("게시 승인 10-02 22:50 · " + spotsNote(["가", "나"]))) === JSON.stringify(["가", "나"]));
봄("보장 말", /보장 말/.test(걸림(`${좋은}\n\n무조건 통과돼요.`)));
봄("후기처럼", /후기/.test(걸림(`${좋은}\n\n써 봤는데 좋았어요.`)));
봄("블로그는 1500자 하한", /본문 \d+자/.test(걸림(좋은, "blog")));
봄("블로그는 원문 안내 링크", /원문 안내 페이지 링크/.test(걸림(좋은, "blog")));

const 표 = 대조표(`3.5 cm, 413×531픽셀, 500 KB`, p);
봄("대조표 원문 줄", 표.length >= 4 && 표.every((x) => x.url.includes("/guide/passport-photo/")));

// 효과 — 올린 뒤 측정만, 주소 꼴 맞추기
봄("블로그 주소 꼴", normUrl("https://m.blog.naver.com/PostView.naver?blogId=a&logNo=1") === normUrl("https://blog.naver.com/a/1/"));
봄("지식iN 은 docId", normUrl("https://kin.naver.com/qna/detail.naver?d1id=1&docId=7") === "kin.naver.com/qna/detail.naver?docId=7");
const e = countUsed(
  [{ id: 1, posted_url: "https://blog.naver.com/a/1", posted_day: "2026-10-03" }, { id: 2, posted_url: "https://cafe.naver.com/b/2", posted_day: "2026-10-03" }],
  [{ engine: "chatgpt-web", measured_on: "2026-10-02", url: "https://blog.naver.com/a/1" },
    { engine: "gemini-web", measured_on: "2026-10-04", url: "https://m.blog.naver.com/a/1" },
    { engine: "perplexity-web", measured_on: "2026-10-05", url: "https://blog.naver.com/a/1" }]);
봄("올린 2 중 1 쓰임", e.posted === 2 && e.used === 1);
봄("올리기 전 측정은 안 셈", !e.perEngine["chatgpt-web"] && e.perEngine["gemini-web"] === 1 && e.perEngine["perplexity-web"] === 1);
봄("검색 링크", searchLink("jisikin", "a b")?.includes("where=kin") && searchLink("cafe", "a")?.includes("where=article") && searchLink("blog", "a") === null);

// DB 고객(Step 39a) — 문서딱 말이 새지 않고, 사실 0 이면 안 쓴다
{
  const 행 = { id: 9, slug: "m-co", name: "엠", domain: "m.kr", answer_pattern: "엠",
    config: { marketing: { enabled: true, pages: [{ all: [["여권"]], guide: "/guide/passport-photo/", tool: "/id-photo/" }], disclosure: "제가 일하는 곳입니다." } } };
  const db0 = 고객설정(행, {});
  봄("DB 고객 사실 0 → marketing.facts 빠짐", 바깥글빠진칸(db0) === "marketing.facts");
  봄("문서딱(코드) 은 빠짐 없음", 바깥글빠진칸({ ...c, 출처: "코드" }) === null);
  봄("코드 고객 사실 0 도 안 씀", 바깥글빠진칸({ ...c, 출처: "코드", marketing: { ...c.marketing, facts: [] } }) === "marketing.facts");
  const db = 고객설정({ ...행, config: { marketing: { ...행.config.marketing, facts: [{ text: "사실 가" }, { text: "사실 나." }] } } }, {});
  봄("DB 고객 사실 있음 → 빠짐 없음", 바깥글빠진칸(db) === null);
  const 줄 = 사실줄(db, null);
  봄("사실 줄 — 안내 수 없으면 머리말 없이", 줄 === "엠 고정 사실: 사실 가, 사실 나.", 줄);
  봄("사실 줄 — guidePrefix 있으면 안내 수", 사실줄({ ...db, marketing: { ...db.marketing, guidePrefix: "/guide/" } }, 3) === "엠 고정 사실(오늘 사이트맵 기준): 안내 글 3편, 사실 가, 사실 나.");
  const dp = { ...p, 사실: 줄, 근거: `${줄}\n${글}` };
  const 프 = ["jisikin", "cafe", "blog"].map((ch) => 프롬프트(db, ch, dp)).join("\n");
  봄("DB 고객 프롬프트 — 문서딱 0", !프.includes("문서딱"));
  봄("DB 고객 프롬프트 — persona 기본값", 프.includes("너는 엠(m.kr) 쪽 사람이다. 소속을 숨기지 않고 밝히며 정보를 나눈다.") && !프.includes("무료 도구"));
  봄("DB 고객 프롬프트 — situations 없으면 「(예:」 없음", !프.includes("(예:"));
  봄("DB 고객 프롬프트 — 사실 두 줄", 프.includes("사실 가, 사실 나."));
  봄("DB 고객 관문 — 문서딱 금지 말(배경 지우기)은 안 붙음", !/비공개 도구/.test(관문("jisikin", { title: "x", body: `${좋은}\n\n배경 지우기 도구도 있어요.` }, p, db).join(" ")));
  const 관 = 관문("cafe", { title: "x", body: "짧다" }, { ...p, 대안: [] }, db).join(" / ");
  봄("DB 고객 관문 — 이름이 고객 이름", 관.includes("엠 링크는 한두 개") && !관.includes("문서딱"), 관);
  봄("DB 고객 금지 말 — 글자 그대로", /금지 말: a\.b/.test(관문("jisikin", { title: "x", body: `${좋은}\n\na.b 기능` }, p, 고객설정({ ...행, config: { marketing: { ...행.config.marketing, banned: ["a.b"] } } }, {})).join(" ")));
}

console.log(`\n${통과} 통과 · ${실패} 실패`);
if (실패) process.exitCode = 1;
