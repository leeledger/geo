# Review Feedback — Step 41 5차 (0b34146)
Date: 2026-10-10
Ready for Builder: YES

## Must Fix
- 없음.

## Should Fix
- tools/kin-find.mjs:243 (confidence: 8/10) — 캡차 일감에 적은 대체 명령이 엉뚱한 프로필을 연다. 문구는 `node tools/open-session.mjs --kin ${c.marketing.blogProfile}` 이고, 원장은 저장소 루트에서 이 명령을 친다.
  그런데 open-session.mjs:45 는 `path.resolve(process.cwd(), kp)` 로 경로를 잡는다. 루트에서 돌리면 `C:\dev\AGO&GEO\.browser-profile-docttak` 에 로그인 안 된 빈 프로필을 새로 만든다. 거기서 캡차를 풀어도 진짜 프로필 `tools\.browser-profile-docttak` 에는 남지 않는다.
  버튼 쪽은 login-poll 이 `cwd: HERE` 로 띄우니 정상이다. 대체 명령만 틀렸다. 고침은 둘 중 하나다. ① --kin 에서 `path.resolve(HERE, kp)` 로 바꾼다(HERE 가 없으면 `path.dirname(fileURLToPath(import.meta.url))`). ② 문구를 `cd tools && node open-session.mjs --kin …` 로 바꾼다. 1분짜리라 바로 고친다. pc-runner 를 다시 띄우기 전에 고친다. 웹 배포와는 관계없다.

## 지난 Must Fix — 둘 다 닫힘
- KG-41-9: open-session `--kin` 이 그 고객 프로필로 kin.naver.com 분야 102 를 연다. 로그인 확인으로 닫지 않고, 원장이 닫거나 12분이 지나면 `ctx.close()` 로 정상 종료한다. 누르는 코드는 없다. 프로필 이름은 `^\.browser-profile-[a-z0-9-]{1,40}$` 로 거르고, 학원 프로필은 막는다.
  login-core 창요청은 `kin-captcha-<slug>` 를 `{sites:["kin"]}` 로 받는다. 할 일 카드 버튼은 「지식iN 캡차 풀 창 열기」, 공급 줄도 그 버튼 이름으로 바뀌었다.
- Escalate 2: marketing-draft 의 근거(417행)와 대조표 줄에서 질문 글이 빠졌다. 프롬프트에는 「질문 숫자를 규격·한도처럼 옮겨 쓰지 않는다」가 들어갔다. 시험도 붙었다.
- 확인: test-kin 110 · test-login 56 통과 · 0 실패, web tsc 0.

## 배포 순서 (KG-41-1)
1) DDL — Git Bash 에서 아래 덩어리를 그대로 붙여 넣는다. 2) 마지막 줄이 `{ kq: 'geo.kin_questions', kr: 'geo.kin_runs', col: 1, runcols: 2 }` 인지 본다. 아니면 멈춘다. 3) 웹 배포 → 운영 /admin/ops 에서 문서딱 바깥 글 카드를 확인한다. 4) 위 Should Fix 를 고친 뒤 pc-runner 를 다시 띄운다(KG-41-7).
```
cd "/c/dev/AGO&GEO/tools" && node --input-type=module -e '
import fs from "node:fs"; import pg from "pg"; import { MARKETING_DDL } from "../web/lib/marketing-core.mjs";
for (const l of fs.readFileSync("../academy/.env.local","utf8").split(/\r?\n/)) { const m=/^([A-Z_]+)=(.*)$/.exec(l); if (m && !process.env[m[1]]) process.env[m[1]]=m[2]; }
const u=new URL(process.env.DATABASE_URL); u.searchParams.delete("sslmode");
const c=new pg.Client({connectionString:u.toString(),ssl:{rejectUnauthorized:process.env.DATABASE_SSL_INSECURE!=="true"}}); await c.connect();
for (const s of MARKETING_DDL) { await c.query(s); console.log("ok", s.split("\n")[0].slice(0,70)); }
console.log((await c.query(`select to_regclass($$geo.kin_questions$$) kq, to_regclass($$geo.kin_runs$$) kr, (select count(*) from information_schema.columns where table_schema=$$geo$$ and table_name=$$marketing_posts$$ and column_name=$$kin_question_id$$)::int col, (select count(*) from information_schema.columns where table_schema=$$geo$$ and table_name=$$kin_runs$$ and column_name in ($$status$$,$$note$$))::int runcols`)).rows[0]);
await c.end();'
```

## Escalate to Architect
- 없음.

## Cleared
0b34146 이 KG-41-9(원장이 실제로 열 수 있는 캡차 창)와 Escalate 2(질문 숫자를 근거에서 뺌)를 맞게 고쳤다. 등록 코드는 없고 시험·tsc 모두 통과다.
Step 41 is clear.
