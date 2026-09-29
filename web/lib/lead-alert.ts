/**
 * 새 상담 신청 메일 한 통(원장 2026-09-30 「메일로 받기」, Step 28 D27).
 *
 * Resend HTTP API. RESEND_API_KEY·LEAD_ALERT_TO 둘 다 있을 때만 보낸다 — 없으면 조용히 건너뛴다(키는 원장이 만든다).
 * 메일에는 개인정보를 싣지 않는다: 이름 첫 글자+**, 연락처 끝 4자리, 관리 화면 링크. 나머지는 관리 화면에서 본다.
 * 보내는 주소는 Resend 기본(onboarding@resend.dev) — 도메인 인증 없이 계정 주인에게만 간다. 받는 사람이 원장 본인이라 충분하다.
 * 실패해도 던지지 않는다. 리드 저장은 이미 끝났다.
 */

export function leadAlertBody(lead: { name: string | null; phone: string | null }, adminUrl: string): string {
  const name = lead.name ? `${[...lead.name.trim()][0]}**` : "(이름 안 남김)";
  const digits = String(lead.phone ?? "").replace(/\D/g, "");
  const phone = digits.length >= 4 ? `끝자리 ${digits.slice(-4)}` : digits.length ? "(번호가 짧음 — 관리 화면에서 확인)" : "(전화 안 남김)";
  return `새 상담 신청이 들어왔습니다.\n\n이름: ${name}\n연락처: ${phone}\n\n자세한 내용은 관리 화면에서 봅니다: ${adminUrl}`;
}

export async function sendLeadAlert(lead: { name: string | null; phone: string | null }, adminUrl: string): Promise<void> {
  const key = process.env.RESEND_API_KEY?.trim();
  const to = process.env.LEAD_ALERT_TO?.trim();
  if (!key || !to) return;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: "Cited <onboarding@resend.dev>", to: [to], subject: "새 상담 신청", text: leadAlertBody(lead, adminUrl) }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) console.error("lead-alert", res.status);
  } catch (e) {
    console.error("lead-alert", e instanceof Error ? e.message : "error");
  }
}
