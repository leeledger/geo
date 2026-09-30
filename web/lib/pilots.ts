import { inqPool } from "./inquiries";

export async function listPilots() {
  try { return (await inqPool().query(`select p.*, c.slug, c.name, c.domain,
    (select count(*)::int from geo.pilot_tasks t where t.pilot_id=p.id and t.status='완료') done,
    (select count(*)::int from geo.pilot_tasks t where t.pilot_id=p.id) total
    from geo.pilots p join geo.clients c on c.id=p.client_id order by p.created_at desc`)).rows; }
  catch { return []; }
}
export async function getPilot(id:string) {
  try {
    const p=(await inqPool().query(`select p.*,c.slug,c.name,c.domain from geo.pilots p join geo.clients c on c.id=p.client_id where p.id=$1`,[id])).rows[0];
    if(!p)return null;
    // 확장 질문(stage 'extend', Step 31)은 승인 20문항 밖이다 — 패널·승인 버튼에 안 섞는다(approveQuestions 도 뺀다)
    const [questions,tasks,audits,content,ai,checks]=await Promise.all([
      inqPool().query(`select * from geo.pilot_questions where pilot_id=$1 and coalesce(stage,'')<>'extend' order by position`,[id]),
      inqPool().query(`select * from geo.pilot_tasks where pilot_id=$1 order by due_on, id`,[id]),
      inqPool().query(`select * from geo.local_audits where pilot_id=$1 order by source,field`,[id]),
      inqPool().query(`select * from geo.content_approvals where pilot_id=$1 order by id`,[id]),
      inqPool().query(`select measured_on::text as day,collection_method,engine,count(*)::int n,count(*) filter(where mentioned)::int mentioned,count(*) filter(where cited)::int cited from academy.ai_measurements where client_id=$1 group by 1,2,3 order by 1`,[p.client_id]),
      // 손 확인 기록(Step 26 D8). 표가 아직 없으면(스키마 적용 전) 빈 목록 — 파일럿 화면 전체를 404 로 만들지 않는다
      inqPool().query(`select id,question,surface,checked_on::text checked_on,shown,note,capture is not null has_capture from geo.pilot_manual_checks where pilot_id=$1 order by checked_on,id`,[id]).catch(()=>({rows:[]})),
    ]);
    return {pilot:p,questions:questions.rows,tasks:tasks.rows,audits:audits.rows,content:content.rows,ai:ai.rows,checks:checks.rows};
  } catch{return null;}
}
export async function getPilotByInquiryKey(key:string){try{return (await inqPool().query(`select p.id,p.inquiry_key,p.started_on,p.ends_on,c.id client_id,c.name from geo.pilots p join geo.clients c on c.id=p.client_id where p.inquiry_key=$1 and p.status in ('준비','진행')`,[key])).rows[0]??null}catch{return null}}
