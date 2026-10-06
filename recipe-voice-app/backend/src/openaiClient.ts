import OpenAI from "openai";

let client: OpenAI | null = null;

/**
 * OpenAI SDK는 생성 시점에 API 키가 없으면 즉시 예외를 던진다.
 * 모듈 스코프에서 `new OpenAI()`를 하면 STT_PROVIDER=google이거나 음성 기능을 전혀
 * 안 쓰는 요청(레시피 CRUD 등)에서도 OPENAI_API_KEY가 없으면 서버 자체가 기동하지 못한다.
 * 그래서 최초 실제 사용 시점까지 생성을 미룬다.
 */
export function getOpenAiClient(): OpenAI {
  if (!client) {
    client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return client;
}
