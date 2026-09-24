/** 고객별 30일 파일럿 최종 보고서. DB에 남은 사실만 Markdown으로 출력한다. */
import fs from "node:fs";
import { Pool } from "pg";
for (const l of fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8").split(/\r?\n/)) {
  const m = /^([A-Z_]+)=(.*)$/.exec(l); if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}
const ci = process.argv.indexOf("--client"), slug = ci >= 0 ? process.argv[ci + 1] : null;
if (!slug) throw new Error("사용법: node scripts/pilot-report.mjs --client <slug> [--out file.md]");
const oi = process.argv.indexOf("--out");
const u = new URL(process.env.DATABASE_URL); u.searchParams.delete("sslmode");
const db = new Pool({ connectionString: u.toString(), ssl: { rejectUnauthorized: process.env.DATABASE_SSL_INSECURE !== "true" } });
const q = (s, p=[]) => db.query(s,p).then(r=>r.rows);
const [p] = await q(`select p.*,c.name,c.domain,c.id client_id from geo.pilots p join geo.clients c on c.id=p.client_id where c.slug=$1`,[slug]);
if (!p) throw new Error(`파일럿 없음: ${slug}`);
const [tasks,ai,audits,content,inq] = await Promise.all([
  q(`select * from geo.pilot_tasks where pilot_id=$1 order by due_on,id`,[p.id]),
  q(`select measured_on::text as day,engine,collection_method,count(*)::int n,count(*) filter(where mentioned)::int mentioned,count(*) filter(where cited)::int cited from academy.ai_measurements where client_id=$1 group by 1,2,3 order by 1`,[p.client_id]),
  q(`select * from geo.local_audits where pilot_id=$1`,[p.id]), q(`select * from geo.content_approvals where pilot_id=$1`,[p.id]),
  q(`select count(*)::int total,count(*) filter(where source='AI')::int ai,count(*) filter(where source in('AI','네이버검색','구글검색'))::int search,count(*) filter(where enrolled)::int enrolled,count(*) filter(where enrolled is null)::int unknown from academy.inquiries where client_id=$1 and day between $2 and $3`,[p.client_id,p.started_on,p.ends_on])
]);
const comparable=ai.some((a,i)=>ai.some((b,j)=>i!==j&&a.engine===b.engine&&a.collection_method===b.collection_method));
const first=ai[0],last=ai.at(-1), success=Boolean(comparable&&last&&(last.cited>(first?.cited??0)||Number(inq[0].ai)>0||Number(inq[0].search)>0));
const md=`# ${p.name} · 30일 AI 발견성 파일럿 결과

기간: ${String(p.started_on).slice(0,10)} ~ ${String(p.ends_on).slice(0,10)}  
판정: **${success?'성과 확인':'성과 확인 안 됨'}**

## AI 답변 측정

${ai.length?ai.map(a=>`- ${a.day} · ${a.engine} · ${a.collection_method}: 언급 ${a.mentioned}/${a.n}, 직접 인용 ${a.cited}/${a.n}`).join('\n'):'측정 기록 없음'}

${comparable?'동일 엔진·방법의 비교 회차가 있습니다.':'동일 엔진·방법의 비교 회차가 없어 개선률을 계산하지 않습니다.'}

## 상담 유입

- 전체 문의 ${inq[0].total}건
- AI 직접 확인 ${inq[0].ai}건
- AI·검색 확인 ${inq[0].search}건
- 등록 ${inq[0].enrolled}명
- 결과 미입력 ${inq[0].unknown}건

## 납품

${tasks.map(t=>`- [${t.status==='완료'?'x':' '}] ${t.title}${t.evidence?` — ${t.evidence}`:''}`).join('\n')}

## 정보 정합성

- 확인 ${audits.filter(a=>a.verdict!=='미확인').length}/${audits.length}
- 불일치 ${audits.filter(a=>a.verdict==='불일치').length}건

## 콘텐츠

${content.map(c=>`- ${c.title||'제목 미정'} · ${c.status}${c.published_url?` · ${c.published_url}`:''}`).join('\n')}

## 갱신 판단

${success?'성과가 확인됐다. 고객의 계속 지불 의향을 별도로 기록한다.':'성공 기준이 확인되지 않았다. 실패 원인을 기록하고 갱신을 권하지 않는다.'}
`;
if(oi>=0)fs.writeFileSync(process.argv[oi+1],md);else console.log(md);
await db.end();
