/**
 * 유튜브 Data API v3 — 올리기·공개 범위·썸네일·실적.
 *
 * 왜 API 와 브라우저(yt-upload.mjs) 둘 다 두는가:
 *   API 는 화면이 바뀌어도 안 깨지고 PC 가 없어도(Actions) 돈다. 그런데 구글 감사(audit)를
 *   통과하지 않은 프로젝트로 올린 영상은 public 을 달라고 해도 「비공개로 잠긴다」(videos.insert 문서 배너).
 *   감사는 몇 주 걸린다. 그동안은 API 로 올리고, 잠겼으면 스튜디오 화면에서 공개로 돌린다(--studio-public).
 *   감사가 끝나면 그 단계는 저절로 안 탄다 — 응답의 privacyStatus 가 요청과 같으면 건너뛴다.
 *
 * 열쇠 (사람이 한 번):
 *   1. console.cloud.google.com → 프로젝트 → 「YouTube Data API v3」 사용 설정
 *   2. OAuth 동의 화면: 외부 · 테스트 사용자에 채널 구글 계정 → 「앱 게시(프로덕션)」
 *      테스트 상태로 두면 갱신 토큰이 7일 뒤 죽는다. 미인증 경고는 본인만 쓰니 「계속」 누르면 된다
 *   3. 사용자 인증 정보 → OAuth 클라이언트 ID → 데스크톱 앱 → JSON 받기
 *      → tools/.yt-secret/client.json 으로 저장 (저장소에 안 올라간다)
 *   4. node yt-api.mjs auth   ← 브라우저가 뜨면 채널 계정으로 허용. 갱신 토큰이 token.json 에 남는다
 *
 * 쓰기:
 *   node yt-api.mjs auth
 *   node yt-api.mjs whoami                         어느 채널로 붙었는지
 *   node yt-api.mjs upload <영상> --title "…" --desc-file d.txt [--vis public] [--thumb t.png] [--tags a,b] [--studio-public]
 *   node yt-api.mjs public <영상ID>                공개로 (API, 감사 전이면 안 될 수 있다)
 *   node yt-api.mjs stats                          최근 영상 조회수·좋아요 — 레퍼런스 기록용
 *
 * Actions 에서 쓸 때는 파일 대신 환경변수 YT_CLIENT_ID · YT_CLIENT_SECRET · YT_REFRESH_TOKEN.
 * 할당량: 하루 10,000 단위(태평양 자정 초기화). 올리기 한 번이 수백~1,600 단위라 하루 몇 편이 한계다.
 */
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { spawn, execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SECRET_DIR = path.join(HERE, ".yt-secret");
const CLIENT = path.join(SECRET_DIR, "client.json");
const TOKEN = path.join(SECRET_DIR, "token.json");
const SCOPES = [
  "https://www.googleapis.com/auth/youtube.upload",
  "https://www.googleapis.com/auth/youtube",
];

const [cmd, ...rest] = process.argv.slice(2);
const opt = (k, d) => { const i = rest.indexOf(k); return i >= 0 ? rest[i + 1] : d; };
const has = (k) => rest.includes(k);

function client() {
  if (process.env.YT_CLIENT_ID) return { id: process.env.YT_CLIENT_ID, secret: process.env.YT_CLIENT_SECRET };
  if (!fs.existsSync(CLIENT)) {
    console.log(`✗ ${CLIENT} 이 없습니다. 파일 맨 위 「열쇠」 1~3 을 먼저 해 주세요.`);
    process.exit(1);
  }
  const j = JSON.parse(fs.readFileSync(CLIENT, "utf8"));
  const c = j.installed || j.web;
  return { id: c.client_id, secret: c.client_secret };
}

async function tokenPost(body) {
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(`토큰 실패 ${r.status}: ${j.error} ${j.error_description || ""}`);
  return j;
}

async function accessToken() {
  const { id, secret } = client();
  const refresh = process.env.YT_REFRESH_TOKEN
    || (fs.existsSync(TOKEN) && JSON.parse(fs.readFileSync(TOKEN, "utf8")).refresh_token);
  if (!refresh) { console.log("✗ 갱신 토큰이 없습니다. node yt-api.mjs auth 먼저."); process.exit(1); }
  const j = await tokenPost({ client_id: id, client_secret: secret, refresh_token: refresh, grant_type: "refresh_token" });
  return j.access_token;
}

async function api(method, url, at, body) {
  const r = await fetch(url, {
    method,
    headers: { authorization: `Bearer ${at}`, ...(body ? { "content-type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`${method} ${url.split("?")[0]} → ${r.status}: ${j.error?.message || JSON.stringify(j).slice(0, 200)}`);
  return j;
}

/* 데스크톱 OAuth — 로컬 고리(loopback)로 코드를 받는다. 사람이 브라우저에서 「허용」만 누른다. */
async function auth() {
  const { id, secret } = client();
  const server = http.createServer();
  await new Promise((ok) => server.listen(0, "127.0.0.1", ok));
  const redirect = `http://127.0.0.1:${server.address().port}`;
  const url = "https://accounts.google.com/o/oauth2/v2/auth?" + new URLSearchParams({
    client_id: id, redirect_uri: redirect, response_type: "code",
    scope: SCOPES.join(" "), access_type: "offline", prompt: "consent",
  });
  console.log("\n브라우저에서 채널 구글 계정으로 「허용」을 눌러 주세요. 안 뜨면 이 주소를 여세요:\n" + url + "\n");
  spawn("cmd", ["/c", "start", "", url.replace(/&/g, "^&")], { detached: true, stdio: "ignore" }).unref();

  const code = await new Promise((ok, no) => {
    const t = setTimeout(() => no(new Error("10분 안에 허용되지 않았습니다")), 10 * 60 * 1000);
    server.on("request", (req, res) => {
      const q = new URL(req.url, redirect).searchParams;
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end(q.get("code") ? "<h2>연결됐습니다. 이 창은 닫으셔도 됩니다.</h2>" : `<h2>실패: ${q.get("error")}</h2>`);
      if (q.get("code") || q.get("error")) { clearTimeout(t); q.get("code") ? ok(q.get("code")) : no(new Error(q.get("error"))); }
    });
  });
  server.close();
  const j = await tokenPost({ client_id: id, client_secret: secret, code, redirect_uri: redirect, grant_type: "authorization_code" });
  if (!j.refresh_token) throw new Error("갱신 토큰이 안 왔습니다 (prompt=consent 인데도). 구글 계정 보안 → 제3자 앱에서 이 앱을 지우고 다시.");
  fs.mkdirSync(SECRET_DIR, { recursive: true });
  fs.writeFileSync(TOKEN, JSON.stringify({ refresh_token: j.refresh_token, scope: j.scope, saved: new Date().toISOString() }, null, 2));
  console.log(`✓ 갱신 토큰 저장: ${TOKEN}`);
  await whoami();
}

async function whoami() {
  const at = await accessToken();
  const j = await api("GET", "https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&mine=true", at);
  const c = j.items?.[0];
  if (!c) { console.log("✗ 이 계정에 채널이 없습니다"); return; }
  console.log(`채널: ${c.snippet.title} (${c.snippet.customUrl || c.id}) · 구독 ${c.statistics.subscriberCount} · 영상 ${c.statistics.videoCount}`);
}

/* 이어 올리기(resumable). 40MB 영상이면 한 번에 보내도 된다 — 끊기면 처음부터. */
async function upload() {
  const file = path.resolve(rest.find((a) => /\.(mp4|mov|webm)$/i.test(a)) || "");
  const title = opt("--title");
  if (!fs.existsSync(file) || !title) { console.log("사용법: upload <영상> --title \"…\" --desc-file d.txt"); process.exit(1); }
  const vis = (opt("--vis", "public")).toLowerCase();
  const desc = opt("--desc-file") ? fs.readFileSync(opt("--desc-file"), "utf8").replace(/\r/g, "") : "";
  const tags = opt("--tags") ? opt("--tags").split(",").map((s) => s.trim()).filter(Boolean) : undefined;
  const at = await accessToken();
  const size = fs.statSync(file).size;

  const meta = {
    snippet: { title, description: desc, tags, categoryId: "27", defaultLanguage: "ko", defaultAudioLanguage: "ko" }, // 27 = 교육
    status: { privacyStatus: vis, selfDeclaredMadeForKids: false, embeddable: true },
  };
  const init = await fetch("https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status", {
    method: "POST",
    headers: {
      authorization: `Bearer ${at}`, "content-type": "application/json; charset=UTF-8",
      "x-upload-content-length": String(size), "x-upload-content-type": "video/*",
    },
    body: JSON.stringify(meta),
  });
  if (!init.ok) throw new Error(`올리기 시작 실패 ${init.status}: ${(await init.text()).slice(0, 300)}`);
  const loc = init.headers.get("location");
  console.log(`  올리는 중 ${(size / 1024 / 1024).toFixed(1)}MB …`);
  const put = await fetch(loc, { method: "PUT", headers: { "content-length": String(size), "content-type": "video/*" }, body: fs.readFileSync(file) });
  const v = await put.json();
  if (!put.ok) throw new Error(`올리기 실패 ${put.status}: ${JSON.stringify(v).slice(0, 300)}`);
  console.log(`✓ 올림: https://youtu.be/${v.id}  (요청 ${vis} → 받은 ${v.status?.privacyStatus})`);

  if (opt("--thumb")) {
    const img = fs.readFileSync(opt("--thumb"));
    const r = await fetch(`https://www.googleapis.com/upload/youtube/v3/thumbnails/set?videoId=${v.id}`, {
      method: "POST", headers: { authorization: `Bearer ${at}`, "content-type": "image/png" }, body: img,
    });
    // 썸네일은 채널 「고급 기능」(전화 인증)이 켜져야 된다. 실패해도 영상은 올라가 있다
    console.log(r.ok ? "  썸네일 ✓" : `  썸네일 ✗ ${r.status} — 채널 고급 기능(전화 인증)을 확인`);
  }

  if (vis === "public" && v.status?.privacyStatus !== "public") {
    console.log("  ! 감사 전 프로젝트라 비공개로 잠겼습니다.");
    if (has("--studio-public")) {
      console.log("  스튜디오 화면에서 공개로 돌립니다 …");
      execFileSync("node", [path.join(HERE, "yt-upload.mjs"), "--set-public", v.id], { stdio: "inherit", cwd: HERE });
    } else {
      console.log(`  공개하려면: node yt-upload.mjs --set-public ${v.id}`);
    }
  }
  fs.appendFileSync(path.join(HERE, "yt-uploads.jsonl"),
    JSON.stringify({ id: v.id, title, file: path.basename(file), at: new Date().toISOString(), privacy: v.status?.privacyStatus }) + "\n");
  return v.id;
}

async function setPublic(id) {
  const at = await accessToken();
  const cur = await api("GET", `https://www.googleapis.com/youtube/v3/videos?part=status&id=${id}`, at);
  if (!cur.items?.length) throw new Error("영상을 못 찾았습니다: " + id);
  const status = { ...cur.items[0].status, privacyStatus: "public" };
  const j = await api("PUT", "https://www.googleapis.com/youtube/v3/videos?part=status", at, { id, status });
  console.log(`${id} → ${j.status.privacyStatus}`);
}

async function stats() {
  const at = await accessToken();
  const ch = await api("GET", "https://www.googleapis.com/youtube/v3/channels?part=contentDetails&mine=true", at);
  const up = ch.items[0].contentDetails.relatedPlaylists.uploads;
  const pl = await api("GET", `https://www.googleapis.com/youtube/v3/playlistItems?part=contentDetails&maxResults=25&playlistId=${up}`, at);
  const ids = pl.items.map((i) => i.contentDetails.videoId).join(",");
  if (!ids) { console.log("영상 없음"); return; }
  const vs = await api("GET", `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics,status&id=${ids}`, at);
  const day = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });
  for (const v of vs.items) {
    const s = v.statistics;
    console.log(`${day}  ${v.id}  조회 ${s.viewCount ?? "-"} · 좋아요 ${s.likeCount ?? "-"} · 댓글 ${s.commentCount ?? "-"}  ${v.status.privacyStatus}  ${v.snippet.title}`);
  }
}

try {
  if (cmd === "auth") await auth();
  else if (cmd === "whoami") await whoami();
  else if (cmd === "upload") await upload();
  else if (cmd === "public") await setPublic(rest[0]);
  else if (cmd === "stats") await stats();
  else { console.log("명령: auth · whoami · upload · public <ID> · stats   (파일 맨 위 설명 참고)"); process.exit(1); }
} catch (e) {
  console.log("✗ " + e.message);
  process.exit(1);
}
