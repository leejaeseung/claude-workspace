import { test } from "node:test";
import assert from "node:assert/strict";
import {
  koreanNumeralToNumber,
  normalizeUnit,
  parseQuantity,
  extractTimerSeconds,
  stripParticlesAndEndings,
  containsWakeWord,
  extractCommandAfterWakeWord,
} from "./koreanNormalize";

test("koreanNumeralToNumber: 한자어 자릿수 조합", () => {
  assert.equal(koreanNumeralToNumber("이백"), 200);
  assert.equal(koreanNumeralToNumber("삼십"), 30);
  assert.equal(koreanNumeralToNumber("오"), 5);
  assert.equal(koreanNumeralToNumber("100"), 100);
});

test("koreanNumeralToNumber: 고유어 수관형사", () => {
  assert.equal(koreanNumeralToNumber("한"), 1);
  assert.equal(koreanNumeralToNumber("두"), 2);
});

test("normalizeUnit: 표기 변이를 한글 표준 단위로 (영문 코드 사용 금지)", () => {
  assert.equal(normalizeUnit("그램"), "그램");
  assert.equal(normalizeUnit("g"), "그램");
  assert.equal(normalizeUnit("tbsp"), "큰술");
  assert.equal(normalizeUnit("tsp"), "작은술");
  assert.equal(normalizeUnit("모"), "모");
  assert.equal(normalizeUnit("대"), "대");
  assert.equal(normalizeUnit("모름단위"), "모름단위");
});

test("parseQuantity: 재료 조각에서 수량/단위 추출 (단위는 항상 한글)", () => {
  assert.deepEqual(parseQuantity("김치 이백 그램"), { quantity: 200, unit: "그램" });
  assert.deepEqual(parseQuantity("돼지고기 100g"), { quantity: 100, unit: "그램" });
  assert.deepEqual(parseQuantity("소금 약간"), { quantity: null, unit: "약간" });
  assert.deepEqual(parseQuantity("두부 한 모"), { quantity: 1, unit: "모" });
  assert.deepEqual(parseQuantity("대파 한 대"), { quantity: 1, unit: "대" });
});

test("extractTimerSeconds: 시간 표현 → 초", () => {
  assert.equal(extractTimerSeconds("오분"), 300);
  assert.equal(extractTimerSeconds("5분"), 300);
  assert.equal(extractTimerSeconds("삼십초"), 30);
  assert.equal(extractTimerSeconds("이분 삼십초"), 150);
  assert.equal(extractTimerSeconds("아무 시간 표현 없음"), null);
});

test("stripParticlesAndEndings: 조사/어미 제거", () => {
  assert.equal(stripParticlesAndEndings("다음으로 넘겨줘"), "다음 넘겨");
  assert.equal(stripParticlesAndEndings("재료 다시 알려줘"), "재료 다시");
});

test("containsWakeWord: 별명 포함 여부 (띄어쓰기 무시)", () => {
  assert.equal(containsWakeWord("시리야 다음 단계", "시리야"), true);
  assert.equal(containsWakeWord("시리 야 다음 단계", "시리야"), true);
  assert.equal(containsWakeWord("다음 단계로 넘겨줘", "시리야"), false);
  assert.equal(containsWakeWord("아무 말", ""), false);
});

test("extractCommandAfterWakeWord: 별명 뒤에 붙은 명령만 추출", () => {
  assert.equal(extractCommandAfterWakeWord("시리야 다음 단계", "시리야"), "다음 단계");
  assert.equal(extractCommandAfterWakeWord("시리야", "시리야"), null);
  assert.equal(extractCommandAfterWakeWord("시리 야 다음 단계", "시리야"), null);
});
