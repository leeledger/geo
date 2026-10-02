// 바깥 글 초안(Step 35 D53·D56) 단위 시험 — 가짜 행·글자만, DB·네트워크·Claude 없음.
//   node scripts/test-marketing.mjs
import { bySlug } from "../clients.mjs";
import { 대상고르기, 관문, 대조표, 본문글 } from "./marketing-draft.mjs";
import { countUsed, normUrl, searchLink } from "../../web/lib/marketing-core.mjs";

let 통과 = 0, 실패 = 0;
const 봄 = (이름, 참) => { if (참) 통과++; else { 실패++; console.log(`✗ ${이름}`); } };

const c = bySlug("docttak");
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
  guide: "https://docttak.com/guide/passport-photo/", tool: "https://docttak.com/id-photo/", 기관: ["외교부"], 근거: `고정 사실: 안내 글 31편\n${글}`,
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
봄("공식 길 안 알림", /공식 길/.test(걸림(좋은.replace("외교부 여권안내에서", "다른 곳에서"))));
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

console.log(`\n${통과} 통과 · ${실패} 실패`);
if (실패) process.exitCode = 1;
