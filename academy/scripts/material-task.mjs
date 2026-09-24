/**
 * 글감 도구 한 벌. write-draft·write-news 가 같은 것을 쓴다.
 *
 * 두 곳에 베껴 두면 한쪽만 고쳐 놓고 고친 줄 안다 — 게이트를 지나치는 길이 하나 생기고
 * 그 길이 기본 경로가 될 수 있다(Richard 2026-09-23, 모드 사실에 게이트가 없던 건).
 *
 * 2026-09-24 원장: 「초안 작성이 필수는 아니고 없으면 패스」.
 * 전에는 빈손으로 끝나면 「초안 재료가 필요합니다」를 원장 할 일로 올리고, 두 주 연속이면 「발행이 멈췄습니다」까지 올렸다.
 * 이제는 원장에게 아무것도 올리지 않는다. 그 주는 건너뛰었다고 활동 기록에만 남긴다.
 * 글감은 원장이 생각날 때 /admin/material 에 적는다 — 적혀 있으면 다음 월요일에 쓴다.
 */
export const 재료도구 = (q, { client = 1, admin } = {}) => {
  const ADMIN = admin || process.env.ADMIN_BASE_URL || "https://geo-rose-nine.vercel.app";

  /** 건너뜀 기록 — 할 일이 아니라 활동 한 줄이다. 이름은 옛 호출부와 맞춰 둔다 */
  const 재료일감 = ({ detail }) =>
    q(`insert into geo.agent_activity (client_id, agent, action, ok, summary, run_url) values ($1, 'content', '주간 초안 건너뜀', true, $2, $3)`,
      [client, String(detail ?? "").slice(0, 1000), process.env.GITHUB_RUN_ID
        ? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}` : null])
      .catch((e) => console.log("  ⚠ 건너뜀 기록을 못 남겼습니다:", e.message.slice(0, 90)));

  /** 빈손 횟수는 더 세지 않는다 — 셌던 이유(원장에게 올리기)가 없어졌다. 호출부가 숫자를 받으니 0 을 준다 */
  const 빈손 = async (왜) => {
    console.log(`  이번 주는 건너뜁니다 — ${왜}`);
    return 0;
  };

  /** 옛 「글감 필요」「발행 멈춤」 일감이 열려 있으면 닫는다. 초안이 나왔을 때도, 건너뛸 때도 */
  const 다시돎 = async () => {
    await q(
      `update geo.agent_tasks set status = '닫힘', done_at = now(), updated_at = now()
        where client_id = $1 and dedupe_key in ('material-need', 'material-stopped') and status <> '닫힘'`,
      [client]).catch(() => {});
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
