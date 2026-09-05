/**
 * 한글 → 로마자 (국어의 로마자 표기법 기반, 슬러그용 단순화).
 *
 * 왜 필요한가: 한글 슬러그는 주소창에서 퍼센트 인코딩되어 150자를 넘긴다.
 * 카카오톡·문자로 옮길 때 깨지고, AI 가 인용할 때도 주소가 잘린다.
 * 발음이 정확할 필요는 없다 — 짧고 안정적이고 사람이 대충 읽을 수 있으면 된다.
 */
const CHO = ["g","kk","n","d","tt","r","m","b","pp","s","ss","","j","jj","ch","k","t","p","h"];
const JUNG = ["a","ae","ya","yae","eo","e","yeo","ye","o","wa","wae","oe","yo","u","weo","we","wi","yu","eu","ui","i"];
const JONG = ["","k","k","k","n","n","n","t","l","l","l","l","l","l","l","l","m","p","p","t","t","ng","t","t","k","t","p","t"];

export function romanize(s) {
  let out = "";
  for (const ch of s) {
    const c = ch.codePointAt(0);
    if (c >= 0xac00 && c <= 0xd7a3) {
      const n = c - 0xac00;
      out += CHO[Math.floor(n / 588)] + JUNG[Math.floor((n % 588) / 28)] + JONG[n % 28];
    } else out += ch;
  }
  return out;
}

/** 제목 → 주소 조각. 너무 길면 앞쪽 단어만 남긴다 — 주소는 짧을수록 인용된다. */
export function slugify(title, fallback = "") {
  let s = romanize(String(title))
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  if (s.length > 52) {
    const parts = s.split("-");
    s = "";
    for (const p of parts) {
      if (s.length + p.length + 1 > 52) break;
      s = s ? s + "-" + p : p;
    }
  }
  return s || fallback || `post-${Date.now()}`;
}
