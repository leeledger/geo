/**
 * 직원 프로필 — 모델을 부르는 곳이 프롬프트 앞에 붙이는 「나는 누구고 어떻게 일하나」.
 *
 * 영상(Hermes 멀티프로필, 원장 2026-09-24 지시)의 구조를 따른다.
 *   agents/USER.md          원장 공통 (얇게)
 *   agents/<id>/SOUL.md     누구인가 · 믿는 것 · 하지 않는 것
 *   agents/<id>/AGENTS.md   어떻게 일하나 · 넘기는 곳 · 보고 양식
 *   agents/<id>/MEMORY.md   오래 갈 규칙만. 작업 로그를 쌓지 않는다 — 쌓이면 역할이 섞인다
 *
 * 기억은 사람이·세션이 고친다. 에이전트가 이 파일들을 스스로 덮어쓰지 않는다(Arch D5).
 *
 *   import { 프로필 } from "./profile.mjs";   프로필("content") → 이어 붙인 문자열
 *   node scripts/profile.mjs content          찍어 본다
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** 합쳐 이만큼까지. 넘으면 MEMORY 부터 자른다 — 정체성과 일하는 법이 기억보다 먼저다 */
export const 상한 = 6000;

const 폴더 = new URL("../agents/", import.meta.url);
const 읽기 = (rel) => {
  try { return fs.readFileSync(new URL(rel, 폴더), "utf8").replace(/\r/g, "").trim(); } catch { return ""; }
};
const 잇기 = (조각들) => 조각들.filter(Boolean).join("\n\n---\n\n");

/** 없는 파일은 건너뛴다. 모르는 id 면 USER 만 준다 */
export function 프로필(id) {
  const 이름 = /^[a-z]+$/.test(String(id ?? "")) ? id : "";
  const 앞 = [읽기("USER.md"), 이름 && 읽기(`${이름}/SOUL.md`), 이름 && 읽기(`${이름}/AGENTS.md`)];
  let 기억 = 이름 ? 읽기(`${이름}/MEMORY.md`) : "";

  let 전부 = 잇기([...앞, 기억]);
  if (전부.length <= 상한) return 전부;

  // MEMORY 를 줄 단위로 뒤에서부터 덜어낸다. 한 줄이 한 규칙이라 줄 가운데를 자르지 않는다
  const 줄 = 기억.split("\n");
  while (줄.length && 잇기([...앞, 줄.join("\n")]).length > 상한) 줄.pop();
  기억 = 줄.join("\n").trim();
  전부 = 잇기([...앞, 기억]);
  // 기억을 다 빼도 넘으면 뒤를 자른다 — 여기 오면 AGENTS.md 가 너무 긴 것이다
  return 전부.length <= 상한 ? 전부 : 전부.slice(0, 상한);
}

if (process.argv[1] && path.resolve(process.argv[1]).toLowerCase() === fileURLToPath(import.meta.url).toLowerCase()) {
  const s = 프로필(process.argv[2]);
  console.log(`${s.length}자\n\n${s}`);
}
