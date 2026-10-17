import { inqPool } from "./inquiries";
import { answerPattern } from "./client-core.mjs";
import {
  약속한곳들, 창고르기, 최근창, 요인들, 종합, 지난기록, 고객요약, 레퍼런스줄, 학원비교시작,
  type 창값, type 요인, type 종합결과, type 측정행,
} from "./feasibility-core.mjs";

/**
 * 착수 판정(Step 58) 서버 읽기. 쓰지 않는다. 계산은 feasibility-core 순수 함수.
 * 잰 날 목록 먼저(distinct measured_on) → 창 안 날의 행만(답 원문 앞 4000자). 브랜드 문항·약속 밖 곳은 SQL 에서도 뺀다.
 * 실패하면 throw 하지 않고 오류 말을 돌려준다 — 못 읽은 것이 조용히 「좋음」·0 으로 보이면 안 된다.
 */
const q = (s: string, p: unknown[] = []) => inqPool().query(s, p).then((r) => r.rows);

/** 첫 레퍼런스(학원) — academy/clients.mjs 코드 고객 1번. 업종은 이름 뽑기에 쓸 업종표 말 */
const 레퍼런스고객 = 1;
const 레퍼런스업종 = "코딩학원";

export type 판정판 = {
  오류: string | null;
  창: 창값;
  요인: 요인[];
  종합: 종합결과 | null;
  지난기록: string;
  고객요약: string | null;
  레퍼런스: string[] | null;
  레퍼런스오류: string | null;
};

const 날목록 = (clientId: number) =>
  q(`select distinct measured_on::text as d from academy.ai_measurements
      where client_id = $1 and collection_method = any($2) and coalesce(stage, '') not in ('brand', '브랜드') order by 1`, [clientId, 약속한곳들])
    .then((rs) => rs.map((r) => String(r.d)));

const 행들 = (clientId: number, 날들: string[]): Promise<측정행[]> =>
  날들.length
    ? q(`select measured_on::text as d, collection_method, engine, stage, prompt_id, mentioned, left(raw->>'answer', 4000) as answer
          from academy.ai_measurements
         where client_id = $1 and measured_on = any($2::date[]) and collection_method = any($3) and coalesce(stage, '') not in ('brand', '브랜드')`,
      [clientId, 날들, 약속한곳들]) as Promise<측정행[]>
    : Promise.resolve([]);

/** 고객 자신 정규식 — answer_pattern, 없으면 이름 그대로. 둘 다 없거나 깨졌으면 null(C 못 잼) */
function 우리정규식(row: { answer_pattern?: string | null; name?: string | null }): RegExp | null {
  const src = String(row.answer_pattern ?? "").trim() || answerPattern(String(row.name ?? ""));
  if (!src) return null;
  try { return new RegExp(src, "i"); } catch { return null; }
}

async function 학원레퍼런스(): Promise<string[]> {
  const [c] = await q(`select name, answer_pattern from geo.clients where id = $1`, [레퍼런스고객]);
  const 날 = (await 날목록(레퍼런스고객)).filter((d) => d >= 학원비교시작);
  const 첫창 = 창고르기(날, 학원비교시작), 끝창 = 최근창(날);
  const [a, b] = await Promise.all([행들(레퍼런스고객, 첫창.날들), 행들(레퍼런스고객, 끝창.날들)]);
  // 학원은 자사 — 홈페이지가 이미 있고(구축 없음) 기본 정보는 우리가 다 안다
  const 고정 = { 사이트상태: "none", 플랫폼: null, intake상태: "됨", 사실: { 업종: 레퍼런스업종, 지역: "앎" }, 업종: 레퍼런스업종, 우리Re: c ? 우리정규식(c) : null };
  const 하나 = (창: 창값, rows: 측정행[]) => { const 요인 = 요인들({ ...고정, rows, 창 }); return { 창, 요인, 종합: 종합(요인) }; };
  return 레퍼런스줄({ 첫: 하나(첫창, a), 최근: 하나(끝창, b) });
}

/**
 * row: geo.clients 행(to_jsonb) · intake상태: 착수순서 receive.intake 줄 상태 · pilot: getOnboard 의 파일럿(리허설이면 창 시작을 안 정한다)
 */
export async function getFeasibility(row: Record<string, any>, intake상태: string | null, pilot: Record<string, any> | null): Promise<판정판> {
  const auto = row.config?.auto ?? {};
  const 사실 = { 업종: auto.사실?.업종?.값 ?? null, 지역: auto.사실?.지역?.값 ?? null };
  // 할 일 순서와 같은 우선순위 — 계약 파일럿 needs_build, 리허설 needs_build, 자동 세팅이 고른 사이트 상태
  const 계약 = pilot && pilot.status !== "리허설" ? pilot : null;
  const 사이트상태 = [계약?.needs_build, pilot?.needs_build, auto.사이트상태].find((x) => ["none", "setup", "build"].includes(x)) ?? null;
  const from = 계약?.paid_on && 계약?.started_on ? String(계약.started_on).slice(0, 10) : null;

  const 레퍼런스 = 학원레퍼런스().then((x) => ({ 줄: x, 오류: null as string | null }))
    .catch((e) => { console.error("착수 판정 — 학원 레퍼런스", e); return { 줄: null, 오류: "학원 레퍼런스를 못 읽었습니다" }; });
  const 지난 = q(`select count(*) filter (where p.paid_on is not null and p.status <> '리허설' and p.verdict in ('성공', '실패', '판정 보류'))::int as n,
        count(*) filter (where p.paid_on is not null and p.status <> '리허설' and p.verdict = '성공')::int as m
      from geo.pilots p join geo.clients c on c.id = p.client_id where c.relation is distinct from '자사'`)
    .then(([r]) => 지난기록({ n: r.n, m: r.m }))
    .catch((e) => { console.error("착수 판정 — 지난 기록", e); return "지난 기록을 못 읽었습니다"; });

  const 빈창: 창값 = { 단계: "아직", 날들: [] };
  try {
    const 창 = 창고르기(await 날목록(row.id), from);
    const rows = await 행들(row.id, 창.날들);
    const 요인 = 요인들({ rows, 창, 사이트상태, 플랫폼: row.derived?.platform ?? null, intake상태, 사실, 업종: 사실.업종, 우리Re: 우리정규식(row) });
    const 결과 = 종합(요인);
    const [ref, 지난말] = await Promise.all([레퍼런스, 지난]);
    return { 오류: null, 창, 요인, 종합: 결과, 지난기록: 지난말, 고객요약: 고객요약({ 창, 요인, 종합: 결과 }), 레퍼런스: ref.줄, 레퍼런스오류: ref.오류 };
  } catch (e) {
    console.error("착수 판정 — 측정 읽기", row.slug, e);
    const [ref, 지난말] = await Promise.all([레퍼런스, 지난]);
    return { 오류: "판정을 못 읽었습니다", 창: 빈창, 요인: [], 종합: null, 지난기록: 지난말, 고객요약: null, 레퍼런스: ref.줄, 레퍼런스오류: ref.오류 };
  }
}
