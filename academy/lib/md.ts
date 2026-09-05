/**
 * 아주 작은 마크다운 → HTML 변환기.
 *
 * 라이브러리를 쓰지 않는 이유: 이 결과물은 AI 크롤러가 읽는 본문이다.
 * 필요한 것은 문단·제목·목록·인용·코드뿐이고, 그 이상은 오히려 구조를 흐린다.
 * 서버에서만 돌고 입력은 관리자가 쓴 글이지만, 그래도 HTML 은 전부 이스케이프한 뒤
 * 허용한 문법만 되살린다.
 */
const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** 인라인: **굵게** `코드` [글자](주소) */
function inline(s: string): string {
  return esc(s)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>")
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g,
      '<a href="$2" rel="noopener">$1</a>');
}

export function renderMarkdown(src: string): string {
  const lines = src.replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  let para: string[] = [];
  let list: { type: "ul" | "ol"; items: string[] } | null = null;
  let code: string[] | null = null;

  const flushPara = () => {
    if (!para.length) return;
    out.push(`<p>${inline(para.join(" "))}</p>`);
    para = [];
  };
  const flushList = () => {
    if (!list) return;
    out.push(`<${list.type}>${list.items.map((i) => `<li>${inline(i)}</li>`).join("")}</${list.type}>`);
    list = null;
  };
  const flushAll = () => { flushPara(); flushList(); };

  for (const raw of lines) {
    const line = raw.trimEnd();

    if (code !== null) {
      if (line.trim().startsWith("```")) {
        out.push(`<pre><code>${esc(code.join("\n"))}</code></pre>`);
        code = null;
      } else code.push(raw);
      continue;
    }
    if (line.trim().startsWith("```")) { flushAll(); code = []; continue; }

    if (!line.trim()) { flushAll(); continue; }

    // 이미지 한 줄 — 네이버에서 옮겨온 사진이 이 형태로 들어온다
    const im = /^!\[([^\]]*)\]\(([^)\s]+)\)$/.exec(line.trim());
    if (im) {
      flushAll();
      out.push(
        `<figure class="pimg"><img src="${esc(im[2])}" alt="${esc(im[1])}" loading="lazy" decoding="async"></figure>`,
      );
      continue;
    }
    if (/^-{3,}$/.test(line.trim())) { flushAll(); out.push("<hr>"); continue; }

    const h = /^(#{2,4})\s+(.*)$/.exec(line);
    if (h) {
      flushAll();
      const lv = h[1].length; // ## → h2
      out.push(`<h${lv}>${inline(h[2])}</h${lv}>`);
      continue;
    }

    const ul = /^[-*]\s+(.*)$/.exec(line);
    if (ul) {
      flushPara();
      if (list?.type !== "ul") { flushList(); list = { type: "ul", items: [] }; }
      list.items.push(ul[1]);
      continue;
    }
    const ol = /^\d+\.\s+(.*)$/.exec(line);
    if (ol) {
      flushPara();
      if (list?.type !== "ol") { flushList(); list = { type: "ol", items: [] }; }
      list.items.push(ol[1]);
      continue;
    }
    const bq = /^>\s?(.*)$/.exec(line);
    if (bq) { flushAll(); out.push(`<blockquote><p>${inline(bq[1])}</p></blockquote>`); continue; }

    flushList();
    para.push(line.trim());
  }
  if (code !== null) out.push(`<pre><code>${esc(code.join("\n"))}</code></pre>`);
  flushAll();
  return out.join("\n");
}

/** 목록·검색결과용 요약. 요약이 비어 있을 때만 쓴다. */
export function excerpt(src: string, n = 160): string {
  const t = src
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/^#{2,4}\s+/gm, "")
    .replace(/[*`>\[\]]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return t.length <= n ? t : t.slice(0, n).replace(/\s\S*$/, "") + "…";
}
