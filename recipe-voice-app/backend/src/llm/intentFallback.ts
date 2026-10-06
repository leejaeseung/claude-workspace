import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import { getOpenAiClient } from "../openaiClient";

const MODEL = process.env.OPENAI_INTENT_MODEL ?? "gpt-4o-mini";

const IntentSchema = z.object({
  type: z.enum(["NEXT_STEP", "PREV_STEP", "REPEAT_STEP", "LIST_INGREDIENTS", "START_TIMER", "UNKNOWN"]),
  seconds: z.number().nullable(),
});

const SYSTEM_PROMPT = `사용자는 요리 중 손을 쓰지 못해 음성으로 레시피 앱을 조작합니다.
로컬 키워드 매처가 이미 해석하지 못한 발화만 여기로 전달됩니다. 다음 중 하나로 분류하세요:
- NEXT_STEP: 다음 조리 단계로 이동
- PREV_STEP: 이전 조리 단계로 이동
- REPEAT_STEP: 현재 단계를 다시 안내
- LIST_INGREDIENTS: 재료 목록을 다시 안내
- START_TIMER: 타이머 시작 (seconds 필드에 초 단위 정수를 채우세요)
- UNKNOWN: 위 어느 것에도 해당하지 않음
START_TIMER가 아니면 seconds는 null로 두세요.`;

export interface IntentResult {
  type: "NEXT_STEP" | "PREV_STEP" | "REPEAT_STEP" | "LIST_INGREDIENTS" | "START_TIMER" | "UNKNOWN";
  seconds: number | null;
}

export async function inferIntentFromText(text: string): Promise<IntentResult> {
  const response = await getOpenAiClient().responses.parse({
    model: MODEL,
    input: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: text },
    ],
    text: { format: zodTextFormat(IntentSchema, "cook_mode_intent") },
  });

  if (!response.output_parsed) return { type: "UNKNOWN", seconds: null };
  return response.output_parsed;
}
