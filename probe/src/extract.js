/**
 * 구조화 추출.
 *
 * 답변 원문 → 고정 스키마 JSON. 문자열 매칭이 아니라 모델 추출을 쓰는 이유:
 * "더존", "더존비즈온", "Douzone", "위하고", "iCUBE" 가 전부 같은 회사이고,
 * "이카운트 말고 다른 걸 추천한다" 같은 부정 언급을 언급으로 세면 안 되기 때문.
 *
 * strict tool use 로 스키마를 강제한다 (additionalProperties:false + required).
 * 그래도 실패할 수 있으므로 텍스트에서 JSON 을 건져 올리는 폴백을 둔다 —
 * 추출 실패를 "언급 0건"으로 조용히 기록하면 결과 전체가 왜곡된다.
 */

const EXTRACT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["brands", "answer_kind"],
  properties: {
    answer_kind: {
      type: "string",
      enum: ["recommends_brands", "explains_only", "refuses_or_deflects"],
      description: "답변이 구체적 브랜드를 제시했는지, 일반론만 말했는지, 회피했는지",
    },
    brands: {
      type: "array",
      description: "답변에 등장한 제품/회사. 등장 순서대로. 부정적으로만 언급된 것도 포함하되 stance 로 구분",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "position", "stance"],
        properties: {
          name: { type: "string", description: "답변에 쓰인 표기 그대로" },
          position: { type: "integer", description: "답변 안에서 몇 번째로 등장했는가. 1부터" },
          stance: {
            type: "string",
            enum: ["endorsed", "listed", "dismissed"],
            description: "endorsed=명시적 추천, listed=단순 나열, dismissed=부적합하다고 언급",
          },
          attributes: {
            type: "array",
            items: { type: "string" },
            description: "그 브랜드에 붙은 속성어. 예: 가성비, 제조업특화, 비쌈",
          },
        },
      },
    },
  },
};

const SYSTEM = `너는 AI 답변에서 브랜드 언급을 추출하는 파서다.
- 답변 원문에 실제로 등장한 것만 추출한다. 추론하거나 보완하지 않는다.
- position 은 답변 텍스트에서 처음 등장한 순서다.
- "A보다는 B가 낫다"에서 A는 dismissed, B는 endorsed 다.
- 일반 명사(ERP, 그룹웨어, 클라우드)는 브랜드가 아니다. 제외한다.
- 브랜드가 하나도 없으면 brands 를 빈 배열로 둔다.`;

export async function extractMentions(answerText, opts = {}) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY 가 설정되지 않았습니다");

  // 추출은 내부 처리 단계라 측정 대상 모델과 분리한다.
  // EXTRACT_MODEL=claude-haiku-4-5 로 바꾸면 이 단계 비용이 크게 줄어든다 (품질은 직접 검증할 것).
  const model = opts.model || process.env.EXTRACT_MODEL || "claude-opus-5";

  if (!answerText || !answerText.trim()) {
    return { answer_kind: "refuses_or_deflects", brands: [], _extract_status: "empty_input" };
  }

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      system: SYSTEM,
      messages: [{ role: "user", content: `<answer>\n${answerText}\n</answer>\n\n위 답변에서 브랜드 언급을 추출해 record_mentions 를 호출해라.` }],
      tools: [
        {
          name: "record_mentions",
          description: "답변에서 추출한 브랜드 언급을 기록한다",
          input_schema: EXTRACT_SCHEMA,
          strict: true,
        },
      ],
      tool_choice: { type: "tool", name: "record_mentions" },
    }),
    signal: AbortSignal.timeout(opts.timeoutMs ?? 180_000),
  });

  if (!res.ok) {
    const d = await res.text();
    const e = new Error(`extract ${res.status}: ${d.slice(0, 400)}`);
    e.retryable = res.status === 429 || res.status >= 500;
    throw e;
  }

  const json = await res.json();
  const block = (json.content ?? []).find((b) => b.type === "tool_use");

  if (block) {
    return { ...block.input, _extract_status: "ok", _extract_usage: json.usage };
  }

  // 폴백: 텍스트에서 JSON 블록 건지기
  const text = (json.content ?? []).filter((b) => b.type === "text").map((b) => b.text).join("");
  const m = text.match(/\{[\s\S]*\}/);
  if (m) {
    try {
      return { ...JSON.parse(m[0]), _extract_status: "fallback_parse" };
    } catch { /* 아래로 */ }
  }

  // 실패를 성공(언급 0건)으로 위장하지 않는다.
  return { answer_kind: null, brands: [], _extract_status: "FAILED", _raw_text: text.slice(0, 500) };
}

/* ───────────────────── 브랜드 정규화 (별칭 → canonical id) ───────────────────── */

export function buildResolver(brandUniverse) {
  // 긴 별칭부터 매칭해야 "더존"이 "더존비즈온"을 먼저 잡아먹지 않는다.
  const entries = [];
  for (const b of brandUniverse) {
    for (const alias of [b.name, ...(b.aliases ?? [])]) {
      entries.push({ id: b.id, alias: alias.toLowerCase().replace(/\s+/g, "") });
    }
  }
  entries.sort((a, b) => b.alias.length - a.alias.length);

  return function resolve(rawName) {
    if (!rawName) return null;
    const n = rawName.toLowerCase().replace(/\s+/g, "");
    for (const e of entries) {
      if (n.includes(e.alias)) return e.id;
    }
    return null; // 유니버스 밖 브랜드. 집계에서 "기타"로 따로 센다.
  };
}
