/**
 * 깨우기 — 자동 작업 하나가 끝날 때마다(.github/workflows/wake.yml, workflow_run) 돈다.
 *
 * 2026-09-24 아침: 매시 점검(company.yml, 매시 23분 예약)을 GitHub 이 두 번 건너뛰어 1시간 47분 동안 아무도 안 돌렸다.
 * 매시 점검이 실행 기록을 현황판으로 옮기고 밀린 일을 대신 띄우는데, 그게 멈추니 멀쩡히 끝난 측정·정찰까지 「늦음」으로 떴다.
 * 원장: 「늦음인 것들은 다시 능동적으로 임무 수행해야 하고 목표까지 완수」.
 *
 * 하는 일 둘
 *   1. 방금 끝난 실행을 활동 기록에 바로 적는다 — 매시 점검을 기다리지 않는다(같은 run_url 이면 건너뜀. company 출근기록과 같은 모양)
 *   2. 매시 점검이 55분 넘게 안 떴으면 깨운다 — 깨어난 매시 점검이 밀린 예약을 대신 띄운다(company.mjs 밀린예약)
 *
 * 예약(cron)에 기대지 않는다. workflow_run 은 앞 작업이 끝나면 뜬다.
 * company.yml 은 이 트리거 목록에 없다 — 매시 점검 → 대신 띄운 작업 → 깨우기 → 매시 점검 고리가 돌지 않게. 깨우기는 55분 안에 뜬 매시 점검이 있으면 안 깨운다.
 */
import pg from "pg";

const REPO = process.env.GITHUB_REPOSITORY || "leeledger/geo";
const HOUSE = 1;
// company.mjs WORKFLOWS 와 같은 표 — 누구의 일로 적나
const 담당 = { watch: "ops", scout: "ops", serp: "measure", snapshot: "deliver", write: "content", optimize: "improve", audit: "ops", repair: "ops", sales: "sales" };
const 깨울간격분 = 55;

const name = String(process.env.WF_NAME ?? "");
const url = String(process.env.WF_URL ?? "");
const conclusion = String(process.env.WF_CONCLUSION ?? "");
const updated = String(process.env.WF_UPDATED ?? "") || new Date().toISOString();

const u = new URL(process.env.DATABASE_URL);
u.searchParams.delete("sslmode");
const pool = new pg.Pool({ connectionString: u.toString(), ssl: { rejectUnauthorized: process.env.DATABASE_SSL_INSECURE !== "true" }, max: 1 });
const q = (s, p = []) => pool.query(s, p).then((r) => r.rows);

const gh = async (path, init = {}) => {
  if (!process.env.GH_TOKEN) return { __error: "GH_TOKEN 없음" };
  const r = await fetch(`https://api.github.com/repos/${REPO}${path}`, {
    ...init, headers: { authorization: `Bearer ${process.env.GH_TOKEN}`, accept: "application/vnd.github+json", ...(init.headers ?? {}) },
  }).catch((e) => ({ ok: false, status: 0, text: async () => e.message }));
  if (r.status === 201 || r.status === 204) return {};
  return r.ok ? r.json() : { __error: `${r.status} ${String(await r.text()).slice(0, 160)}` };
};

const main = async () => {
  // 1. 방금 끝난 실행을 적는다
  if (담당[name] && url) {
    const [seen] = await q(`select 1 from geo.agent_activity where run_url = $1 limit 1`, [url]);
    if (!seen) {
      // 매시 점검(출근기록)과 같은 모양 — 「<처음 띄운 이벤트> · <결과>」. 둘이 몇 초 차로 겹치면 한 줄만 남게 on conflict
      await q(`insert into geo.agent_activity (client_id, agent, action, ok, summary, run_url, at) values ($1,$2,$3,$4,$5,$6,$7)
               on conflict (run_url) where run_url is not null and action ~ '^자동 작업 [a-z]+$' do nothing`,
        [HOUSE, 담당[name], `자동 작업 ${name}`, conclusion === "success", `${process.env.WF_EVENT || "workflow_run"} · ${conclusion}`, url, updated]);
      console.log(`기록: 자동 작업 ${name} · ${conclusion}`);
    } else console.log(`이미 적힘: ${name}`);
  }

  // 2. 매시 점검이 멈춰 있으면 깨운다
  const d = await gh(`/actions/workflows/company.yml/runs?per_page=1`);
  if (d.__error) { console.log(`매시 점검 기록을 못 읽음 ${d.__error} — 안 깨움`); return; }
  const last = d.workflow_runs?.[0];
  const 분 = last ? Math.round((Date.now() - Date.parse(last.created_at)) / 60000) : Infinity;
  if (last && last.status !== "completed") { console.log(`매시 점검이 도는 중(${last.status}) — 그대로 둠`); return; }
  if (분 < 깨울간격분) { console.log(`매시 점검 ${분}분 전에 떴음 — 그대로 둠`); return; }
  const r = await gh(`/actions/workflows/company.yml/dispatches`, { method: "POST", body: JSON.stringify({ ref: "main" }) });
  const ok = !r.__error;
  await q(`insert into geo.agent_activity (client_id, agent, action, ok, summary) values ($1,'ops','매시 점검 깨움',$2,$3)`,
    [HOUSE, ok, ok ? `${분 === Infinity ? "기록 없음" : `${분}분`} 동안 안 떠서 ${name} 끝난 김에 깨움` : `깨우기 실패 ${r.__error}`]);
  console.log(ok ? `매시 점검 깨움 (${분}분 만)` : `깨우기 실패 ${r.__error}`);
};

main()
  .catch((e) => { console.log("실패:", e.stack ?? e.message); process.exitCode = 1; })
  .finally(() => pool.end());
