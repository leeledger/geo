/**
 * 「재료를 주세요」 일감 한 벌. write-draft·write-news 가 같은 것을 쓴다.
 *
 * 두 곳에 베껴 두면 한쪽만 고쳐 놓고 고친 줄 안다 — 게이트를 지나치는 길이 하나 생기고
 * 그 길이 기본 경로가 될 수 있다(Richard 2026-09-23, 모드 사실에 게이트가 없던 건).
 *
 * dedupe_key 는 company.mjs 의 재료 신호와 같은 `material-need` 다.
 * 재료가 3개를 넘으면 회사 루프가 알아서 닫는다 — 여기서 따로 닫지 않는다.
 */
export const 재료도구 = (q, { client = 1, admin } = {}) => {
  const ADMIN = admin || process.env.ADMIN_BASE_URL || "https://geo-rose-nine.vercel.app";
  const 오늘 = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });

  const 재료일감 = ({ title, detail, payload = {} }) =>
    // 빈손을 셀 때마다 그날을 같이 찍는다. 같은 날 두 번째 호출은 위에서 걸러진다
    q(
      `insert into geo.agent_tasks (client_id, agent, kind, dedupe_key, title, detail, payload, priority, status, link)
       values ($1, 'content', 'material', 'material-need', $2, $3, $4::jsonb, 12, '사람 대기', $5)
       on conflict (client_id, dedupe_key) do update set
         title = excluded.title, detail = excluded.detail,
         payload = geo.agent_tasks.payload || excluded.payload,
         priority = excluded.priority, link = coalesce(excluded.link, geo.agent_tasks.link), updated_at = now(),
         status = case when geo.agent_tasks.status in ('닫힘', '완료') then '사람 대기' else geo.agent_tasks.status end`,
      [client, title, detail, JSON.stringify("빈손" in payload ? { ...payload, 빈손날: 오늘() } : payload), `${ADMIN}/admin/material`],
    ).catch((e) => console.log("  ⚠ 재료 일감을 못 올렸습니다:", e.message.slice(0, 90)));

  /**
   * 빈손으로 끝난 횟수를 센다. 한 주 건너뛰는 건 괜찮다 — 두 주 연속이면 발행이 멈춘 것이다.
   * 그때는 우선순위를 맨 위로 올려 따로 알린다(sticky — 신호가 없어도 회사 루프가 안 닫는다).
   */
  const 빈손 = async (왜) => {
    const [t] = await q(
      `select coalesce((payload->>'빈손')::int, 0) n, payload->>'빈손날' as 날 from geo.agent_tasks
        where client_id = $1 and dedupe_key = 'material-need'`, [client]).catch(() => []);
    // 한 번 돌 때 write-news 가 두 번 불릴 수 있다 — company.mjs 가 직접 부르고,
    // 거기서 초안이 안 나오면 write-draft 가 모드 사실로 또 부른다. 하루에 한 번만 센다
    if (t?.날 === 오늘()) {
      console.log(`  (오늘 이미 빈손으로 셌습니다 — ${t.n}주째)`);
      return t.n;
    }
    const n = (t?.n ?? 0) + 1;
    if (n >= 2) {
      await q(
        `insert into geo.agent_tasks (client_id, agent, kind, dedupe_key, title, detail, payload, priority, status, link)
         values ($1, 'content', 'material', 'material-stopped', $2, $3, $4::jsonb, 5, '사람 대기', $5)
         on conflict (client_id, dedupe_key) do update set
           title = excluded.title, detail = excluded.detail,
           payload = geo.agent_tasks.payload || excluded.payload, priority = excluded.priority, updated_at = now(),
           status = case when geo.agent_tasks.status = '닫힘' then '사람 대기' else geo.agent_tasks.status end`,
        [
          client,
          `발행이 멈췄습니다 — 자동 초안이 ${n}주 연속 빈손`,
          `주 1편이 끊기면 크롤러도 뜸해지고 레퍼런스가 늙습니다.\n이유: ${왜}\n재료 한 줄이면 다음 주는 돕니다: ${ADMIN}/admin/material`,
          JSON.stringify({ sticky: true, 빈손: n, 왜 }),
          `${ADMIN}/admin/material`,
        ],
      ).catch((e) => console.log("  ⚠ 멈춤 일감을 못 올렸습니다:", e.message.slice(0, 90)));
      console.log(`  ⚠ ${n}주 연속 빈손입니다. 발행 멈춤 일감을 올렸습니다.`);
    }
    return n;
  };

  /** 초안이 나왔으면 빈손 카운터를 0 으로 돌리고 멈춤 일감을 닫는다 */
  const 다시돎 = async () => {
    await q(`update geo.agent_tasks set payload = payload || '{"빈손":0}'::jsonb, updated_at = now()
              where client_id = $1 and dedupe_key = 'material-need'`, [client]).catch(() => {});
    await q(
      `update geo.agent_tasks set status = '닫힘', done_at = now(), updated_at = now(),
              evidence = left(evidence || chr(10) || $2, 4000)
        where client_id = $1 and dedupe_key = 'material-stopped' and status <> '닫힘'`,
      [client, `${오늘()} 초안이 다시 나와 닫음`]).catch(() => {});
  };

  /** 이 글에 쓴 재료에 글 주소를 적는다. 안 적으면 다음 주에 같은 재료로 또 쓴다 */
  const 재료썼음 = async (쓴재료, slug) => {
    if (!쓴재료?.length) return;
    await q(`update academy.materials set used_in = used_in || $1::text[] where id = any($2::uuid[])`,
      [[slug], 쓴재료.map((m) => m.id)])
      .catch((e) => console.log("  ⚠ 재료에 쓴 글을 못 적었습니다:", e.message.slice(0, 90)));
  };

  return { ADMIN, 재료일감, 빈손, 다시돎, 재료썼음 };
};
