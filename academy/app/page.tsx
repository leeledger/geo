import fs from "node:fs";
import path from "node:path";
import schema from "@/content/schema.json";

/**
 * 홈은 기존 정적 HTML 을 그대로 내보낸다.
 *
 * 왜 JSX 로 옮기지 않는가: 이 마크업은 AI 노출 측정에서 87점을 받은 결과물이다.
 * 손으로 옮기면 태그가 미묘하게 달라지고 점수가 흔들린다. 빌드 시점에 파일을 읽어
 * 그대로 심으면 출력 HTML 이 한 글자도 바뀌지 않는다.
 */
const HOME = fs.readFileSync(
  path.join(process.cwd(), "content", "home.html"),
  "utf8",
);

export default function Home() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
      />
      <div dangerouslySetInnerHTML={{ __html: HOME }} />
    </>
  );
}
