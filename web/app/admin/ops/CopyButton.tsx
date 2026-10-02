"use client";

import { useState } from "react";

/** 본문 복사 — 지식iN·카페 글쓰기 칸에 바로 붙인다. 복사가 막힌 브라우저면 「직접 선택해 복사」로 알린다 */
export default function CopyButton({ text, label = "본문 복사" }: { text: string; label?: string }) {
  const [state, setState] = useState<"idle" | "done" | "fail">("idle");
  return (
    <button
      type="button"
      className="td-btn"
      onClick={() => {
        navigator.clipboard.writeText(text).then(
          () => setState("done"),
          () => setState("fail"),
        );
      }}
    >
      {state === "done" ? "복사됨" : state === "fail" ? "직접 선택해 복사" : label}
    </button>
  );
}
