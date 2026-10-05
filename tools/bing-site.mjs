import { loadClients, 고객고르기, 잠깐DB } from "../academy/clients.mjs";

/**
 * 빙 웹마스터에 사이트가 없을 때 bing-submit-urls.mjs 가 찍는 줄. local-agent.mjs 가 이 글자를 보고
 * 원장 일감(「빙 웹마스터에 {이름} 추가」)을 연다. 두 파일이 같은 글자를 쓰도록 여기 한 군데 둔다
 */
export const 빙미등록 = "빙 웹마스터에 등록 안 됨";

/** 어느 고객 사이트를 낼까. 인자 없으면 학원 하나 — 고객고르기 는 인자 없을 때 전부를 돌려주니 그대로 쓰지 않는다. DB 고객도 찾는다(Step 37) */
export const bingClient = (argv = process.argv, 열기 = 잠깐DB) =>
  열기(async (q) => (argv.includes("--client") ? (await 고객고르기(argv, q))[0] : (await loadClients(q))[0]));
