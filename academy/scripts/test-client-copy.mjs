// 고객에게 가는 글 금지어 전수(Step 55b D233) — 착수순서·체크리스트를 갈래 × dns × needs_build × 밀린 날 × 빠진 것 전 조합으로 돌려
// 보낼글 · setup-send 일감 글 · 재촉 글을 모아 금지어(client-core 고객금지말)가 0 인지 본다. DB·네트워크 없음.
//   node scripts/test-client-copy.mjs
import { 체크리스트, 일감계획, 고객금지말, 금지말찾기 } from "../../web/lib/client-core.mjs";
import { 착수순서 } from "../../web/lib/onboard-core.mjs";

let 통과 = 0, 실패 = 0;
const 봄 = (이름, 참, 보탬 = "") => { if (참) 통과++; else { 실패++; console.log(`✗ ${이름}${보탬 ? ` — ${보탬}` : ""}`); } };

const 오늘 = "2026-10-17";
const 더하기 = (d, n) => new Date(Date.parse(`${d}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
const KEY = "k".repeat(32);
const 갈래들 = { 사이트: "miso-dental.co.kr", 빌더: "miso.imweb.me", 플랫폼: "blog.naver.com", 없음: null };
const 채널들 = { 사이트: {}, 빌더: {}, 플랫폼: { blog: "https://blog.naver.com/miso_blog", place: null, sns: null }, 없음: { blog: null, place: "https://m.place.naver.com/hospital/1", sns: null } };
const 점검 = {
  없음: { checkedAt: "t", home: { status: 200 }, robots: { status: 200, blocked: [] }, sitemap: { status: 200, ok: true, pages: 3, url: "u" }, llmsTxt: { status: 200, ok: true },
    homeLdTypes: ["Dentist"], indexnowFile: { status: 200, ok: true } },
  전부: { checkedAt: "t", home: { status: 200 }, robots: { status: 200, blocked: ["GPTBot"] }, sitemap: { status: 404, ok: false, url: "u" }, llmsTxt: { status: 404, ok: false, head: "" },
    homeLdTypes: [], indexnowFile: { status: 404, ok: false } },
};
const 업무 = (needs, 밀림) => ["intake", "questions", "inquiry-sheet", "local-audit", "manual-baseline", "baseline-report", ...(needs === "none" ? [] : ["site-launch"]),
  "content-draft", "content-approve", "content-publish", "manual-day30", "final-report", "renewal"].map((code) => ({ code, status: "대기", due_on: 더하기(오늘, -밀림) }));

const 모음 = [];
let 조합 = 0;
for (const [갈래, domain] of Object.entries(갈래들)) {
  for (const dns of ["고객", "우리", "모름", null]) {
    for (const needs of ["none", "setup", "build", null]) {
      for (const 밀림 of [0, 3, 10]) {
        for (const 빠짐 of ["없음", "전부"]) {
          for (const 블로그 of [null, "받음"]) {
            조합++;
            const onboard = { ...(dns ? { dns } : {}), ...(블로그 ? { blog: 블로그 } : {}), channels: 채널들[갈래] };
            const row = { id: 1, slug: "miso", name: "미소치과", domain, relation: "외부", status: "active", started_on: 더하기(오늘, -밀림), crawl_key: "ck",
              config: { v: 1, indexnow: domain && 갈래 !== "플랫폼" ? { mode: "우리", key: KEY } : { mode: "안 씀" }, wantGsc: !!domain && 갈래 !== "플랫폼", gsc: false,
                answerTerms: ["미소치과"], onboard } };
            const pilot = needs ? { id: "p-1", status: "진행", needs_build: needs, paid_on: 더하기(오늘, -밀림), started_on: 더하기(오늘, -밀림), ends_on: 더하기(오늘, 20), inquiry_key: "k-1" } : null;
            const derived = domain ? 점검[빠짐] : {};
            const 세팅줄 = 체크리스트(row, derived, { pilot: pilot ? { id: "p-1", status: "진행", approved: false } : null });
            const r = 착수순서({ row, derived, 세팅줄, pilot, tasks: pilot ? 업무(needs, 밀림) : [], questions: [], content: [], ai: [], checks: [], audits: [], 로그인일감: [], 크롤: null }, 오늘);
            const 이름 = `${갈래}·dns ${dns ?? "없음"}·${needs ?? "파일럿 없음"}·밀림 ${밀림}·빠짐 ${빠짐}·블로그 ${블로그 ?? "-"}`;
            for (const s of r.단계) for (const x of s.줄) if (x.보낼글) 모음.push({ 이름, 단계: s.id, 줄: x.id, 글: x.보낼글, 갈래, 빠짐, 밀림, needs });
            for (const t of 일감계획(row, 세팅줄).열기.filter((t) => t.key === "setup-send")) 모음.push({ 이름, 단계: "일감", 줄: "setup-send", 글: t.detail, 갈래, 빠짐, 밀림 });
            for (const x of 세팅줄) if (x.보낼글) 모음.push({ 이름, 단계: "체크리스트", 줄: x.id, 글: x.보낼글, 갈래, 빠짐, 밀림 });
          }
        }
      }
    }
  }
}

console.log(`조합 ${조합}개 · 고객 글 ${모음.length}개`);
봄(`조합 ${조합}개를 돌림 · 고객 글 ${모음.length}개 모음`, 조합 === 4 * 4 * 4 * 3 * 2 * 2 && 모음.length > 100);
const 걸림 = 모음.map((x) => ({ ...x, 말: 금지말찾기(x.글) })).filter((x) => x.말.length);
봄(`금지어 0 (목록 ${고객금지말.length}개)`, !걸림.length, 걸림.slice(0, 5).map((x) => `${x.이름} ${x.단계}.${x.줄} [${x.말.join(",")}] ${x.글.slice(0, 80)}`).join("\n   "));
봄("blog.naver.com 고객 — robots·sitemap·llms·IndexNow 를 말하는 고객 글 0", !모음.filter((x) => x.갈래 === "플랫폼").some((x) => /robots|sitemap|사이트맵|llms|indexnow/i.test(x.글)));
봄("blog.naver.com 고객 — 사이트 단계 보낼글 0 · setup-send 0", !모음.some((x) => x.갈래 === "플랫폼" && ["site", "일감", "체크리스트"].includes(x.단계)));
봄("홈페이지 없음 고객 — 사이트 단계 보낼글 0 · setup-send 0", !모음.some((x) => x.갈래 === "없음" && ["site", "일감", "체크리스트"].includes(x.단계)));
봄("사이트가 다 된 고객 — 사이트 단계 보낼글 0", !모음.some((x) => x.빠짐 === "없음" && ["site", "일감", "체크리스트"].includes(x.단계) && x.갈래 !== "없음" && x.갈래 !== "플랫폼"));
// 구축(build) 계약은 새 사이트를 여는 일이라 도메인 담당을 묻는 글(dns 모름)이 남는다 — 사이트를 그대로 쓰는 none·setup·파일럿 없음만 본다
봄("사이트가 다 된 고객 · 밀린 날 0 — 받을 것 단계 보낼글 0", !모음.some((x) => x.빠짐 === "없음" && x.밀림 === 0 && x.needs !== "build" && x.단계 === "receive" && !(x.줄 === "blog")),
  모음.filter((x) => x.빠짐 === "없음" && x.밀림 === 0 && x.needs !== "build" && x.단계 === "receive").map((x) => `${x.이름} ${x.줄}`).slice(0, 3).join(" / "));
봄("빠진 것이 있는 사이트 고객 — 보낼글은 관리자 아이디 한 문장(고칠 목록 아님)", 모음.filter((x) => x.줄 === "send" || x.줄 === "setup-send").every((x) => /관리자 아이디/.test(x.글) && !/\n\d\. /.test(x.글)));
봄("빌더 고객 — 빌더 이름 + 관리자 아이디", 모음.filter((x) => x.갈래 === "빌더" && x.단계 === "체크리스트").every((x) => x.글.includes("아임웹 관리자 아이디로")));
봄("블로그 채널이 있으면 블로그 아이디 요청 글", 모음.some((x) => x.갈래 === "플랫폼" && x.줄 === "blog" && x.글.includes("네이버 블로그 아이디로 저희가 들어갈 수 있게")));
봄("불안 팔지 않음 — 「늦」「서두르」「놓치」 0", !모음.some((x) => /늦|서두르|놓치/.test(x.글)));

console.log(`${통과} 통과 · ${실패} 실패`);
if (실패) process.exitCode = 1;
