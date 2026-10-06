import { extractTimerSeconds, stripParticlesAndEndings } from "../shared/koreanNormalize";

export type CookModeIntent =
  | { type: "NEXT_STEP" }
  | { type: "PREV_STEP" }
  | { type: "REPEAT_STEP" }
  | { type: "LIST_INGREDIENTS" }
  | { type: "START_TIMER"; seconds: number }
  | { type: "UNKNOWN"; rawText: string };

interface KeywordRule {
  keywords: string[];
  build: (text: string) => CookModeIntent;
}

// 우선순위 순서: 타이머처럼 숫자를 포함하는 규칙을 먼저 검사해야
// "오분 뒤에 다음 단계로" 같은 복합 발화에서 오분류를 줄일 수 있다.
const RULES: KeywordRule[] = [
  {
    keywords: ["타이머", "분", "초"],
    build: (text) => {
      const seconds = extractTimerSeconds(text);
      return seconds !== null
        ? { type: "START_TIMER", seconds }
        : { type: "UNKNOWN", rawText: text };
    },
  },
  {
    keywords: ["다음", "넘겨", "다음 단계", "다음으로"],
    build: () => ({ type: "NEXT_STEP" }),
  },
  {
    keywords: ["이전", "전 단계", "뒤로"],
    build: () => ({ type: "PREV_STEP" }),
  },
  {
    // "재료"를 포함한 발화("재료 다시 알려줘")가 REPEAT_STEP의 "다시"에 먼저 걸리지 않도록
    // 더 구체적인 규칙을 일반적인 "다시" 규칙보다 먼저 검사한다.
    keywords: ["재료", "재료 알려", "재료 다시"],
    build: () => ({ type: "LIST_INGREDIENTS" }),
  },
  {
    keywords: ["다시", "한번 더", "재요청"],
    build: () => ({ type: "REPEAT_STEP" }),
  },
];

/**
 * 온디바이스 STT 최종 결과 텍스트를 요리 모드 인텐트로 매칭한다.
 * 매칭에 실패하면 UNKNOWN을 반환하고, 호출부에서 온라인 LLM 폴백(/api/voice/intent)으로 넘겨야 한다.
 */
export function matchCookModeIntent(rawText: string): CookModeIntent {
  const normalized = stripParticlesAndEndings(rawText);

  for (const rule of RULES) {
    const hit = rule.keywords.some((keyword) => normalized.includes(keyword));
    if (hit) {
      const intent = rule.build(normalized);
      if (intent.type !== "UNKNOWN") return intent;
    }
  }

  return { type: "UNKNOWN", rawText };
}
