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
-- 랜딩 상담 신청 폼 (2026-09-11). 어떻게 알고 왔는지가 매출 검증의 유일한 고리다.
alter table geo.leads add column if not exists referral   text;  -- AI / 네이버검색 / 구글검색 / 블로그 / 소개 / 기타
alter table geo.leads add column if not exists concerns   text;  -- 고른 고민을 " · " 로 이어서
alter table geo.leads add column if not exists competitor text;
alter table geo.leads add column if not exists site       text;
create index if not exists leads_created_idx on geo.leads (created_at desc);
create index if not exists leads_status_idx  on geo.leads (status);

-- RLS 전면 차단. 앱은 직접 커넥션(DATABASE_URL)으로만 쓰므로 PostgREST 로는 열리지 않는다.
-- (Supabase 를 쓸 경우) geo 스키마를 API Exposed schemas 에 추가하지 말 것.
alter table geo.scans enable row level security;
alter table geo.leads enable row level security;

-- 직접 영업 후보. 공개 정보와 통화로 확인한 사실을 분리해 기록한다.
create table if not exists geo.outreach_targets (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  district text not null,
  neighborhood text,
  address text,
  phone text,
  website text,
  evidence_url text not null,
  evidence_note text,
  priority int not null default 3,
  owner_consults boolean,
  monthly_inquiries_5plus boolean,
  single_location boolean,
  status text not null default '확인 전',
  next_action text not null default '전화로 3가지 조건 확인',
  next_due date,
  note text not null default '',
  contacted_at timestamptz,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique(name, district)
);
create index if not exists outreach_status_idx on geo.outreach_targets(status, priority, updated_at);
alter table geo.outreach_targets enable row level security;

-- 30일 유료 파일럿의 계약·측정·납품 원장
create table if not exists geo.clients (
  id serial primary key, slug text not null unique, name text not null, domain text,
  alias text, status text not null default 'active', started_on date not null default current_date,
  schema_name text not null default 'academy', note text, relation text not null default '외부',
  created_at timestamptz not null default now()
);
alter table geo.clients add column if not exists relation text not null default '외부';
create table if not exists geo.pilots (
  id uuid primary key default gen_random_uuid(),
  client_id int not null references geo.clients(id),
  outreach_target_id uuid references geo.outreach_targets(id),
  price int not null default 390000,
  payment_ref text,
  contact_name text,
  contact_email text,
  contact_phone text,
  receipt_type text,
  terms_evidence text,
  paid_at timestamptz,
  started_on date not null,
  ends_on date not null,
  status text not null default '준비',
  inquiry_key uuid not null default gen_random_uuid() unique,
  terms_accepted_at timestamptz,
  created_at timestamptz not null default now(),
  unique(client_id)
);
alter table geo.pilots add column if not exists inquiry_key uuid default gen_random_uuid();
alter table geo.pilots add column if not exists contact_name text;
alter table geo.pilots add column if not exists contact_email text;
alter table geo.pilots add column if not exists contact_phone text;
alter table geo.pilots add column if not exists receipt_type text;
alter table geo.pilots add column if not exists terms_evidence text;
create unique index if not exists pilots_inquiry_key_idx on geo.pilots(inquiry_key);
create table if not exists geo.pilot_questions (
  id bigserial primary key, pilot_id uuid not null references geo.pilots(id) on delete cascade,
  position int not null, stage text not null, text text not null, approved boolean not null default false,
  unique(pilot_id, position)
);
create table if not exists geo.pilot_tasks (
  id bigserial primary key, pilot_id uuid not null references geo.pilots(id) on delete cascade,
  code text not null, title text not null, owner text not null default '사이티드',
  due_on date not null, status text not null default '대기', evidence text not null default '',
  completed_at timestamptz, unique(pilot_id, code)
);
create table if not exists geo.local_audits (
  id bigserial primary key, pilot_id uuid not null references geo.pilots(id) on delete cascade,
  source text not null, field text not null, observed text not null default '',
  verdict text not null default '미확인', recommendation text not null default '',
  updated_at timestamptz not null default now(), unique(pilot_id, source, field)
);
create table if not exists geo.content_approvals (
  id bigserial primary key, pilot_id uuid not null references geo.pilots(id) on delete cascade,
  title text not null default '', draft_url text, published_url text,
  status text not null default '주제 선정', customer_note text not null default '',
  approved_at timestamptz, published_at timestamptz, updated_at timestamptz not null default now()
);
alter table geo.pilots enable row level security;
alter table geo.pilot_questions enable row level security;
alter table geo.pilot_tasks enable row level security;
alter table geo.local_audits enable row level security;
alter table geo.content_approvals enable row level security;

-- 매일 에이전트가 진단→행동→검증한 원장. 화면 역할 카드와 실제 실행을 구분한다.
create table if not exists geo.agent_runs (
  id bigserial primary key, client_id int not null references geo.clients(id),
  run_day date not null default current_date, trigger text not null default 'daily',
  status text not null default '행동 대기', facts jsonb not null default '{}'::jsonb,
  diagnosis text not null, action text not null, evidence text not null default '',
  started_at timestamptz not null default now(), completed_at timestamptz,
  unique(client_id, run_day, trigger)
);
alter table geo.agent_runs enable row level security;

-- 영업용 뷰 — 점수가 낮을수록 후킹이 강하다
create or replace view geo.lead_queue as
select l.id, l.created_at, l.email, l.company, l.phone, l.wants, l.status,
       s.origin, s.total as site_score, s.grade
from geo.leads l
left join geo.scans s on s.id = l.scan_id
order by l.created_at desc;
