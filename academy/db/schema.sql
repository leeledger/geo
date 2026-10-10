-- 로봇&코딩학원 · 블로그 스키마
--
-- 기존 GEO 프로젝트가 쓰는 geo 스키마와 겹치지 않도록 academy 스키마에 둔다.
-- 적용: npm run setup-db  (또는 Neon SQL Editor 에 붙여넣기)

create schema if not exists academy;
create extension if not exists pgcrypto;

create table if not exists academy.posts (
  id           uuid primary key default gen_random_uuid(),
  slug         text unique not null,          -- URL 조각. AI 인용의 주소가 되므로 바꾸지 않는다
  title        text not null,
  summary      text not null default '',      -- 목록·검색결과·og:description 에 그대로 쓰인다
  body         text not null default '',      -- 마크다운 소부분집합 (## ### - 1. > ``` **)
  category     text not null default '수업기록',
  tags         text[] not null default '{}',
  cover_alt    text not null default '',
  published    boolean not null default false,
  published_at timestamptz,                   -- 공개 시각. 목록 정렬 기준
  updated_at   timestamptz not null default now(),
  created_at   timestamptz not null default now(),
  -- 네이버 블로그에서 옮겨온 글이면 원문 주소를 남긴다 (중복 판단·출처 표기용)
  source_url   text
);

create index if not exists posts_pub_idx
  on academy.posts (published, published_at desc nulls last);
create index if not exists posts_cat_idx on academy.posts (category);

-- 에이전트가 그린 도해 (Step 12). 학원 사이트는 git push 로 배포되지 않아 public/ 에 못 올린다 —
-- 글처럼 DB 에 두고 /blog/img/<slug>/<name>.svg 로 내보낸다 (app/blog/img/[slug]/[name]/route.ts)
create table if not exists academy.post_images (
  slug       text not null,
  name       text not null,
  svg        text not null,
  alt        text not null,
  created_at timestamptz not null default now(),
  unique (slug, name)
);

-- 공개 글만 보는 뷰 — 페이지 쪽에서 실수로 초안을 노출하지 않게 한다
create or replace view academy.published_posts as
  select id, slug, title, summary, body, category, tags, cover_alt,
         published_at, updated_at, source_url
    from academy.posts
   where published and published_at is not null;

-- AI 크롤러 방문 기록
--
-- 왜 필요한가: "AI 답변에 불리는가"는 결과 지표라 몇 주가 걸린다.
-- 그 전에 움직이는 유일한 선행지표가 "크롤러가 실제로 왔는가"다.
-- 크롤러가 안 왔으면 콘텐츠를 아무리 고쳐도 소용이 없고,
-- 왔는데 인용이 안 되면 문제는 문서 쪽이다. 둘을 구분해 준다.
create table if not exists academy.crawl_hits (
  id         bigserial primary key,
  seen_at    timestamptz not null default now(),
  bot        text not null,          -- 정규화한 크롤러 이름 (GPTBot, ClaudeBot, ...)
  vendor     text not null,          -- openai / anthropic / google / perplexity / ...
  path       text not null,
  ua         text not null,
  ip_hash    text                    -- 원문 IP 는 저장하지 않는다
);

create index if not exists crawl_bot_idx on academy.crawl_hits (bot, seen_at desc);
create index if not exists crawl_seen_idx on academy.crawl_hits (seen_at desc);

-- 크롤러별 요약 — 리포트에 그대로 쓴다
create or replace view academy.crawl_summary as
  select bot, vendor,
         count(*)::int              as hits,
         count(distinct path)::int  as pages,
         min(seen_at)               as first_seen,
         max(seen_at)               as last_seen
    from academy.crawl_hits
   group by bot, vendor
   order by max(seen_at) desc;

-- 일별 스냅샷 — 케이스 스터디의 원장(原帳)
--
-- 이 사업에서 파는 것은 "사이트를 잘 만들어 드립니다"가 아니라
-- "움직였는지 숫자로 보여 드립니다"다. 같은 방식으로 매일 재고 기록이 남아야
-- 나중에 "무엇이 효과가 있었는가"를 추측이 아니라 차이로 말할 수 있다.
create table if not exists academy.snapshots (
  day          date primary key,      -- 하루 한 건. 재실행해도 덮어쓴다
  taken_at     timestamptz not null default now(),
  posts        int  not null default 0,
  chars        int  not null default 0,
  crawl_total  int  not null default 0,   -- 누적 크롤러 방문
  crawl_1d     int  not null default 0,
  crawl_7d     int  not null default 0,
  vendors      text[] not null default '{}',
  by_bot       jsonb not null default '{}'
);

-- 커버리지 지표
--
-- 크롤러 방문 횟수만 세면 레퍼런스로 약하다. "35회 왔다"는 규모를 말하지 못한다.
-- 사이트가 몇 쪽인데 그중 몇 쪽이 읽혔는가(커버리지), 처음 방문까지 며칠 걸렸는가(리드타임),
-- 몇 개 엔진이 왔는가(폭). 이 셋이 있어야 다음 고객사에 "보통 이렇습니다"라고 말할 수 있다.
create or replace view academy.coverage as
with pages as (
  -- 실제 문서 수 (홈 + 목록 + 글). 이미지·정적 파일은 세지 않는다.
  select count(*)::int + 2 as total from academy.published_posts
),
seen as (
  select count(distinct path)::int as n
    from academy.crawl_hits
   where path !~ '\.(png|jpg|jpeg|gif|webp|svg|css|js|txt|xml|ico)$'
)
select
  p.total                                              as pages_total,
  s.n                                                  as pages_crawled,
  round(100.0 * s.n / nullif(p.total,0), 1)            as coverage_pct
from pages p, seen s;

-- 엔진별 커버리지 — 어느 엔진이 얼마나 읽었는가
create or replace view academy.coverage_by_vendor as
with pages as (select count(*)::int + 2 as total from academy.published_posts)
select h.vendor,
       count(distinct h.path)::int                          as pages_crawled,
       (select total from pages)                            as pages_total,
       round(100.0 * count(distinct h.path) / nullif((select total from pages),0), 1) as coverage_pct,
       min(h.seen_at)                                       as first_seen,
       max(h.seen_at)                                       as last_seen
  from academy.crawl_hits h
 where h.path !~ '\.(png|jpg|jpeg|gif|webp|svg|css|js|txt|xml|ico)$'
 group by h.vendor
 order by count(distinct h.path) desc;

-- 스냅샷에 커버리지 지표 추가
alter table academy.snapshots add column if not exists pages_total   int;
alter table academy.snapshots add column if not exists pages_crawled int;
alter table academy.snapshots add column if not exists coverage_pct  numeric(5,1);
alter table academy.snapshots add column if not exists engines       int;
alter table academy.snapshots add column if not exists lead_hours    int;

-- geo.clients 는 web/db/schema.sql 에서 만든다. 학원 스크립트가 읽는 Step 37 칸을 같은 줄로 적어 둔다 (academy/measure-targets.mjs 고객설정준비)
alter table geo.clients add column if not exists config jsonb not null default '{}'::jsonb;
alter table geo.clients add column if not exists derived jsonb not null default '{}'::jsonb;

-- geo.pilots 는 web/db/schema.sql 에서 만든다. 학원 스크립트(company.mjs · measure-targets · pilot-report)가 읽는 Step 26 칸을 같은 줄로 적어 둔다
-- Step 26 파일럿 생애주기 — academy/pilot-plan.mjs 파일럿칸준비 · web/lib/pilot-plan.ts PILOT_COLUMNS 와 같은 줄
-- 착수(질문 승인 뒤 첫 측정일, KST) · 기준선 보고 보낸 때 · 구축·세팅(none|setup|build)과 사이트 연 날 · 경쟁사(쉼표 이름) · 계약 칸
alter table geo.pilots add column if not exists kickoff_on date;
-- 입금 확인일 — 구축 없음이면 30일이 이날부터(신청서 8행, Arch 2026-09-30)
alter table geo.pilots add column if not exists paid_on date;
alter table geo.pilots add column if not exists questions_approved_at timestamptz;
alter table geo.pilots add column if not exists baseline_sent_at timestamptz;
alter table geo.pilots add column if not exists site_launch_on date;
alter table geo.pilots add column if not exists needs_build text not null default 'none';
alter table geo.pilots add column if not exists competitors text not null default '';
alter table geo.pilots add column if not exists biz_type text;
alter table geo.pilots add column if not exists refund_terms_sent_on date;
alter table geo.pilots add column if not exists invoice_issued_on date;
alter table geo.pilots add column if not exists cancelled_on date;
alter table geo.pilots add column if not exists refund_amount int;
-- 업무 기한의 기준(등록|착수|시작|끝)과 며칠 뒤. 없으면(옛 파일럿) 기한을 다시 세지 않는다
alter table geo.pilot_tasks add column if not exists anchor text;
alter table geo.pilot_tasks add column if not exists offset_days int;
-- 손 확인 기록 — 구글 AI 개요·AI 모드·네이버 AI 브리핑을 사람이 본 결과와 캡처(이미지 2MB, 관리자만 읽음)
create table if not exists geo.pilot_manual_checks (
  id bigserial primary key, pilot_id uuid not null references geo.pilots(id) on delete cascade,
  question text not null,
  surface text not null check (surface in ('google_ai_overview','naver_ai_briefing','google_ai_mode')),
  checked_on date not null, shown text not null check (shown in ('이름','링크','안 나옴','화면 없음')),
  note text not null default '', capture bytea, capture_type text,
  created_at timestamptz not null default now()
);
alter table geo.pilot_manual_checks enable row level security;
-- 고객별 투입 시간(Step 23 D5). 첫 입력이 아니라 company.mjs 시작에서 만든다(Step 27 D16) — web/lib/hours.ts HOURS_DDL 과 같은 줄
create table if not exists geo.client_hours (
  id bigserial primary key,
  client_id int not null references geo.clients(id),
  day date not null default ((now() at time zone 'Asia/Seoul')::date),
  minutes int not null check (minutes > 0 and minutes <= 1440),
  what text not null default '',
  created_at timestamptz not null default now()
);
alter table geo.client_hours enable row level security;
-- 고객사 사이트 사람 방문(Step 29). IP 는 없다 — visitor 는 그날만 같은 사람을 묶는 해시 앞 16자.
-- web/lib/visits.ts VISITS_DDL · academy/app/api/visit/route.ts 와 같은 줄(academy/scripts/test-visit.mjs 가 대조)
create table if not exists geo.site_visits (
  id bigserial primary key,
  client_id int not null references geo.clients(id),
  at timestamptz not null default now(),
  day date not null default ((now() at time zone 'Asia/Seoul')::date),
  path text not null,
  ref_host text not null default '',
  ref_kind text not null check (ref_kind in ('ai','search','sns','direct','internal','other')),
  visitor text not null,
  device text not null default ''
);
create index if not exists site_visits_client_day_idx on geo.site_visits (client_id, day);
-- 탐침·확장 질문 측정(Step 22·31). 승인 20문항(ai_measurements)과 섞지 않는 따로 표.
-- academy/scripts/loop-grow.mjs 탐침측정DDL 과 같은 줄 — company.mjs 시작·ai-measure 가 만든다
create table if not exists academy.ai_probe_measurements (
  id bigserial primary key, client_id int not null default 1, measured_on date not null,
  collection_method text not null, engine text not null, model text, prompt_id text not null,
  stage text, prompt_text text not null, attempt int not null default 1,
  mentioned boolean not null default false, cited boolean not null default false,
  citations jsonb not null default '[]'::jsonb, note text, raw jsonb not null,
  form text not null default 'sentence', radius text,
  imported_at timestamptz not null default now(),
  unique (client_id, measured_on, collection_method, engine, prompt_id, attempt)
);
alter table geo.site_visits enable row level security;
-- 바깥 글 초안(Step 35 D52) — 지식iN·카페·블로그. 초안은 academy/scripts/marketing-draft.mjs 가 매일 쓰고,
-- 원장이 /admin/ops 에서 올린 주소를 적는다. web/lib/marketing-core.mjs MARKETING_DDL 과 같은 줄
create table if not exists geo.marketing_posts (
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
  note text not null default ''
);
create index if not exists marketing_posts_client_day_idx on geo.marketing_posts (client_id, created_on);
alter table geo.marketing_posts enable row level security;
-- 지식iN 실제 질문(Step 41) — tools/kin-find.mjs 가 원장 PC 에서 찾아 넣는다. web/lib/marketing-core.mjs MARKETING_DDL 과 같은 줄
create table if not exists geo.kin_questions (
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
  note text not null default ''
);
alter table geo.kin_questions enable row level security;
alter table geo.marketing_posts add column if not exists kin_question_id bigint references geo.kin_questions(id);
-- 지식iN 찾기 한 번마다(Step 41 KG-41-6) — 현황판 「최근 7일 읽은 질문」. web/lib/marketing-core.mjs MARKETING_DDL 과 같은 줄
create table if not exists geo.kin_runs (
  id bigserial primary key,
  client_id int not null references geo.clients(id),
  at timestamptz not null default now(),
  status text not null default '돎' check (status in ('돎','막힘','실패','안 돎')),
  note text not null default '',
  read int not null default 0,
  matched int not null default 0,
  candidates int not null default 0
);
alter table geo.kin_runs enable row level security;
-- 문서딱 저장소 주간 성장 리포트(Step 36) — academy/scripts/growth-import.mjs 가 매일 한 번 쌓는다.
-- gsc·cf 는 리포트 growth-data JSON 그대로, 표 3칸은 리포트가 반올림한 값. web/lib/growth-core.mjs GROWTH_DDL 과 같은 줄
create table if not exists geo.growth_reports (
  client_id int not null references geo.clients(id),
  week text not null,
  generated date,
  source_url text not null,
  gsc jsonb,
  gsc_queries7 jsonb,
  gsc_queries28 jsonb,
  gsc_pages28 jsonb,
  cf jsonb,
  notes text,
  opportunity jsonb,
  fetched_at timestamptz not null default now(),
  primary key (client_id, week)
);
alter table geo.growth_reports enable row level security;
