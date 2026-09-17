/**
 * OpenRouter 중계 토큰을 만들어 Vercel(geo)·GitHub Secrets 에 넣고 geo 를 재배포한다.
 * 비밀 값 쓰기라 사람이 직접 돌린다.  node tools/set-llm-proxy.mjs
 *
 * 값은 화면에 안 찍는다. 셸 파이프를 안 쓴다 — PowerShell 파이프는 BOM·줄바꿈을 값에 붙인다 (CLAUDE.md 함정)
 */
import crypto from "node:crypto";
import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const web = path.join(root, "web");
const token = crypto.randomBytes(32).toString("hex");
const run = (cmd, cwd, input) => {
  console.log(`> ${cmd}`);
  execSync(cmd, { cwd, input, stdio: [input === undefined ? "inherit" : "pipe", "inherit", "inherit"] });
};

// 이미 있으면 지우고 다시 넣는다
try { execSync("npx vercel env rm LLM_PROXY_TOKEN production --yes", { cwd: web, stdio: "ignore" }); } catch {}
run("npx vercel env add LLM_PROXY_TOKEN production", web, token);
run("gh secret set LLM_PROXY_TOKEN", root, token);
run("gh secret set LLM_PROXY_URL", root, "https://geo-rose-nine.vercel.app/api/llm");
// 환경변수는 새 배포부터 읽힌다. OPENROUTER_API_KEY 도 이 배포에서 처음 읽힌다
// geo 의 Root Directory 가 web 이라 저장소 루트에서 프로젝트를 지정해 올린다. web 안에서 돌리면 web/web 을 찾는다
process.env.VERCEL_ORG_ID = "team_MzcL6JOfHV8vy0lPrPOqMODP";
process.env.VERCEL_PROJECT_ID = "prj_lOaeEBbMy19hlb6ooP46f7idRWYN";
run("npx vercel --prod --yes", root);
console.log("\n끝났습니다. Claude 에게 「토큰 넣었어」라고 말하면 루프를 돌려 확인합니다.");
