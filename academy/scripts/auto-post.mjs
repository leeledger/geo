/**
 * 학원 주 1편 자동 글(Step 43) — 주제를 고르고 쓰기에 넘긴다. 감수는 --review.
 *
 * 원장 결정 2026-10-10: 「새 글 포스팅도 자동화해서 주제 선택과 감수 모두 자동으로.」
 * 판정은 전부 web/lib/post-auto-core.mjs 한 곳에 있다. 여기는 DB·파일·쓰기 스크립트를 잇는 자리다.
 *
 *   --pick [--dry]           후보 모으기 → 거르기 → 점수순 → 재료 관문 → 고름 기록 → 쓰기(write-news / write-draft)
 *                            --dry 는 후보표·뺀 이유·재료 관문까지 찍고 DB 를 안 쓴다(쓰기도 안 부른다)
 *   --review <slug> [--dry]  자동 감수 4관문 (아래 감수 절)
 *
 * 마지막 줄 AUTOPOST=<JSON> 을 company.mjs 가 읽는다(illustrate 의 ILLUSTRATE= 꼴).
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";
import {
  후보모으기, 거르기, 재료모으기, 재료판정, 이번주글SQL, 기록하기,
} from "../../web/lib/post-auto-core.mjs";

for (const l of fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8").split(/\r?\n/)) {
  const m = /^([A-Z_]+)=(.*)$/.exec(l);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

const DRY = process.argv.includes("--dry");
const PICK = process.argv.includes("--pick");
const RI = process.argv.indexOf("--review");
const REVIEW = RI >= 0 ? process.argv[RI + 1] : null;
const CLIENT = 1;

const u = new URL(process.env.DATABASE_URL);
u.searchParams.delete("sslmode");
const pool = new Pool({ connectionString: u.toString(), ssl: { rejectUnauthorized: process.env.DATABASE_SSL_INSECURE !== "true" } });
const q = (s, p = []) => pool.query(s, p).then((r) => r.rows);

const 끝 = (o) => {
  if (o.상태 === "실패") process.exitCode = 1;
  console.log(`AUTOPOST=${JSON.stringify(o)}`);
  return o;
};
const 활동 = (action, summary, ok = true) => (DRY ? Promise.resolve() : q(
  `insert into geo.agent_activity (client_id, agent, action, ok, summary) values ($1, 'content', $2, $3, $4)`,
  [CLIENT, action, ok, String(summary).slice(0, 1000)]).catch(() => {}));
const 자르기 = (s, n) => (String(s).length > n ? `${String(s).slice(0, n)}…` : String(s));

// ─────────────────────────────────────────── --pick
async function 고르기() {
  if (!DRY) {
    const 이번주 = await q(이번주글SQL, [CLIENT]);
    if (이번주.length) {
      console.log(`이번 주 글이 이미 있습니다(/blog/${이번주[0].slug}${이번주[0].published ? " 발행" : " 감수 중"}). 주 1편이라 고르지 않습니다.`);
      return 끝({ 상태: "이번주있음", slug: 이번주[0].slug });
    }
  }
  const 은행 = JSON.parse(fs.readFileSync(new URL("../content/topics.json", import.meta.url), "utf8")).topics ?? [];
  const { 후보, 못읽음 } = await 후보모으기(q, { client: CLIENT, 은행 });
  if (못읽음.length) console.log(`  ⚠ 못 읽은 신호: ${못읽음.join(" · ")} — 나머지 신호로 고릅니다`);

  let 기록 = [];
  try {
    기록 = await q(`select topic_key, kind, at from academy.post_reviews where client_id = $1`, [CLIENT]);
  } catch (e) {
    // 기록 없이 고르면 버린 주제·쓴 주제를 또 고른다 — 실제 실행에서는 멈춘다
    if (!DRY) { console.log(`글 기록 표를 못 읽었습니다: ${e.message.slice(0, 120)}`); return 끝({ 상태: "실패", 왜: "글 기록 표를 못 읽음" }); }
    console.log("  ⚠ 글 기록 표(academy.post_reviews)가 아직 없습니다 — dry 라 기록 없이 거릅니다");
  }
  const 최근글 = await q(
    `select title, tags, published_at from academy.posts
      where client_id = $1 and published_at > now() - interval '28 days' order by published_at desc`, [CLIENT]);
  const 모든제목 = (await q(`select title from academy.posts where client_id = $1 and published`, [CLIENT])).map((r) => r.title);
  const { 남은것, 뺀것 } = 거르기(후보, 기록, 최근글, { 모든제목 });

  console.log(`\n후보 ${후보.length}개 · 남은 것 ${남은것.length}개 · 뺀 것 ${뺀것.length}개`);
  console.log("\n── 남은 후보 (점수순)");
  for (const c of 남은것.slice(0, 15)) {
    console.log(`  ${String(c.점수).padStart(3)}점 [${c.신호.join("+")}]${c.학원사실필요 ? " (학원 사실 필요)" : ""} ${c.제목}`);
    console.log(`        ${c.이유}`);
  }
  if (남은것.length > 15) console.log(`  … 그 밖 ${남은것.length - 15}개`);
  console.log("\n── 뺀 것");
  for (const x of 뺀것) console.log(`  · ${자르기(x.제목, 50)} — ${x.왜}`);

  if (!남은것.length) {
    await 활동("이번 주 쓸 주제 없음", `후보 ${후보.length}개가 모두 걸러짐`);
    return 끝({ 상태: "후보없음" });
  }

  const 라벨들 = await 재료모으기(q, CLIENT);
  console.log(`\n재료: 재료표 ${라벨들.m.length} · 상담 말 ${라벨들.i.length} · 원장 글 문단 ${라벨들.p.length}`);

  for (const c of 남은것.slice(0, 3)) {
    const 판 = 재료판정(c, 라벨들);
    console.log(`\n재료 관문: ${c.제목} → ${판.결과} (${판.왜})`);
    if (판.결과 === "재료부족") {
      if (!DRY) await 기록하기(q, { client: CLIENT, topic_key: c.키, kind: "재료부족", why: `「${c.제목}」 ${판.왜}` });
      continue;
    }
    // 쓰기에 넘길 라벨 재료. 재료 글은 write-draft 가 재료표(m)를 스스로 붙이니 상담 말·원장 글만 더 준다
    const 재료표 = (판.결과 === "재료" ? [...라벨들.i, ...라벨들.p] : [...라벨들.m, ...라벨들.i, ...라벨들.p])
      .map((r) => ({ 라벨: r.라벨, 원문: r.원문, ...(r.id ? { id: r.id } : {}) }));
    const 주제 = { 키: c.키, 제목: c.제목, 이유: c.이유, 신호: c.신호 };
    const 각도 = c.각도 || [
      c.신호.includes("A") || c.신호.includes("B") ? "학부모가 AI 에게 이 질문을 그대로 했는데 우리 사이트가 답에 안 나왔다. 첫 문단에서 질문에 대한 판단을 먼저 말한다." : "",
      c.경쟁출처?.length ? `대신 인용된 곳: ${c.경쟁출처.join(", ")} — 베끼지 않는다.` : "",
      c.신호.includes("C") ? `검색어 「${c.제목}」에서 우리가 안 보인다.` : "",
    ].filter(Boolean).join(" ");
    const 넘길것 = { 주제, 각도, 분류: c.분류 || "교육관점", 태그: c.태그 ?? [], 재료표 };
    if (DRY) {
      console.log(`  (dry) 여기서 고르고 ${판.결과 === "재료" ? "write-draft" : "write-news"} 에 넘깁니다. 넘길 라벨 재료 ${재료표.length}개`);
      return 끝({ 상태: "고름", dry: true, 제목: c.제목, 키: c.키, 모드: 판.결과 });
    }
    await 기록하기(q, { client: CLIENT, topic_key: c.키, kind: "고름", why: `「${c.제목}」 — ${c.이유}` });
    const 파일 = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "auto-post-")), "topic.json");
    fs.writeFileSync(파일, JSON.stringify(넘길것));
    const 스크립트 = 판.결과 === "재료" ? "write-draft.mjs" : "write-news.mjs";
    const r = spawnSync(process.execPath, [fileURLToPath(new URL(`./${스크립트}`, import.meta.url)), "--topic-json", 파일],
      { encoding: "utf8", maxBuffer: 20 * 1024 * 1024, env: process.env });
    process.stdout.write(r.stdout ?? "");
    if (r.stderr) process.stderr.write(r.stderr);
    fs.rmSync(path.dirname(파일), { recursive: true, force: true });
    const slug = /DRAFT_SLUG=(\S+)/.exec(r.stdout ?? "")?.[1];
    if (slug) {
      await q(`update academy.post_reviews set slug = $2 where id = (select id from academy.post_reviews
                 where client_id = $1 and topic_key = $3 and kind = '고름' and slug is null order by at desc limit 1)`, [CLIENT, slug, c.키]).catch(() => {});
      return 끝({ 상태: "씀", slug, 제목: c.제목, 모드: 판.결과 });
    }
    if (r.status === 78) {
      // 쓸 사실을 못 찾음·게이트 두 번·키 없음 — 이 주제는 4주 미룬다. 매일 같은 주제로 검색을 다시 돌리지 않게
      await 기록하기(q, { client: CLIENT, topic_key: c.키, kind: "재료부족", why: `「${c.제목}」 쓰기가 빈손으로 끝남(쓸 사실을 못 찾았거나 검사에 두 번 걸림)` });
      return 끝({ 상태: "쓰기건너뜀", 제목: c.제목 });
    }
    return 끝({ 상태: "실패", 왜: `${스크립트} 종료 ${r.status}` });
  }
  await 활동("이번 주 쓸 주제 없음", "앞 후보 3개가 다 재료 부족");
  return 끝({ 상태: "재료부족" });
}

const main = async () => {
  if (PICK) return 고르기();
  if (REVIEW) return 감수하기(REVIEW);
  console.log("node scripts/auto-post.mjs --pick [--dry] | --review <slug> [--dry]");
  process.exitCode = 1;
};

async function 감수하기() {
  console.log("자동 감수는 아직 없습니다.");
  return 끝({ 행동: "미룸", 왜: "감수 준비 안 됨" });
}

main()
  .catch((e) => { console.log("실패:", e.message.slice(0, 300)); 끝({ 상태: "실패", 행동: "미룸", 왜: e.message.slice(0, 200) }); process.exitCode = 1; })
  .finally(() => pool.end());
