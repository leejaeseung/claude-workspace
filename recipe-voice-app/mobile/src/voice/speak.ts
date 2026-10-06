import * as Speech from "expo-speech";

/**
 * 앱 전역에서 TTS 속도/언어를 통일해서 쓰기 위한 래퍼.
 * 기본 속도(rate: 1.0)가 요리 중 귀로 알아듣기엔 다소 빨라서 살짝 낮췄다.
 * "조금만 느리게" 요청에 대한 1차 값이라 더 느리게/빠르게 원하면 이 값만 바꾸면 된다.
 */
export function speak(text: string, options?: Speech.SpeechOptions): void {
  Speech.speak(text, { language: "ko-KR", rate: 0.8, ...options });
}

interface SpeakableIngredient {
  name: string;
  quantity: number | null;
  unit: string | null;
}

/**
 * 재료 하나를 TTS로 읽기 좋은 문구로 만든다. 화면 표기(숫자 그대로)와 달리,
 * "0.5"처럼 TTS가 "영 점 오"로 어색하게 읽는 값은 사람이 실제로 말하는 "반"으로 바꾼다.
 * DB에 저장된 수량 자체는 그대로 두고 말할 때만 다르게 표현한다.
 */
export function formatIngredientForSpeech(ing: SpeakableIngredient): string {
  if (ing.quantity === null) {
    return ing.unit ? `${ing.name} ${ing.unit}` : ing.name;
  }
  const quantityText = ing.quantity === 0.5 ? "반" : String(ing.quantity);
  return `${ing.name} ${quantityText}${ing.unit ?? ""}`;
}
