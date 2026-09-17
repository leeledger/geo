/**
 * 매일 개선 루프의 작업 지시서와 실행 원장.
 * 측정값으로 한 가지 병목을 고르고 DB에 남긴다. 실행 에이전트는 그 행동을 끝낸 뒤
 *   node scripts/daily-agent.mjs --complete "한 일" "근거"
 * 로 닫는다. 기록만 만들고 실행했다고 쓰지 않는다.
 */
import fs from "node:fs";import {Pool} from "pg";
for(const l of fs.readFileSync(new URL("../.env.local",import.meta.url),"utf8").split(/\r?\n/)){const m=/^([A-Z_]+)=(.*)$/.exec(l);if(m&&!process.env[m[1]])process.env[m[1]]=m[2]}
const u=new URL(process.env.DATABASE_URL);u.searchParams.delete("sslmode");const db=new Pool({connectionString:u.toString(),ssl:{rejectUnauthorized:process.env.DATABASE_SSL_INSECURE!=="true"}});const q=(s,p=[])=>db.query(s,p).then(r=>r.rows);const [c]=await q(`select id from geo.clients where slug='robotncoding'`);if(!c)throw new Error('robotncoding 없음');
await db.query(`create table if not exists geo.agent_runs(id bigserial primary key,client_id int not null references geo.clients(id),run_day date not null default current_date,trigger text not null default 'daily',status text not null default '행동 대기',facts jsonb not null default '{}'::jsonb,diagnosis text not null,action text not null,evidence text not null default '',started_at timestamptz not null default now(),completed_at timestamptz,unique(client_id,run_day,trigger))`);
if(process.argv.includes('--complete')){const i=process.argv.indexOf('--complete'),done=process.argv[i+1]??'',evidence=process.argv[i+2]??'';await q(`update geo.agent_runs set status='완료',action=$2,evidence=$3,completed_at=now() where client_id=$1 and run_day=current_date and trigger='daily'`,[c.id,done,evidence]);console.log('오늘 개선 루프 완료 기록');await db.end();process.exit(0)}
const [f]=await q(`select
 (select count(*)::int from geo.pilot_questions q join geo.pilots p on p.id=q.pilot_id where p.client_id=$1) questions,
 (select count(*)::int from geo.pilot_questions q join geo.pilots p on p.id=q.pilot_id where p.client_id=$1 and q.approved) approved,
 (select count(*)::int from academy.inquiries where client_id=$1 and enrolled is null) unresolved,
 (select count(*)::int from academy.posts where client_id=$1 and not published) drafts,
 (select max(measured_on)::text from academy.ai_measurements where client_id=$1) ai_day,
 (select count(*)::int from academy.ai_measurements where client_id=$1 and measured_on=(select max(measured_on) from academy.ai_measurements where client_id=$1)) ai_rows,
 (select min(coverage_pct)::float from academy.coverage_by_vendor where client_id=$1 and vendor in('openai','google','naver','anthropic')) low_coverage,
 (select count(*)::int from geo.local_audits a join geo.pilots p on p.id=a.pilot_id where p.client_id=$1 and a.verdict='미확인') audit_open`,[c.id]);
let diagnosis,action;
if(f.approved<20){diagnosis=`목표 질문 승인 ${f.approved}/${f.questions}`;action='질문 20개를 사실·구매의도 기준으로 검토하고 승인받는다.'}
else if(f.ai_rows<40){diagnosis=`최신 AI 기준선 ${f.ai_rows}건 · 20문항 2회 미달`;action='같은 화면과 조건에서 승인 질문 20개를 2회 측정하고 답변·출처를 적재한다.'}
else if(f.audit_open>0){diagnosis=`로컬 정보 미확인 ${f.audit_open}칸`;action='공식 사이트·네이버 플레이스·Google Business Profile·교육청 정보를 대조해 가장 영향 큰 불일치부터 수정한다.'}
else if((f.low_coverage??0)<80){diagnosis=`주요 크롤러 최저 커버리지 ${f.low_coverage??0}%`;action='미수집 핵심 페이지의 접근성·내부 링크·사이트맵·robots를 점검하고 수정한 뒤 색인을 요청한다.'}
else if(f.unresolved>0){diagnosis=`결과 미입력 문의 ${f.unresolved}건`;action='원장에게 등록 여부를 확인해 문의 성과 원장을 닫는다.'}
else if(f.drafts>0){diagnosis=`검토 대기 초안 ${f.drafts}편`;action='근거와 학원 사실을 확인해 한 편을 승인 대기로 정리한다.'}
else{diagnosis='측정·정합성·커버리지에 즉시 보이는 결함 없음';action='미언급 질문과 인용된 질문의 출처 차이를 비교해 다음 근거 콘텐츠 한 편의 초안을 만든다.'}
await q(`insert into geo.agent_runs(client_id,diagnosis,action,facts) values($1,$2,$3,$4::jsonb) on conflict(client_id,run_day,trigger) do update set diagnosis=excluded.diagnosis,action=excluded.action,facts=excluded.facts,status=case when geo.agent_runs.status='완료' then geo.agent_runs.status else '행동 대기' end,started_at=now()`,[c.id,diagnosis,action,JSON.stringify(f)]);console.log(`진단: ${diagnosis}\n행동: ${action}`);await db.end();
