// 시험용 가짜 open-session(Step 39b) — 브라우저를 안 연다. login-poll 에 OPEN_SESSION 으로 끼운다.
//   FAKE_OPEN_OK   ✓ 를 찍을 이름(쉼표). 비면 하나도 안 찍는다
//   FAKE_OPEN_ARGS 받은 인자를 적을 파일(시험이 읽는다)
import fs from "node:fs";

if (process.env.FAKE_OPEN_ARGS) fs.writeFileSync(process.env.FAKE_OPEN_ARGS, JSON.stringify(process.argv.slice(2)));
console.log("브라우저를 띄웠습니다(가짜).");
const ok = String(process.env.FAKE_OPEN_OK ?? "").split(",").map((s) => s.trim()).filter(Boolean);
for (const n of ok) console.log(`  ✓ ${n} 로그인 확인`);
console.log("창을 닫고 세션을 저장합니다…");
