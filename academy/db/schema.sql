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
