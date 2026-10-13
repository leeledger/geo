// Step 45 — 학원 AI 탐침에 「AI 교육」 검색어 4개를 넣는다(멱등).
//   node scripts/seed-probes-step45.mjs
// 탐침은 ai_probe_measurements 로만 간다. 승인 20문항(ai_measurements)에는 넣지 않는다 — 영업 숫자가 오염된다.
// 같은 글(앞뒤 공백 무시)이 이미 있으면 건너뛴다. 번호는 daily-agent.mjs 와 같은 max+1.
import { 잠깐DB } from "../clients.mjs";

const CLIENT_ID = 1;
const PROBES = [
  { text: "송파 초등 AI 교육", radius: "송파구" },
  { text: "송파 AI 교육 기관", radius: "송파구" },
  { text: "송파 AI 강의하는 곳", radius: "송파구" },
  { text: "석촌동 초등 AI 수업", radius: "동네" },
];
const 오늘 = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });

const 넣음 = await 잠깐DB(async (q) => {
  if (!q) throw new Error("DB 에 못 붙었습니다 — .env.local 의 DATABASE_URL 을 확인하세요");
  await q(`create table if not exists academy.ai_probe_questions (id serial primary key, client_id int not null, prompt_id text not null,
             source_prompt text, radius text, text text not null, created_on date not null default current_date,
             active bool not null default true, form text not null default 'sentence', unique (client_id, prompt_id))`);
  const 있는글 = new Set((await q(`select trim(text) t from academy.ai_probe_questions where client_id=$1`, [CLIENT_ID])).map((r) => r.t));
  const [m] = await q(`select coalesce(max(substring(prompt_id from 2)::int), 0) as n from academy.ai_probe_questions
                        where client_id=$1 and prompt_id ~ '^p[0-9]+$'`, [CLIENT_ID]);
  let n = m.n;
  const 결과 = [];
  for (const p of PROBES) {
    if (있는글.has(p.text.trim())) { console.log(`건너뜀 (이미 있음): ${p.text}`); continue; }
    const id = `p${++n}`;
    const r = await q(`insert into academy.ai_probe_questions (client_id, prompt_id, source_prompt, radius, text, form, active, created_on)
                       values ($1,$2,null,$3,$4,'keyword',true,$5::date) on conflict (client_id, prompt_id) do nothing returning prompt_id`,
      [CLIENT_ID, id, p.radius, p.text, 오늘]);
    if (!r.length) throw new Error(`${id} 번호가 이미 있습니다 — 다시 돌리세요`);
    결과.push(id);
    console.log(`넣음 ${id}: ${p.text} (${p.radius})`);
  }
  return 결과;
});

console.log(`${넣음.length}개 넣음${넣음.length ? ` — ${넣음.join(", ")}` : ""} · 기준일 ${오늘}`);
