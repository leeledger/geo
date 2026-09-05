/**
 * 네이버 블로그 → academy.posts 이관.
 *
 * RSS 로 글 목록·날짜를 받고, 각 글의 모바일 페이지를 컴포넌트 순서대로 걸으며
 * 문단·소제목·이미지·구분선을 그대로 옮긴다. 이미지는 우리 도메인으로 내려받는다
 * (네이버 주소를 그대로 걸면 리퍼러 차단으로 깨지고, 남의 서버에 의존하게 된다).
 *
 * 왜 옮기는가: 네이버는 robots.txt 로 GPTBot·ClaudeBot·PerplexityBot 을 전부 막는다.
 * 즉 지금까지 쓴 글은 AI 에게 존재하지 않는 문서다. 열린 지면에 한 벌 두면 그때부터 읽힌다.
 *
 * 사용: node scripts/import-naver.mjs force11 [--dry]
 */
import { Pool } from "pg";
import fs from "node:fs";
import path from "node:path";
import { slugify } from "../lib/romanize.mjs";

const BLOG_ID = process.argv[2] || "force11";
const DRY = process.argv.includes("--dry");
const IMG_DIR = path.join(process.cwd(), "public", "blog");

try {
  for (const l of fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8").split(/\r?\n/)) {
    const m = /^([A-Z_]+)=(.*)$/.exec(l);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
} catch {}

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125 Safari/537.36";

async function get(url, bin) {
  const r = await fetch(url, {
    headers: { "user-agent": UA, referer: "https://m.blog.naver.com/" },
  });
  if (!r.ok) throw new Error(r.status + " " + url);
  return bin ? Buffer.from(await r.arrayBuffer()) : r.text();
}

/** HTML 엔티티를 푼다. 이걸 안 하면 본문에 &#x27; 가 그대로 박힌다. */
function unent(x) {
  return x
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

const text = (x) =>
  unent(x.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, ""))
    .replace(/​/g, "")
    .replace(/[ \t]+/g, " ")
    .trim();

const cdata = (s, tag) => {
  const open = "<" + tag + ">";
  const close = "</" + tag + ">";
  const a = s.indexOf(open);
  if (a < 0) return "";
  const b = s.indexOf(close, a + open.length);
  if (b < 0) return "";
  let v = s.slice(a + open.length, b).trim();
  if (v.startsWith("<![CDATA[") && v.endsWith("]]>")) v = v.slice(9, -3);
  return v.trim();
};

/** 본문 영역만 잘라낸다 — 사이드바·추천글이 섞이면 안 된다 */
function bodyRegion(html) {
  const a = html.indexOf("se-main-container");
  return a < 0 ? html : html.slice(a);
}

/** 컴포넌트를 문서 순서대로 쪼갠다 */
function components(html) {
  const out = [];
  const re = /<div class="se-component (se-[a-z]+)[^"]*"[^>]*>/g;
  let m;
  let prev = null;
  while ((m = re.exec(html))) {
    if (prev) out.push({ kind: prev.kind, html: html.slice(prev.at, m.index) });
    prev = { kind: m[1], at: m.index };
  }
  if (prev) out.push({ kind: prev.kind, html: html.slice(prev.at, prev.at + 60000) });
  return out;
}

/** 텍스트 컴포넌트 → 문단 배열. 소제목은 ## 로 올린다. */
function textBlocks(chunk, title) {
  const TAIL =
    /상담\s*및\s*문의|문의\/?상담|카카오|카톡|pf\.kakao|02-422-0525|블로그\s*이웃|공감.*댓글|^Instagram$/;
  const paras = [...chunk.matchAll(/<p class="se-text-paragraph[^"]*"[^>]*>([\s\S]*?)<\/p>/g)];
  const out = [];
  let buf = [];
  const ends = (t) => /(다|요|죠|까|네|음|함|임)[.!?]?$|[.!?…:]$/.test(t);
  const flush = () => {
    const t = buf.join(" ").replace(/\s+/g, " ").trim();
    if (t.length > 1) out.push(t);
    buf = [];
  };
  for (const m of paras) {
    const raw = m[1];
    const t = text(raw);
    if (!t) continue;
    if (TAIL.test(t)) break;
    if (title && t.replace(/^\[[^\]]*\]\s*/, "") === title) continue;

    // 큰 글씨이거나, 짧은데 전부 굵은 줄이면 소제목으로 본다
    const big = /se-fs-fs(19|21|24|28|30|32)\b/.test(raw);
    const bold = /<b[ >]|font-weight:\s*(bold|[7-9]00)/.test(raw);
    if ((big || (bold && t.length <= 40)) && t.length <= 48) {
      flush();
      out.push("## " + t.replace(/^\d+\.\s*/, "").replace(/^\*+|\*+$/g, ""));
      continue;
    }

    buf.push(t);
    const cur = buf.join(" ").length;
    if ((ends(t) && cur >= 110) || cur > 360) flush();
  }
  flush();
  return out;
}

/** 이미지 컴포넌트 → 원본 주소. 썸네일(?type=)이 아니라 data-linkdata 의 src 를 쓴다. */
function imageUrl(chunk) {
  const ld = /data-linkdata='([^']+)'/.exec(chunk);
  if (ld) {
    try {
      const j = JSON.parse(unent(ld[1]));
      // 원본 주소는 쿼리 없이 부르면 404 다. w966 이 현재 최대 폭이다.
      if (j.src) return j.src.split("?")[0] + "?type=w966";
    } catch {}
  }
  const lazy = /data-lazy-src="([^"]+)"/.exec(chunk);
  if (lazy) return unent(lazy[1]).split("?")[0] + "?type=w966";
  return null;
}

async function saveImage(url, slug, n) {
  const clean = url.split("?")[0];
  const ext = (/\.(jpe?g|png|gif|webp)$/i.exec(clean)?.[1] || "jpg").toLowerCase();
  const dir = path.join(IMG_DIR, slug);
  const file = n + "." + (ext === "jpeg" ? "jpg" : ext);
  const abs = path.join(dir, file);
  const web = "/blog/" + slug + "/" + file;
  if (fs.existsSync(abs)) return web;
  const buf = await get(url, true);
  if (buf.length < 900) throw new Error("too small");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(abs, buf);
  return web;
}

async function fetchBody(logNo, title, slug) {
  const html = bodyRegion(await get("https://m.blog.naver.com/" + BLOG_ID + "/" + logNo));
  const blocks = [];
  let n = 0;
  let imgs = 0;
  const alt = title.replace(/[\[\]()]/g, "").trim();

  for (const c of components(html)) {
    if (c.kind === "se-text") {
      for (const b of textBlocks(c.html, title)) blocks.push(b);
    } else if (c.kind === "se-image") {
      const u = imageUrl(c.html);
      if (!u) continue;
      try {
        const web = await saveImage(u, slug, n + 1);
        n++;
        imgs++;
        blocks.push("![" + alt + "](" + web + ")");
      } catch {}
    } else if (c.kind === "se-horizontal") {
      if (blocks.length) blocks.push("---");
    } else if (c.kind === "se-quotation") {
      const t = text(c.html);
      if (t) blocks.push("> " + t);
    }
    // se-oglink · se-places · se-document 는 외부 카드라 옮기지 않는다
  }
  while (blocks.length && blocks[blocks.length - 1] === "---") blocks.pop();
  return { body: blocks.join("\n\n"), imgs };
}

const rss = await get("https://rss.blog.naver.com/" + BLOG_ID + ".xml");
const items = [...rss.matchAll(/<item>([\s\S]*?)<\/item>/g)].map((m) => m[1]);
console.log("RSS 에서 " + items.length + "개 글을 찾았습니다.");

const posts = [];
for (const [i, it] of items.entries()) {
  const title = cdata(it, "title");
  const link = cdata(it, "link");
  const logNo = /\/(\d+)/.exec(link)?.[1];
  const pubDate = new Date(cdata(it, "pubDate"));
  const category = cdata(it, "category") || "학원소식";
  if (!logNo) continue;
  const slug = slugify(title, "post-" + logNo);

  let body = "";
  let imgs = 0;
  try {
    const r = await fetchBody(logNo, title, slug);
    body = r.body;
    imgs = r.imgs;
  } catch (e) {
    console.log("  본문 실패 " + title + ": " + e.message);
  }
  const textOnly = body.replace(/!\[[^\]]*\]\([^)]*\)/g, "").trim();
  if (textOnly.length < 40) body = text(cdata(it, "description")) + (body ? "\n\n" + body : "");

  const summary = body
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/^##\s*/gm, "")
    .replace(/^---$/gm, "")
    .replace(/[*`>]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 150);

  posts.push({
    slug,
    title,
    summary: summary + (summary.length >= 150 ? "…" : ""),
    body,
    category,
    published_at: pubDate.toISOString(),
    source_url: link.split("?")[0],
  });
  console.log(
    "  " + String(i + 1).padStart(2) + ". " + title.slice(0, 34).padEnd(34) +
    String(body.length).padStart(6) + "자 · 사진 " + imgs,
  );
}

posts.sort((a, b) => new Date(a.published_at) - new Date(b.published_at));

if (DRY) {
  fs.writeFileSync("naver-posts.json", JSON.stringify(posts, null, 2));
  console.log("\n미리보기 저장: naver-posts.json (" + posts.length + "개)");
  process.exit(0);
}

const u = new URL(process.env.DATABASE_URL);
u.searchParams.delete("sslmode");
const pool = new Pool({
  connectionString: u.toString(),
  ssl: { rejectUnauthorized: process.env.DATABASE_SSL_INSECURE !== "true" },
});

for (const p of posts) {
  await pool.query(
    "insert into academy.posts (slug,title,summary,body,category,tags,published,published_at,source_url,updated_at)" +
      " values ($1,$2,$3,$4,$5,'{}',true,$6,$7,now())" +
      " on conflict (slug) do update set title=excluded.title, summary=excluded.summary," +
      " body=excluded.body, category=excluded.category, published_at=excluded.published_at," +
      " source_url=excluded.source_url, updated_at=now()",
    [p.slug, p.title, p.summary, p.body, p.category, p.published_at, p.source_url],
  );
}
const { rows } = await pool.query("select count(*)::int n from academy.published_posts");
console.log("\n이관 완료: " + posts.length + "개 저장 · 현재 공개 글 " + rows[0].n + "개");
await pool.end();
