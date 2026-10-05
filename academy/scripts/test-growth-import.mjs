// 문서딱 성장 리포트 읽기·색인 고객 고르기(Step 36) 단위 시험 — 네트워크·DB 없음.
//   node scripts/test-growth-import.mjs
//
// 재료: fixtures/growth-2026-41.md 는 doc-tools-kr main 에 2026-10-05 커밋된 첫 실 리포트 그대로
// (https://raw.githubusercontent.com/leeledger/doc-tools-kr/main/reports/growth/2026-41.md).
// 변형(JSON 없음·gsc null·표 머리 바뀜 등)은 이 원문을 renderReport(scripts/ops/lib/report.mjs)가 그 경우에 실제로 내는 꼴로 바꾼 것.
// 이슈는 아직 실물이 없다(2026-41 후보 0개라 그쪽이 이슈를 안 만들었다) — opportunities.mjs issueBody 가 내는 꼴을 그 코드대로 옮겼다.
import fs from "node:fs";
import { CLIENTS, indexClients } from "../clients.mjs";
import { bingClient } from "../../tools/bing-site.mjs";
import {
  GROWTH_SLUGS, parseGrowthReport, parseOpportunityIssue, reportStalled, splitRow, weekMonday, weekOfName, weeksToFetch,
} from "../../web/lib/growth-core.mjs";

let 통과 = 0, 실패 = 0;
const 봄 = (이름, 참) => { if (참) 통과++; else { 실패++; console.log(`✗ ${이름}`); } };
const 던짐 = (f, re) => { try { f(); return false; } catch (e) { return re.test(e.message); } };

// 체크아웃이 CRLF 로 바꿔 놓아도 아래 변형(줄바꿈 LF 기준)이 맞게 LF 로 읽는다. CRLF 읽기는 따로 시험한다
const 원문 = fs.readFileSync(new URL("./fixtures/growth-2026-41.md", import.meta.url), "utf8").replace(/\r\n/g, "\n");

// ── 실 리포트 그대로
const r = parseGrowthReport(원문);
봄("주·생성일", r.week === "2026-41" && r.generated === "2026-10-05");
봄("서치콘솔 7일 합계 = JSON 그대로 (클릭 0·노출 36·순위 18.17)", r.gsc.last7.clicks === 0 && r.gsc.last7.impressions === 36 && r.gsc.last7.position === 18.166666666666668);
봄("서치콘솔 기간 날짜", r.gsc.range7.startDate === "2026-09-26" && r.gsc.range7.endDate === "2026-10-02" && r.gsc.range28.startDate === "2026-09-05");
봄("Cloudflare 7일 = JSON 그대로 (페이지뷰 6,651·5일)", r.cf.last7.pageViews === 6651 && r.cf.last7.requests === 44596 && r.cf.last7.uniques === 1837 && r.cf.last7.days === 5 && r.cf.until === "2026-10-04");
봄("표 3개 행 수 11/11/16", r.queries7.length === 11 && r.queries28.length === 11 && r.pages28.length === 16);
봄("쿼리 행", JSON.stringify(r.queries7[3]) === JSON.stringify({ key: "국시원 사진 규정", clicks: 0, impressions: 1, ctr: 0, position: 7 }));
봄("페이지 행(첫 줄 http 주소 그대로)", r.pages28[0].key === "http://docttak.com/" && r.pages28[0].position === 2 && r.pages28[5].key === "/guide/id-card-photo/" && r.pages28[5].impressions === 7 && r.pages28[5].position === 8.1);
봄("메모 없음 → null", r.notes === null);

// ── growth-data 표지
const 표지빼기 = 원문.replace(/<!-- growth-data .* -->/, "");
봄("JSON 표지 없음 → 던짐", 던짐(() => parseGrowthReport(표지빼기), /표지 없음/));
봄("JSON 깨짐 → 던짐", 던짐(() => parseGrowthReport(원문.replace('"week":"2026-41",', '"week":"2026-41",,')), /JSON 깨짐/));
봄("주 표시 이상 → 던짐", 던짐(() => parseGrowthReport(원문.replace('"week":"2026-41"', '"week":"41"')), /주 표시/));
봄("빈 글 → 던짐", 던짐(() => parseGrowthReport(""), /표지 없음/));

// ── 비밀값 빠짐: renderReport 는 gsc 가 null 이면 메모 줄(「> 」)을 찍고 「건너뜀 (위 메모 참고).」, JSON gsc:null
const json = JSON.parse(/<!-- growth-data (\{.*\}) -->/.exec(원문)[1]);
const 서치콘솔절 = 원문.slice(원문.indexOf("## 서치콘솔 (구글)"), 원문.indexOf("## Cloudflare (서버 통계)"));
const gsc없음 = 원문
  .replace("생성: 2026-10-05 (A-5 자동 작성, docs/OPS-RUNBOOK.md)\n", "생성: 2026-10-05 (A-5 자동 작성, docs/OPS-RUNBOOK.md)\n\n> 서치콘솔: GSC_SERVICE_ACCOUNT_JSON 이 없어 건너뜀\n")
  .replace(서치콘솔절, "## 서치콘솔 (구글)\n건너뜀 (위 메모 참고).\n\n")
  .replace(/<!-- growth-data .* -->/, `<!-- growth-data ${JSON.stringify({ ...json, gsc: null })} -->`);
const g = parseGrowthReport(gsc없음);
봄("gsc null → null 그대로, 표 3개 null", g.gsc === null && g.queries7 === null && g.queries28 === null && g.pages28 === null);
봄("gsc null 이어도 Cloudflare 는 살림", g.cf.last7.pageViews === 6651);
봄("「> 」 메모 → notes", g.notes === "서치콘솔: GSC_SERVICE_ACCOUNT_JSON 이 없어 건너뜀");
const cf없음 = parseGrowthReport(원문.replace(/<!-- growth-data .* -->/, `<!-- growth-data ${JSON.stringify({ ...json, cf: null })} -->`));
봄("cf null → null 그대로, 서치콘솔 살림", cf없음.cf === null && cf없음.gsc.last7.impressions === 36);

// ── 표
const 머리바뀜 = 원문.replace("### 상위 쿼리 (28일)\n| 쿼리 | 클릭 | 노출 | CTR | 평균 순위 |", "### 상위 쿼리 (28일)\n| 쿼리 | 클릭 | 노출 | CTR | 순위 |");
const h = parseGrowthReport(머리바뀜);
봄("머리 바뀜 → 그 표만 null, 합계·다른 표 유지", h.queries28 === null && h.queries7.length === 11 && h.pages28.length === 16 && h.gsc.last7.impressions === 36);
봄("제목 바뀜 → 그 표 null", parseGrowthReport(원문.replace("### 상위 페이지 (28일)", "### 페이지 (28일)")).pages28 === null);
// rowsTable 은 행이 없으면 「| (데이터 없음) | | | | |」 한 줄
const 빈표 = 원문.replace(/(### 상위 쿼리 \(7일\)\n\| 쿼리 \| 클릭 \| 노출 \| CTR \| 평균 순위 \|\n\|---\|---:\|---:\|---:\|---:\|\n)(\|.*\n)+/, "$1| (데이터 없음) | | | | |\n");
봄("(데이터 없음) → 빈 배열", JSON.stringify(parseGrowthReport(빈표).queries7) === "[]");
// n() 은 en-US 쉼표, pct 는 소수 한 자리 %, pos 는 0 이면 「-」
const 값바꿈 = 원문.replace("| 국시원 사진 규정 | 0 | 1 | 0.0% | 7.0 |", "| 국시원 사진 규정 | 1,234 | 12,345 | 12.5% | - |");
const v = parseGrowthReport(값바꿈).queries7[3];
봄("쉼표 숫자·%·순위 「-」", v.clicks === 1234 && v.impressions === 12345 && v.ctr === 0.125 && v.position === null);
// cell() 은 칸 안 세로줄을 「\|」 로 쓴다
const 세로줄 = 원문.replace("| 국시원 사진 규정 | 0 |", "| 국시원 \\| 사진 규정 | 0 |");
봄("쿼리 안 이스케이프된 세로줄", parseGrowthReport(세로줄).queries7[3].key === "국시원 | 사진 규정");
봄("splitRow", JSON.stringify(splitRow("| a \\| b | 1 | |")) === JSON.stringify(["a | b", "1", ""]) && splitRow("a | b") === null);
봄("못 읽는 행 하나 → 표 null(반쯤 읽은 표는 틀린 표)", parseGrowthReport(원문.replace("| 여자 여권사진 | 0 | 1 | 0.0% | 24.0 |", "| 여자 여권사진 | 0 | 많음 | 0.0% | 24.0 |")).queries7 === null);
봄("CRLF 도 읽음", parseGrowthReport(원문.replace(/\n/g, "\r\n")).pages28.length === 16);

// ── 후보 이슈 (opportunities.mjs issueBody 꼴)
const 본문 = [
  "2026-42 서치콘솔 28일 쿼리에서 고른 새 안내 페이지 후보입니다(A-6). 공식 출처를 직접 가져올 수 있는 것만 만드세요.", "",
  "## 노출은 많은데 클릭이 적은 쿼리 (노출 50회 이상, CTR 2.0% 미만)",
  "| 쿼리 | 노출 | 클릭 | CTR | 순위 | 지금 받는 안내 | 추천 도구 |", "|---|---:|---:|---:|---:|---|---|",
  "| 여권사진 규격 | 120 | 1 | 0.8% | 9.4 | /guide/passport-photo/ | /id-photo/?preset=passport_online |",
  "| 국시원 \\| 사진 | 60 | 0 | 0.0% | 7.0 | 없음 | - |", "",
  "## 안내 페이지가 없는 쿼리 (노출 10회 이상)",
  "| 쿼리 | 노출 | 클릭 | 순위 | 추천 도구 |", "|---|---:|---:|---:|---|",
  "| 운전면허 사진 규정 2026 | 14 | 0 | 10.0 | /id-photo/ |",
].join("\n");
const 이슈 = { title: "새 안내 페이지 후보 2026-42: 3개", body: 본문, html_url: "https://github.com/leeledger/doc-tools-kr/issues/9", updated_at: "2026-10-12T00:30:00Z" };
const o = parseOpportunityIssue(이슈);
봄("이슈 제목 → 주·건수", o.week === "2026-42" && o.count === 3 && o.url.endsWith("/issues/9") && o.updatedAt === "2026-10-12T00:30:00Z");
봄("저CTR 표", o.lowCtr.length === 2 && o.lowCtr[0].impressions === 120 && o.lowCtr[0].ctr === 0.008 && o.lowCtr[0].guide === "/guide/passport-photo/" && o.lowCtr[1].guide === null && o.lowCtr[1].tool === null && o.lowCtr[1].query === "국시원 | 사진");
봄("안내 없음 표", o.uncovered.length === 1 && o.uncovered[0].query === "운전면허 사진 규정 2026" && o.uncovered[0].tool === "/id-photo/");
const 꼴다름 = parseOpportunityIssue({ ...이슈, title: "Guide candidates 2026-42 (3)" });
봄("제목 꼴 다름 → 주·건수 null, 주소 살림", 꼴다름.week === null && 꼴다름.count === null && 꼴다름.url === 이슈.html_url);
봄("「없음.」 절 → 빈 배열", JSON.stringify(parseOpportunityIssue({ ...이슈, body: 본문.replace(/## 안내 페이지가 없는 쿼리[^]*$/, "## 안내 페이지가 없는 쿼리 (노출 10회 이상)\n없음.") }).uncovered) === "[]");
봄("본문 머리 다름 → 그 표 null", parseOpportunityIssue({ ...이슈, body: 본문.replace("| 쿼리 | 노출 | 클릭 | 순위 | 추천 도구 |", "| 쿼리 | 노출 | 순위 |") }).uncovered === null);
봄("본문 없음 → 표 null", parseOpportunityIssue({ title: 이슈.title, body: null }).lowCtr === null);

// ── 받을 주
봄("파일 이름 → 주", weekOfName("2026-41.md") === "2026-41" && weekOfName("README.md") === null && weekOfName("2026-41.md.bak") === null);
봄("빈 DB → 목록 전부(최근부터)", JSON.stringify(weeksToFetch(["2026-41", "2026-42"], [])) === JSON.stringify(["2026-42", "2026-41"]));
봄("이어 받기 — 있는 주는 다시 안 받음", JSON.stringify(weeksToFetch(["2026-41", "2026-42", "2026-43"], ["2026-41", "2026-42"])) === JSON.stringify(["2026-43"]));
const 많음 = Array.from({ length: 12 }, (_, i) => `2026-${String(30 + i).padStart(2, "0")}`);
봄("최대 8 · 최근 주부터", weeksToFetch(많음, []).length === 8 && weeksToFetch(많음, [])[0] === "2026-41" && weeksToFetch(많음, []).at(-1) === "2026-34");
봄("다음 날 남은 옛 주", JSON.stringify(weeksToFetch(많음, weeksToFetch(많음, []))) === JSON.stringify(["2026-33", "2026-32", "2026-31", "2026-30"]));
봄("주 꼴 아닌 것은 버림", JSON.stringify(weeksToFetch(["2026-41", "x"], [])) === JSON.stringify(["2026-41"]));

// ── 멈춤 판정
봄("ISO 주 월요일", weekMonday("2026-41") === "2026-10-05" && weekMonday("2026-01") === "2025-12-29");
봄("9일 안 → 안 멈춤", !reportStalled({ week: "2026-41", generated: "2026-10-05" }, "2026-10-14"));
봄("9일 넘음 → 멈춤", reportStalled({ week: "2026-41", generated: "2026-10-05" }, "2026-10-15"));
봄("생성일 없으면 그 주 월요일로", reportStalled({ week: "2026-41", generated: null }, "2026-10-15"));
봄("행 없음 → 멈춤 아님(첫 리포트 전)", !reportStalled(null, "2026-10-15"));

// ── 설정
봄("성장 리포트 고객 = clients.mjs growthReports", JSON.stringify(CLIENTS.filter((c) => c.growthReports).map((c) => c.slug)) === JSON.stringify(GROWTH_SLUGS));
봄("문서딱 growthReports", JSON.stringify(CLIENTS.find((c) => c.slug === "docttak").growthReports) === JSON.stringify({ repo: "leeledger/doc-tools-kr", dir: "reports/growth", opportunityLabel: "ops:opportunity" }));

// ── 색인 고객 (local-agent)
봄("gsc:true 만 — 학원·문서딱, 아이로그 안 함", JSON.stringify(indexClients().map((c) => c.slug)) === JSON.stringify(["robotncoding", "docttak"]));
봄("학원 먼저 — 목록 순서가 바뀌어도", indexClients([...CLIENTS].reverse())[0].slug === "robotncoding");
봄("gsc 없는 목록 → 빈", indexClients([{ id: 9, slug: "x" }]).length === 0);

// ── 빙 제출 고객 (bing-submit-urls)
봄("인자 없음 = 학원(robotncoding.com)", bingClient(["node", "bing-submit-urls.mjs"]).domain === "robotncoding.com");
봄("--look 만 = 학원", bingClient(["node", "x", "--look"]).domain === "robotncoding.com");
봄("--client docttak = docttak.com", bingClient(["node", "x", "--look", "--client", "docttak"]).domain === "docttak.com");

console.log(`\n${통과} 통과 · ${실패} 실패`);
if (실패) process.exitCode = 1;
