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
    const [questions,tasks,audits,content,ai]=await Promise.all([
      inqPool().query(`select * from geo.pilot_questions where pilot_id=$1 order by position`,[id]),
      inqPool().query(`select * from geo.pilot_tasks where pilot_id=$1 order by due_on, id`,[id]),
      inqPool().query(`select * from geo.local_audits where pilot_id=$1 order by source,field`,[id]),
      inqPool().query(`select * from geo.content_approvals where pilot_id=$1 order by id`,[id]),
      inqPool().query(`select measured_on::text as day,collection_method,engine,count(*)::int n,count(*) filter(where mentioned)::int mentioned,count(*) filter(where cited)::int cited from academy.ai_measurements where client_id=$1 group by 1,2,3 order by 1`,[p.client_id]),
    ]);
    return {pilot:p,questions:questions.rows,tasks:tasks.rows,audits:audits.rows,content:content.rows,ai:ai.rows};
  } catch{return null;}
}
export async function getPilotByInquiryKey(key:string){try{return (await inqPool().query(`select p.id,p.inquiry_key,p.started_on,p.ends_on,c.id client_id,c.name from geo.pilots p join geo.clients c on c.id=p.client_id where p.inquiry_key=$1 and p.status in ('준비','진행')`,[key])).rows[0]??null}catch{return null}}
