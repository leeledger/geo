/**
 * 바깥 글(지식iN·카페·블로그) 초안과 효과 — 화면(web/lib/marketing.ts)과 스크립트(academy/scripts/marketing-draft.mjs ·
 * pilot-report.mjs)가 같이 쓰는 순수 함수와 표 (Step 35 D52·D54·D56).
 *
 * 효과는 「올린 주소가 AI 답 출처(citations)에 나왔나」 하나로만 센다. 기여 추정은 하지 않는다.
 */

/** geo.marketing_posts — academy/db/schema.sql · web/db/schema.sql 과 같은 줄 */
export const MARKETING_DDL = [
  `create table if not exists geo.marketing_posts (
  id bigserial primary key,
  client_id int not null references geo.clients(id),
  channel text not null check (channel in ('jisikin','cafe','blog')),
  target_query text not null,
  source_url text not null,
  title text not null,
  body text not null,
  status text not null default '초안' check (status in ('초안','올림','버림')),
  posted_url text,
  posted_at timestamptz,
  created_on date not null default ((now() at time zone 'Asia/Seoul')::date),
  note text not null default '')`,
  `create index if not exists marketing_posts_client_day_idx on geo.marketing_posts (client_id, created_on)`,
  `alter table geo.marketing_posts enable row level security`,
  // 지식iN 실제 질문(Step 41) — 원장 PC kin-find 가 찾아 넣는다. 같은 질문에 두 번 답하지 않게 url 하나에 한 줄
  `create table if not exists geo.kin_questions (
  id bigserial primary key,
  client_id int not null references geo.clients(id),
  url text not null unique,
  title text not null,
  body text not null default '',
  asked_at date not null,
  answers int not null default 0,
  adopted boolean not null default false,
  query text not null,
  found_at timestamptz not null default now(),
  status text not null default '후보' check (status in ('후보','씀','버림')),
  note text not null default '')`,
  `alter table geo.kin_questions enable row level security`,
  `alter table geo.marketing_posts add column if not exists kin_question_id bigint references geo.kin_questions(id)`,
  // 지식iN 찾기 한 번마다(KG-41-6) — 현황판 「최근 7일 읽은 질문」. read 는 분야 목록에서 처음 본 7일 안 질문 수(앞 실행과 안 겹침)
  `create table if not exists geo.kin_runs (
  id bigserial primary key,
  client_id int not null references geo.clients(id),
  at timestamptz not null default now(),
  status text not null default '돎' check (status in ('돎','막힘','실패','안 돎')),
  note text not null default '',
  read int not null default 0,
  matched int not null default 0,
  candidates int not null default 0)`,
  `alter table geo.kin_runs enable row level security`,
];

export const CHANNELS = ["jisikin", "cafe", "blog"];

/**
 * 「읽을 자리」 — 초안 문장 가운데 원문과 겹침이 낮은 것(숫자 없는 지어낸 말 후보). 초안 note 에 이 꼴로 둔다.
 * 블로그 「읽었어요」를 누르면 note 앞에 「게시 승인 … · 」이 붙는다. 무엇을 읽고 승인했는지 남기려고 지우지 않는다
 */
const SPOT_HEAD = "읽을 자리: ";
const SPOT_SEP = " ‖ ";
export const spotsNote = (sentences) => (sentences.length ? SPOT_HEAD + sentences.map((s) => s.replaceAll(SPOT_SEP, " ")).join(SPOT_SEP) : "");
export const readSpots = (note) => {
  const s = String(note ?? ""), i = s.indexOf(SPOT_HEAD);
  return i < 0 ? [] : s.slice(i + SPOT_HEAD.length).split(SPOT_SEP).filter(Boolean);
};
export const CHANNEL_NAME = { jisikin: "지식iN", cafe: "카페", blog: "블로그" };

/**
 * 원장이 실제 최근 질문을 골라 답하게 — 그 검색어로 네이버 지식iN·카페 검색 결과를 연다.
 * 블로그는 원장 손으로 올리지 않으니(D55 자동) 링크가 없다
 */
export function searchLink(channel, query) {
  const where = channel === "jisikin" ? "kin" : channel === "cafe" ? "article" : null;
  return where ? `https://search.naver.com/search.naver?where=${where}&query=${encodeURIComponent(query)}` : null;
}

/**
 * 주소를 비교할 꼴로. 앞 프로토콜·www.·m. 를 떼고, 끝 / 를 뗀다.
 * 물음표 뒤는 보통 버리지만 지식iN 은 docId 가 글 번호라 그것만 남긴다
 */
export function normUrl(raw) {
  let s = String(raw ?? "").trim();
  if (!s) return "";
  try {
    const u = new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`);
    const host = u.hostname.toLowerCase().replace(/^(www|m)\./, "");
    const doc = host === "kin.naver.com" ? u.searchParams.get("docId") : null;
    // 블로그 글은 PostView.naver?blogId=x&logNo=n 꼴로도 인용된다 — blog.naver.com/x/n 으로 맞춘다
    const blogId = host === "blog.naver.com" ? u.searchParams.get("blogId") : null;
    const logNo = blogId ? u.searchParams.get("logNo") : null;
    s = blogId && logNo ? `${host}/${blogId}/${logNo}`
      : `${host}${decodeURIComponent(u.pathname).replace(/\/+$/, "")}${doc ? `?docId=${doc}` : ""}`;
  } catch {
    s = s.toLowerCase().replace(/^https?:\/\//, "").replace(/^(www|m)\./, "").replace(/[?#].*$/, "").replace(/\/+$/, "");
  }
  return s;
}

/**
 * 올린 글 n개 중 k개가 AI 답 출처로 쓰였나 — 곳별.
 *   posts  [{ id, posted_url, posted_day('YYYY-MM-DD') }]  status '올림' 인 것만 넘긴다
 *   cites  [{ engine, measured_on('YYYY-MM-DD'), url }]     academy.ai_measurements.citations 를 펼친 것
 * 올리기 전 날의 측정은 안 센다(그날 답이 이 글을 볼 수 없었다)
 */
export function countUsed(posts, cites) {
  const byUrl = new Map();
  for (const c of cites) {
    const k = normUrl(c.url);
    if (!k) continue;
    if (!byUrl.has(k)) byUrl.set(k, []);
    byUrl.get(k).push(c);
  }
  const perPost = [];
  const perEngine = {};
  for (const p of posts) {
    const k = normUrl(p.posted_url);
    const hits = (k ? byUrl.get(k) ?? [] : []).filter((c) => c.measured_on >= p.posted_day);
    const engines = [...new Set(hits.map((c) => c.engine))].sort();
    for (const e of engines) perEngine[e] = (perEngine[e] ?? 0) + 1;
    perPost.push({ id: p.id, engines, first: hits.map((c) => c.measured_on).sort()[0] ?? null });
  }
  return { posted: posts.length, used: perPost.filter((x) => x.engines.length).length, perEngine, perPost };
}
