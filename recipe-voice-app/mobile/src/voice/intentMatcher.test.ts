import { test } from "node:test";
import assert from "node:assert/strict";
import { matchCookModeIntent } from "./intentMatcher";

test("다음 단계 이동 발화", () => {
  assert.deepEqual(matchCookModeIntent("다음으로 넘겨줘"), { type: "NEXT_STEP" });
  assert.deepEqual(matchCookModeIntent("다음 단계"), { type: "NEXT_STEP" });
});

test("이전 단계 이동 발화", () => {
  assert.deepEqual(matchCookModeIntent("이전 단계로 가줘"), { type: "PREV_STEP" });
});

test("재료 안내 발화", () => {
  assert.deepEqual(matchCookModeIntent("재료 다시 알려줘"), { type: "LIST_INGREDIENTS" });
});

test("타이머 시작 발화", () => {
  assert.deepEqual(matchCookModeIntent("타이머 오분 맞춰줘"), { type: "START_TIMER", seconds: 300 });
  assert.deepEqual(matchCookModeIntent("삼십초 타이머"), { type: "START_TIMER", seconds: 30 });
});

test("매칭 실패 시 UNKNOWN", () => {
  assert.deepEqual(matchCookModeIntent("이거 얼마나 매울까"), {
    type: "UNKNOWN",
    rawText: "이거 얼마나 매울까",
  });
});
