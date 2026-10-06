import { API_BASE_URL } from "../api/client";
import { CookModeIntent } from "./intentMatcher";

interface RawIntentResponse {
  type: "NEXT_STEP" | "PREV_STEP" | "REPEAT_STEP" | "LIST_INGREDIENTS" | "START_TIMER" | "UNKNOWN";
  seconds: number | null;
}

/**
 * 로컬 결정적 매처가 실패한 발화만 텍스트로(오디오 아님) 서버에 보내 LLM 인텐트 추정을 받는다.
 * 네트워크가 없으면 그대로 실패하며, 호출부는 실패 시 "다시 말씀해주세요" 안내로 대체해야 한다.
 */
export async function fetchIntentFallback(rawText: string): Promise<CookModeIntent> {
  // RN/Hermes 런타임에 AbortSignal.timeout 정적 메서드가 없을 수 있어 수동으로 구현한다.
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 4000);

  let raw: RawIntentResponse;
  try {
    const response = await fetch(`${API_BASE_URL}/api/voice/intent`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: rawText }),
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`intent_fallback_failed:${response.status}`);
    raw = (await response.json()) as RawIntentResponse;
  } finally {
    clearTimeout(timeoutId);
  }

  // 서버 응답을 그대로 캐스팅하지 않는다 — 백엔드 IntentResult는 모든 타입에 seconds:number|null을
  // 두지만, 모바일의 CookModeIntent는 START_TIMER에만 seconds를 요구하고 UNKNOWN에는 rawText를
  // 요구한다. 특히 모델이 START_TIMER인데 seconds를 못 채워 null로 보내는 경우를 여기서 걸러내지
  // 않으면 cook.tsx가 "null초 타이머" 같은 TTS를 말하게 된다.
  switch (raw.type) {
    case "NEXT_STEP":
      return { type: "NEXT_STEP" };
    case "PREV_STEP":
      return { type: "PREV_STEP" };
    case "REPEAT_STEP":
      return { type: "REPEAT_STEP" };
    case "LIST_INGREDIENTS":
      return { type: "LIST_INGREDIENTS" };
    case "START_TIMER":
      return typeof raw.seconds === "number"
        ? { type: "START_TIMER", seconds: raw.seconds }
        : { type: "UNKNOWN", rawText };
    default:
      return { type: "UNKNOWN", rawText };
  }
}
