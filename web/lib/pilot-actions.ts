"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { inqPool } from "./inquiries";

import { isAdmin } from "./admin-auth";
import { answerPattern } from "./answer-pattern";

/** 서버 동작은 동작 번호만 알면 누구나 부를 수 있다. 화면이 관리자 전용이어도 동작 자체를 막아야 한다(2026-09-23 발견) */
async function guard() {
  if (!(await isAdmin())) throw new Error("관리자만 할 수 있습니다");
}


const makeQuestions=(brand:string,district:string,neighborhood:string,category:string,audience:string)=>[
 `${district}에서 ${audience} ${category} 추천해줘`,`${neighborhood} 근처 ${category} 어디가 좋아?`,`${district} ${category} 중 상담을 잘해주는 곳 알려줘`,`${neighborhood}에서 가까운 ${category} 비교해줘`,`${district} ${category} 비용은 보통 얼마야`,`${district}에서 후기 말고 수업 근거가 분명한 ${category} 알려줘`,`${audience}가 다닐 ${district} ${category} 고르는 기준 알려줘`,`${district} ${category} 중 소규모로 가르치는 곳 있어?`,
 `${audience}에게 ${category}가 필요한지 판단하는 법은?`,`${category}를 시작하기 좋은 시기는 언제야?`,`${category} 상담 때 무엇을 물어봐야 해?`,`${category}를 다녀도 효과 없는 경우는?`,`${category}에서 실제로 무엇을 배우는지 확인하는 법은?`,
 `대형 ${category}와 동네 ${category} 중 어디가 나아?`,`${category} 온라인 수업과 오프라인 학원 차이는?`,`${district} ${category} 두 곳을 비교할 때 볼 기준은?`,`${category} 체험수업에서 확인할 것은?`,
 `${brand}은 어떤 곳이야?`,`${brand}의 위치와 수업 대상을 알려줘`,`${brand}을 선택해도 되는 사람과 안 맞는 사람을 알려줘`
];

export async function createPilot(form:FormData){await guard();
  const brand=String(form.get("name")??"").trim(), domain=String(form.get("domain")??"").trim().replace(/^https?:\/\//,"").replace(/\/$/,"");
  const district=String(form.get("district")??"").trim(), neighborhood=String(form.get("neighborhood")??"").trim();
  const category=String(form.get("category")??"").trim(), audience=String(form.get("audience")??"").trim();
  const payment=String(form.get("payment_ref")??"").trim();
  const terms=String(form.get("terms_evidence")??"").trim(), contactName=String(form.get("contact_name")??"").trim(), contactEmail=String(form.get("contact_email")??"").trim(), contactPhone=String(form.get("contact_phone")??"").trim(), receiptType=String(form.get("receipt_type")??"").trim();
  // 답에 이 고객 이름이 나왔는지 가리는 말(쉼표로 여러 개). 없으면 측정이 「측정 설정 없음」으로 멈추니 등록 때 받는다(Step 25 D1)
  const pattern=answerPattern(String(form.get("answer_terms")??""));
  if(!brand||!domain||!district||!neighborhood||!category||!audience||!payment||!terms||!contactName||!contactEmail||!contactPhone||!receiptType||!pattern)return;
  const slug=String(form.get("slug")??"").toLowerCase().replace(/[^a-z0-9-]/g,"").slice(0,40);
  if(!slug)return;
  const db=await inqPool().connect(); let pilotId="";
  try{await db.query("begin");
    await db.query(`alter table geo.clients add column if not exists answer_pattern text`);
    await db.query(`alter table geo.clients add column if not exists measure_active boolean not null default false`);
    const c=(await db.query(`insert into geo.clients(slug,name,domain,alias,schema_name,started_on,note,relation,answer_pattern) values($1,$2,$3,$4,'academy',current_date,'39만원 30일 유료 파일럿','외부',$5) on conflict(slug) do update set name=excluded.name,domain=excluded.domain,answer_pattern=excluded.answer_pattern returning id`,[slug,brand,domain,`${district}의 단일 지점 ${category}`,pattern])).rows[0];
    const p=(await db.query(`insert into geo.pilots(client_id,price,payment_ref,contact_name,contact_email,contact_phone,receipt_type,terms_evidence,paid_at,started_on,ends_on,status,terms_accepted_at) values($1,390000,$2,$3,$4,$5,$6,$7,now(),current_date,current_date+30,'진행',now()) on conflict(client_id) do update set payment_ref=excluded.payment_ref,contact_name=excluded.contact_name,contact_email=excluded.contact_email,contact_phone=excluded.contact_phone,receipt_type=excluded.receipt_type,terms_evidence=excluded.terms_evidence returning id,started_on,ends_on`,[c.id,payment,contactName,contactEmail,contactPhone,receiptType,terms])).rows[0];
    const qs=makeQuestions(brand,district,neighborhood,category,audience);
    for(let i=0;i<qs.length;i++)await db.query(`insert into geo.pilot_questions(pilot_id,position,stage,text) values($1,$2,$3,$4) on conflict(pilot_id,position) do update set text=excluded.text`,[p.id,i+1,i<8?'지역':i<13?'문제':i<17?'비교':'브랜드',qs[i]]);
    const tasks=[
      ["intake","사업자·공식 정보와 관리자 권한 수령",0,"고객"],["questions","목표 질문 20개 고객 승인",1,"고객"],
      ["baseline-chatgpt-1","ChatGPT Search 기준선 1회",2,"사이티드"],["baseline-chatgpt-2","ChatGPT Search 기준선 2회",3,"사이티드"],
      ["baseline-google-1","Google AI 개요 기준선 1회",2,"사이티드"],["baseline-google-2","Google AI 개요 기준선 2회",3,"사이티드"],
      ["baseline-naver-1","네이버 AI 화면 기준선 1회",2,"사이티드"],["baseline-naver-2","네이버 AI 화면 기준선 2회",3,"사이티드"],
      ["local-audit","로컬 정보 4곳 정합성 감사와 수정안",5,"사이티드"],["access-fix","승인된 정합성 수정 반영",9,"공동"],
      ["content-draft","근거 콘텐츠 1개 초안",10,"사이티드"],["content-approve","콘텐츠 사실 확인·승인",13,"고객"],["content-publish","콘텐츠 게시·색인 요청",15,"사이티드"],
      ["inquiry-sheet","상담 유입 기록 교육과 입력 링크 전달",1,"사이티드"],["day30-chatgpt","Day 30 ChatGPT 재측정",30,"사이티드"],["day30-google","Day 30 Google 재측정",30,"사이티드"],["day30-naver","Day 30 네이버 재측정",30,"사이티드"],["final-report","전후 비교·문의·실패 원인 최종 보고서",31,"사이티드"],["renewal","계속 지불 의향 확인",31,"사이티드"]
    ];
    for(const t of tasks)await db.query(`insert into geo.pilot_tasks(pilot_id,code,title,due_on,owner) values($1,$2,$3,$4::date+$5::int,$6) on conflict(pilot_id,code) do nothing`,[p.id,t[0],t[1],p.started_on,t[2],t[3]]);
    for(const source of ["공식 사이트","네이버 플레이스","Google Business Profile","교육청 공개정보"])for(const field of ["상호","주소","전화","운영시간","과정·대상"])await db.query(`insert into geo.local_audits(pilot_id,source,field) values($1,$2,$3) on conflict do nothing`,[p.id,source,field]);
    await db.query(`insert into geo.content_approvals(pilot_id) select $1 where not exists(select 1 from geo.content_approvals where pilot_id=$1)`,[p.id]);
    await db.query("commit"); pilotId=p.id;
  }catch(e){await db.query("rollback");throw e}finally{db.release()}
  revalidatePath("/admin/pilots"); redirect(`/admin/pilots/${pilotId}`);
}
export async function updatePilotTask(form:FormData){await guard();const id=Number(form.get("id"));const status=String(form.get("status"));const evidence=String(form.get("evidence")??"").slice(0,500);await inqPool().query(`update geo.pilot_tasks set status=$2,evidence=$3,completed_at=case when $2='완료' then now() else null end where id=$1`,[id,status,evidence]);revalidatePath(String(form.get("path")));}
export async function updateAudit(form:FormData){await guard();await inqPool().query(`update geo.local_audits set observed=$2,verdict=$3,recommendation=$4,updated_at=now() where id=$1`,[Number(form.get("id")),String(form.get("observed")??"").slice(0,300),String(form.get("verdict")),String(form.get("recommendation")??"").slice(0,500)]);revalidatePath(String(form.get("path")));}
export async function approveQuestions(form:FormData){await guard();await inqPool().query(`update geo.pilot_questions set approved=true where pilot_id=$1`,[String(form.get("pilot_id"))]);revalidatePath(String(form.get("path")));}
export async function updateQuestion(form:FormData){await guard();await inqPool().query(`update geo.pilot_questions set text=$2,approved=false where id=$1`,[Number(form.get("id")),String(form.get("text")??"").slice(0,300)]);revalidatePath(String(form.get("path")));}
export async function updateContent(form:FormData){await guard();const status=String(form.get("status"));await inqPool().query(`update geo.content_approvals set title=$2,draft_url=nullif($3,''),published_url=nullif($4,''),status=$5,customer_note=$6,approved_at=case when $5 in ('승인','게시') and approved_at is null then now() else approved_at end,published_at=case when $5='게시' then now() else null end,updated_at=now() where id=$1`,[Number(form.get("id")),String(form.get("title")??"").slice(0,200),String(form.get("draft_url")??"").slice(0,500),String(form.get("published_url")??"").slice(0,500),status,String(form.get("customer_note")??"").slice(0,500)]);revalidatePath(String(form.get("path")));}
/**
 * 고객사 전용 유입 기록표(/record/<열쇠>). 로그인 없이 쓰는 공개 폼이라 입력을 좁힌다(Richard 2026-09-23).
 * 열쇠는 uuid(122비트)라 링크 자체가 권한이다. 다만 값은 보고서·현황판 집계로 가니 폼의 선택지만 받는다.
 */
const 유입경로 = ["AI", "네이버검색", "구글검색", "네이버플레이스", "블로그", "소개", "간판·전단", "기타"];
const 연락경로 = ["전화", "카카오", "방문"];
export async function addClientInquiry(form:FormData){
  const key=String(form.get("key")??"");
  // uuid 가 아니면 DB 가 형 변환 오류로 500 을 낸다 — 먼저 거른다
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(key))return;
  const source=String(form.get("source")??"").trim();
  const channel=String(form.get("channel")??"전화").trim();
  if(!유입경로.includes(source)||!연락경로.includes(channel))return;
  const {rows:[p]}=await inqPool().query(`select p.id,c.id client_id from geo.pilots p join geo.clients c on c.id=p.client_id where p.inquiry_key=$1 and p.status in ('준비','진행')`,[key]);
  if(!p)return;
  // current_date 는 DB 의 UTC 날짜다. 00~09시(KST)에 쓴 기록이 전날로 들어갔다
  await inqPool().query(`insert into academy.inquiries(day,source,said,channel,grade,enrolled,note,client_id) values((now() at time zone 'Asia/Seoul')::date,$1,$2,$3,'',$4,'고객 전용 기록표',$5)`,[source,String(form.get("said")??"").slice(0,300),channel,form.get("enrolled")==='yes'?true:form.get("enrolled")==='no'?false:null,p.client_id]);
  revalidatePath(`/record/${key}`);
}
