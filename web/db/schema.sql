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
-- AI 답에서 이 고객 이름을 가리는 정규식 원문(등록 화면이 말을 escape 해 만든다) · 파일럿 밖에서도 매일 잴지 (Step 25)
alter table geo.clients add column if not exists answer_pattern text;
alter table geo.clients add column if not exists measure_active boolean not null default false;
-- Step 37 고객 설정 — 사람이 넣은 말(config v1)과 사이트를 읽어 얻은 값(derived, Step 38 세팅 점검이 채운다). academy/clients.mjs 고객설정 이 읽는다
alter table geo.clients add column if not exists config jsonb not null default '{}'::jsonb;
alter table geo.clients add column if not exists derived jsonb not null default '{}'::jsonb;
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
alter table geo.site_visits enable row level security;
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
-- 루프가 무엇을 겨냥해 무엇을 했고 먹혔는지 (academy/scripts/daily-agent.mjs 가 만든다)
alter table geo.agent_runs add column if not exists target_prompt text;
alter table geo.agent_runs add column if not exists action_kind text;
alter table geo.agent_runs add column if not exists target_slug text;
alter table geo.agent_runs add column if not exists verdict text not null default '판정 전';
alter table geo.agent_runs add column if not exists verdict_note text not null default '';
alter table geo.agent_runs add column if not exists effective_on date;
alter table geo.agent_runs add column if not exists judged_at timestamptz;
alter table geo.agent_runs enable row level security;

-- 탐침·확장 질문 측정(Step 22·31). 승인 20문항(academy.ai_measurements)과 섞지 않는 따로 표.
-- academy/scripts/loop-grow.mjs 탐침측정DDL · academy/db/schema.sql 과 같은 줄
create schema if not exists academy;
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

-- 영업용 뷰 — 점수가 낮을수록 후킹이 강하다
create or replace view geo.lead_queue as
select l.id, l.created_at, l.email, l.company, l.phone, l.wants, l.status,
       s.origin, s.total as site_score, s.grade
from geo.leads l
left join geo.scans s on s.id = l.scan_id
order by l.created_at desc;
