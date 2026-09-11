/**
 * 정찰 — 문제를 스스로 찾아 낸다.
 *
 * 왜 만드느냐면:
 *   지금까지 문제를 찾은 건 전부 사람이 화면을 보고 「이건 뭐지?」 물었을 때였다.
 *   OpenAI 커버리지 15.6%, 브랜드 검색 미노출, 리드 큐의 가짜 2건, 랜딩의 과장된
 *   제목 — 전부 누가 물어봐서 알았다. 물어보지 않으면 며칠이고 그대로 있었다.
 *
 *   브리핑(briefing.mjs)은 「지금 상태」를 적는다. 점검(health.mjs)은 「죽었나」를 본다.
 *   그 사이가 비어 있다. 살아 있는데 잘못 가고 있는 것 — 그걸 찾는 자리다.
 *
 * 하는 일
 *   규칙마다 DB·사이트를 보고, 걸리면 「무엇이 · 왜 · 그래서 뭘 해야 하나」를 낸다.
 *   판단이 필요한 일은 사람(또는 LLM)에게 넘기고, 여기서는 찾기만 한다.
 *
 * 내는 것
 *   사람이 읽을 글, 그리고 --json 으로 기계가 읽을 목록.
 *   GitHub Actions 가 이걸 받아 이슈로 연다.
 *
 *   node scripts/scout.mjs
 *   node scripts/scout.mjs --json
 */
import fs from "node:fs";
import { Pool } from "pg";

for (const l of fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8").split(/\r?\n/)) {
  const m = /^([A-Z_]+)=(.*)$/.exec(l);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}
const u = new URL(process.env.DATABASE_URL);
u.searchParams.delete("sslmode");
const pool = new Pool({
  connectionString: u.toString(),
  ssl: { rejectUnauthorized: process.env.DATABASE_SSL_INSECURE !== "true" },
});
const q = (s, p = []) => pool.query(s, p).then((r) => r.rows);
const JSON_OUT = process.argv.includes("--json");

const found = [];
/**
 * @param key   이슈 제목에 쓸 고유 키. 같은 문제를 두 번 열지 않기 위해 쓴다
 * @param level "막힘" 지금 손대야 함 · "샘" 두면 서서히 나빠짐 · "기회" 해두면 좋음
 */
const report = (key, level, what, why, todo) =>
  found.push({ key, level, what, why, todo });

const clients = await q(`select id, slug, name, domain from geo.clients where status <> 'ended' order by id`)
  .catch(() => [{ id: 1, slug: "robotncoding", name: "로봇&코딩학원", domain: "robotncoding.com" }]);

for (const c of clients) {
  const P = [c.id];

  // ── 1. 엔진별 커버리지가 크게 갈리는가
  const cov = await q(`
    select vendor, coverage_pct::float pct, pages_crawled::int p, pages_total::int t
      from academy.coverage_by_vendor where client_id = $1`, P).catch(() => []);
  const major = cov.filter((r) => ["openai", "anthropic", "google", "naver"].includes(r.vendor));
  if (major.length >= 2) {
    const hi = Math.max(...major.map((r) => r.pct));
    for (const r of major) {
      if (hi - r.pct >= 40 && r.pct < 60) {
        report(`cov-${c.slug}-${r.vendor}`, "샘",
          `${c.name} — ${r.vendor} 커버리지 ${r.pct}% (최고 ${hi}%)`,
          `${r.p}/${r.t}쪽만 읽었습니다. 다른 엔진은 ${hi}%인데 이 엔진만 뒤처집니다.`,
          r.vendor === "openai"
            ? "빙 색인을 확인하세요. OpenAI 는 빙 인덱스에 크게 기댑니다 — node scripts/bing-check.mjs"
            : "robots.txt 에 이 크롤러가 이름으로 허용돼 있는지 보세요.");
      }
    }
  }

  // ── 2. 우리 이름인데 안 나오는가 (브랜드 방어)
  const brandMiss = await q(`
    select query, array_agg(distinct engine) engines
      from academy.serp_checks
     where client_id = $1 and kind = '브랜드' and not hit
       and day = (select max(day) from academy.serp_checks where client_id = $1)
     group by query`, P).catch(() => []);
  if (brandMiss.length) {
    report(`brand-${c.slug}`, "막힘",
      `${c.name} — 우리 이름으로 검색해도 안 나옵니다`,
      brandMiss.map((r) => `「${r.query}」 (${r.engines.join(", ")})`).join(" · ") +
      ". 이름을 아는 사람이 못 찾으면 그 앞 단계는 다 의미가 없습니다.",
      "이름이 겹치는 곳이 자리를 가져갔는지 확인하고, 색인 요청을 다시 넣으세요.");
  }

  // ── 3. 경쟁 검색어에서 며칠째 0인가
  const [rv] = await q(`
    select count(*) filter (where won)::int won, count(*)::int total
      from (select query, bool_or(hit) won from academy.serp_checks
             where client_id = $1 and kind = '경쟁'
               and day = (select max(day) from academy.serp_checks where client_id = $1)
             group by query) t`, P).catch(() => [{ won: 0, total: 0 }]);
  const [days] = await q(`
    select count(distinct day)::int n from academy.serp_checks
     where client_id = $1 and kind = '경쟁'`, P).catch(() => [{ n: 0 }]);
  if (rv.total > 0 && rv.won === 0 && days.n >= 3) {
    report(`rival-${c.slug}`, "샘",
      `${c.name} — 경쟁 검색어 0/${rv.total} (${days.n}일째)`,
      "이름 없이 지역·업종으로 찾는 사람에게 한 번도 안 걸립니다. 브랜드 검색 1위는 여기 안 셉니다.",
      "이기고 있는 지면이 무엇인지 먼저 보세요 — node scripts/who-wins.mjs. " +
      "목록 사이트가 이기는 자리면 글이 아니라 등재가 답입니다.");
  }

  // ── 4. 발행이 늦어지는가
  const [pp] = await q(`
    select max(published_at) last, count(*) filter (where published)::int n
      from academy.posts where client_id = $1`, P).catch(() => [{}]);
  const since = pp?.last ? Math.floor((Date.now() - new Date(pp.last)) / 86400000) : null;
  if (since !== null && since >= 8) {
    report(`publish-${c.slug}`, since >= 12 ? "막힘" : "샘",
      `${c.name} — 마지막 발행 ${since}일 전`,
      "주 1편이 목표입니다. 끊기면 크롤러도 뜸해지고 레퍼런스가 늙습니다.",
      "content/topics.json 에서 안 쓴 주제를 골라 쓰세요.");
  }

  /**
   * 5. 크롤러가 끊겼는가.
   *
   * 「0건」에는 두 가지가 섞여 있다 — 끊긴 것과, 애초에 안 재는 것.
   * 처음엔 이걸 안 갈라서 아이로그(측정 장치를 아직 못 단 고객사)에
   * 「36시간 크롤러 안 왔습니다」라는 헛경보를 냈다.
   * 헛경보를 내는 정찰은 없느니만 못하다 — 두 번 울면 아무도 안 본다.
   */
  const [ever] = await q(`
    select count(*)::int n from academy.crawl_hits where client_id = $1`, P).catch(() => [{ n: 0 }]);
  if (ever.n === 0) {
    report(`notracker-${c.slug}`, "기회",
      `${c.name} — 크롤러 방문을 아직 안 재고 있습니다`,
      "기록이 한 줄도 없습니다. 끊긴 게 아니라 측정 장치를 아직 안 달았습니다. " +
      "AI 가 실제로 읽어 가는지는 서버에 기록을 심어야만 압니다 — 검색 콘솔에도 안 나옵니다.",
      "고객사 서버에 크롤러 기록 장치를 다세요. 남의 서버라 협의가 먼저입니다.");
  } else {
    const [ch] = await q(`
      select count(*)::int n from academy.crawl_hits
       where client_id = $1 and seen_at > now() - interval '36 hours'`, P).catch(() => [{ n: -1 }]);
    if (ch.n === 0) {
      report(`crawl-${c.slug}`, "막힘",
        `${c.name} — 36시간 동안 크롤러가 안 왔습니다`,
        "전에는 오던 크롤러가 멈췄습니다. 사이트가 죽었거나 robots 가 막고 있거나 색인에서 빠졌습니다.",
        "주소가 열리는지, robots.txt 가 정상인지 먼저 보세요.");
    }
  }

  // ── 6. 착수 진단 점수가 낮은 채로 방치되는가
  // 착수 점수만 보면 고쳐 놓은 곳도 계속 「방치」로 뜬다. 지금 점수가 있으면 그걸 본다.
  const [cl] = await q(`
    select coalesce(current_score, baseline_score) s, baseline_score b0,
           current_on, (current_date - coalesce(current_on, baseline_on)::date) age
      from geo.clients where id = $1`, P)
    .catch(() => q(`
      select baseline_score s, baseline_score b0, null as current_on,
             (current_date - baseline_on::date) age
        from geo.clients where id = $1`, P))
    .catch(() => [{}]);
  if (cl?.s !== null && cl?.s !== undefined && cl.s < 70 && cl.age >= 7) {
    report(`baseline-${c.slug}`, "기회",
      `${c.name} — 진단 ${cl.s}점인데 ${cl.age}일째 그대로입니다`,
      "0점 항목은 파일 몇 개면 오릅니다. 손 안 대면 그 아래 단계가 전부 막힙니다.",
      "구조화 데이터·llms.txt·sitemap.xml 부터 채우세요.");
  }

  // 다시 진단한 지 오래됐는가 — 고친 게 먹혔는지 모르는 채로 다음 일을 정하게 된다
  if (cl?.current_on !== undefined) {
    const stale = cl.current_on ? Math.floor((Date.now() - new Date(cl.current_on)) / 86400000) : null;
    if (stale === null || stale >= 3) {
      report(`rescan-${c.slug}`, "샘",
        `${c.name} — ${stale === null ? "다시 진단한 적이 없습니다" : `마지막 진단 ${stale}일 전`}`,
        "착수 점수만 있으면 고친 뒤 몇 점이 됐는지 모릅니다. 아이로그가 44 → 75 가 된 걸 하루 넘게 몰랐습니다.",
        `node scripts/rescan.mjs --client ${c.slug}`);
    }
  }

  // 측정 기록이 한 줄도 없는가 — 고객사를 받아 놓고 안 재는 상태
  const [sc] = await q(`select count(*)::int n from academy.serp_checks where client_id = $1`, P).catch(() => [{ n: -1 }]);
  if (sc.n === 0) {
    report(`nomeasure-${c.slug}`, "막힘",
      `${c.name} — 검색 노출을 한 번도 안 쟀습니다`,
      "기준선이 없으면 나중에 좋아져도 증명을 못 합니다. 고객사를 받은 첫날 할 일입니다.",
      `academy/clients.mjs 에 검색어를 넣고 node scripts/check-index.mjs --client ${c.slug}`);
  }
}

// ── 7. 문의 기록 — 매출 검증의 유일한 고리
const [inq] = await q(`select count(*)::int n from academy.inquiries`).catch(() => [{ n: -1 }]);
if (inq.n === 0) {
  report("inquiry", "막힘",
    "상담 기록이 0건입니다",
    "노출이 문의로 이어지는지 전혀 모릅니다. 이게 비면 앞의 모든 숫자가 영업 자료가 못 됩니다.",
    "상담에서 「어떻게 알고 오셨어요」를 묻고 /admin/inquiry 에 한 줄 남기세요. 30초면 됩니다.");
}

// ── 8. 리드 큐에 깨진 값이 섞였는가
const bad = await q(`
  select count(*)::int n from geo.leads
   where company like '%' || chr(65533) || '%' or wants like '%' || chr(65533) || '%'`).catch(() => [{ n: 0 }]);
if (bad[0]?.n > 0) {
  report("lead-broken", "샘",
    `리드 큐에 글자가 깨진 줄이 ${bad[0].n}건 있습니다`,
    "테스트로 넣은 값일 가능성이 큽니다. 화면에는 실제 문의처럼 보입니다.",
    "node web/scripts/leads-clean.mjs 로 확인하고 지우세요.");
}

await pool.end();

// ── 내보내기
if (JSON_OUT) {
  console.log(JSON.stringify(found, null, 1));
  process.exit(0);
}

const ORDER = { 막힘: 0, 샘: 1, 기회: 2 };
found.sort((a, b) => ORDER[a.level] - ORDER[b.level]);

console.log("════════════════════════════════════════════════════");
console.log(`  정찰 · ${new Date().toLocaleDateString("ko-KR")}`);
console.log("════════════════════════════════════════════════════");
if (!found.length) {
  console.log("\n  찾은 문제 없음.\n");
} else {
  for (const f of found) {
    console.log(`\n[${f.level}] ${f.what}`);
    console.log(`  왜   ${f.why}`);
    console.log(`  할일 ${f.todo}`);
  }
  console.log(`\n  ── 막힘 ${found.filter((f) => f.level === "막힘").length}건 ·` +
    ` 샘 ${found.filter((f) => f.level === "샘").length}건 ·` +
    ` 기회 ${found.filter((f) => f.level === "기회").length}건`);
}
