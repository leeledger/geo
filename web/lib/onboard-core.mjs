/**
 * 계약 뒤 순서(Step 54) — 순수 함수. DB 는 onboard.ts 가 읽고, 저장은 onboard-actions.ts. 시험 academy/scripts/test-onboard-core.mjs.
 *
 * 계약한 고객 한 곳을 「계약 → 받을 것 → 사이트 → 질문 승인·착수 → 첫 7일 기준선 → 30일 → 30일 판정」 한 줄 순서로 편다.
 * 새로 저장하는 것은 없다(D204) — 체크리스트()·geo.pilots·pilot_tasks·getPilot()·로그인 일감·크롤 방문을 읽어 묶는다.
 * 상황 답(도메인 담당·서치어드바이저·빙·블로그 계정·기존 채널·이관)만 config.onboard 에 둔다.
 * 숫자는 입력에 있는 것만 쓴다(D211). 못 읽었으면 「못 읽음」, 기록이 없으면 「기록 없음」 — 0 을 지어내지 않는다. 비율·성공 판정은 계산하지 않는다.
 * 고객에게 가는 글(보낼글)에는 기술 말이 없다(D233 — client-core 고객금지말, 시험 test-client-copy). 고객이 할 일이 없으면 보낼 글도 없다.
 */
import { 오늘KST, 월일 } from "./client-status-core.mjs";
import { 갈래 as 홈갈래 } from "./client-core.mjs";
import { platformOf } from "./platform-hosts.mjs";

export const 누가 = { 자동: "자동", 세션: "Claude 세션", 원장: "원장님", 고객: "고객" };
export const 상태 = { 됨: "됨", 도는: "도는 중", 원장: "원장님 몫", 고객: "고객 기다림", 아직: "아직", 없음: "해당없음", 못: "못 읽음" };
const { 됨, 도는, 원장, 고객, 아직, 없음, 못 } = 상태;

const NEEDS = ["none", "setup", "build"];
const 준비말 = { none: "구축 없음", setup: "기술 세팅", build: "사이트 구축" };
/** 고객에게 보내는 기록표 주소의 기본 — 운영 랜딩. onboard.ts 가 site.ts SITE_URL 을 넘긴다 */
const SITE = "https://cited.kr";

// ─────────────────────────────────────────── 날짜 (KST)
const 날차 = (a, b) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);
const 날더하기 = (d, n) => new Date(Date.parse(`${d}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
const 두자리 = (n) => String(n).padStart(2, "0");
/** date 칸 → 'YYYY-MM-DD'. pg 는 date 를 그 PC 시간대의 자정 Date 로 준다 — 시간대 이동 없이 그 날짜 그대로 */
export function 날(x) {
  if (!x) return null;
  if (x instanceof Date) return Number.isNaN(+x) ? null : `${x.getFullYear()}-${두자리(x.getMonth() + 1)}-${두자리(x.getDate())}`;
  const s = String(x);
  return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : null;
}
/** timestamptz(문자·Date) → KST 날짜. DB 시각은 UTC 로 온다 */
export function 시각날(x) {
  if (!x) return null;
  const t = x instanceof Date ? +x : Date.parse(String(x).replace(" ", "T").replace(/([+-]\d\d)$/, "$1:00"));
  return Number.isNaN(t) ? null : 오늘KST(t);
}

// ─────────────────────────────────────────── 환불 위치 — pilot-plan.ts refundGuide 와 글자가 같아야 한다(D212, 시험 14)
export function 환불문장(p) {
  if (!p.kickoff_on) return "착수 전 취소 — 390,000원 모두 돌려드림";
  if (!p.baseline_sent_at) return "기준선 보고 전 취소 — 195,000원(50%) 돌려드림";
  return "기준선 보고 뒤 취소 — 돌려드리지 않음";
}

/** SOP 「성공 판정」 요약(research/pilot-measurement-sop.md). 이 화면은 판정하지 않는다 */
const 판정글 = "지역·문제·비교 17문항의 7일 비율이 기준선보다 늘거나, 상담 기록에서 AI·검색 유입 문의가 1건 이상 확인되면 성공입니다. 성공일 때만 월 구독을 안내하고, 아니면 실패 원인을 적습니다. 이 화면은 판정하지 않습니다. 최종 보고서 숫자로 정합니다";

const 인사 = (name) => `안녕하세요, ${name} 담당자님.`;
/** 재촉 글 — 무엇을 · 왜 지금 필요한지 · 회신 방법. 불안을 팔지 않는다 */
const 재촉 = (name, 무엇, 왜) => `${인사(name)}\n${무엇} 아직 받지 못했습니다. ${왜}. 이 메일에 답장으로 보내 주시거나 편하실 때 전화 주세요.`;
const dns물음 = (name) => `${인사(name)}\n홈페이지 관리자 아이디를 알려 주시거나, 홈페이지를 만든 업체 연락처를 알려 주세요. 손볼 곳은 저희가 직접 고칩니다.`;
const 블로그물음 = (name, 플랫폼) => `${인사(name)}\n${플랫폼} 아이디로 저희가 들어갈 수 있게 해 주세요. 글은 저희가 올리고 미리 보여 드립니다.`;

const 주소인가 = (s) => { try { const u = new URL(String(s)); return u.protocol === "http:" || u.protocol === "https:"; } catch { return false; } };

/**
 * 입력 = { row, derived, 세팅줄, pilot, tasks, questions, content, ai, checks, audits, 로그인일감, 크롤, site? }
 * 오늘 = 'YYYY-MM-DD'(KST) 또는 시각 숫자·Date(KST 날짜로 바꾼다)
 */
export function 착수순서(입력, 오늘 = 오늘KST()) {
  const 오늘일 = typeof 오늘 === "number" || 오늘 instanceof Date ? 오늘KST(+오늘) : String(오늘).slice(0, 10);
  const row = 입력.row ?? {};
  const c = row.config && typeof row.config === "object" ? row.config : {};
  const ob = c.onboard && typeof c.onboard === "object" && !Array.isArray(c.onboard) ? c.onboard : {};
  const 기록표앞 = 입력.site ?? SITE;
  // 자동 세팅이 만든 리허설 파일럿(외부·입금 전)은 계약 전이다 — 파일럿 없음과 같은 순서로 편다(55f 가 계약으로 올린다)
  const 자동리허설 = 입력.pilot?.status === "리허설" && row.relation === "외부" && !날(입력.pilot?.paid_on);
  const p = 자동리허설 ? null : 입력.pilot ?? null;
  const 홈 = 홈갈래(row);
  const 홈있음 = 홈 === "사이트" || 홈 === "빌더";
  const 배열 = (x) => (Array.isArray(x) ? x : []);
  const tasks = 배열(입력.tasks), questions = 배열(입력.questions), content = 배열(입력.content), ai = 배열(입력.ai), checks = 배열(입력.checks), audits = 배열(입력.audits);
  const 세팅 = new Map(배열(입력.세팅줄).map((x) => [x.id, x]));
  const T = (code) => tasks.find((t) => t.code === code) ?? null;
  const 완료 = (code) => T(code)?.status === "완료";

  const 리허설 = p?.status === "리허설";
  const 자사 = row.relation === "자사";
  const 계약없음 = 자사 || 리허설;
  const 취소 = 날(p?.cancelled_on);
  const nb = NEEDS.includes(p?.needs_build) ? p.needs_build : "none";
  const 구축 = nb !== "none";
  const kickoff = 날(p?.kickoff_on), launch = 날(p?.site_launch_on), paid = 날(p?.paid_on), ends = 날(p?.ends_on), start = 날(p?.started_on);
  const baselineSent = 시각날(p?.baseline_sent_at);
  const approvedAt = 시각날(p?.questions_approved_at);
  const 사이트있음 = !(nb === "build" && !launch);
  const 파일럿링크 = p?.id ? `/admin/pilots/${p.id}` : null;
  const 상황링크 = `/admin/clients/${row.slug}/onboard#situation`;
  const dns = ob.dns ?? null;

  /** 원장님·Claude 세션 몫 기한 말 */
  const 기한말 = (code) => {
    const t = T(code);
    const d = 날(t?.due_on);
    const 막힘 = t?.status === "막힘" ? " · 막힘으로 표시됨" : "";
    if (!d) return 막힘;
    if (d > 오늘일) return ` · 기한 ${월일(d)}${막힘}`;
    if (d === 오늘일) return ` · 기한 오늘${막힘}`;
    return ` · 기한 ${월일(d)}에서 ${날차(d, 오늘일)}일 지남${막힘}`;
  };
  /** 고객 몫 — 기준일(그 업무 기한, 없으면 입금 확인일, 파일럿 없으면 등록일)부터 며칠째. 3일 이상이면 재촉 글 */
  const 고객줄 = (줄, due, 무엇, 왜) => {
    const 기준 = 날(due) ?? paid ?? 날(row.started_on);
    const 끝줄 = { ...줄, 누가: 누가.고객, 상태: 고객 };
    if (!기준) return 끝줄;
    if (기준 > 오늘일) return { ...끝줄, 사람말: `${줄.사람말} · 기한 ${월일(기준)}` };
    const n = 날차(기준, 오늘일);
    const out = { ...끝줄, 사람말: `${줄.사람말} · ${n === 0 ? "기한 오늘" : `${n}일째`}`, 일수: n };
    if (n >= 3 && !계약없음 && 무엇) out.보낼글 = 재촉(row.name, 무엇, 왜);
    return out;
  };

  // ─────────────── 계약
  const contract = (() => {
    const 칸 = [["refund", "환불 절 서면 전달"], ["paid", "입금 확인"], ["invoice", "세금계산서"], ["pilot", "파일럿 시작"]];
    if (계약없음) {
      const 말 = 리허설 ? "리허설이라 계약이 없습니다" : "자사라 계약이 없습니다";
      return 칸.map(([id, k]) => ({ id, 칸: k, 누가: 누가.원장, 상태: 없음, 사람말: 말 }));
    }
    if (!p) {
      return [
        ...칸.slice(0, 3).map(([id, k]) => ({ id, 칸: k, 누가: 누가.원장, 상태: 아직, 사람말: "파일럿을 시작할 때 넣습니다" })),
        { id: "pilot", 칸: "파일럿 시작", 누가: 누가.원장, 상태: 원장, 사람말: "계약이 되면 파일럿 시작 칸을 넣습니다 — 필요한 준비도 거기서 고릅니다", 링크: `/admin/clients/${row.slug}#pilot` },
      ];
    }
    const 계약칸 = (id, k, d, 됨말, 빈말) => (d
      ? { id, 칸: k, 누가: 누가.원장, 상태: 됨, 사람말: 됨말(d) }
      : { id, 칸: k, 누가: 누가.원장, 상태: 원장, 사람말: 빈말, 링크: 파일럿링크 });
    return [
      계약칸("refund", "환불 절 서면 전달", 날(p.refund_terms_sent_on), (d) => `${월일(d)} 서면으로 보냈습니다`, "환불 절을 서면으로 보낸 날이 비었습니다 — 파일럿 화면 계약 칸에 넣습니다"),
      계약칸("paid", "입금 확인", paid, (d) => `${월일(d)} 입금을 확인했습니다`, "입금 확인일이 비었습니다 — 파일럿 화면 계약 칸에 넣습니다"),
      계약칸("invoice", "세금계산서", 날(p.invoice_issued_on), (d) => `${월일(d)} 발행했습니다`, "세금계산서 발행일 미입력 — 발행하면 파일럿 화면 계약 칸에 넣습니다"),
      { id: "pilot", 칸: "파일럿 시작", 누가: 누가.원장, 상태: 됨, 사람말: `필요한 준비 ${준비말[nb]}`, 링크: 파일럿링크 },
    ];
  })();

  // ─────────────── 받을 것
  const 세팅상태 = { 됨, 기다림: 도는, 사람: 원장, 해당없음: 없음 };
  const gscLine = 세팅.get("gsc");
  const gsc됨 = gscLine?.상태 === "됨";
  const receive = [];
  receive.push(!p
    ? { id: "intake", 칸: "사업자·공식 정보·관리자 권한", 누가: 누가.고객, 상태: 아직, 사람말: "파일럿을 시작하면 받을 것 목록이 생깁니다" }
    : 완료("intake")
      ? { id: "intake", 칸: "사업자·공식 정보·관리자 권한", 누가: 누가.고객, 상태: 됨, 사람말: "받았습니다" }
      : 고객줄({ id: "intake", 칸: "사업자·공식 정보·관리자 권한", 사람말: `상호·주소·전화·운영시간${홈있음 ? "과 홈페이지 관리자 아이디" : ""}를 받습니다`, 링크: 파일럿링크 }, T("intake")?.due_on,
        홈있음 ? "사업자 정보와 공식 정보(상호·주소·전화·운영시간), 홈페이지 관리자 아이디를" : "사업자 정보와 공식 정보(상호·주소·전화·운영시간)를",
        "곳마다 같은 정보로 맞춰야 첫 측정과 점검을 시작할 수 있습니다"));

  const ch = ob.channels && typeof ob.channels === "object" ? ob.channels : {};
  const 채널 = [["blog", "블로그"], ["place", "플레이스"], ["sns", "SNS"]].filter(([k]) => 주소인가(ch[k]));
  receive.push(채널.length
    ? { id: "channels", 칸: "기존 채널 주소", 누가: 누가.고객, 상태: 됨, 사람말: `받았습니다: ${채널.map(([, n]) => n).join(" · ")}`, 근거: 채널.map(([k]) => ch[k]).join(" · ") }
    : ob.noChannels === true
      ? { id: "channels", 칸: "기존 채널 주소", 누가: 누가.고객, 상태: 됨, 사람말: "운영 중인 블로그·플레이스·SNS 가 없다고 표시했습니다" }
      : 고객줄({ id: "channels", 칸: "기존 채널 주소", 사람말: "운영 중인 블로그·플레이스·SNS 주소를 받아 「상황 바꾸기」에 넣습니다", 링크: 상황링크 }, T("intake")?.due_on,
        "운영 중인 네이버 블로그·플레이스·SNS 주소를", "곳마다 상호·주소·전화가 같은지 점검하는 데 씁니다"));

  receive.push(
    dns === "고객" ? { id: "dns", 칸: "도메인·호스팅 담당", 누가: 누가.고객, 상태: 됨, 사람말: "고객 쪽 담당이 고칩니다 — 고칠 목록은 사이트 단계에서 보냅니다" }
    : dns === "우리" ? { id: "dns", 칸: "도메인·호스팅 담당", 누가: 누가.세션, 상태: 됨, 사람말: "관리 권한을 받아 우리가 직접 고칩니다" }
    : dns === "모름" ? (사이트있음
      ? { id: "dns", 칸: "도메인·호스팅 담당", 누가: 누가.원장, 상태: 원장, 사람말: "누가 만지는지 모릅니다 — 사이트 단계 「고객 담당에게 보낼 것」의 물음 글로 묻습니다" }
      : { id: "dns", 칸: "도메인·호스팅 담당", 누가: 누가.원장, 상태: 원장, 사람말: "누가 만지는지 모릅니다 — 아래 글로 묻습니다", 보낼글: dns물음(row.name) })
    : { id: "dns", 칸: "도메인·호스팅 담당", 누가: 누가.원장, 상태: 원장, 사람말: "도메인·호스팅을 누가 만지는지 「상황 바꾸기」에서 고릅니다", 링크: 상황링크 });

  if (!gscLine) receive.push({ id: "gsc", 칸: "구글 서치콘솔 권한", 누가: 누가.원장, 상태: 못, 사람말: "세팅 체크리스트를 못 읽었습니다" });
  else receive.push({ id: "gsc", 칸: "구글 서치콘솔 권한", 누가: 누가.원장, 상태: 세팅상태[gscLine.상태] ?? 못,
    사람말: gscLine.상태 === "사람" && gscLine.할일 ? `${gscLine.사람말}. ${gscLine.할일}` : gscLine.사람말 });

  const sa = ob.naverSa ?? "아직";
  const 사이트먼저 = "사이트를 연 뒤 등록합니다";
  receive.push(
    sa === "끝" ? { id: "naversa", 칸: "네이버 서치어드바이저", 누가: 누가.원장, 상태: 됨, 사람말: "등록과 소유 확인을 마쳤다고 표시했습니다" }
    : sa === "안씀" ? { id: "naversa", 칸: "네이버 서치어드바이저", 누가: 누가.원장, 상태: 없음, 사람말: "쓰지 않기로 했습니다" }
    : !사이트있음 ? { id: "naversa", 칸: "네이버 서치어드바이저", 누가: 누가.원장, 상태: 아직, 사람말: 사이트먼저 }
    : sa === "확인파일보냄" ? (dns === "우리"
      ? { id: "naversa", 칸: "네이버 서치어드바이저", 누가: 누가.세션, 상태: 도는, 사람말: "확인 파일을 우리가 올립니다 — 올린 뒤 원장님이 서치어드바이저에서 소유 확인을 누릅니다(캡차)" }
      // 보낸 날을 저장하지 않는다 — 며칠째를 셀 근거가 없어 일수·재촉 글을 안 만든다(D220)
      : { id: "naversa", 칸: "네이버 서치어드바이저", 누가: 누가.고객, 상태: 고객, 사람말: "확인 파일을 고객 담당에게 보냈습니다 — 올라가면 원장님이 소유 확인을 누릅니다(캡차)" })
    : { id: "naversa", 칸: "네이버 서치어드바이저", 누가: 누가.원장, 상태: 원장,
      사람말: `서치어드바이저에 사이트를 넣고 확인 파일을 받습니다. 캡차가 떠서 원장님이 직접 합니다 — 파일은 ${dns === "우리" ? "우리가" : dns === "고객" ? "고객 담당이" : "도메인 담당이"} 올립니다` });

  const bing = ob.bing ?? "아직";
  receive.push(
    bing === "끝" ? { id: "bing", 칸: "빙 웹마스터", 누가: 누가.원장, 상태: 됨, 사람말: "등록했다고 표시했습니다" }
    : bing === "안씀" ? { id: "bing", 칸: "빙 웹마스터", 누가: 누가.원장, 상태: 없음, 사람말: "쓰지 않기로 했습니다" }
    : !사이트있음 ? { id: "bing", 칸: "빙 웹마스터", 누가: 누가.원장, 상태: 아직, 사람말: 사이트먼저 }
    : gsc됨 ? { id: "bing", 칸: "빙 웹마스터", 누가: 누가.원장, 상태: 원장, 사람말: "빙 웹마스터에서 구글 서치콘솔 「가져오기」로 넣습니다" }
    : gscLine?.상태 === "해당없음" ? { id: "bing", 칸: "빙 웹마스터", 누가: 누가.원장, 상태: 원장, 사람말: "구글 서치콘솔을 안 써서 빙 웹마스터에 직접 넣습니다(확인 파일)" }
    : { id: "bing", 칸: "빙 웹마스터", 누가: 누가.원장, 상태: 아직, 사람말: "구글 서치콘솔 권한이 먼저입니다 — 빙은 거기서 가져옵니다" });

  const 일감 = 입력.로그인일감;
  const blog = ob.blog ?? null;
  const 블로그주소 = 주소인가(ch.blog) ? String(ch.blog) : null;
  const 블로그플랫폼 = 블로그주소 ? (() => { try { return platformOf(new URL(블로그주소).hostname)?.name ?? "블로그"; } catch { return "블로그"; } })() : null;
  const 저장명령 = `원장 PC 에서 한 번: node tools/save-login.mjs naver-${row.slug} — 끝나면 「상황 바꾸기」에 저장한 날을 넣습니다`;
  receive.push(
    blog === "없음" ? { id: "blog", 칸: "네이버 블로그 계정", 누가: 누가.고객, 상태: 없음, 사람말: "고객에게 네이버 블로그가 없습니다" }
    : blog === "안맡김" ? { id: "blog", 칸: "네이버 블로그 계정", 누가: 누가.고객, 상태: 없음, 사람말: "블로그는 고객이 직접 씁니다" }
    : blog === "받음" ? (일감 === "못읽음"
      ? { id: "blog", 칸: "네이버 블로그 계정", 누가: 누가.원장, 상태: 못, 사람말: "로그인 일감을 못 읽었습니다" }
      : 배열(일감).length
        ? { id: "blog", 칸: "네이버 블로그 계정", 누가: 누가.원장, 상태: 원장, 사람말: `로그인 일감이 열려 있습니다: ${배열(일감).map((t) => t.title).join(" · ")}`, 근거: 배열(일감).map((t) => t.dedupe_key).join(" · "), 링크: "/admin/ops" }
        : 날(ob.blogSavedOn)
          ? { id: "blog", 칸: "네이버 블로그 계정", 누가: 누가.원장, 상태: 됨, 사람말: `${월일(날(ob.blogSavedOn))} 원장 PC 에 로그인을 저장했다고 표시했습니다` }
          : { id: "blog", 칸: "네이버 블로그 계정", 누가: 누가.원장, 상태: 원장, 사람말: 저장명령 })
    // 채널에 블로그 주소가 있으면 묻지 않고 아이디만 받는다 — 보낼 글 하나
    : 블로그주소 ? { id: "blog", 칸: "네이버 블로그 계정", 누가: 누가.원장, 상태: 원장, 사람말: `블로그(${블로그주소})에 우리가 글을 올리려면 아이디가 필요합니다 — 받으면 「상황 바꾸기」에서 「받음」`,
      보낼글: 블로그물음(row.name, 블로그플랫폼), 링크: 상황링크 }
    : { id: "blog", 칸: "네이버 블로그 계정", 누가: 누가.원장, 상태: 원장, 사람말: "블로그가 있는지, 우리가 글을 올려도 되는지 묻고 「상황 바꾸기」에서 고릅니다", 링크: 상황링크 });

  if (ob.migrate === true) {
    const ms = ob.migrateState ?? "아직";
    receive.push(ms === "끝" ? { id: "migrate", 칸: "블로그 글 이관", 누가: 누가.세션, 상태: 됨, 사람말: "옮겼다고 표시했습니다" }
      : { id: "migrate", 칸: "블로그 글 이관", 누가: 누가.세션, 상태: 도는, 사람말: `${ms === "진행" ? "옮기는 중입니다" : "Claude 세션이 옮길 차례입니다"} — 이관 도구가 없어 손으로 옮기고 「상황 바꾸기」에서 표시합니다` });
  }

  // ─────────────── 사이트
  const site = [];
  const 연뒤 = "사이트를 연 뒤 점검합니다";
  const 칸이름 = { site: "사이트 열림", robots: "AI 크롤러 허용(robots)", sitemap: "사이트맵", llms: "llms.txt", jsonld: "홈 JSON-LD", keyfile: "IndexNow 키 파일" };
  for (const id of ["site", "robots", "sitemap", "llms", "jsonld", "keyfile"]) {
    const x = 세팅.get(id);
    if (!사이트있음) site.push({ id, 칸: 칸이름[id], 누가: 누가.자동, 상태: 없음, 사람말: 연뒤 });
    else if (!x) site.push({ id, 칸: 칸이름[id], 누가: 누가.자동, 상태: 못, 사람말: "세팅 체크리스트를 못 읽었습니다" });
    else site.push({ id, 칸: x.칸, 누가: 누가.자동, 상태: 세팅상태[x.상태] ?? 못, 사람말: x.사람말 });
  }
  // send — 세팅줄의 보낼글만 고객에게 간다(D232). 할일·고칠것(기술 목록)은 보낼글로 쓰지 않는다
  const send = 세팅.get("send");
  if (!사이트있음) site.push({ id: "send", 칸: "고객 담당에게 보낼 것", 누가: 누가.원장, 상태: 없음, 사람말: 연뒤 });
  else if (!send) site.push({ id: "send", 칸: "고객 담당에게 보낼 것", 누가: 누가.원장, 상태: 못, 사람말: "세팅 체크리스트를 못 읽었습니다" });
  else if (send.상태 === "해당없음") site.push({ id: "send", 칸: send.칸, 누가: 누가.원장, 상태: 없음, 사람말: send.사람말 });
  else if (send.상태 === "됨") site.push({ id: "send", 칸: send.칸, 누가: dns === "우리" ? 누가.세션 : 누가.원장, 상태: 됨, 사람말: send.사람말 });
  else if (dns === "우리" && send.고칠것) {
    const n = /^.*?고칠 것 (\d+)가지/.exec(send.고칠것)?.[1];
    site.push({ id: "send", 칸: "고칠 것", 누가: 누가.세션, 상태: 도는, 사람말: `우리가 직접 고칩니다 — ${n ? `빠진 ${n}가지를` : "위에서 빠진 것을"} Claude 세션이 반영합니다`, 근거: send.고칠것 });
  } else if (send.상태 !== "사람") site.push({ id: "send", 칸: send.칸, 누가: 누가.자동, 상태: 세팅상태[send.상태] ?? 못, 사람말: send.사람말 });
  else if (dns === "모름") {
    site.push({ id: "send", 칸: send.칸, 누가: 누가.원장, 상태: 원장, 사람말: "고칠 것이 있는데 누가 고칠지 모릅니다 — 먼저 묻고 「상황 바꾸기」에서 고릅니다", 보낼글: dns물음(row.name) });
  } else site.push({ id: "send", 칸: send.칸, 누가: 누가.원장, 상태: 원장, 사람말: send.사람말, ...(send.보낼글 ? { 보낼글: send.보낼글 } : {}) });

  if (구축) {
    const 보인날 = 날(nb === "build" ? ob.draftShownOn : ob.setupReportOn);
    const 이름 = nb === "build" ? "시안" : "세팅 작업 보고";
    site.push(보인날
      ? { id: nb === "build" ? "draft" : "report", 칸: 이름, 누가: 누가.세션, 상태: 됨, 사람말: `${월일(보인날)} 고객에게 보였습니다 — 이날부터 ${nb === "build" ? "구축" : "세팅"} 환불은 절반입니다(신청서)` }
      : !p ? { id: nb === "build" ? "draft" : "report", 칸: 이름, 누가: 누가.세션, 상태: 아직, 사람말: "파일럿을 시작한 뒤 합니다" }
      : !baselineSent ? { id: nb === "build" ? "draft" : "report", 칸: 이름, 누가: 누가.세션, 상태: 아직, 사람말: "손대기 전 첫 7일 기준선이 먼저입니다" }
      : { id: nb === "build" ? "draft" : "report", 칸: 이름, 누가: 누가.세션, 상태: 도는, 사람말: `Claude 세션이 ${nb === "build" ? "시안을 만듭니다" : "세팅하고 작업 보고를 씁니다"} — 고객에게 보이면 「상황 바꾸기」에 날짜를 넣습니다`, 링크: 상황링크 });
    site.push(launch
      ? { id: "launch", 칸: "사이트 연 날", 누가: 누가.원장, 상태: 됨, 사람말: `${월일(launch)} 열었습니다` }
      : !p ? { id: "launch", 칸: "사이트 연 날", 누가: 누가.원장, 상태: 아직, 사람말: "파일럿을 시작한 뒤 합니다" }
      : { id: "launch", 칸: "사이트 연 날", 누가: 누가.원장, 상태: 원장, 사람말: `사이트를 열면 파일럿 화면 계약 칸에 연 날을 넣습니다. 손대기 전 7일 기준선 뒤에 엽니다${기한말("site-launch")}`, 링크: 파일럿링크 });
    if (nb === "build") {
      const k = 입력.크롤;
      site.push(!launch ? { id: "crawl", 칸: "AI 크롤러 방문", 누가: 누가.자동, 상태: 아직, 사람말: "사이트를 연 뒤 셉니다" }
        : !row.crawl_key ? { id: "crawl", 칸: "AI 크롤러 방문", 누가: 누가.자동, 상태: 아직, 사람말: "새 사이트에 방문 기록 코드를 심으면 셉니다" }
        : k === "못읽음" ? { id: "crawl", 칸: "AI 크롤러 방문", 누가: 누가.자동, 상태: 못, 사람말: "방문 기록을 못 읽었습니다" }
        : !k || typeof k !== "object" ? { id: "crawl", 칸: "AI 크롤러 방문", 누가: 누가.자동, 상태: 도는, 사람말: "방문 기록 없음" }
        : { id: "crawl", 칸: "AI 크롤러 방문", 누가: 누가.자동, 상태: 도는,
          사람말: k.n7 ? `최근 7일 ${k.n7}번${시각날(k.last) ? ` · 마지막 ${월일(시각날(k.last))}` : ""}` : `최근 7일 방문 기록 없음${시각날(k.last) ? ` · 마지막 ${월일(시각날(k.last))}` : ""}`,
          근거: String(k.n7 ?? 0) });
    }
  }

  // ─────────────── 질문 승인·착수
  const 승인수 = questions.filter((x) => x.approved === true).length;
  const 승인됨 = !!approvedAt || 완료("questions");
  const kickoffRows = [];
  if (!p) kickoffRows.push({ id: "questions", 칸: "질문 20개 승인", 누가: 누가.고객, 상태: 아직,
    사람말: 자동리허설 && questions.length ? `질문 ${questions.length}개를 자동으로 만들어 두었습니다 — 파일럿을 시작하면 승인을 받습니다` : "파일럿을 시작하면 질문 20개가 생깁니다" });
  else if (승인됨) kickoffRows.push({ id: "questions", 칸: "질문 20개 승인", 누가: 누가.고객, 상태: 됨, 사람말: `승인 ${승인수}/${questions.length}${approvedAt ? ` · ${월일(approvedAt)}` : ""}`, 근거: `${승인수}/${questions.length}` });
  else kickoffRows.push(고객줄({ id: "questions", 칸: "질문 20개 승인",
    사람말: `승인 ${승인수}/${questions.length} — 고객이 승인하면 다음 측정부터 잽니다${nb === "none" && ends ? ` · 승인이 늦어도 30일은 ${월일(ends)} 에 끝납니다(신청서 8행)` : ""}`,
    근거: `${승인수}/${questions.length}`, 링크: 파일럿링크 }, T("questions")?.due_on,
    "목표 질문 20개 승인을", "승인한 질문으로 AI 답을 재기 시작합니다"));

  const 측정일 = ai.map((a) => String(a.day ?? "").slice(0, 10)).filter(Boolean).sort();
  const 칠일전 = 날더하기(오늘일, -6);
  const 최근 = ai.filter((a) => String(a.day ?? "").slice(0, 10) >= 칠일전).reduce((s, a) => s + (Number(a.n) || 0), 0);
  const 측정말 = 측정일.length ? `마지막 측정 ${월일(측정일.at(-1))} · 최근 7일 ${최근}건` : "아직 측정 없음";
  kickoffRows.push(!p ? { id: "first-measure", 칸: "첫 측정(착수)", 누가: 누가.자동, 상태: 아직, 사람말: "질문 승인 뒤 시작합니다" }
    : kickoff ? { id: "first-measure", 칸: "첫 측정(착수)", 누가: 누가.자동, 상태: 측정일.length ? 됨 : 도는, 사람말: `착수 ${월일(kickoff)} · ${측정말}`, 근거: 측정말 }
    : 승인됨 ? { id: "first-measure", 칸: "첫 측정(착수)", 누가: 누가.자동, 상태: 도는, 사람말: `다음 측정 때 시작합니다 · ${측정말}` }
    : { id: "first-measure", 칸: "첫 측정(착수)", 누가: 누가.자동, 상태: 아직, 사람말: `질문 승인이 먼저입니다 · ${측정말}` });

  const 기록표 = p?.inquiry_key ? `${기록표앞}/record/${p.inquiry_key}` : null;
  kickoffRows.push(!p ? { id: "inquiry-sheet", 칸: "상담 유입 기록표", 누가: 누가.원장, 상태: 아직, 사람말: "파일럿을 시작하면 기록표 주소가 생깁니다" }
    : 완료("inquiry-sheet") ? { id: "inquiry-sheet", 칸: "상담 유입 기록표", 누가: 누가.원장, 상태: 됨, 사람말: "보냈습니다" }
    : { id: "inquiry-sheet", 칸: "상담 유입 기록표", 누가: 누가.원장, 상태: 원장, 사람말: `기록표 주소를 고객에게 보냅니다${기한말("inquiry-sheet")}`,
      ...(기록표 ? { 보낼글: `${인사(row.name)}\n상담 때 손님께 「어떻게 알고 오셨어요」를 여쭙고 아래 주소에 적어 주세요. 한 번에 30초면 됩니다. 30일 뒤 결과를 볼 때 이 기록을 씁니다.\n${기록표}` } : {}) });

  // ─────────────── 첫 7일 기준선
  const 확인칸 = audits.filter((a) => a.verdict && a.verdict !== "미확인").length;
  const 점검말 = audits.length ? `점검 ${확인칸}/${audits.length}칸 확인` : "점검 칸 기록 없음";
  const 채널없음 = !채널.length && ob.noChannels !== true;
  const baseline = [];
  baseline.push(!p ? { id: "local-audit", 칸: "상호·주소·전화 곳마다 점검", 누가: 누가.세션, 상태: 아직, 사람말: "파일럿을 시작한 뒤 합니다" }
    : 완료("local-audit") ? { id: "local-audit", 칸: "상호·주소·전화 곳마다 점검", 누가: 누가.세션, 상태: 됨, 사람말: 점검말, 근거: 점검말 }
    : !kickoff ? { id: "local-audit", 칸: "상호·주소·전화 곳마다 점검", 누가: 누가.세션, 상태: 아직, 사람말: `착수 뒤에 점검합니다 · ${점검말}` }
    : { id: "local-audit", 칸: "상호·주소·전화 곳마다 점검", 누가: 누가.세션, 상태: 도는, 사람말: `Claude 세션 차례 · ${점검말}${채널없음 ? " · 기존 채널 주소를 아직 못 받았습니다" : ""}${기한말("local-audit")}`, 근거: 점검말, 링크: 파일럿링크 });
  const 손말 = checks.length ? `손 확인 ${checks.length}건` : "손 확인 기록 없음";
  baseline.push(!p ? { id: "manual-baseline", 칸: "AI 개요·AI 브리핑 손 확인", 누가: 누가.원장, 상태: 아직, 사람말: "파일럿을 시작한 뒤 합니다" }
    : 완료("manual-baseline") ? { id: "manual-baseline", 칸: "AI 개요·AI 브리핑 손 확인", 누가: 누가.원장, 상태: 됨, 사람말: 손말, 근거: 손말 }
    : !kickoff ? { id: "manual-baseline", 칸: "AI 개요·AI 브리핑 손 확인", 누가: 누가.원장, 상태: 아직, 사람말: `착수 뒤에 합니다 · ${손말}` }
    : { id: "manual-baseline", 칸: "AI 개요·AI 브리핑 손 확인", 누가: 누가.원장, 상태: 원장, 사람말: `구글 AI 개요·네이버 AI 브리핑을 손으로 확인하고 캡처합니다 · ${손말}${기한말("manual-baseline")}`, 근거: 손말, 링크: 파일럿링크 && `${파일럿링크}#manual` });
  const 기준선날 = kickoff ? 날더하기(kickoff, 7) : null;
  baseline.push(!p ? { id: "baseline-report", 칸: "기준선 보고", 누가: 누가.세션, 상태: 아직, 사람말: "파일럿을 시작한 뒤 합니다" }
    : baselineSent ? { id: "baseline-report", 칸: "기준선 보고", 누가: 누가.세션, 상태: 됨, 사람말: `${월일(baselineSent)} 보냈습니다` }
    : !kickoff ? { id: "baseline-report", 칸: "기준선 보고", 누가: 누가.세션, 상태: 아직, 사람말: "착수 뒤 7일을 재고 만듭니다" }
    : 오늘일 < 기준선날 ? { id: "baseline-report", 칸: "기준선 보고", 누가: 누가.세션, 상태: 도는, 사람말: `첫 7일을 재는 중입니다 — ${월일(기준선날)} 에 만듭니다` }
    : { id: "baseline-report", 칸: "기준선 보고", 누가: 누가.세션, 상태: 도는, 사람말: `Claude 세션이 기준선 보고를 만들 차례입니다 — 보내면 파일럿 화면에서 「보냈음」을 누릅니다${오늘일 > 기준선날 ? ` · ${날차(기준선날, 오늘일)}일 지남` : ""}`, 링크: 파일럿링크 });

  // ─────────────── 30일
  // 구축·세팅은 연 날부터 30일(academy/pilot-plan.mjs 파일럿일정 과 같은 셈: 시작 + 29). DB started_on·ends_on 이 아직 안 맞춰졌어도 낡은 기간을 안 보인다(D219)
  const 기간시작 = nb === "none" ? (paid ?? start) : launch;
  const 기간끝 = 구축 ? (launch ? 날더하기(launch, 29) : null) : ends;
  const 기간앎 = !!p && !(구축 && !launch) && !!기간시작 && !!기간끝;
  const 시작함 = 기간앎 && 오늘일 >= 기간시작;
  const 끝남 = 기간앎 && 오늘일 >= 기간끝;
  const run30 = [];
  run30.push(!p ? { id: "period", 칸: "30일", 누가: 누가.자동, 상태: 아직, 사람말: "파일럿을 시작하면 셉니다" }
    : 구축 && !launch ? { id: "period", 칸: "30일", 누가: 누가.자동, 상태: 아직, 사람말: "사이트 연 날 미입력 — 30일 아직 안 셈" }
    : !기간앎 ? { id: "period", 칸: "30일", 누가: 누가.자동, 상태: 못, 사람말: "기간 기록 없음" }
    : 오늘일 < 기간시작 ? { id: "period", 칸: "30일", 누가: 누가.자동, 상태: 아직, 사람말: `${월일(기간시작)}~${월일(기간끝)}` }
    : 오늘일 > 기간끝 ? { id: "period", 칸: "30일", 누가: 누가.자동, 상태: 됨, 사람말: `${월일(기간시작)}~${월일(기간끝)} · 끝났습니다` }
    : { id: "period", 칸: "30일", 누가: 누가.자동, 상태: 도는, 사람말: `${월일(기간시작)}~${월일(기간끝)} · 남은 ${날차(오늘일, 기간끝)}일` });
  const ct = content[0] ?? null;
  const st = ct?.status ?? null;
  const 초안됨 = 완료("content-draft") || ["초안", "수정 요청", "승인", "게시"].includes(st);
  const 승인받음 = 완료("content-approve") || ["승인", "게시"].includes(st);
  const 게시됨 = 완료("content-publish") || st === "게시";
  run30.push(!p ? { id: "content-draft", 칸: "근거 콘텐츠 초안", 누가: 누가.세션, 상태: 아직, 사람말: "파일럿을 시작한 뒤 합니다" }
    : 초안됨 ? { id: "content-draft", 칸: "근거 콘텐츠 초안", 누가: 누가.세션, 상태: 됨, 사람말: "초안이 나왔습니다" }
    : !시작함 ? { id: "content-draft", 칸: "근거 콘텐츠 초안", 누가: 누가.세션, 상태: 아직, 사람말: "30일이 시작되면 씁니다" }
    : { id: "content-draft", 칸: "근거 콘텐츠 초안", 누가: 누가.세션, 상태: 도는, 사람말: `Claude 세션 차례 — 상담에서 들은 말과 실제 사실이 있어야 씁니다${기한말("content-draft")}`, 링크: 파일럿링크 });
  run30.push(!p ? { id: "content-approve", 칸: "콘텐츠 사실 확인", 누가: 누가.고객, 상태: 아직, 사람말: "파일럿을 시작한 뒤 합니다" }
    : 승인받음 ? { id: "content-approve", 칸: "콘텐츠 사실 확인", 누가: 누가.고객, 상태: 됨, 사람말: "고객이 확인했습니다" }
    : !초안됨 ? { id: "content-approve", 칸: "콘텐츠 사실 확인", 누가: 누가.고객, 상태: 아직, 사람말: "초안이 먼저입니다" }
    : 고객줄({ id: "content-approve", 칸: "콘텐츠 사실 확인", 사람말: st === "수정 요청" ? "고객이 고칠 곳을 보냈습니다 — 반영한 뒤 다시 확인을 받습니다" : "초안의 사실 확인을 기다립니다", 링크: 파일럿링크 },
      T("content-approve")?.due_on, "근거 콘텐츠 초안의 사실 확인을", "확인을 받아야 게시하고 검색에 알릴 수 있습니다"));
  run30.push(!p ? { id: "content-publish", 칸: "콘텐츠 게시·색인 요청", 누가: 누가.세션, 상태: 아직, 사람말: "파일럿을 시작한 뒤 합니다" }
    : 게시됨 ? { id: "content-publish", 칸: "콘텐츠 게시·색인 요청", 누가: 누가.세션, 상태: 됨, 사람말: "게시했습니다", ...(주소인가(ct?.published_url) ? { 링크: ct.published_url } : {}) }
    : !승인받음 ? { id: "content-publish", 칸: "콘텐츠 게시·색인 요청", 누가: 누가.세션, 상태: 아직, 사람말: "고객 확인이 먼저입니다" }
    : { id: "content-publish", 칸: "콘텐츠 게시·색인 요청", 누가: 누가.세션, 상태: 도는, 사람말: `Claude 세션이 게시하고 색인을 요청할 차례입니다${기한말("content-publish")}`, 링크: 파일럿링크 });

  // ─────────────── 30일 판정
  const 끝전말 = 기간앎 ? `30일 끝(${월일(기간끝)})에 합니다` : "30일이 정해지면 합니다";
  const day30 = [];
  const 끝줄 = (id, 칸, 누구, 할말, 링크) => (!p ? { id, 칸, 누가: 누구, 상태: 아직, 사람말: "파일럿을 시작한 뒤 합니다" }
    : 완료(id) ? { id, 칸, 누가: 누구, 상태: 됨, 사람말: "마쳤습니다" }
    : !끝남 ? { id, 칸, 누가: 누구, 상태: 아직, 사람말: 끝전말 }
    : { id, 칸, 누가: 누구, 상태: 누구 === 누가.원장 ? 원장 : 도는, 사람말: `${할말}${기한말(id)}`, ...(링크 ? { 링크 } : {}) });
  day30.push(끝줄("manual-day30", "30일 차 손 확인", 누가.원장, "같은 질문으로 구글 AI 개요·네이버 AI 브리핑을 다시 손 확인하고 캡처합니다", 파일럿링크 && `${파일럿링크}#manual`));
  day30.push(끝줄("final-report", "최종 보고", 누가.세션, "Claude 세션이 같은 질문·같은 방법으로 최종 보고를 만들 차례입니다", 파일럿링크));
  const 갱신 = 끝줄("renewal", "성공 판정·갱신", 누가.원장, "최종 보고서를 보고 판정합니다", 파일럿링크);
  day30.push({ ...갱신, 사람말: `${갱신.사람말}. ${판정글}` });

  // ─────────────── 단계 순서 (D210)
  const 묶음 = {
    contract: ["계약", contract], receive: ["받을 것", receive], site: ["사이트", site], kickoff: ["질문 승인·착수", kickoffRows],
    baseline: ["첫 7일 기준선", baseline], run30: ["30일", run30], day30: ["30일 판정", day30],
  };
  const 순서 = 구축 ? ["contract", "receive", "kickoff", "baseline", "site", "run30", "day30"] : ["contract", "receive", "site", "kickoff", "baseline", "run30", "day30"];
  let 단계 = 순서.map((id) => ({ id, 이름: 묶음[id][0], 줄: 묶음[id][1] }));

  // ─────────────── 띠
  const 띠 = [];
  if (취소) {
    const 금액 = Number.isInteger(p.refund_amount) ? `돌려드린 금액 ${p.refund_amount.toLocaleString("ko-KR")}원` : "금액 미입력";
    띠.push(`${월일(취소)} 취소 · ${금액}`);
    단계 = 단계.map((s) => ({ ...s, 줄: s.줄.map(({ 보낼글: _b, 일수: _n, ...x }) => ({ ...x, 상태: 없음, 사람말: "취소된 계약입니다" })) }));
  } else if (리허설) 띠.push("리허설 — 계약 줄은 없습니다");
  else if (자사) 띠.push("자사 — 계약 줄은 없습니다");
  else if (p) 띠.push(`지금 취소하면: ${환불문장(p)}`);
  if (!취소 && 구축 && launch && (!kickoff || launch < 날더하기(kickoff, 7))) {
    띠.push(`사이트를 ${월일(launch)} 에 열었습니다. ${kickoff ? `착수 ${월일(kickoff)} 뒤 7일 기준선이 끝나기 전입니다` : "착수(첫 측정) 전입니다"} — 전후 비교가 깨집니다`);
  }

  // ─────────────── 요약 · 다음 고비
  const 전부 = 단계.flatMap((s) => s.줄);
  const 고객줄들 = 전부.filter((x) => x.상태 === 고객);
  const 일수들 = 고객줄들.map((x) => x.일수).filter((n) => Number.isInteger(n));
  const 요약 = {
    원장: 전부.filter((x) => x.상태 === 원장).length,
    고객: 고객줄들.length,
    고객최장일: 일수들.length ? Math.max(...일수들) : null,
    자동: 전부.filter((x) => x.누가 === 누가.자동 && x.상태 === 도는).length,
  };
  let 다음고비 = null;
  if (p && !취소) {
    const 후보 = [
      ["기준선 보고", 기준선날, !!baselineSent],
      ["사이트 열기", 구축 ? 날(T("site-launch")?.due_on) : null, !!launch],
      ["콘텐츠 게시", 기간앎 ? 날(T("content-publish")?.due_on) : null, 게시됨],
      ["30일 끝", 기간앎 ? 기간끝 : null, 끝남],
      ["최종 보고", 기간앎 ? 날(T("final-report")?.due_on) : null, 완료("final-report")],
    ].filter(([, d, done]) => d && !done).sort((a, b) => (a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0));
    if (후보.length) {
      const [이름, d] = 후보[0];
      다음고비 = `${이름} ${월일(d)}${d < 오늘일 ? ` (${날차(d, 오늘일)}일 지남)` : d === 오늘일 ? " (오늘)" : ""}`;
    }
  }

  return { 띠, 요약, 다음고비, 단계 };
}

// ─────────────────────────────────────────── 상황 바꾸기 폼 검사 (54c)
const 고름 = {
  dns: ["고객", "우리", "모름"],
  naverSa: ["아직", "확인파일보냄", "끝", "안씀"],
  bing: ["아직", "끝", "안씀"],
  blog: ["없음", "안맡김", "받음"],
  migrateState: ["아직", "진행", "끝"],
};
const 칸말 = {
  dns: "도메인·호스팅 담당", naverSa: "네이버 서치어드바이저", bing: "빙 웹마스터", blog: "네이버 블로그 계정", migrateState: "이관 상태",
  migrate: "블로그 글 이관", noChannels: "기존 채널 없음", ch_blog: "블로그 주소", ch_place: "플레이스 주소", ch_sns: "SNS 주소",
  blogSavedOn: "로그인 저장한 날", draftShownOn: "시안 보인 날", setupReportOn: "세팅 보고 보인 날",
};
/** pilot-plan.ts ymd 와 같은 규칙 */
const ymd = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`));

/** 폼 값 → config.onboard 에 합칠 칸. 모르는 값이 하나라도 있으면 ok false(저장 안 함) */
export function onboard입력검사(f) {
  const v = (k) => String(f?.[k] ?? "").trim();
  const 오류 = [];
  const 칸 = {};
  for (const [k, 값들] of Object.entries(고름)) {
    const x = v(k);
    if (!x) 칸[k] = null;
    else if (값들.includes(x)) 칸[k] = x;
    else 오류.push(`${칸말[k]}: 고를 수 있는 값이 아닙니다`);
  }
  for (const k of ["migrate", "noChannels"]) {
    const x = v(k);
    if (["", "off", "false", "0"].includes(x)) 칸[k] = false;
    else if (["on", "true", "1"].includes(x)) 칸[k] = true;
    else 오류.push(`${칸말[k]}: 켬·끔만 됩니다`);
  }
  const channels = {};
  for (const k of ["blog", "place", "sns"]) {
    const x = v(`ch_${k}`);
    if (!x) channels[k] = null;
    else if (x.length > 200) 오류.push(`${칸말[`ch_${k}`]}: 200자까지입니다`);
    else if (/\s/.test(x) || !주소인가(x)) 오류.push(`${칸말[`ch_${k}`]}: http 나 https 로 시작하는 주소만 됩니다`);
    else channels[k] = x;
  }
  칸.channels = channels;
  for (const k of ["blogSavedOn", "draftShownOn", "setupReportOn"]) {
    const x = v(k);
    if (!x) 칸[k] = null;
    else if (ymd(x)) 칸[k] = x;
    else 오류.push(`${칸말[k]}: 날짜 모양이 아닙니다`);
  }
  return { ok: 오류.length === 0, 칸, 오류 };
}
