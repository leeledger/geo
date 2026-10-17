// 두 칸 등록 · 자동 세팅(Step 55) 단위 시험 — 가짜 q·가짜 fetch·가짜 DNS 만. DB·네트워크 없음.
//   node scripts/test-auto-setup-core.mjs
// 갈래: 플랫폼 목록 옮기기 · 입력나누기 · slug · 로마자 · 판별말 · 사실뽑기 · 거르기 · 자동완성 · 패널 → 패널점검 · 단계 기계(임대·의존·실패 3·재시도·원장 출처·사실 저장)
import fs from "node:fs";
import path from "node:path";
import { 계정이름 } from "../../tools/auto-login.mjs";
import { 패널점검 } from "./seed-panel.mjs";
import { answerPattern, CODE_SLUGS, 금지말찾기 } from "../../web/lib/client-core.mjs";
import { PLATFORMS, platformOf, classifyTarget, 호스트갈래, BUILDER_HOSTS } from "../../web/lib/platform-hosts.mjs";
import { 이름흔함, 지역짧게, 업종표, 모든시군구, 동의어 } from "../../web/lib/auto-setup-words.mjs";
import {
  입력나누기, slug고르기, 로마자, 판별말, 사실뽑기, 씨앗, 응답말, 자동완성, 자동완성주소, 자동완성UA, 출처붙임, 거르기, 패널만들기, 두칸칸,
  다음단계, 자동요약, 자동한걸음, 재시도, 사실입력검사, 사실저장, 자동이어하기, 사이트상태, 임대초, 멈춘단계, 틀검색어, 넓힌씨앗,
} from "../../web/lib/auto-setup-core.mjs";

let 통과 = 0, 실패 = 0;
const 봄 = (이름, 참, 보탬 = "") => { if (참) 통과++; else { 실패++; console.log(`✗ ${이름}${보탬 ? ` — ${보탬}` : ""}`); } };
const J = JSON.stringify;

// ─────────────────────────────────────────── 55a 플랫폼 목록 — 옮기기 전과 같다(옮기기 전 platform-check.ts 목록을 그대로 베낌)
{
  const 옛 = [["naver_blog", ["blog.naver.com", "m.blog.naver.com"]], ["naver_place", ["m.place.naver.com", "pcmap.place.naver.com", "map.naver.com"]],
    ["naver_store", ["smartstore.naver.com", "m.smartstore.naver.com"]], ["instagram", ["instagram.com", "www.instagram.com"]], ["kakao_channel", ["pf.kakao.com"]],
    ["kakao_place", ["place.map.kakao.com"]], ["brunch", ["brunch.co.kr"]], ["youtube", ["youtube.com", "www.youtube.com", "m.youtube.com"]], ["naver_short", ["naver.me"]]];
  봄("PLATFORMS 10개 · 순서 그대로", J(PLATFORMS.map((p) => p.id)) === J(["naver_blog", "naver_place", "naver_store", "tistory", "instagram", "kakao_channel", "kakao_place", "brunch", "youtube", "naver_short"]));
  봄("platformOf — 목록 전 호스트가 옮기기 전과 같다", 옛.every(([id, hs]) => hs.every((h) => platformOf(h)?.id === id) && hs.every((h) => platformOf(h.toUpperCase())?.id === id)));
  봄("platformOf — tistory 하위만 · 비슷한 호스트 아님", platformOf("my-blog.tistory.com")?.id === "tistory" && platformOf("tistory.com") === null && platformOf("x.y.tistory.com") === null
    && platformOf("blog.naver.com.evil.com") === null && platformOf("smartplace.naver.com") === null && platformOf("cited.kr") === null);
  봄("호스트갈래 — 플랫폼·빌더·사이트", 호스트갈래("blog.naver.com") === "플랫폼" && 호스트갈래("a.wixsite.com") === "빌더"
    && 호스트갈래("a.imweb.me") === "빌더" && 호스트갈래("imweb.me") === "사이트" && 호스트갈래("miso.kr") === "사이트" && BUILDER_HOSTS.length === 2);
  // D237 — 네이버 modoo! 는 2025-06-26 종료(모든 하위도메인이 종료 안내로 200). 홈페이지 없음과 같다
  봄("호스트갈래 — modoo 는 없음(종료, D237)", 호스트갈래("miso.modoo.at") === "없음" && 호스트갈래("modoo.at") === "없음" && 호스트갈래("www.modoo.at") === "없음" && 호스트갈래("modoo.at.evil.com") === "사이트");
  봄("classifyTarget — 옮긴 뒤 그대로", classifyTarget("blog.naver.com").kind === "error" && classifyTarget("new.smartplace.naver.com/x").msg.startsWith("스마트플레이스")
    && J(classifyTarget("https://x:y@blog.naver.com/a#h")) === J({ kind: "platform", id: "naver_blog", url: "https://blog.naver.com/a" }));
}

// ─────────────────────────────────────────── 입력나누기 (4갈래 + 거부)
{
  봄("입력나누기 — 빈칸 → 없음", J(입력나누기("a", "  ")) === J({ 갈래: "없음", domain: null }));
  const p = 입력나누기("a", "https://blog.naver.com/naver_diary");
  봄("입력나누기 — 플랫폼 → domain null · 채널 blog", p.갈래 === "플랫폼" && p.domain === null && J(p.채널) === J({ 칸: "blog", id: "naver_blog", url: "https://blog.naver.com/naver_diary" }));
  봄("입력나누기 — 인스타·플레이스 칸", 입력나누기("a", "instagram.com/miso.dental").채널.칸 === "sns" && 입력나누기("a", "https://m.place.naver.com/hospital/123").채널.칸 === "place");
  봄("입력나누기 — 빌더 하위도메인", J(입력나누기("a", "https://miso.imweb.me/")) === J({ 갈래: "빌더", domain: "miso.imweb.me" }));
  봄("입력나누기 — 사이트 · www·스킴 뗌", J(입력나누기("a", "HTTPS://www.Miso-Dental.co.kr")) === J({ 갈래: "사이트", domain: "miso-dental.co.kr" }));
  const 경로 = 입력나누기("a", "miso.kr/about?x=1");
  봄("입력나누기 — 경로 있는 주소 → domain 호스트 · 원문 남김", 경로.domain === "miso.kr" && 경로.원문 === "miso.kr/about?x=1");
  봄("입력나누기 — 스마트플레이스 관리 주소 거부", /스마트플레이스 관리 화면/.test(입력나누기("a", "https://new.smartplace.naver.com/bizes/1").오류));
  봄("입력나누기 — 블로그 뿌리 주소 거부", /주소 전체를/.test(입력나누기("a", "blog.naver.com").오류));
  const 모두 = 입력나누기("a", "https://miso.modoo.at/");
  봄("입력나누기 — modoo → 없음 · domain null · 원문 남김(D237)", 모두.갈래 === "없음" && 모두.domain === null && 모두.원문 === "https://miso.modoo.at/" && !모두.채널);
  봄("입력나누기 — IP 거부", /IP 주소/.test(입력나누기("a", "http://10.0.0.1/").오류));
  봄("입력나누기 — localhost 거부", /localhost|주소를 다시/.test(입력나누기("a", "localhost:3000").오류 ?? ""));
  봄("입력나누기 — 점 없음 거부", !!입력나누기("a", "intranet").오류);
  봄("입력나누기 — ftp 거부", !!입력나누기("a", "ftp://miso.kr").오류);
}

// ─────────────────────────────────────────── slug · 로마자
{
  // 겹받침(ㄻ·ㄺ·ㄼ)은 대표 소리 글자 하나 · ㅇ 첫소리는 비움 · ㄹ 받침 뒤 ㄹ 첫소리는 ll · 동화·연음 없음(학원 → hakwon)
  const 로 = [["미소치과", "misochigwa"], ["닭갈비", "dakgalbi"], ["삶의쉼표", "samuiswimpyo"], ["여덟", "yeodeol"], ["읽기", "ikgi"],
    ["안양", "anyang"], ["울릉", "ulleung"], ["설렁탕", "seolleongtang"], ["로봇&코딩학원", "robot kodinghakwon"], ["가B1나", "gab1na"]];
  봄("로마자 — 10개(겹받침·ㅇ첫소리·ㄹ)", 로.every(([a, b]) => 로마자(a) === b), 로.map(([a, b]) => `${a}:${로마자(a)}${로마자(a) === b ? "" : `≠${b}`}`).join(" "));
  const 슬 = (x, 쓰인) => slug고르기(x, 쓰인);
  봄("slug — 도메인 첫 마디", 슬({ 갈래: "사이트", domain: "miso-dental.co.kr", name: "미소" }) === "miso-dental");
  봄("slug — 블로그 아이디 밑줄 → -", 슬({ 갈래: "플랫폼", domain: null, 채널: { id: "naver_blog", url: "https://blog.naver.com/naver_diary" }, name: "x" }) === "naver-diary");
  봄("slug — 인스타 점 → -", 슬({ 갈래: "플랫폼", domain: null, 채널: { id: "instagram", url: "https://instagram.com/miso.dental" }, name: "x" }) === "miso-dental");
  봄("slug — 티스토리 하위도메인", 슬({ 갈래: "플랫폼", domain: null, 채널: { id: "tistory", url: "https://my-blog.tistory.com/" }, name: "x" }) === "my-blog");
  봄("slug — 플레이스 → 이름 로마자", 슬({ 갈래: "플랫폼", domain: null, 채널: { id: "naver_place", url: "https://m.place.naver.com/hospital/1" }, name: "미소 치과" }) === "miso-chigwa");
  봄("slug — 없음 → 이름 로마자", 슬({ 갈래: "없음", domain: null, name: "시험꽃집" }) === "siheomkkotjip");
  봄("slug — 겹치면 -2 · -3", 슬({ 갈래: "사이트", domain: "cited.kr", name: "x" }, ["cited"]) === "cited-2" && 슬({ 갈래: "사이트", domain: "cited.kr", name: "x" }, ["cited", "cited-2"]) === "cited-3");
  봄("slug — 코드 slug·new 피함", 슬({ 갈래: "사이트", domain: "ilog.kr", name: "x" }) === "ilog-2" && 슬({ 갈래: "사이트", domain: "new.kr", name: "x" }) === "new-2");
  const 긴 = 슬({ 갈래: "사이트", domain: `${"a".repeat(60)}.kr`, name: "x" }, ["a".repeat(40)]);
  봄("slug — 40자 · 겹쳐도 40자 안", 긴.length <= 40 && /^[a-z0-9-]{1,40}$/.test(긴) && 긴.endsWith("-2"), 긴);
  봄("slug — 비면 client", 슬({ 갈래: "없음", domain: null, name: "!!" }) === "client");
  const 모두 = ["miso-dental", "naver-diary", "siheomkkotjip", "cited-2", "client", 긴];
  봄("slug — 계정이름()(naver-<slug> 프로필) 정규식 통과", 모두.every((s) => 계정이름(path.join("C:/x", `.browser-profile-${s}`)) === `naver-${s}`));
  봄("slug — CODE_SLUGS 를 안 줌", !모두.some((s) => CODE_SLUGS.includes(s)));
}

// ─────────────────────────────────────────── 판별말 · 흔한 이름 (D223·D224)
{
  const a = 판별말("시험치과 송파점", "cited.kr");
  봄("판별말 — 이름+도메인", J(a.terms) === J(["시험치과 송파점", "cited.kr"]) && a.흔함 === false);
  const b = 판별말("송파치과", "songpa.kr");
  봄("판별말 — 흔한 이름 → 도메인만", J(b.terms) === J(["songpa.kr"]) && b.흔함 && /2자 미만/.test(b.까닭));
  const c = 판별말("강동 수학 학원", null);
  봄("판별말 — 흔하고 도메인 없음 → 없음", J(c.terms) === "[]" && c.흔함 && /도메인도 없어/.test(c.까닭));
  const d = 판별말("Acme", "acme.kr");
  봄("판별말 — 맨 영어 낱말 안 넣음(도메인은 넣음)", J(d.terms) === J(["acme.kr"]) && /맨 영어/.test(d.까닭));
  봄("판별말 — 2자 이하 흔함", 이름흔함("미소") && 이름흔함("A치과") === true);
  봄("이름흔함 — 업종·지역·점 빼고 2자", !이름흔함("미소치과의원") && 이름흔함("강남역점") && !이름흔함("새솔수학학원") && 이름흔함("서울 강남구 수학학원 본점"));
  봄("이름흔함 — 도메인·영문은 판정 안 함", !이름흔함("cited.kr") && !이름흔함("robotncoding"));
  const re = new RegExp(answerPattern(a.terms.join(",")), "i");
  봄("판별말 — answerPattern 이 띄어쓰기 변형을 잡음", re.test("시험치과송파점") && re.test("시험 치과 송파점") && re.test("CITED.KR") && !re.test("송파 치과"));
}

// ─────────────────────────────────────────── 사실뽑기 (D225)
{
  const ld = (x) => `<script type="application/ld+json">${typeof x === "string" ? x : J(x)}</script>`;
  const g = 사실뽑기(ld({ "@graph": [{ "@type": "WebSite" }, { "@type": "Dentist", address: { "@type": "PostalAddress", addressRegion: "서울특별시", addressLocality: "송파구" } }] }), "미소");
  봄("사실 — JSON-LD @graph Dentist · address 송파구", g.업종.값 === "치과" && /Dentist/.test(g.업종.출처) && g.지역.값 === "송파구" && /적힌 주소/.test(g.지역.출처), J(g));
  const arr = 사실뽑기(ld([{ "@type": "Organization", address: "경기도 성남시 분당구 정자동 1" }]), "미소치과");
  봄("사실 — JSON-LD 배열 · 글자 주소 · 시 아래 구", arr.업종.값 === "치과" && /이름/.test(arr.업종.출처) && arr.지역.값 === "분당구", J(arr));
  const 깨짐 = 사실뽑기(`${ld("{깨짐")}<title>잠실 미소치과</title><p>서울 송파구 올림픽로 1</p>`, "미소");
  봄("사실 — 깨진 JSON-LD 건너뜀 → 제목·본문", 깨짐.업종.값 === "치과" && /제목/.test(깨짐.업종.출처) && 깨짐.지역.값 === "송파구" && /홈페이지 글/.test(깨짐.지역.출처), J(깨짐));
  const 둘 = 사실뽑기("<p>본점 서울 송파구 1</p><p>강남점 서울 강남구 2</p>", "미소치과");
  봄("사실 — 지역 둘 → 모름(지점 여럿을 하나로 안 찍음)", 둘.지역.값 === null && /2곳/.test(둘.지역.출처));
  봄("사실 — 같은 지역 여러 번은 하나", 사실뽑기("<p>서울 송파구 1</p><footer>서울특별시 송파구</footer>", "미소치과").지역.값 === "송파구");
  봄("사실 — 지역 없음 → 모름", 사실뽑기("<p>안녕하세요</p>", "미소치과").지역.값 === null);
  봄("사실 — 「인서울 강남구」 같은 앞붙음은 안 잡음", 사실뽑기("<p>인서울강남구</p>", "x").지역.값 === null);
  봄("사실 — 제목 업종 둘 → 모름", 사실뽑기("<title>치과 · 한의원</title>", "미소").업종.값 === null);
  봄("사실 — 이름 업종(띄어 쓴 학원)", 사실뽑기("", "OO 영어 학원").업종.값 === "영어학원" && 사실뽑기("", "로봇&코딩학원").업종.값 === "코딩학원");
  봄("사실 — 이름 업종 없음 · 본문 없음 → 모름", 사실뽑기("", "시험블로그").업종.값 === null);
  봄("사실 — 낱말 끝·꼬리(의원)만 업종으로", 사실뽑기("<title>밝은눈안과의원</title>", "x").업종.값 === "안과" && 사실뽑기("<title>치과기공 재료</title>", "x").업종.값 === null);
  봄("지역짧게", 지역짧게("송파구") === "송파" && 지역짧게("중구") === "중구" && 지역짧게("수원시") === "수원" && 지역짧게("고성군") === "고성");
  봄("업종표 — 학원 꼴 → 과목학원", 업종표.find((x) => x.업종 === "수학학원").말.includes("수학교습소") && 업종표.find((x) => x.업종 === "수학학원").말.includes("수학공부방"));
}

// ─────────────────────────────────────────── 씨앗 · 거르기 · 자동완성 원문
{
  봄("씨앗 — 1차 셋(중복 없음)", J(씨앗("치과", "송파구")) === J(["송파 치과", "송파구 치과", "송파 치과 추천"]) && 씨앗("치과", "중구").length === 2);
  봄("응답말 — 원응답 모양", J(응답말({ query: ["송파 치과"], items: [[["송파 치과의원"], ["송파 치과병원"]]] })) === J(["송파 치과의원", "송파 치과병원"]) && J(응답말({})) === "[]");
  const 원 = ["송파 치과의원", "송파 치과 채용", "송파 치과의원", "송파치과의원", "미소치과 송파", "송파 맛집", "치과 뜻", "송파 치과 추천", "송파 치과 알바", "잠실 치과"];
  봄("거르기 — 업종 없음·이름·채용·뜻·알바·띄어쓰기 중복 뺌 · 순서", J(거르기(원, { 판별말: ["미소치과"], 업종: "치과", 이름: "미소치과" })) === J(["송파 치과의원", "송파 치과 추천", "잠실 치과"]));
  const 붙음 = 출처붙임([{ q: "송파 치과", items: ["a 치과", "b 치과"] }]);
  봄("출처붙임 — 씨앗·순위", J(붙음[1]) === J({ text: "b 치과", 씨앗: "송파 치과", 순위: 2 }));
  봄("거르기 — 객체 그대로", 거르기(붙음, { 업종: "치과" })[0].순위 === 1);
}
{
  const 부름 = [];
  const 가짜 = (표) => async (url, init) => {
    부름.push({ url, ua: init.headers["user-agent"] });
    const q = new URL(url).searchParams.get("q");
    const h = 표[q];
    if (h === "멈춤") return new Promise((_, rej) => init.signal.addEventListener("abort", () => rej(new Error("aborted"))));
    if (typeof h === "number") return new Response("x", { status: h });
    return new Response(J({ query: [q], items: [(h ?? []).map((x) => [x])] }), { status: 200 });
  };
  const r = await 자동완성(["송파 치과", "송파구 치과"], { fetch: 가짜({ "송파 치과": ["송파 치과의원", "송파 치과 추천"], "송파구 치과": 503 }), 간격: 0,
    다음씨앗: (결과) => 출처붙임(결과).map((x) => x.text), now: () => new Date("2026-10-17T00:00:00Z") });
  봄("자동완성 — 호스트 고정 주소 · 정직한 UA", 부름.every((x) => x.url.startsWith("https://ac.search.naver.com/nx/ac?q=") && x.ua === 자동완성UA) && 자동완성주소("a&b=c").includes("q=a%26b%3Dc"));
  봄("자동완성 — 5xx 는 그 씨앗만 · 2차는 1차 결과", J(r.씨앗.map((s) => [s.q, s.차, s.status])) === J([["송파 치과", 1, 200], ["송파구 치과", 1, 503], ["송파 치과의원", 2, 200], ["송파 치과 추천", 2, 200]]) && r.fetched_at === "2026-10-17T00:00:00.000Z");
  부름.length = 0;
  const 막 = await 자동완성(["a 치과", "b 치과", "c 치과"], { fetch: 가짜({ "a 치과": ["a 치과의원"], "b 치과": 403 }), 간격: 0 });
  봄("자동완성 — 403 이면 뒤 씨앗은 안 두드림", 부름.length === 2 && 막.씨앗[1].status === 403 && 막.씨앗[2].status === null && /막혀/.test(막.씨앗[2].오류));
  부름.length = 0;
  const 많 = await 자동완성(Array.from({ length: 45 }, (_, i) => `s${i}`), { fetch: 가짜({}), 간격: 0 });
  봄("자동완성 — 최대 40번(D246)", 부름.length === 40 && 많.씨앗.filter((s) => s.오류 === "최대 40번").length === 5);
  const 느림 = await 자동완성(["a"], { fetch: 가짜({ a: "멈춤" }), 한도: 30, 간격: 0 });
  봄("자동완성 — 요청당 한도 넘으면 시간 초과", 느림.씨앗[0].status === null && /시간 초과/.test(느림.씨앗[0].오류));
}

// ─────────────────────────────────────────── 패널만들기 → seed-panel 패널점검
{
  const kw = Array.from({ length: 17 }, (_, i) => ({ text: `송파 치과 ${i}`, 씨앗: "송파 치과", 순위: i + 1 }));
  const 패널 = 패널만들기(kw, "시험치과 송파점", "cited.kr");
  const pattern = answerPattern("시험치과 송파점,cited.kr");
  봄("패널 — 20개 · keyword 17 · brand 3", 패널.length === 20 && 패널.filter(([s]) => s === "keyword").length === 17 && 패널.filter(([s]) => s === "brand").length === 3);
  봄("패널 — brand 꼴", 패널[17][1] === "시험치과 송파점 어떤 곳이야?" && 패널[18][1] === "cited.kr 뭐 하는 곳이야?" && 패널[19][1] === "시험치과 송파점");
  봄("패널 — 출처 「네이버 자동완성 · 씨앗 · n위」", 패널[2][2] === "네이버 자동완성 · 씨앗 송파 치과 · 3위");
  봄("패널 — seed-panel 패널점검 통과", 패널점검({ SLUG: "cited-2", 패널, 이름말: () => pattern }, pattern) === null, 패널점검({ SLUG: "cited-2", 패널, 이름말: () => pattern }, pattern));
  봄("패널 — 도메인 없으면 「어디에 있어?」", 패널만들기(kw, "꽃집", null)[18][1] === "꽃집 어디에 있어?");
}

// ─────────────────────────────────────────── 두칸칸
{
  const r = 두칸칸({ name: " 시험치과  송파점 ", homepage: "cited.kr", test: "on" }, ["cited"], new Date("2026-10-17T00:00:00Z"));
  봄("두칸칸 — 칸", r.ok && r.칸.slug === "cited-2" && r.칸.domain === "cited.kr" && J(r.칸.answerTerms) === J(["시험치과 송파점", "cited.kr"]) && r.칸.test && r.칸.wantGsc
    && J(r.칸.compete) === "[]" && J(r.칸.brand) === J(["시험치과 송파점"]) && r.칸.relation === "외부");
  봄("두칸칸 — auto 단계 전부 대기 · 입력 원문", Object.values(r.칸.auto.단계).every((s) => s.상태 === "대기" && s.시도 === 0) && r.칸.auto.입력.homepage === "cited.kr" && r.칸.auto.갈래 === "사이트");
  const c = 두칸칸({ name: "시험블로그", homepage: "https://blog.naver.com/naver_diary" });
  봄("두칸칸 — 플랫폼 → channels.blog · domain null · wantGsc false", c.칸.domain === null && c.칸.channels.blog === "https://blog.naver.com/naver_diary" && c.칸.wantGsc === false && c.칸.slug === "naver-diary");
  봄("두칸칸 — 오류(이름 한 글자·주소)", !두칸칸({ name: "a", homepage: "" }).ok && !두칸칸({ name: "가게", homepage: "blog.naver.com" }).ok);
  const 모 = 두칸칸({ name: "시험꽃집", homepage: "miso.modoo.at" });
  봄("두칸칸 — modoo → 홈페이지 없음과 같음(slug 로마자 · wantGsc false · 판별 말 이름만)", 모.ok && 모.칸.domain === null && 모.칸.slug === "siheomkkotjip" && 모.칸.wantGsc === false
    && J(모.칸.answerTerms) === J(["시험꽃집"]) && 모.칸.auto.갈래 === "없음" && 모.칸.auto.입력.homepage === "miso.modoo.at");
  봄("두칸칸 — 「그래도 등록」", 두칸칸({ name: "가게", homepage: "", allow_dup: "on" }).칸.이름겹침허용 === true);
}

// ─────────────────────────────────────────── 단계 기계 — 가짜 DB
const 경로쓰기 = (o, p, v) => { const k = [...p]; const 끝 = k.pop(); let x = o; for (const s of k) { if (!x[s] || typeof x[s] !== "object") return o; x = x[s]; } x[끝] = v; return o; };
const 경로읽기 = (o, p) => p.reduce((x, k) => (x == null ? undefined : x[k]), o);
function 가짜DB(clients) {
  const db = { clients: clients.map((c) => structuredClone(c)), pilots: [], questions: [], tasks: [], 로그: [] };
  const 찾 = (id) => db.clients.find((c) => c.id === id);
  db.q = async (s, p = []) => {
    const sql = s.replace(/\s+/g, " ").trim();
    db.로그.push(sql);
    if (sql.startsWith("select to_jsonb(c) as r from geo.clients c where slug")) return db.clients.filter((c) => c.slug === p[0]).map((c) => ({ r: structuredClone(c) }));
    if (sql.startsWith("select to_jsonb(c) as r from geo.clients c where c.status = 'active' and c.config ? 'auto'")) return db.clients.filter((c) => c.status === "active" && c.config.auto).map((c) => ({ r: structuredClone(c) }));
    if (sql.startsWith("update geo.clients set config = jsonb_set(config, $2::text[], coalesce(config #> $2::text[]")) {
      // 임대
      const c = 찾(p[0]); const s0 = 경로읽기(c.config, p[1]) ?? {};
      const ok = (s0.상태 ?? "대기") === "대기" || (s0.상태 === "실패" && (s0.시도 ?? 0) < 3) || (s0.상태 === "도는중" && Date.parse(s0.at ?? "") < Date.parse(p[2]) - 임대초 * 1000);
      if (!ok) return [];
      경로쓰기(c.config, p[1], { ...s0, 상태: "도는중", at: p[2], 시도: (s0.시도 ?? 0) + 1 });
      return [{ id: c.id }];
    }
    if (sql.startsWith("update geo.clients set config = jsonb_set(config, $2::text[], jsonb_build_object('상태', '대기'")) {
      const c = db.clients.find((x) => x.slug === p[0]); if (!c?.config.auto) return [];
      경로쓰기(c.config, p[1], { 상태: "대기", 시도: 0 }); return [{ id: c.id }];
    }
    if (sql.startsWith("update geo.clients set config = jsonb_set(jsonb_set(jsonb_set(jsonb_set(jsonb_set(config,")) {
      const c = db.clients.find((x) => x.slug === p[0]); if (!c?.config.auto) return [];
      c.config.auto.사실 = JSON.parse(p[1]); c.config.auto.출처.업종 = JSON.parse(p[2]); c.config.auto.출처.지역 = JSON.parse(p[2]);
      c.config.auto.단계.업종지역 = JSON.parse(p[3]); c.config.auto.단계.검색어 = JSON.parse(p[4]); return [{ id: c.id }];
    }
    if (sql.startsWith("update geo.clients set config = jsonb_set(jsonb_set(config, '{queries,compete}'")) {
      const c = 찾(p[0]); if (String(c.config.auto?.출처?.경쟁 ?? "").startsWith("원장")) return [];
      c.config.queries.compete = JSON.parse(p[1]); c.config.auto.출처.경쟁 = JSON.parse(p[2]); return [];
    }
    if (sql.startsWith("update geo.clients set config = ")) {
      // 칸쓰기 — 짝 [경로, 값]
      const c = 찾(p[0]);
      for (let i = 1; i < p.length; i += 2) 경로쓰기(c.config, p[i], JSON.parse(p[i + 1]));
      return [];
    }
    if (sql.startsWith("update geo.clients set derived = jsonb_set(coalesce(derived")) { 찾(p[0]).derived.platform = JSON.parse(p[1]); return []; }
    if (sql.startsWith("update geo.clients set derived = $2::jsonb")) { const c = 찾(p[0]); c.derived = { ...JSON.parse(p[1]), ...(c.derived.gscAccess ? { gscAccess: c.derived.gscAccess } : {}) }; return []; }
    if (sql.startsWith("update geo.clients set measure_active = true")) { 찾(p[0]).measure_active = true; return []; }
    if (sql.startsWith("insert into geo.pilots")) {
      if (db.pilots.some((x) => x.client_id === p[0])) return [];
      const r = { id: `p-${db.pilots.length + 1}`, client_id: p[0], status: "리허설", needs_build: p[1], paid_on: null };
      db.pilots.push(r); return [{ id: r.id }];
    }
    if (sql.startsWith("select id, status from geo.pilots where client_id")) return db.pilots.filter((x) => x.client_id === p[0]);
    if (sql.startsWith("select p.id, p.status, p.questions_approved_at")) return [];
    if (sql.startsWith("select count(*)::int n from geo.pilot_questions")) return [{ n: db.questions.filter((x) => x.pilot_id === p[0]).length }];
    if (sql.startsWith("insert into geo.pilot_questions")) {
      if (db.questions.some((x) => x.pilot_id === p[0] && x.position === p[1])) return [];
      db.questions.push({ pilot_id: p[0], position: p[1], stage: p[2], text: p[3], approved: false }); return [{ id: db.questions.length }];
    }
    if (sql.startsWith("select status from geo.agent_tasks")) return db.tasks.filter((t) => t.key === p[1]).map((t) => ({ status: t.status }));
    if (sql.startsWith("insert into geo.agent_tasks")) {
      let t = db.tasks.find((x) => x.key === p[1]);
      if (!t) { t = { id: db.tasks.length + 1, key: p[1], status: "사람 대기", detail: p[3] }; db.tasks.push(t); } else t.detail = p[3];
      return [{ id: t.id, status: t.status }];
    }
    if (sql.startsWith("insert into geo.agent_activity")) return [];
    if (sql.startsWith("update geo.agent_tasks set status")) { const t = db.tasks.find((x) => x.key === p[1] && !["완료", "닫힘"].includes(x.status)); if (!t) return []; t.status = p[2]; return [{ id: t.id, title: t.key }]; }
    throw new Error(`가짜 DB 가 모르는 SQL: ${sql.slice(0, 90)}`);
  };
  return db;
}
const 공인 = async () => [{ address: "93.184.216.34" }];
const 사이트표 = (B, { 홈 = '<html><title>시험치과</title><script type="application/ld+json">{"@type":"Organization"}</script></html>', 막힘 = false } = {}) => ({
  [`${B}/`]: () => new Response(홈, { status: 200, headers: { "content-type": "text/html" } }),
  [`${B}/robots.txt`]: () => new Response(막힘 ? "User-agent: GPTBot\nDisallow: /" : "User-agent: *\nAllow: /", { status: 200 }),
  [`${B}/sitemap.xml`]: () => new Response(`<urlset><url><loc>${B}/a</loc></url></urlset>`, { status: 200, headers: { "content-type": "application/xml" } }),
  [`${B}/llms.txt`]: () => new Response("# 시험", { status: 200, headers: { "content-type": "text/plain" } }),
});
const 자동완성표 = (n) => {
  // 1차 씨앗마다 n 개의 서로 다른 치과 말(2차는 빈 목록)
  let i = 0;
  return async (url) => {
    const u = new URL(url);
    if (u.hostname === "ac.search.naver.com") {
      const q = u.searchParams.get("q");
      const items = q.startsWith("송파") && !/^송파 (치과|구) .*\d/.test(q) && i < 3 ? Array.from({ length: n }, (_, k) => [`${q} ${String.fromCharCode(0xac00 + i * 50 + k)} 치과${k}`]) : [];
      if (/^송파/.test(q)) i++;
      return new Response(J({ query: [q], items: [items] }), { status: 200 });
    }
    return new Response("", { status: 404 });
  };
};
const 합치기 = (...fs) => async (url, init) => { for (const f of fs) { const r = await f(url, init); if (r && r.status !== 404) return r; } return new Response("", { status: 404 }); };
const 표fetch = (표) => async (url) => (표[url] ? 표[url]() : new Response("", { status: 404 }));
const 새고객 = (덮기 = {}) => {
  const r = 두칸칸({ name: "시험치과 송파점", homepage: "cited.kr" }, ["cited"], new Date("2026-10-17T00:00:00Z"));
  return { id: 50, slug: r.칸.slug, name: r.칸.name, domain: r.칸.domain, relation: "외부", status: "active", answer_pattern: answerPattern(r.칸.answerTerms.join(",")),
    config: { v: 1, answerTerms: r.칸.answerTerms, queries: { compete: [], brand: r.칸.brand }, indexnow: { mode: "우리", key: "k".repeat(32) }, wantGsc: true, gsc: false, auto: r.칸.auto }, derived: {}, ...덮기 };
};
const 지금 = () => new Date("2026-10-17T03:00:00Z");

{
  // 다음단계 — 순수
  const a = 새고객().config.auto;
  봄("다음단계 — 처음은 사이트", 다음단계(a) === "사이트");
  a.단계.사이트 = { 상태: "됨" };
  봄("다음단계 — 사이트 됨 → 업종지역", 다음단계(a) === "업종지역");
  a.단계.업종지역 = { 상태: "원장" };
  봄("다음단계 — 업종지역 원장이면 검색어는 못 가고 파일럿", 다음단계(a) === "파일럿");
  a.단계.파일럿 = { 상태: "됨" };
  봄("다음단계 — 질문은 검색어가 먼저", 다음단계(a) === null);
  const b = 새고객().config.auto;
  b.단계.사이트 = { 상태: "실패", 시도: 1 };
  봄("다음단계 — 실패 시도<3 은 매시 고리만(판은 안 돈다)", 다음단계(b, 지금()) === "사이트" && 다음단계(b, 지금(), { 실패도: false }) === null);
  b.단계.사이트 = { 상태: "실패", 시도: 3 };
  봄("다음단계 — 실패 시도 3 은 안 돈다", 다음단계(b, 지금()) === null);
  b.단계.사이트 = { 상태: "도는중", at: "2026-10-17T02:59:00Z", 시도: 1 };
  봄("다음단계 — 임대 중(60초 전)은 안 잡음", 다음단계(b, 지금()) === null);
  b.단계.사이트 = { 상태: "도는중", at: "2026-10-17T02:58:00Z", 시도: 1 };
  봄("다음단계 — 지난 임대(120초 전)는 잡음", 다음단계(b, 지금()) === "사이트");
  봄("자동요약", J(자동요약({ 단계: { 사이트: { 상태: "됨" }, 업종지역: { 상태: "원장" } } })) === J({ 된: 1, 전부: 5, 끝: false, 원장: ["업종지역"] }));
  봄("사이트상태 — 다 됨 none · 빠짐 setup · 못 엶만 null", 사이트상태({ robots: { blocked: [] }, sitemap: { ok: true }, llmsTxt: { ok: true }, homeLdTypes: ["X"] }) === "none"
    && 사이트상태({ robots: { blocked: [] }, sitemap: { ok: false }, llmsTxt: { ok: true }, homeLdTypes: ["X"] }) === "setup"
    && 사이트상태({ robots: { status: null }, sitemap: { ok: true }, llmsTxt: { ok: true }, homeLdTypes: ["X"] }) === null);
}
{
  // 끝에서 끝(가짜) — 사이트 → 업종지역(모름 → 원장) → 원장 두 칸 → 검색어 → 파일럿 → 질문
  const B = "https://cited.kr";
  const db = 가짜DB([새고객()]);
  const deps = { fetch: 합치기(표fetch(사이트표(B)), 자동완성표(8)), lookup: 공인, now: 지금, 자동완성옵션: { 간격: 0 } };
  const s1 = await 자동한걸음(db.q, "cited-2", deps);
  const c = db.clients[0];
  봄("한걸음 1 — 사이트 됨 · 제안 none(다 열림)", s1.단계 === "사이트" && s1.상태 === "됨" && c.config.auto.사이트상태 === "none" && c.derived.home.status === 200, J(s1));
  봄("한걸음 1 — 업종 이름에서 · 지역 모름", c.config.auto.사실.업종.값 === "치과" && /이름/.test(c.config.auto.사실.업종.출처) && c.config.auto.사실.지역.값 === null);
  봄("한걸음 1 — 단계 상태 됨·시도 1·at", c.config.auto.단계.사이트.상태 === "됨" && c.config.auto.단계.사이트.시도 === 1 && !!c.config.auto.단계.사이트.at);
  const s2 = await 자동한걸음(db.q, "cited-2", deps);
  봄("한걸음 2 — 업종지역 원장(지역 모름)", s2.단계 === "업종지역" && s2.상태 === "원장" && /지역을 못 찾았습니다/.test(c.config.auto.단계.업종지역.말));
  봄("한걸음 2 — setup-auto 사람 일감", db.tasks.some((t) => t.key === "setup-auto" && t.status === "사람 대기" && /지역을 못 찾았습니다/.test(t.detail)));
  const s3 = await 자동한걸음(db.q, "cited-2", deps);
  봄("한걸음 3 — 원장 단계는 건너뛰고 파일럿", s3.단계 === "파일럿" && s3.상태 === "됨" && db.pilots[0].status === "리허설" && db.pilots[0].needs_build === "none");
  봄("한걸음 4 — 더 할 것 없음(질문은 검색어가 먼저)", (await 자동한걸음(db.q, "cited-2", deps)).상태 === "할 것 없음");
  봄("사실입력검사", 사실입력검사({ category: "치과", district: "송파구" }).ok && !사실입력검사({ category: "치", district: "송파구" }).ok && !사실입력검사({ category: "치과", district: "<b>" }).ok);
  await 사실저장(db.q, "cited-2", { 업종: "치과", 지역: "송파구" }, new Date("2026-10-17T03:00:00Z"));
  봄("사실저장 — 출처 원장 입력 KST 날 · 업종지역 됨 · 검색어 대기", c.config.auto.사실.지역.출처 === "원장 입력 2026-10-17" && c.config.auto.단계.업종지역.상태 === "됨" && c.config.auto.단계.검색어.상태 === "대기");
  const s5 = await 자동한걸음(db.q, "cited-2", deps);
  봄("한걸음 5 — 검색어 됨 · 후보 ≥17 · 원응답 저장", s5.단계 === "검색어" && s5.상태 === "됨" && c.config.auto.후보.length >= 17 && c.config.auto.자동완성.씨앗.length >= 3, J(s5));
  봄("한걸음 5 — compete 3~8 원문(1차)", c.config.queries.compete.length >= 3 && c.config.queries.compete.length <= 8 && c.config.queries.compete.every((x) => c.config.auto.자동완성.씨앗.filter((s) => s.차 === 1).some((s) => s.items.includes(x)))
    && /^자동: 네이버 자동완성/.test(c.config.auto.출처.경쟁));
  const s6 = await 자동한걸음(db.q, "cited-2", deps);
  봄("한걸음 6 — 질문 20(keyword 17·brand 3·approved false) · measure_active", s6.단계 === "질문" && s6.상태 === "됨" && db.questions.length === 20
    && db.questions.filter((x) => x.stage === "keyword").length === 17 && db.questions.every((x) => x.approved === false) && c.measure_active === true);
  봄("한걸음 6 — keyword 는 자동완성 원문만", db.questions.filter((x) => x.stage === "keyword").every((x) => c.config.auto.자동완성.씨앗.some((s) => s.items.includes(x.text))));
  봄("끝 — 다섯 단계 됨 · setup-auto 닫힘", 자동요약(c.config.auto).끝 && db.tasks.find((t) => t.key === "setup-auto").status === "완료");
  봄("끝 — 같은 단계 두 번 돌려도 질문 20(on conflict do nothing)", (await 자동한걸음(db.q, "cited-2", deps)).상태 === "끝" && db.questions.length === 20);
  봄("쓰기는 칸만 — config 통째 쓰기 없음", !db.로그.some((s) => /^update geo\.clients set config = \$\d::jsonb/.test(s)));
}
{
  // 후보 < 17 → 원장 · 질문 0 · 원장 출처 경쟁은 안 덮음
  const db = 가짜DB([새고객()]);
  const c = db.clients[0];
  c.config.auto.단계.사이트 = { 상태: "됨" }; c.config.auto.단계.업종지역 = { 상태: "됨" }; c.config.auto.사이트상태 = "setup";
  c.config.auto.사실 = { 업종: { 값: "치과", 출처: "x" }, 지역: { 값: "송파구", 출처: "x" } };
  c.config.auto.출처.경쟁 = "원장"; c.config.queries.compete = ["원장이 넣은 말 하나", "둘째 말", "셋째 말"];
  const r = await 자동한걸음(db.q, "cited-2", { fetch: 자동완성표(3), now: 지금, 자동완성옵션: { 간격: 0 } });
  // D246 — 자동완성이 모자라면 틀로 채우고 됨(원장에게 안 넘김)
  봄("자동완성 적음 → 틀로 채워 됨 · 「자동완성 n · 틀 m」", r.상태 === "됨" && /^자동완성 \d+ · 틀 \d+/.test(c.config.auto.단계.검색어.말) && c.config.auto.후보.length >= 17, c.config.auto.단계.검색어.말);
  봄("원장 경쟁 검색어는 씨앗으로 쓰고 덮지 않음", J(c.config.queries.compete) === J(["원장이 넣은 말 하나", "둘째 말", "셋째 말"]) && c.config.auto.자동완성.씨앗.some((s) => s.q === "둘째 말"));
  await 자동한걸음(db.q, "cited-2", { now: 지금 });
  봄("후보 적음 → 질문 안 넣음(파일럿만)", db.questions.length === 0 && db.pilots.length === 1);
}
{
  // 실패 3번 → 원장 · 재시도 초기화 · 자동완성 403 · 홈 못 엶·내부주소 · 넘김
  const db = 가짜DB([새고객()]);
  const c = db.clients[0];
  const 내부 = { fetch: async () => new Response("", { status: 200 }), lookup: async () => [{ address: "10.0.0.5" }], now: 지금 };
  const r1 = await 자동한걸음(db.q, "cited-2", 내부);
  봄("홈 못 엶(내부 주소) → 실패 · 사이트 상태 안 정함", r1.상태 === "실패" && /못 열었습니다/.test(r1.말) && c.config.auto.사이트상태 === undefined && /내부 주소/.test(c.config.auto.단계.사이트.오류));
  봄("판 부름(실패도 false)은 실패를 다시 안 돈다", (await 자동한걸음(db.q, "cited-2", { ...내부, 실패도: false })).상태 === "할 것 없음");
  await 자동한걸음(db.q, "cited-2", 내부);
  const r3 = await 자동한걸음(db.q, "cited-2", 내부);
  봄("실패 3번째 → 원장", r3.상태 === "원장" && c.config.auto.단계.사이트.시도 === 3 && /3번째도 안 돼/.test(c.config.auto.단계.사이트.말));
  봄("원장 뒤에는 안 돈다", (await 자동한걸음(db.q, "cited-2", 내부)).상태 === "할 것 없음");
  await 재시도(db.q, "cited-2", "사이트");
  봄("재시도 — 시도 0·대기", c.config.auto.단계.사이트.상태 === "대기" && c.config.auto.단계.사이트.시도 === 0);
  봄("재시도 — 모르는 단계 거부", (await 재시도(db.q, "cited-2", "x")) === false);
  const 넘김 = await 자동한걸음(db.q, "cited-2", { fetch: async (u) => new Response("", { status: 301, headers: { location: "https://other.example/" } }), lookup: 공인, now: 지금 });
  봄("다른 호스트로 넘김 → 사람 말 「다른 곳으로 넘어갑니다」", 넘김.상태 === "실패" && /다른 곳으로 넘어갑니다: https:\/\/other\.example/.test(넘김.말), 넘김.말);
}
{
  const db = 가짜DB([새고객()]);
  const c = db.clients[0];
  c.config.auto.단계.사이트 = { 상태: "됨" }; c.config.auto.단계.업종지역 = { 상태: "됨" };
  c.config.auto.사실 = { 업종: { 값: "치과", 출처: "x" }, 지역: { 값: "송파구", 출처: "x" } };
  const r = await 자동한걸음(db.q, "cited-2", { fetch: async () => new Response("", { status: 403 }), now: 지금, 자동완성옵션: { 간격: 0 } });
  봄("자동완성 403 → 첫 번만 두드리고 멈춤 · 틀 17 로 됨 · 원응답 저장", r.상태 === "됨" && /^자동완성 0 · 틀 17/.test(r.말) && /403/.test(r.말)
    && c.config.auto.자동완성.씨앗[0].status === 403 && c.config.auto.자동완성.씨앗.slice(1).every((s) => s.status === null), r.말);
  봄("자동완성 403 → 경쟁 검색어도 틀(지역 업종 · 추천)", J(c.config.queries.compete.slice(0, 2)) === J(["송파 치과", "송파 치과 추천"]) && /틀/.test(c.config.auto.출처.경쟁), J(c.config.queries.compete));
}
{
  // 임대 — 겹친 부름은 한 번 · 지난 임대는 잡음 · 3번 다 시간 초과 → 원장
  const db = 가짜DB([새고객()]);
  const c = db.clients[0];
  c.config.auto.단계.사이트 = { 상태: "도는중", at: "2026-10-17T02:59:30Z", 시도: 1 };
  봄("임대 중이면 다른 부름은 안 돈다", (await 자동한걸음(db.q, "cited-2", { now: 지금 })).상태 === "할 것 없음" && c.config.auto.단계.사이트.시도 === 1);
  c.config.auto.단계.사이트 = { 상태: "도는중", at: "2026-10-17T02:57:00Z", 시도: 3 };
  const r = await 자동한걸음(db.q, "cited-2", { now: 지금 });
  봄("3번 다 시간 안에 못 끝냄 → 원장", r.상태 === "원장" && c.config.auto.단계.사이트.상태 === "원장");
  // 같은 단계를 동시에 두 번(브라우저 + 매시) — 임대 하나만
  const db2 = 가짜DB([새고객()]);
  const 느린 = async (url) => { await new Promise((r2) => setTimeout(r2, 20)); return (await 표fetch(사이트표("https://cited.kr"))(url)); };
  const [a, b] = await Promise.all([자동한걸음(db2.q, "cited-2", { fetch: 느린, lookup: 공인, now: 지금 }), 자동한걸음(db2.q, "cited-2", { fetch: 느린, lookup: 공인, now: 지금 })]);
  봄("동시에 두 번 → 하나는 「도는중」", [a.상태, b.상태].sort().join(",") === "도는중,됨", `${a.상태},${b.상태}`);
}
{
  // 원장이 「자세히」로 넣은 사실은 사이트 단계 재시도가 덮지 않는다
  const db = 가짜DB([새고객()]);
  const c = db.clients[0];
  c.config.auto.출처.업종 = "원장 입력 2026-10-16"; c.config.auto.사실 = { 업종: { 값: "한의원", 출처: "원장 입력 2026-10-16" }, 지역: { 값: "강남구", 출처: "원장 입력 2026-10-16" } };
  await 자동한걸음(db.q, "cited-2", { fetch: 표fetch(사이트표("https://cited.kr")), lookup: 공인, now: 지금 });
  봄("원장 출처 사실은 안 덮음", c.config.auto.사실.업종.값 === "한의원" && c.config.auto.단계.사이트.상태 === "됨");
}
{
  // 플랫폼 · 없음 갈래
  const r = 두칸칸({ name: "시험블로그", homepage: "https://blog.naver.com/naver_diary" });
  const 행 = { id: 51, slug: r.칸.slug, name: r.칸.name, domain: null, relation: "외부", status: "test", answer_pattern: null,
    config: { v: 1, answerTerms: [], queries: { compete: [], brand: [] }, onboard: { channels: r.칸.channels }, auto: r.칸.auto }, derived: {} };
  const db = 가짜DB([행]);
  봄("플랫폼 — 확인기 없으면(매시 고리) 건너뜀", (await 자동한걸음(db.q, "naver-diary", { now: 지금 })).상태 === "건너뜀");
  const 확인 = async (id, url) => ({ checkedAt: "t", platform: { id, name: "네이버 블로그" }, url, page: { fetched: true, status: 200, title: "블로그" }, hosts: [{ host: "blog.naver.com", robots: "ok", status: 200 }], lines: ["줄"] });
  const s = await 자동한걸음(db.q, "naver-diary", { checkPlatform: 확인, now: 지금 });
  const c = db.clients[0];
  봄("플랫폼 — 확인 → derived.platform · build", s.상태 === "됨" && c.derived.platform.platform.name === "네이버 블로그" && c.config.auto.사이트상태 === "build" && /채널만 봅니다/.test(s.말));
  const db2 = 가짜DB([{ ...행, slug: "nob", config: { ...행.config, onboard: {} } }]);
  const s2 = await 자동한걸음(db2.q, "nob", { checkPlatform: 확인, now: 지금 });
  봄("플랫폼 — 채널 주소가 없으면 원장(블로그 주소 다시 받기)", s2.상태 === "원장" && /블로그 주소 전체를/.test(db2.clients[0].config.auto.단계.사이트.말));
  const 없 = 두칸칸({ name: "시험꽃집", homepage: "" });
  const db3 = 가짜DB([{ ...행, slug: 없.칸.slug, name: "시험꽃집", config: { ...행.config, onboard: {}, auto: 없.칸.auto } }]);
  const s3 = await 자동한걸음(db3.q, "siheomkkotjip", { now: 지금, fetch: async () => { throw new Error("바깥 요청 없어야 함"); } });
  const 모 = 두칸칸({ name: "시험꽃집", homepage: "miso.modoo.at" });
  const db4 = 가짜DB([{ ...행, slug: 모.칸.slug, name: "시험꽃집", domain: null, config: { ...행.config, onboard: {}, auto: 모.칸.auto } }]);
  const s4 = await 자동한걸음(db4.q, 모.칸.slug, { now: 지금, fetch: async () => { throw new Error("바깥 요청 없어야 함"); } });
  봄("modoo — 바깥 요청 없이 build(D237)", s4.상태 === "됨" && db4.clients[0].config.auto.사이트상태 === "build");
  봄("없음 — 바깥 요청 없이 build · 업종 이름 꽃집", s3.상태 === "됨" && db3.clients[0].config.auto.사이트상태 === "build" && db3.clients[0].config.auto.사실.업종.값 === "꽃집");
}
{
  // 자동이어하기 — active 만 · 시험 고객 빼고 · max
  const 행들 = [1, 2, 3, 4].map((i) => ({ ...새고객(), id: 60 + i, slug: `s${i}`, status: i === 2 ? "test" : "active" }));
  행들[3].config.auto.at = "2026-10-01T00:00:00Z";
  const db = 가짜DB(행들);
  const 줄 = [];
  const 돈 = await 자동이어하기(db.q, { max: 2, deps: { lookup: async () => [{ address: "10.0.0.1" }] }, log: (s) => 줄.push(s), now: 지금 });
  봄("자동이어하기 — 시험 빼고 오래된 것부터 max 곳", J(돈) === J(["s4", "s1"]), J(돈));
  봄("자동이어하기 — 한 줄 로그", 줄.length === 2 && 줄.every((s) => /자동 세팅 s\d: 사이트 실패/.test(s)), J(줄));
}
{
  // D246 검색어 — 자동완성 4개 · 0개 · 403 · 지역 모름 · 중복 없음
  const 검색어차례 = (사실 = { 업종: { 값: "영어학원", 출처: "x" }, 지역: { 값: "송파구", 출처: "x" } }) => {
    const r = 새고객();
    r.config.auto.단계.사이트 = { 상태: "됨" }; r.config.auto.단계.업종지역 = { 상태: "됨" }; r.config.auto.사실 = 사실;
    return r;
  };
  const 넷 = async (url) => {
    const q = new URL(url).searchParams.get("q");
    const items = q === "송파 영어학원" ? ["송파 영어학원 원어민", "송파 영어학원 파닉스", "송파 영어교습소 저녁", "송파 영어과외 중1"].map((x) => [x]) : [];
    return new Response(J({ query: [q], items: [items] }), { status: 200 });
  };
  const 열여덟 = (c) => c.config.auto.후보.slice(0, 17);
  const 키 = (s) => s.replace(/\s+/g, "").toLowerCase();
  {
    const db = 가짜DB([검색어차례()]);
    const r = await 자동한걸음(db.q, "cited-2", { fetch: 넷, now: 지금, 자동완성옵션: { 간격: 0 } });
    const c = db.clients[0], k = 열여덟(c);
    봄("검색어 — 자동완성 4 → 됨 · 자동완성 4 · 틀 13", r.상태 === "됨" && /^자동완성 4 · 틀 13/.test(r.말), r.말);
    봄("검색어 — 자동완성 먼저 · 틀 뒤 · 출처 표시", k.slice(0, 4).every((x) => x.씨앗 && !x.출처) && k.slice(4).every((x) => x.출처 === "틀"));
    const 패널 = 패널만들기(c.config.auto.후보, "시험치과 송파점", "cited.kr");
    봄("검색어 — 패널 keyword 17 · 출처 칸 자동완성 4 · 틀 13 · brand 3", 패널.length === 20 && 패널.filter(([s]) => s === "keyword").length === 17
      && 패널.filter(([, , o]) => /자동완성/.test(o)).length === 4 && 패널.filter(([, , o]) => /^틀/.test(o)).length === 13, J(패널.map(([, , o]) => o)));
    봄("검색어 — 중복 없음(띄어쓰기 무시)", new Set(k.map((x) => 키(x.text))).size === 17);
    const 씨 = c.config.auto.자동완성.씨앗.filter((s) => s.차 === 1).map((s) => s.q);
    봄("검색어 — 씨앗 넓힘(동의어·서울 동) · 1차 24 안", 씨.includes("송파 영어과외") && 씨.includes("잠실동 영어학원") && 씨.length <= 24, J(씨));
    봄("검색어 — 넘은 요청 40 안", c.config.auto.자동완성.씨앗.filter((s) => s.status !== null).length <= 40);
  }
  {
    const db = 가짜DB([검색어차례()]);
    const 빈 = async (url) => new Response(J({ query: [new URL(url).searchParams.get("q")], items: [[]] }), { status: 200 });
    const r = await 자동한걸음(db.q, "cited-2", { fetch: 빈, now: 지금, 자동완성옵션: { 간격: 0 } });
    const k = 열여덟(db.clients[0]);
    봄("검색어 — 자동완성 0 → 틀 17 · 됨", r.상태 === "됨" && /^자동완성 0 · 틀 17/.test(r.말) && k.length === 17 && k.every((x) => x.출처 === "틀"), r.말);
    봄("검색어 — 틀 첫 줄 「송파 영어학원 추천」 · 중복 없음", k[0].text === "송파 영어학원 추천" && new Set(k.map((x) => 키(x.text))).size === 17);
    봄("검색어 — 틀은 고객 이름·판별 말을 안 담음", k.every((x) => !/시험치과|cited/.test(x.text)));
  }
  {
    const db = 가짜DB([검색어차례()]);
    let 부른 = 0;
    const 막 = async () => { 부른++; return new Response("", { status: 403 }); };
    const r = await 자동한걸음(db.q, "cited-2", { fetch: 막, now: 지금, 자동완성옵션: { 간격: 0 } });
    봄("검색어 — 403 → 한 번만 두드림 · 틀로 채워 됨", 부른 === 1 && r.상태 === "됨" && 열여덟(db.clients[0]).every((x) => x.출처 === "틀"), `${부른} ${r.말}`);
  }
  {
    const db = 가짜DB([검색어차례({ 업종: { 값: "영어학원", 출처: "x" }, 지역: { 값: null, 출처: "모름" } })]);
    db.clients[0].config.auto.단계.업종지역 = { 상태: "됨" };
    const r = await 자동한걸음(db.q, "cited-2", { fetch: async () => { throw new Error("바깥 요청 없어야 함"); }, now: 지금 });
    봄("검색어 — 지역 모름 → 원장(틀을 못 만든다)", r.단계 === "검색어" && r.상태 === "원장" && !db.clients[0].config.auto.후보, J(r));
  }
  봄("틀검색어 — 학원 아닌 곳은 초등·시간표 없음 · 예약 있음", 틀검색어("치과", "수원시").every((x) => !/초등|시간표|소수정예/.test(x)) && 틀검색어("치과", "수원시").includes("수원 치과 예약")
    && 틀검색어("치과", "수원시").length >= 17);
  {
    // D247 — 자동완성 없이 틀만으로 업종표 × 모든시군구 전부 17 이상(중구·서구 같은 한 꼴 지역 포함)
    const 모자람 = [];
    for (const { 업종 } of 업종표) for (const g of 모든시군구) {
      const n = 거르기(틀검색어(업종, g), { 업종, 이름: "", 더말: 동의어(업종) }).length;
      if (n < 17) 모자람.push(`${g} ${업종} ${n}`);
    }
    봄(`틀검색어 — 업종표 × 모든시군구(${업종표.length * 모든시군구.length}) 전부 17 이상`, 모자람.length === 0, 모자람.slice(0, 5).join(", "));
    봄("거르기 — 「중구 인테리어 추천」은 남고 「구인」 낱말은 빠짐", J(거르기(["중구 인테리어 추천", "중구 인테리어 구인", "중구 인테리어 채용공고"], { 업종: "인테리어" })) === J(["중구 인테리어 추천"]));
  }
  봄("틀검색어 — 중복 없음", 틀검색어("영어학원", "송파구").length === new Set(틀검색어("영어학원", "송파구")).size);
  봄("넓힌씨앗 — 서울 동 · 다른 시도에도 있는 구(강서구)는 동 없음", 넓힌씨앗("영어학원", "강남구").includes("대치동 영어학원") && !넓힌씨앗("영어학원", "강서구").some((x) => /동 /.test(x)));
}
{
  // 56e 질문 단계 — 이미 있으면 됨(measure_active 그대로) · 실제 들어간 줄 수로 말한다
  const 질문차례 = () => {
    const r = 새고객();
    for (const k of ["사이트", "업종지역", "검색어", "파일럿"]) r.config.auto.단계[k] = { 상태: "됨" };
    r.config.auto.후보 = Array.from({ length: 17 }, (_, i) => `송파 치과 후보${i}`);
    return r;
  };
  const 파일럿 = (db) => db.pilots.push({ id: "p-1", client_id: 50, status: "리허설", needs_build: "none", paid_on: null });
  const db = 가짜DB([질문차례()]);
  파일럿(db);
  for (const i of [1, 2, 3]) db.questions.push({ pilot_id: "p-1", position: i, stage: "keyword", text: `원장 질문 ${i}`, approved: true });
  const r = await 자동한걸음(db.q, "cited-2", { now: 지금 });
  봄("질문 이미 3개 → 됨 · 안 넣음 · measure_active 그대로", r.상태 === "됨" && /이미 3개/.test(r.말) && db.questions.length === 3 && db.clients[0].measure_active !== true, J(r));
  // 경합 — count 는 0 인데 insert 가 0줄(다른 곳이 먼저 넣음)
  const db2 = 가짜DB([질문차례()]);
  파일럿(db2);
  const 원q = db2.q;
  db2.q = async (s, p) => (s.replace(/\s+/g, " ").trim().startsWith("insert into geo.pilot_questions") ? [] : 원q(s, p));
  const r2 = await 자동한걸음(db2.q, "cited-2", { now: 지금 });
  봄("질문 0줄 들어감 → 원장 「질문을 넣지 못했습니다」 · measure_active 안 켬", r2.상태 === "원장" && /질문을 넣지 못했습니다/.test(r2.말) && db2.clients[0].measure_active !== true, J(r2));
  // 일부만 — 5줄
  const db3 = 가짜DB([질문차례()]);
  파일럿(db3);
  let 들어감 = 0;
  const 원q3 = db3.q;
  db3.q = async (s, p) => (s.replace(/\s+/g, " ").trim().startsWith("insert into geo.pilot_questions") && 들어감++ >= 5 ? [] : 원q3(s, p));
  const r3 = await 자동한걸음(db3.q, "cited-2", { now: 지금 });
  봄("질문 5줄만 → 원장 · 실제 수 5 · measure_active 안 켬", r3.상태 === "원장" && /5개만/.test(r3.말) && db3.questions.length === 5 && db3.clients[0].measure_active !== true, J(r3));
  const db4 = 가짜DB([질문차례()]);
  파일럿(db4);
  const r4 = await 자동한걸음(db4.q, "cited-2", { now: 지금 });
  봄("질문 20줄 → 됨 · measure_active · 말에 실제 수", r4.상태 === "됨" && /질문 20개/.test(r4.말) && db4.questions.length === 20 && db4.clients[0].measure_active === true, J(r4));
}
{
  // 56g 멈춘단계 — 순수
  const a = (s) => ({ 단계: { 사이트: s } });
  봄("멈춘단계 — 시도 3 · 임대 지남 → 단계", 멈춘단계(a({ 상태: "도는중", at: "2026-10-17T02:57:00Z", 시도: 3 }), 지금()) === "사이트");
  봄("멈춘단계 — 시도 2 → null", 멈춘단계(a({ 상태: "도는중", at: "2026-10-17T02:57:00Z", 시도: 2 }), 지금()) === null);
  봄("멈춘단계 — 임대 안 지남 → null", 멈춘단계(a({ 상태: "도는중", at: "2026-10-17T02:59:30Z", 시도: 3 }), 지금()) === null);
  봄("멈춘단계 — auto 없음 → null", 멈춘단계(null, 지금()) === null);
}
{
  // 56f 매시 고리 — 플랫폼 사이트 대기(확인기 없음)는 자리를 안 먹는다. 멈춘 플랫폼 행은 남는다
  const 블로그 = 두칸칸({ name: "시험블로그", homepage: "https://blog.naver.com/naver_diary" });
  const 플랫폼행 = (i) => ({ id: 70 + i, slug: `pf${i}`, name: `블로그${i}`, domain: null, relation: "외부", status: "active", answer_pattern: null,
    config: { v: 1, answerTerms: [], queries: { compete: [], brand: [] }, onboard: { channels: 블로그.칸.channels }, auto: { ...structuredClone(블로그.칸.auto), at: `2026-10-0${i}T00:00:00Z` } }, derived: {} });
  const 보통 = { ...새고객(), id: 79, slug: "plain" };
  보통.config.auto.at = "2026-10-09T00:00:00Z";
  const db = 가짜DB([플랫폼행(1), 플랫폼행(2), 플랫폼행(3), 보통]);
  const 돈 = await 자동이어하기(db.q, { max: 3, deps: { lookup: async () => [{ address: "10.0.0.1" }] }, log: () => {}, now: 지금 });
  봄("고리 — 플랫폼 대기 3곳 + 보통 1곳 · max 3 → 보통이 돈다", J(돈) === J(["plain"]), J(돈));
  const 멈춘 = 플랫폼행(4);
  멈춘.config.auto.단계.사이트 = { 상태: "도는중", at: "2026-10-17T02:57:00Z", 시도: 3 };
  const db2 = 가짜DB([멈춘]);
  const 돈2 = await 자동이어하기(db2.q, { max: 3, log: () => {}, now: 지금 });
  봄("고리 — 멈춘 플랫폼 행은 안 빠지고 원장으로", J(돈2) === J(["pf4"]) && db2.clients[0].config.auto.단계.사이트.상태 === "원장", J(돈2));
  const 돈3 = await 자동이어하기(가짜DB([플랫폼행(5)]).q, { max: 3, deps: { checkPlatform: async () => null }, log: () => {}, now: 지금 });
  봄("고리 — 확인기가 있으면 플랫폼 행도 고른다", J(돈3) === J(["pf5"]), J(돈3));
}
{
  // 금지어 — 자동 세팅 사람 말이 고객 글로 새지 않는다(체크리스트 할일은 원장 몫이지만, 보낼글로 쓰이는 일이 없게 확인)
  봄("금지말찾기", J(금지말찾기("robots.txt 와 Sitemap, DNS")) === J(["robots", "sitemap", "dns"]) && 금지말찾기("홈페이지 관리자 아이디").length === 0);
}

{
  // 55g 이행 — 순수 부분(이행config). 실제 행 바꾸기는 --apply(Arch)
  const { 이행config, 채널없음말 } = await import("./migrate-platform-domain.mjs");
  const 옛 = { id: 99, slug: "old", name: "옛블로그 수학 학원", domain: "blog.naver.com", relation: "외부", alias: "고객 Z",
    config: { v: 1, indexnow: { mode: "우리", key: "k".repeat(32) }, wantGsc: true, gsc: false, answerTerms: ["강동구 수학 학원"], queries: { compete: ["강동", "수학", "학원"], brand: ["x"] } },
    derived: { home: { status: 302 }, checkedAt: "t" } };
  const c = 이행config(옛, "2026-10-17T00:00:00Z");
  봄("이행 — IndexNow 안 씀 · wantGsc false · 판별 말·경쟁 그대로 · 출처 원장", c.indexnow.mode === "안 씀" && !c.indexnow.key && c.wantGsc === false
    && J(c.answerTerms) === J(옛.config.answerTerms) && J(c.queries) === J(옛.config.queries) && c.auto.출처.판별말 === "원장" && c.auto.출처.경쟁 === "원장");
  봄("이행 — 채널 없으면 사이트 단계 원장(블로그 주소 다시 받기) · 나머지 대기", c.auto.단계.사이트.상태 === "원장" && c.auto.단계.사이트.말 === 채널없음말
    && ["업종지역", "검색어", "파일럿", "질문"].every((k) => c.auto.단계[k].상태 === "대기"));
  const 채널 = 이행config({ ...옛, config: { ...옛.config, onboard: { channels: { blog: "https://blog.naver.com/abc" } } } }, "t");
  봄("이행 — 채널 주소가 이미 있으면 사이트 단계 대기", 채널.auto.단계.사이트.상태 === "대기");
  const { 체크리스트: 체크 } = await import("../../web/lib/client-core.mjs");
  const 뒤 = 체크({ ...옛, domain: null, config: c, derived: {} }, {});
  봄("이행 뒤 체크리스트 — 사이트 8줄 해당없음 · auto 사람 · name 사람(흔한 말)", ["site", "robots", "sitemap", "llms", "jsonld", "keyfile", "send", "gsc"].every((id) => 뒤.find((x) => x.id === id).상태 === "해당없음")
    && 뒤.find((x) => x.id === "auto").상태 === "사람" && 뒤.find((x) => x.id === "name").상태 === "사람" && 뒤.every((x) => !x.보낼글));
  봄("이행 — 두 번 째 실행 대상 아님(domain null 은 고르지 않음)", fs.readFileSync(new URL("./migrate-platform-domain.mjs", import.meta.url), "utf8").includes("where c.domain is not null"));
}

console.log(`${통과} 통과 · ${실패} 실패`);
if (실패) process.exitCode = 1;
