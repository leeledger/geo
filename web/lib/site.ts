/**
 * 사이트 기준 주소 — canonical·OG·JSON-LD·사이트맵·robots·llms.txt 가 전부 여기서 읽는다.
 *
 * 함정: PowerShell 파이프로 `vercel env add` 하면 값 앞에 BOM(U+FEFF), 뒤에 줄바꿈이 붙는다.
 * 그래서 env 를 그대로 쓰지 않고 다듬은 뒤 URL 로 검증한다. 틀리면 기본값으로 간다.
 */
export const DEFAULT_SITE_URL = "https://cited.kr";

export function cleanSiteUrl(raw: string | undefined | null): string {
  const v = (raw ?? "").replace(/^﻿/, "").trim().replace(/\/+$/, "");
  if (!v) return DEFAULT_SITE_URL;
  try {
    const u = new URL(v);
    if (u.protocol !== "https:" && u.protocol !== "http:") return DEFAULT_SITE_URL;
    return v;
  } catch {
    return DEFAULT_SITE_URL;
  }
}

export const SITE_URL = cleanSiteUrl(process.env.NEXT_PUBLIC_SITE_URL);

/** 랜딩 메타 · 레이아웃 기본값이 같이 쓴다. 39만원은 lib/services.ts PILOT.price 와 같은 사실. */
export const SITE_TITLE = "사이티드(Cited) — AI 답변에 우리 회사 이름이 나오게 하는 GEO 대행사";
export const SITE_DESCRIPTION =
  "사이티드(Cited)는 손님이 ChatGPT·Perplexity·Gemini·Claude 에 물었을 때 답에 회사 이름이 나오게 만드는 대행사입니다. 30일 파일럿 39만원. 홈페이지 주소만 넣으면 무료 진단.";

/**
 * 사이티드 정의문. 랜딩 FAQ 첫 답 · JSON-LD Organization · llms.txt 머리가 이 문장을 같이 쓴다.
 * AI 가 그대로 인용해 가는 자리라 한 곳에서만 고친다.
 */
export const CITED_ABOUT = [
  "사이티드(Cited)는 손님이 ChatGPT·Perplexity·Gemini·Claude 에 물었을 때 답에 회사 이름이 나오게 만드는 마케팅 대행사입니다.",
  "같은 질문을 날짜별로 물어 몇 번 중 몇 번 나오는지 세고, AI 가 참고하는 사이트와 비교 글을 고칩니다.",
  "학원·병원·사무소 한 곳 규모에 맞췄습니다.",
] as const;
