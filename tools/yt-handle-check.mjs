/**
 * 유튜브 핸들(@이름)이 비어 있는지 확인한다.
 *
 * 채널명을 정해 놓고 나중에 핸들이 막혀 있으면 처음부터 다시 정해야 한다.
 * 이름·도메인·핸들을 한 번에 맞춰 두는 편이 낫다.
 *
 * 404 면 비어 있고, 200 이면 누가 쓰고 있다.
 *
 *   node yt-handle-check.mjs robotncoding aicoding ...
 */
const CANDIDATES = process.argv.slice(2).length
  ? process.argv.slice(2)
  : [
      "robotncoding",
      "robotandcoding",
      "aicoding",
      "aicodinglab",
      "aicodingschool",
      "codingwithai",
      "sirokocoding",
      "seokchoncoding",
      "aikoding",
      "kodingai",
    ];

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36";

for (const h of CANDIDATES) {
  const url = `https://www.youtube.com/@${h}`;
  let status = 0;
  let name = "";
  try {
    const r = await fetch(url, { headers: { "user-agent": UA, "accept-language": "ko-KR,ko;q=0.9" } });
    status = r.status;
    if (r.ok) {
      const html = await r.text();
      // 이미 쓰는 채널이면 이름이 나온다
      const m = /<meta property="og:title" content="([^"]{1,60})"/.exec(html);
      name = m ? m[1] : "";
    }
  } catch (e) {
    status = -1;
    name = e.message.slice(0, 30);
  }
  const mark = status === 404 ? "○ 비어 있음" : status === 200 ? "● 사용중" : `? HTTP ${status}`;
  console.log(`  @${h.padEnd(18)} ${mark}${name ? "  — " + name : ""}`);
  await new Promise((r) => setTimeout(r, 900));
}
