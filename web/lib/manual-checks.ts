/** 손 확인 기록의 선택지(Step 26 D8). DB check 제약과 같은 값이다 */
export const SURFACES = [
  { key: "google_ai_overview", label: "구글 AI 개요" },
  { key: "naver_ai_briefing", label: "네이버 AI 브리핑" },
  { key: "google_ai_mode", label: "구글 AI 모드" },
];
export const SHOWN = ["이름", "링크", "안 나옴", "화면 없음"];
export const MAX_CAPTURE = 2 * 1024 * 1024;

/** 파일 머리 바이트로 이미지 형식을 가린다. PNG·JPEG·WebP 만 — 그 밖은 null */
export function imageType(b: Buffer): string | null {
  if (b.length >= 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.length >= 12 && b.subarray(0, 4).toString("latin1") === "RIFF" && b.subarray(8, 12).toString("latin1") === "WEBP") return "image/webp";
  return null;
}
