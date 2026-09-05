/**
 * 콜드 아웃리치 초안 생성.
 *
 * 원칙: 제안하지 않는다. 발견한 사실만 쓴다.
 * "저희 서비스를 소개합니다"가 아니라 "귀사 사이트에 이런 게 있습니다"로 시작한다.
 * 팔러 온 사람이 아니라 뭔가를 발견한 사람의 메일이어야 열린다.
 *
 * 모든 문장은 스캔 결과에서 나온 사실이어야 한다. 추정이나 과장을 넣지 않는다.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const rows = JSON.parse(fs.readFileSync(path.join(ROOT, "data/targets-scored.json"), "utf8"));


/** 받침 유무에 따른 조사 선택. "영림원소프트랩를" 같은 오류를 막는다. */
function josa(word, withBatchim, withoutBatchim) {
  const last = String(word).trim().slice(-1);
  const code = last.charCodeAt(0);
  if (code < 0xac00 || code > 0xd7a3) return withoutBatchim;   // 한글이 아니면 무받침 취급
  return (code - 0xac00) % 28 === 0 ? withoutBatchim : withBatchim;
}

/** 가장 강한 후킹 한 줄 — 사실만, 검증 가능한 것만 */
function hook(r) {
  const d = JSON.parse(fs.readFileSync(path.join(ROOT, `data/scans/${r.dom}.json`), "utf8"));
  const c = d.checks || {};
  if (c.crawler?.score === 0)
    return { level: 1, line: `robots.txt 가 \`User-agent: *\` 에 대해 \`Disallow: /\` 로 되어 있어, ChatGPT·Claude·Perplexity 의 크롤러가 ${r.name} 사이트를 읽지 못합니다.` };
  if (c.crawler?.score < 30)
    return { level: 1, line: `robots.txt 가 일부 검색 봇만 허용하고 있어, AI 크롤러 대부분이 ${r.name} 사이트에 접근하지 못합니다.` };
  if (c.ssr?.score <= 35)
    return { level: 1, line: `자바스크립트 없이 페이지를 받으면 본문이 평균 ${c.ssr.avgTextLen}자밖에 나오지 않습니다. AI 크롤러도 같은 것을 봅니다.` };
  if (c.schema?.score === 0)
    return { level: 2, line: `구조화 데이터(JSON-LD)가 한 페이지에도 없어, AI 가 ${r.name}${josa(r.name, "을", "를")} 하나의 회사·제품으로 인식할 근거가 없습니다.` };
  if (!d.checks.llmstxt?.exists)
    return { level: 3, line: `llms.txt 가 없어 AI 가 인용할 공식 소개문이 준비돼 있지 않습니다.` };
  return { level: 3, line: `AI 인용 관점에서 보완할 지점이 ${(d.notes || []).length}건 확인됐습니다.` };
}

const fixHint = (r) => {
  const d = JSON.parse(fs.readFileSync(path.join(ROOT, `data/scans/${r.dom}.json`), "utf8"));
  return (d.notes || []).slice(0, 3).map((n, i) => `${i + 1}. ${n.msg}`).join("\n");
};

const targets = rows.filter((r) => r.total > 0 && r.total < 60).sort((a, b) => a.total - b.total);
const out = [];

for (const r of targets) {
  const h = hook(r);
  const subject = h.level === 1
    ? `[${r.name}] AI 검색엔진이 사이트를 읽지 못하고 있습니다`
    : `[${r.name}] AI 답변 노출 관련해 확인된 사항`;

  const body = `${r.name} 마케팅 담당자님께

안녕하세요. AI 답변 노출(GEO)을 측정하는 일을 하고 있습니다.
국내 B2B 솔루션 34곳의 사이트를 AI 크롤러 관점에서 점검하다가
${r.name}(${r.dom}) 에서 확인된 사항이 있어 공유드립니다. 제안이 아니라 발견 사실입니다.

■ 확인된 사항
${h.line}

■ 진단 결과 (100점 만점)
  종합            ${r.total}점 (${r.grade})
  AI 크롤러 접근   ${r.crawler}점
  본문 추출 가능성  ${r.ssr}점
  구조화 데이터     ${r.schema}점
  llms.txt        ${r.llms === "O" ? "있음" : "없음"}

■ 먼저 확인해보실 것
${fixHint(r)}

전부 코드로 확인 가능한 사실만 봤습니다. 브랜드 인지도나 콘텐츠 품질 같은
주관적 항목은 넣지 않았습니다. robots.txt·llms.txt 는 직접 열어보시면 바로 확인됩니다.

참고로 34곳 중 22곳이 50점 미만이었습니다. 드문 일이 아닙니다.

혹시 "실제로 ChatGPT 가 ${r.name}${josa(r.name, "을", "를")} 추천하는가"까지 궁금하시면
실제 구매자가 쓸 질문 60개로 4개 엔진에 물어 경쟁사 대비 노출률을
표본·신뢰구간과 함께 정리해 드리겠습니다. 무료입니다.

회신 주시면 보내드리겠습니다. 관심 없으시면 이 메일은 무시하셔도 됩니다.

감사합니다.
`;
  out.push({ ...r, hookLevel: h.level, subject, body });
}

fs.mkdirSync(path.join(ROOT, "data/outreach"), { recursive: true });
fs.writeFileSync(path.join(ROOT, "data/outreach/drafts.json"), JSON.stringify(out, null, 2), "utf8");
out.forEach((o) => fs.writeFileSync(path.join(ROOT, `data/outreach/${o.dom}.txt`),
  `제목: ${o.subject}\n\n${o.body}`, "utf8"));

console.log(`발송 대상 ${out.length}곳 (60점 미만)\n`);
console.log("우선순위  점수  회사                후킹 강도");
console.log("─".repeat(62));
out.forEach((o, i) => console.log(
  String(i + 1).padStart(6) + "  " + String(o.total).padStart(4) + "  " + o.name.padEnd(20) +
  (o.hookLevel === 1 ? "★★★ 크롤러 차단/본문 없음" : o.hookLevel === 2 ? "★★  스키마 부재" : "★   보완 사항")));
console.log(`\n초안 저장: data/outreach/ (${out.length}개 파일)`);
