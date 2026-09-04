-- 사이트밴드 · 리드 수집 스키마
-- Supabase SQL Editor 에 그대로 붙여 실행한다.

create extension if not exists pgcrypto;

-- 무료 진단 실행 이력
create table if not exists public.scans (
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
create index if not exists scans_created_idx on public.scans (created_at desc);
create index if not exists scans_origin_idx  on public.scans (origin);

-- 결과를 본 뒤 연락처를 남긴 사람
create table if not exists public.leads (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  scan_id     uuid references public.scans(id) on delete set null,
  email       text not null,
  company     text,
  name        text,
  phone       text,
  wants       text,           -- 측정 / 측정+실행 / 엔터프라이즈
  source      text default 'free_scan',
  ip_hash     text,
  status      text default 'new'   -- new / contacted / qualified / closed / dropped
);
create index if not exists leads_created_idx on public.leads (created_at desc);
create index if not exists leads_status_idx  on public.leads (status);

-- RLS: 기본 전면 차단. 서버가 service_role 키로만 쓴다.
-- service_role 은 RLS 를 우회하므로 별도 정책이 필요 없다.
alter table public.scans enable row level security;
alter table public.leads enable row level security;

-- 영업용 뷰 — 점수가 낮을수록 후킹이 강하다
create or replace view public.lead_queue as
select l.id, l.created_at, l.email, l.company, l.phone, l.wants, l.status,
       s.origin, s.total as site_score, s.grade
from public.leads l
left join public.scans s on s.id = l.scan_id
order by l.created_at desc;
