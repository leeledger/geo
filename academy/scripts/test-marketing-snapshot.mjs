// 바깥 글 문서딱 회귀(Step 39a) — 프롬프트 3채널·관문 이유·대안·사실 줄이 일반화 전과 한 글자도 안 다른가.
// --no-claude 는 프롬프트 직전에 멈추니, 프롬프트가 같다는 건 이 스냅샷으로만 증명된다.
//   node scripts/test-marketing-snapshot.mjs           fixtures/marketing-prompt-docttak.txt 와 비교
//   node scripts/test-marketing-snapshot.mjs --write   지금 출력으로 스냅샷을 다시 뜬다(일반화 전에 한 번 뜬 것이 기준)
import fs from "node:fs";
import { CLIENTS, bySlug } from "../clients.mjs";
import * as md from "./marketing-draft.mjs";

const c = bySlug("docttak", CLIENTS);
const 파일 = new URL("./fixtures/marketing-prompt-docttak.txt", import.meta.url);

const 글 = [
  "여권사진",
  "가로 3.5 cm·세로 4.5 cm, 413×531픽셀, 500 KB 이하",
  "외교부 여권안내에서 한 번 더 확인합니다",
  "출처: 외교부 여권안내 (여권) · 확인일 2026-09-29",
  "함께 보면 좋은 안내",
  "정부24 사진 규격",
].join("\n");
const 도구글 = "증명사진 만들기\n사진을 자르고 크기와 용량을 맞춥니다\n얼굴·배경은 고치지 않습니다\nGmail 이나 Outlook 으로 보낼 때도 같은 파일입니다";
const 사실 = md.사실줄(c, 31);
const 페이지 = [{ url: "https://docttak.com/guide/passport-photo/", 글 }, { url: "https://docttak.com/id-photo/", 글: 도구글 }];
const 기관 = ["외교부"];
const p = {
  query: "여권사진 규격", 사실, 페이지,
  사이트맵: new Set(["/id-photo/", "/guide/passport-photo/"]), 바깥: ["https://www.passport.go.kr/home/kor/contents.do?menuPos=31"],
  guide: "https://docttak.com/guide/passport-photo/", tool: "https://docttak.com/id-photo/", 기관,
  근거: [사실, ...페이지.map((x) => x.글)].join("\n"),
};
p.대안 = md.대안찾기(페이지.map((x) => x.글), 기관, c.marketing.alternatives);
const 대안없음 = { ...p, 대안: [] };

// 일부러 걸리는 글 둘 — 문서딱 이름이 든 관문 문장(링크 개수·비공개 도구·대안)이 다 나오게
const 걸림1 = {
  title: "여권사진 규격",
  body: "여권사진은 600 KB 이하예요. 배경 지우기 도구도 있어요. 써 봤는데 무조건 돼요.\n\nhttps://docttak.com/id-photo/ https://docttak.com/guide/passport-photo/ https://docttak.com/remove-background/ https://example.com/x",
};
const 걸림2 = { title: "증명사진 정리", body: "짧은 글. 5 MB 까지 돼요." };

const 판 = [
  "## 사실줄(안내 31)", 사실, "",
  "## 대안찾기", JSON.stringify(p.대안), "",
  "## 프롬프트 jisikin", md.프롬프트(c, "jisikin", p), "",
  "## 프롬프트 cafe(대안 없음)", md.프롬프트(c, "cafe", 대안없음), "",
  "## 프롬프트 blog(고칠것 2)", md.프롬프트(c, "blog", p, ["근거 없는 숫자: 600", "본문 120자 — 블로그 하한 1500자"]), "",
  "## 관문 jisikin 걸림1", ...md.관문("jisikin", 걸림1, p, c), "",
  "## 관문 cafe 걸림1(대안 없음)", ...md.관문("cafe", 걸림1, 대안없음, c), "",
  "## 관문 blog 걸림2", ...md.관문("blog", 걸림2, p, c), "",
].join("\n");

if (process.argv.includes("--write")) {
  fs.writeFileSync(파일, 판);
  console.log(`스냅샷 씀: ${판.length}자`);
} else {
  const 전 = fs.readFileSync(파일, "utf8").replace(/\r\n/g, "\n"); // git autocrlf 가 CRLF 로 꺼내도 같게
  if (전 === 판) console.log(`문서딱 스냅샷 같음 (${판.length}자)`);
  else {
    const a = 전.split("\n"), b = 판.split("\n");
    const i = a.findIndex((l, k) => l !== b[k]);
    console.log(`✗ 문서딱 스냅샷 다름 — ${i + 1}째 줄\n  전: ${a[i]}\n  후: ${b[i]}`);
    process.exitCode = 1;
  }
}
