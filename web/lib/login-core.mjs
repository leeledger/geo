/**
 * 현황판 「로그인 창 열기」(Step 39b) — 사람 대기 login-* 일감 → open-login 일감(로컬 대기) → 원장 PC login-poll 이 창을 연다.
 * 화면(task-actions)·회사 루프(company.mjs)·원장 PC(tools/login-poll.mjs)가 같은 함수를 쓴다. 순수 + q 만 받는다.
 *
 *   open-login  payload { sticky, profile, sites, from }   dedupe open-<login 일감 dedupe>  (예: open-login-google)
 */

/** open-session 이 찍는 이름 — 「✓ <이름> 로그인 확인」. 글자를 바꾸면 login-poll 이 못 읽는다 */
export const 창이름 = {
  google: "Google Search Console",
  naver: "네이버 서치어드바이저",
  microsoft: "빙 웹마스터",
  blog: "네이버 블로그",
  // 지식iN 캡차 풀 창(Step 41 KG-41-9) — 로그인 확인이 아니라 원장이 창을 닫으면 끝. open-session --kin 이 닫힐 때 이 이름으로 ✓ 를 찍는다
  kin: "지식iN 캡차 창",
};

const 슬러그 = /^[a-z0-9-]{1,40}$/;

/**
 * login 일감 dedupe → { sites, profile } | null.
 * 고객 블로그 프로필 경로는 그 일감의 고객 행 slug 로만 만든다 — dedupe 글자로 경로를 만들지 않는다(둘이 맞을 때만)
 */
export function 로그인대상(dedupe, clientSlug) {
  if (dedupe === "login-google") return { sites: ["google"], profile: ".browser-profile" };
  if (dedupe === "login-naver") return { sites: ["naver"], profile: ".browser-profile" };
  if (dedupe === "login-microsoft") return { sites: ["microsoft"], profile: ".browser-profile" };
  if (typeof clientSlug === "string" && 슬러그.test(clientSlug) && dedupe === `login-naver-blog-${clientSlug}`) {
    return { sites: ["blog"], profile: `.browser-profile-${clientSlug}` };
  }
  // kin-find 캡차 일감 — 같은 고객 프로필로 지식iN 을 열어 원장이 푼다
  if (typeof clientSlug === "string" && 슬러그.test(clientSlug) && dedupe === `kin-captcha-${clientSlug}`) {
    return { sites: ["kin"], profile: `.browser-profile-${clientSlug}` };
  }
  return null;
}

/** login-poll 이 받아도 되는 payload 인가 — 프로필은 tools 안 두 꼴만, 곳은 아는 것만 */
export function 창요청검사(payload) {
  const p = payload && typeof payload === "object" ? payload : {};
  const profile = typeof p.profile === "string" && /^\.browser-profile(-[a-z0-9-]{1,40})?$/.test(p.profile) ? p.profile : null;
  const sites = Array.isArray(p.sites) && p.sites.length && p.sites.every((s) => s in 창이름) ? [...new Set(p.sites)] : null;
  if (!profile || !sites) return null;
  // 블로그·지식iN 은 고객 프로필 하나에 그 한 곳만 — 학원 프로필에 열지 않는다
  const 고객창 = sites.includes("blog") || sites.includes("kin");
  if (고객창 && (sites.length !== 1 || profile === ".browser-profile")) return null;
  if (!고객창 && profile !== ".browser-profile") return null;
  // id 는 bigint — pg 가 글자로 준다. 숫자로 맞춘다
  const from = Number(p.from);
  return { profile, sites, from: Number.isInteger(from) && from > 0 ? from : null };
}

/** open-session 출력에서 확인된 곳 */
export function 확인된곳(out, sites) {
  // 지식iN 캡차 창은 로그인 확인이 아니라 원장이 닫은 것으로 끝낸다(「✓ 지식iN 캡차 창 닫힘」)
  const 줄 = new Set([...String(out ?? "").matchAll(/✓ (.+?) (?:로그인 확인|닫힘)/g)].map((m) => m[1].trim()));
  return { 됨: sites.filter((s) => 줄.has(창이름[s])), 안됨: sites.filter((s) => !줄.has(창이름[s])) };
}

/** KST 「YYYY-MM-DD HH:MM」 */
export const kst분 = (d = new Date()) => d.toLocaleString("sv-SE", { timeZone: "Asia/Seoul" }).slice(0, 16);

export const 근거붙임 = (q, id, line) =>
  q(`update geo.agent_tasks set updated_at = now(), evidence = right(coalesce(evidence, '') || E'\n' || $2, 4000) where id = $1`, [id, line]);

/**
 * 버튼 한 번 — 사람 대기 login-* 만. 이미 로컬 대기·실행 중이면 그대로(두 번 눌러도 창 하나).
 * 실행 중이 15분 넘게 그대로면(login-poll 이 죽었으면) 다시 받는다 — open-session 상한이 12분이다
 * → { ok: true, 이미, id } | { ok: false, err }
 */
export async function 창요청(q, taskId, now = new Date()) {
  const [t] = await q(`select t.id, t.client_id, t.dedupe_key, t.title, c.slug from geo.agent_tasks t left join geo.clients c on c.id = t.client_id
     where t.id = $1 and t.status = '사람 대기' and t.kind = 'human' and (t.dedupe_key like 'login-%' or t.dedupe_key like 'kin-captcha-%')`, [taskId]);
  if (!t) return { ok: false, err: "not-login" };
  const 대상 = 로그인대상(t.dedupe_key, t.slug);
  if (!대상) return { ok: false, err: "unknown" };
  const rows = await q(`insert into geo.agent_tasks (client_id, agent, kind, dedupe_key, title, detail, status, priority, payload)
       values ($1, 'deliver', 'open-login', $2, $3, '원장 PC 가 로그인 창을 엽니다(현황판 버튼).', '로컬 대기', 5, $4::jsonb)
       on conflict (client_id, dedupe_key) do update set status = '로컬 대기', payload = excluded.payload, last_error = '', done_at = null, updated_at = now()
        where geo.agent_tasks.status not in ('로컬 대기', '실행 중')
           or (geo.agent_tasks.status = '실행 중' and geo.agent_tasks.updated_at < now() - interval '15 minutes')
       returning id`,
    [t.client_id, `open-${t.dedupe_key}`, `로그인 창: ${t.title}`.slice(0, 300), JSON.stringify({ sticky: true, ...대상, from: Number(t.id) })]);
  if (!rows.length) {
    const [x] = await q(`select id from geo.agent_tasks where client_id = $1 and dedupe_key = $2`, [t.client_id, `open-${t.dedupe_key}`]);
    return { ok: true, 이미: true, id: x?.id ?? null };
  }
  await 근거붙임(q, t.id, `${kst분(now)} 로그인 창 요청함(${kst분(now).slice(11)} KST)`);
  return { ok: true, 이미: false, id: rows[0].id };
}

/**
 * 회사 루프(매시) — PC 가 안 집어 간 창 요청을 실패로. 30분 넘게 로컬 대기 = PC 꺼짐.
 * 실행 중으로 20분 넘게 남은 것 = login-poll 이 중간에 죽음(창 상한 12분)
 */
export async function 오래된창요청닫기(q, now = new Date()) {
  const rows = await q(`update geo.agent_tasks set status = '실패', updated_at = now(),
         last_error = case when status = '로컬 대기' then 'PC 가 꺼져 있어 창을 못 열었습니다' else '창 열기가 끝을 못 알렸습니다' end
       where kind = 'open-login' and ((status = '로컬 대기' and updated_at < now() - interval '30 minutes')
                                   or (status = '실행 중' and updated_at < now() - interval '20 minutes'))
       returning id, client_id, payload, last_error`);
  for (const r of rows) {
    const from = Number(r.payload?.from);
    if (Number.isInteger(from)) await 근거붙임(q, from, `${kst분(now)} 로그인 창 못 엶 — ${r.last_error}`);
  }
  return rows;
}

