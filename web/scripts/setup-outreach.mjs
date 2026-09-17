import fs from "node:fs";
import path from "node:path";
import pg from "pg";

const ROOT = path.resolve(import.meta.dirname, "..");
for (const f of [".env.local", ".env"]) {
  const p = path.join(ROOT, f); if (!fs.existsSync(p)) continue;
  for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/i);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "").trim();
  }
}
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL 없음");
const u = new URL(process.env.DATABASE_URL); u.searchParams.delete("sslmode");
const db = new pg.Client({ connectionString: u.toString(), ssl: /localhost|127\.0\.0\.1/.test(u.hostname) ? undefined : { rejectUnauthorized: process.env.DATABASE_SSL_INSECURE !== "true" } });

const targets = [
  ["넥스탑코딩정보보안학원","송파","방이동","서울 송파구 마천로 27","02-425-1117","https://www.nextopedu.co.kr/","https://www.nextopedu.co.kr/","공식 홈페이지에 대표자·전화·상담 게시판 확인",1],
  ["헬로알고학원","송파","잠실동","서울 송파구 석촌호수로 118","02-6479-3400","https://helloalgo.creatorlink.net/","https://helloalgo.creatorlink.net/forum/view/351310","공식 사이트에 대표자·전화 확인",1],
  ["로보로보코딩랩학원","송파","장지동","서울 송파구 위례순환로 387","02-2088-8313","https://blog.naver.com/rcolab5050","https://academy.prompie.com/academies/detail/6vj2m2v/","전화·9개 과정·주소 확인. 직영 여부 확인 필요",1],
  ["뉴메이킹코딩학원","송파","장지동","서울 송파구 위례광장로 199","0507-1422-9031","https://blog.naver.com/newmaking_coding","https://academy.prompie.com/academies/detail/fte75b8/","공식 블로그·주소 확인",2],
  ["엠제이창의영재코딩교습소","송파","장지동","서울 송파구 위례광장로 188","02-409-2023",null,"https://education.smileus.net/학원/서울/송파구/view/엠제이창의영재코딩교습소","강사 1명·15개 과정·전화 확인",2],
  ["새로움코딩학원","송파","신천동","서울 송파구 올림픽로35길 112",null,null,"https://academy.hakwonsin.co.kr/academy/9av213ga/새로움코딩학원","주소·홈페이지/블로그 보유 확인. 현재 브랜드명 확인 필요",3],
  ["코딩스쿨런스팀로봇코딩학원","강동","명일동","서울 강동구 고덕로 256",null,null,"https://opendatflow.com/academies/4640","2013년 개원·주소 확인. 전화/플레이스 확인 필요",2],
  ["랑이쌤컴퓨터교습소","강동","명일동","서울 강동구 고덕로 266 306호",null,null,"https://academy.ipsitalk.net/region/강동구/comp","교육청 기반 목록 확인. 전화/플레이스 확인 필요",3],
  ["창의소프트웨어코딩컴퓨터교습소","강동","고덕동",null,null,null,"https://academy.prompie.com/academies/list/by-region/city25/by-subject/section2/","강동 코딩교육 목록 확인. 주소/전화 확인 필요",3],
  ["대건정보처리학원","강동","명일동",null,null,null,"https://schoolm.co.kr/academy/seoul/gangdong","교육청 기반 목록 확인. 아동 대상·단일 지점 여부 확인 필요",4]
];

await db.connect();
try {
  await db.query(fs.readFileSync(path.join(ROOT, "db", "schema.sql"), "utf8"));
  for (const t of targets) await db.query(`insert into geo.outreach_targets
    (name,district,neighborhood,address,phone,website,evidence_url,evidence_note,priority,next_due)
    values ($1,$2,$3,$4,$5,$6,$7,$8,$9,current_date)
    on conflict(name,district) do update set address=excluded.address, phone=coalesce(excluded.phone,geo.outreach_targets.phone), website=coalesce(excluded.website,geo.outreach_targets.website), evidence_url=excluded.evidence_url, evidence_note=excluded.evidence_note, priority=excluded.priority`, t);
  const { rows:[c] } = await db.query("select count(*)::int n from geo.outreach_targets");
  console.log(`영업 후보 ${c.n}곳 준비 완료`);
} finally { await db.end(); }
