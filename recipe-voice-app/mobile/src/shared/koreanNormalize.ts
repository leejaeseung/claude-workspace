/**
 * 레시피 음성 입력 파싱과 핸즈프리 인텐트 매칭이 공유하는 한국어 정규화 유틸리티.
 * STT 결과 텍스트에서 수량/단위/시간을 뽑아내는 규칙 기반 파서다.
 */

const KOREAN_DIGIT: Record<string, number> = {
  영: 0,
  일: 1,
  이: 2,
  삼: 3,
  사: 4,
  오: 5,
  육: 6,
  칠: 7,
  팔: 8,
  구: 9,
};

const KOREAN_UNIT_DIGIT: Record<string, number> = {
  한: 1,
  두: 2,
  세: 3,
  네: 4,
  다섯: 5,
  여섯: 6,
  일곱: 7,
  여덜: 8,
  여덟: 8,
  아홉: 9,
  열: 10,
};

const KOREAN_MAGNITUDE: [string, number][] = [
  ["천", 1000],
  ["백", 100],
  ["십", 10],
];

/**
 * 한글 숫자 표현(고유어/한자어 혼용)을 정수로 변환한다.
 * 지원 범위: 0~9999 (레시피 재료량/타이머 용도로 충분).
 * 매칭 실패 시 null 반환.
 */
export function koreanNumeralToNumber(raw: string): number | null {
  const text = raw.trim();
  if (text.length === 0) return null;

  // 이미 아라비아 숫자인 경우
  if (/^\d+$/.test(text)) return parseInt(text, 10);

  // 고유어 수관형사 (한/두/세/네/다섯...) - 단독으로 쓰이는 경우
  if (KOREAN_UNIT_DIGIT[text] !== undefined) return KOREAN_UNIT_DIGIT[text];

  // 한자어 수 표현 (이백, 삼십, 오천 등) - 자릿수 조합
  let remaining = text;
  let total = 0;
  let matchedAny = false;

  for (const [char, value] of KOREAN_MAGNITUDE) {
    const idx = remaining.indexOf(char);
    if (idx === -1) continue;
    const prefix = remaining.slice(0, idx);
    const digit = prefix.length === 0 ? 1 : KOREAN_DIGIT[prefix];
    if (digit === undefined) return null;
    total += digit * value;
    remaining = remaining.slice(idx + 1);
    matchedAny = true;
  }

  if (remaining.length > 0) {
    const digit = KOREAN_DIGIT[remaining];
    if (digit === undefined) {
      return matchedAny ? total : null;
    }
    total += digit;
    matchedAny = true;
  }

  return matchedAny ? total : null;
}

interface UnitRule {
  pattern: RegExp;
  unit: string;
}

// 순서 중요: 더 긴/구체적인 표현을 먼저 매칭한다.
// 단위는 항상 한글 표기로 정규화한다 — TTS로 재료를 읽어줄 때 "tbsp", "count" 같은 영문 코드를
// 그대로 들려주면 발음이 어색해지므로, 표기 변이만 통일하고 개/알/장/쪽/모/대/공기 같은
// 한국어 고유의 세는 말은 서로 뭉개지 않고 그대로 살린다("두부 1모"를 "두부 1개"로 바꾸지 않음).
const UNIT_RULES: UnitRule[] = [
  { pattern: /^(그램|그람|g)$/i, unit: "그램" },
  { pattern: /^(킬로그램|kg)$/i, unit: "킬로그램" },
  { pattern: /^(밀리리터|ml)$/i, unit: "밀리리터" },
  { pattern: /^(리터|l)$/i, unit: "리터" },
  { pattern: /^(큰술|큰스푼|테이블스푼|tbsp)$/i, unit: "큰술" },
  { pattern: /^(작은술|티스푼|tsp)$/i, unit: "작은술" },
  { pattern: /^(컵|cup)$/i, unit: "컵" },
  { pattern: /^(공기)$/i, unit: "공기" },
  { pattern: /^(개)$/i, unit: "개" },
  { pattern: /^(알)$/i, unit: "알" },
  { pattern: /^(장)$/i, unit: "장" },
  { pattern: /^(쪽)$/i, unit: "쪽" },
  { pattern: /^(모)$/i, unit: "모" },
  { pattern: /^(대)$/i, unit: "대" },
  { pattern: /^(봉)$/i, unit: "봉" },
  { pattern: /^(캔)$/i, unit: "캔" },
  { pattern: /^(병)$/i, unit: "병" },
  { pattern: /^(꼬집|약간|조금)$/i, unit: "약간" },
];

/** "그램/그람/g" 같은 표기 변이를 표준 단위(항상 한글)로 정규화. 매칭 안 되면 원문 그대로 반환. */
export function normalizeUnit(raw: string): string {
  const text = raw.trim();
  for (const rule of UNIT_RULES) {
    if (rule.pattern.test(text)) return rule.unit;
  }
  return text;
}

export interface ParsedQuantity {
  quantity: number | null;
  unit: string | null;
}

/**
 * "김치 이백 그램", "돼지고기 100g", "소금 약간" 같은 "재료 수량 단위" 조각에서
 * 수량과 단위를 추출한다. 수량이 없으면(예: "약간") quantity: null.
 */
export function parseQuantity(fragment: string): ParsedQuantity {
  const trimmed = fragment.trim();

  // "약간"/"조금"/"꼬집" — 재료명 없이 단독으로 쓰이거나("약간") 재료명 뒤에 붙는 경우("소금 약간") 모두 처리.
  if (/(약간|조금|한\s*꼬집|꼬집)$/.test(trimmed)) {
    return { quantity: null, unit: "약간" };
  }

  const match = trimmed.match(
    /([\d]+(?:\.\d+)?|[가-힣]+)\s*(그램|그람|g|킬로그램|kg|밀리리터|ml|리터|l|큰술|큰스푼|테이블스푼|tbsp|작은술|티스푼|tsp|컵|cup|공기|개|알|장|쪽|모|대|봉|캔|병)/i
  );

  if (!match) return { quantity: null, unit: null };

  const [, quantityToken, unitToken] = match;
  const quantity = /^\d/.test(quantityToken)
    ? parseFloat(quantityToken)
    : koreanNumeralToNumber(quantityToken);

  return {
    quantity: quantity ?? null,
    unit: normalizeUnit(unitToken),
  };
}

/**
 * "오분", "5분", "삼십초", "30초" 같은 시간 표현을 초 단위 정수로 변환.
 * 매칭 실패 시 null.
 */
export function extractTimerSeconds(text: string): number | null {
  const minuteMatch = text.match(/([\d]+|[가-힣]+)\s*분/);
  const secondMatch = text.match(/([\d]+|[가-힣]+)\s*초/);

  let seconds = 0;
  let matched = false;

  if (minuteMatch) {
    const value = /^\d/.test(minuteMatch[1])
      ? parseInt(minuteMatch[1], 10)
      : koreanNumeralToNumber(minuteMatch[1]);
    if (value !== null) {
      seconds += value * 60;
      matched = true;
    }
  }

  if (secondMatch) {
    const value = /^\d/.test(secondMatch[1])
      ? parseInt(secondMatch[1], 10)
      : koreanNumeralToNumber(secondMatch[1]);
    if (value !== null) {
      seconds += value;
      matched = true;
    }
  }

  return matched ? seconds : null;
}

/**
 * 발화에 사용자가 설정한 별명(웨이크워드)이 포함되어 있는지 확인한다.
 * 공백만 제거하고 비교한다 — STT가 "시리야"를 "시리 야"처럼 띄어 인식해도 잡아내기 위함.
 */
export function containsWakeWord(text: string, wakeWord: string): boolean {
  const normalizedWakeWord = wakeWord.replace(/\s+/g, "");
  if (normalizedWakeWord.length === 0) return false;
  return text.replace(/\s+/g, "").includes(normalizedWakeWord);
}

/**
 * "시리야 다음 단계"처럼 한 호흡에 별명과 명령을 같이 말한 경우, 별명 뒤에 남은 명령 부분만 뽑아낸다.
 * 별명이 원문에 정확히(공백 포함) 등장하지 않으면(예: "시리 야"처럼 분리 인식된 경우) null —
 * 이 경우 호출부는 "일단 깨우기만 하고 명령은 다시 말해달라고 안내"하는 쪽으로 처리하면 된다.
 */
export function extractCommandAfterWakeWord(text: string, wakeWord: string): string | null {
  const index = text.indexOf(wakeWord);
  if (index === -1) return null;
  const remainder = text.slice(index + wakeWord.length).trim();
  return remainder.length > 0 ? remainder : null;
}

/**
 * 검색/매칭 전 전처리: 조사(을/를/이/가/은/는/에/의 등)와 흔한 종결 어미를 제거해
 * 핵심 키워드만 남긴다. 완벽한 형태소 분석이 아니라 규칙 기반 근사치다.
 */
export function stripParticlesAndEndings(text: string): string {
  return text
    .trim()
    .replace(/(으로|로|에서|까지|부터|이랑|와|과|은|는|이|가|을|를|의|에)(\s|$)/g, " ")
    .replace(/(해줘|해주세요|줘|주세요|해줄래|알려줘|알려주세요)$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
