"use client";

import { useEffect, useState } from "react";

/**
 * 지금 시각과 다음 근무를 보여주고, 스스로 새로고침한다.
 *
 * 서버에서 시각을 그리면 배포된 순간에 멈춘 시계가 된다.
 * "실시간으로 보인다"는 말이 성립하려면 이 부분은 브라우저가 해야 한다.
 */

type Slot = { at: string; name: string; team: string; dow?: number };

export default function Live({ slots }: { slots: Slot[] }) {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 1000);
    // 5분마다 서버 데이터를 다시 받는다. 숫자가 늙지 않게.
    const r = setInterval(() => window.location.reload(), 300000);
    return () => { clearInterval(t); clearInterval(r); };
  }, []);

  // 서버 렌더 때는 자리만 잡아 둔다 (하이드레이션 불일치 방지)
  if (!now) return <div className="ops-live"><div className="ops-clock mono">--:--:--</div></div>;

  const kst = new Date(now.getTime() + 9 * 3600000);
  const mins = kst.getUTCHours() * 60 + kst.getUTCMinutes();
  const dow = kst.getUTCDay();

  const parsed = slots.map((s) => {
    const [h, m] = s.at.split(":").map(Number);
    return { ...s, mins: h * 60 + m };
  });

  const upcoming = Array.from({ length: 8 }, (_, days) => parsed
    .filter((s) => s.dow === undefined || s.dow === (dow + days) % 7)
    .map((s) => ({ ...s, gap: days * 1440 + s.mins - mins })))
    .flat().filter((s) => s.gap > 0).sort((a, b) => a.gap - b.gap);
  const next = upcoming[0];
  const gap = next?.gap ?? 0;

  return (
    <div className="ops-live">
      <div className="ops-clock mono">
        {String(kst.getUTCHours()).padStart(2, "0")}:
        {String(kst.getUTCMinutes()).padStart(2, "0")}:
        {String(kst.getUTCSeconds()).padStart(2, "0")}
      </div>
      {next && (
        <div className="ops-next">
          다음 예정 <b>{next.name}</b>
          <span className="mono"> {next.at}</span>
          <span className="ops-gap">{Math.floor(gap / 60)}시간 {gap % 60}분 뒤</span>
        </div>
      )}
    </div>
  );
}
