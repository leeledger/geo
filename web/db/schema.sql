-- 사이트밴드 · 리드 수집 스키마
--
-- Neon · Supabase · Vercel Postgres 등 어떤 Postgres 에나 그대로 적용된다.
-- 모든 테이블이 별도 `geo` 스키마 안에 있어 기존 public 테이블과 이름이 충돌하지 않는다.
-- 적용: npm run setup-db  (또는 Neon SQL Editor 에 붙여넣기)

create schema if not exists geo;
create extension if not exists pgcrypto;

-- 무료 진단 실행 이력
create table if not exists geo.scans (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  origin      text not null,
  total       int  not null,
  grade       text not null,
  checks      jsonb,
  notes       jsonb,
  ip_hash     text,           -- 원문 IP 는 저장하지 않는다 (salt + sha256)
  user_agent  text,
  referrer    text
);
create index if not exists scans_created_idx on geo.scans (created_at desc);
create index if not exists scans_origin_idx  on geo.scans (origin);

-- 결과를 본 뒤 연락처를 남긴 사람
create table if not exists geo.leads (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  scan_id     uuid references geo.scans(id) on delete set null,
  email       text not null,
  company     text,
  name        text,
  phone       text,
  wants       text,           -- 측정 / 측정+실행 / 엔터프라이즈
  source      text default 'free_scan',
  ip_hash     text,
  status      text default 'new'   -- new / contacted / qualified / closed / dropped
);
create index if not exists leads_created_idx on geo.leads (created_at desc);
create index if not exists leads_status_idx  on geo.leads (status);

-- RLS 전면 차단. 앱은 직접 커넥션(DATABASE_URL)으로만 쓰므로 PostgREST 로는 열리지 않는다.
-- (Supabase 를 쓸 경우) geo 스키마를 API Exposed schemas 에 추가하지 말 것.
alter table geo.scans enable row level security;
alter table geo.leads enable row level security;

-- 영업용 뷰 — 점수가 낮을수록 후킹이 강하다
create or replace view geo.lead_queue as
select l.id, l.created_at, l.email, l.company, l.phone, l.wants, l.status,
       s.origin, s.total as site_score, s.grade
from geo.leads l
left join geo.scans s on s.id = l.scan_id
order by l.created_at desc;
