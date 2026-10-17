"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { autoStep, retryAutoStep, saveAutoFacts } from "@/lib/auto-setup-actions";
import SubmitButton from "../../SubmitButton";

/**
 * 자동 세팅 판(Step 55e) — 고객 화면 맨 위. 돌 단계가 있으면 한 번에 한 단계씩 autoStep 을 부르고, 끝날 때마다 화면을 다시 그린다.
 * 실패는 스스로 다시 돌리지 않는다(「다시 시도」나 매시 고리가 잇는다). 창을 닫아도 company.mjs 매시 고리가 이어 간다(D230).
 * 단계 줄·다음 단계는 서버가 정해 넘긴다 — 여기서는 부르고 그리기만.
 */
export type 판줄 = { k: string; 이름: string; 상태: string; 말: string; 시각: string; 시도: number; 오류?: string; 몇분전?: number | null };
type Props = { slug: string; 줄: 판줄[]; 다음: string | null; 끝: boolean; 된: number; 살아있음: boolean; 사실: { 업종: string; 지역: string }; 출처: { 업종: string; 지역: string } };

const 상태반: Record<string, string> = { 됨: "done", 대기: "wait", 도는중: "run", 실패: "bad", 원장: "human" };
const 상태말: Record<string, string> = { 됨: "됨", 대기: "대기", 도는중: "도는 중", 실패: "실패", 원장: "원장님 몫" };

export default function AutoSetupPanel({ slug, 줄, 다음, 끝, 된, 살아있음, 사실, 출처 }: Props) {
  const router = useRouter();
  const 부름 = useRef(false);
  const [도는, set도는] = useState(false);
  const [멈춤, set멈춤] = useState<string | null>(null);
  const 표 = 줄.map((x) => `${x.k}:${x.상태}:${x.시도}`).join("|");

  // 돌 단계가 있으면 하나 부른다. 끝나면 다시 그린다 → 새 다음 단계로 이 효과가 다시 돈다
  useEffect(() => {
    if (!다음 || 부름.current || 멈춤) return;
    부름.current = true;
    set도는(true);
    autoStep(slug)
      .then((r) => { if (r.상태 === "오류") set멈춤(r.말); })
      .catch(() => set멈춤("자동 세팅을 못 불렀습니다. 화면을 새로 고치거나 「다시 시도」를 누릅니다"))
      .finally(() => { 부름.current = false; set도는(false); router.refresh(); });
  }, [다음, 표, 멈춤, slug, router]);

  // 다른 곳(매시 고리)이 돌리는 중이면 5초마다 다시 본다 — 임대 90초 안일 때만(서버가 살아있음으로 넘긴다). 멈춘 판은 다시 보지 않는다
  const 남이도는 = !도는 && 살아있음;
  useEffect(() => {
    if (!남이도는) return;
    const t = setTimeout(() => router.refresh(), 5000);
    return () => clearTimeout(t);
  }, [남이도는, 표, router]);

  return (
    <section className="as-panel" aria-labelledby="as-h" data-testid="auto-setup">
      <h2 id="as-h">자동 세팅 <span className="n">{된}/{줄.length}</span></h2>
      <p className="sub" role="status">
        {도는 ? "도는 중… (최대 30초)" : 끝 ? "다섯 단계를 다 마쳤습니다" : 다음 ? "다음 단계를 부릅니다" : "멈춘 단계는 아래에서 원장님이 이어 줍니다. 창을 닫아도 매시 회사 루프가 이어 갑니다"}
      </p>
      {멈춤 && <p className="cl-err" role="alert">{멈춤}</p>}
      <ul className="as-rows">
        {줄.map((x) => (
          <li key={x.k} className={`as-row ${상태반[x.상태] ?? "wait"}`} data-step={x.k} data-state={x.상태}>
            <span className="as-k">{x.이름}</span>
            <span className={`as-s ${상태반[x.상태] ?? "wait"}`}>{x.상태 === "도는중" && x.몇분전 != null ? `도는 중(${x.몇분전}분 전)` : 상태말[x.상태] ?? x.상태}</span>
            <span className="as-m">
              {x.말 || (x.상태 === "대기" ? "앞 단계를 기다립니다" : "")}
              {x.오류 && (
                <details><summary>원문</summary><pre>{x.오류}</pre></details>
              )}
            </span>
            <span className="as-t">{x.시각}{x.시도 ? ` · 시도 ${x.시도}` : ""}</span>
            {(x.상태 === "실패" || x.상태 === "원장") && (
              <div className="as-do">
                {x.k === "업종지역" && x.상태 === "원장" && (
                  <form className="cl-form" action={saveAutoFacts} data-testid="facts-form">
                    <input type="hidden" name="slug" value={slug} />
                    <label>업종<small>손님이 검색창에 치는 말 · {출처.업종}</small><input name="category" defaultValue={사실.업종} maxLength={20} required placeholder="치과" /></label>
                    <label>지역<small>시군구 · {출처.지역}</small><input name="district" defaultValue={사실.지역} maxLength={20} required placeholder="송파구" /></label>
                    <SubmitButton className="adm-btn cl-save">두 칸 넣고 이어 하기</SubmitButton>
                  </form>
                )}
                <form action={retryAutoStep}>
                  <input type="hidden" name="slug" value={slug} />
                  <input type="hidden" name="step" value={x.k} />
                  <SubmitButton className="adm-btn alt">다시 시도</SubmitButton>
                </form>
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
