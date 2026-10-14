/**
 * 자동으로 도는 브라우저 일을 가볍게 — 그림·영상·글꼴을 안 받는다.
 * 이 일들은 글자·링크·버튼만 읽고 누른다. 받아도 쓰지 않는 것이 CPU·메모리·대역폭을 문다(2026-10-14 PC 멈춤 뒤).
 * 글을 올리는 일(naver-blog-post 등 편집기)에는 걸지 않는다 — 미리보기·업로드가 그림을 다룬다.
 *
 *   import { 가볍게 } from "./lean-browser.mjs";
 *   await 가볍게(ctx);   // BrowserContext 또는 Page
 */
const 안받음 = new Set(["image", "media", "font"]);

export const 가볍게 = (ctx) =>
  ctx.route("**/*", (r) => (안받음.has(r.request().resourceType()) ? r.abort() : r.continue()));
