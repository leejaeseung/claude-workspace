import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useKeepAwake } from "expo-keep-awake";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { getRecipeById, RecipeDetail } from "../../../db/recipeQueries";
import { useCookModeStore } from "../../../store/cookModeStore";
import { useSettingsStore } from "../../../store/settingsStore";
import { useCookModeRecognition } from "../../../voice/onDeviceRecognizer";
import { matchCookModeIntent, CookModeIntent } from "../../../voice/intentMatcher";
import { fetchIntentFallback } from "../../../voice/intentFallback";
import { formatIngredientForSpeech, speak } from "../../../voice/speak";
import { containsWakeWord, extractCommandAfterWakeWord } from "../../../shared/koreanNormalize";

// 별명으로 깨운 뒤 명령을 기다리는 시간. 이 시간 안에 말이 없으면 다시 별명을 불러야 한다.
const AWAKE_WINDOW_MS = 8000;

export default function CookModeScreen() {
  useKeepAwake();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [recipe, setRecipe] = useState<RecipeDetail | null>(null);
  const [isAwake, setIsAwake] = useState(false);
  // handleTranscript는 useSpeechRecognitionEvent 구독 시점의 클로저로 호출되므로,
  // isAwake state를 직접 참조하면 setIsAwake 직후 도착하는 발화가 갱신 전 값을 볼 수 있다
  // (enabledRef와 동일한 문제). 게이트 판단은 항상 ref로 하고, state는 화면 표시용으로만 쓴다.
  const isAwakeRef = useRef(false);
  // headerShown: false라 상단 상태바/하단 안드로이드 제스처 바 영역을 이 화면이 직접 비워줘야 한다.
  const insets = useSafeAreaInsets();
  const wakeWord = useSettingsStore((s) => s.wakeWord);
  const sleepTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const wake = useCallback(() => {
    isAwakeRef.current = true;
    setIsAwake(true);
  }, []);

  const sleep = useCallback(() => {
    isAwakeRef.current = false;
    setIsAwake(false);
  }, []);

  const { currentStepIndex, totalSteps, timerSecondsLeft, init, next, prev, startTimer, tickTimer, clearTimer } =
    useCookModeStore();

  useFocusEffect(
    useCallback(() => {
      if (!id) return;
      getRecipeById(id).then((detail) => {
        setRecipe(detail);
        if (detail) init(detail.steps.length);
      });
    }, [id, init])
  );

  const scheduleSleep = useCallback(() => {
    if (sleepTimerRef.current) clearTimeout(sleepTimerRef.current);
    sleepTimerRef.current = setTimeout(sleep, AWAKE_WINDOW_MS);
  }, [sleep]);

  useEffect(() => {
    return () => {
      if (sleepTimerRef.current) clearTimeout(sleepTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (timerSecondsLeft === null) return;
    if (timerSecondsLeft === 0) {
      speak("타이머가 끝났습니다.");
      clearTimer();
      return;
    }
    const timeout = setTimeout(tickTimer, 1000);
    return () => clearTimeout(timeout);
  }, [timerSecondsLeft, tickTimer, clearTimer]);

  const speakIngredients = useCallback(() => {
    if (!recipe) return;
    const text = recipe.ingredients.map(formatIngredientForSpeech).join(", ");
    speak(text.length > 0 ? text : "등록된 재료가 없습니다.");
  }, [recipe]);

  const speakCurrentStep = useCallback(() => {
    if (!recipe) return;
    const step = recipe.steps[currentStepIndex];
    if (step) speak(step.text);
  }, [recipe, currentStepIndex]);

  const applyIntent = useCallback(
    (resolved: CookModeIntent) => {
      switch (resolved.type) {
        case "NEXT_STEP":
          next();
          break;
        case "PREV_STEP":
          prev();
          break;
        case "REPEAT_STEP":
          speakCurrentStep();
          break;
        case "LIST_INGREDIENTS":
          speakIngredients();
          break;
        case "START_TIMER":
          startTimer(resolved.seconds);
          speak(`${formatDurationForSpeech(resolved.seconds)} 타이머를 시작합니다.`);
          break;
        case "UNKNOWN":
          speak("이해하지 못했어요. 다시 말씀해주세요.");
          break;
      }
    },
    [next, prev, speakCurrentStep, speakIngredients, startTimer]
  );

  const processCommand = useCallback(
    async (text: string) => {
      const intent = matchCookModeIntent(text);
      const resolved = intent.type === "UNKNOWN" ? await tryOnlineFallback(text) : intent;
      applyIntent(resolved);
    },
    [applyIntent]
  );

  // 항상 듣고 있는 게 아니라, 별명(웨이크워드)을 부르기 전까지는 들리는 말을 전부 무시한다.
  // 별명을 부르면 짧은 시간(AWAKE_WINDOW_MS) 동안만 실제 명령으로 처리하고, 그 뒤엔 다시 잠든다.
  const handleTranscript = useCallback(
    async (text: string) => {
      if (!isAwakeRef.current) {
        if (!containsWakeWord(text, wakeWord)) return;

        wake();
        scheduleSleep();

        const remainder = extractCommandAfterWakeWord(text, wakeWord);
        if (remainder) {
          await processCommand(remainder);
          scheduleSleep();
        } else {
          speak("네, 말씀하세요.");
        }
        return;
      }

      await processCommand(text);
      scheduleSleep();
    },
    [wakeWord, wake, processCommand, scheduleSleep]
  );

  const { isListening, onDeviceSupport } = useCookModeRecognition({
    enabled: true,
    onFinalTranscript: handleTranscript,
  });

  if (!recipe) return null;

  const currentStep = recipe.steps[currentStepIndex];

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: "#111827",
        paddingHorizontal: 24,
        paddingTop: insets.top + 16,
        paddingBottom: insets.bottom + 16,
        justifyContent: "space-between",
      }}
    >
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
        <View style={{ flex: 1, marginRight: 12 }}>
          <Text style={{ color: "#9ca3af", fontSize: 14 }}>
            {onDeviceSupport === "unsupported"
              ? "⚠️ 이 기기는 오프라인 음성 인식을 지원하지 않아 온라인 인식으로 동작합니다."
              : !isAwake
                ? `😴 "${wakeWord}"라고 불러주세요`
                : isListening
                  ? "🎙 듣고 있어요 — \"다음\", \"이전\", \"재료 알려줘\", \"타이머 5분\""
                  : "잠시 대기 중..."}
          </Text>
          {timerSecondsLeft !== null && (
            <Text style={{ color: "#fbbf24", fontSize: 20, marginTop: 8 }}>
              ⏱ {Math.floor(timerSecondsLeft / 60)}:{String(timerSecondsLeft % 60).padStart(2, "0")}
            </Text>
          )}
        </View>
        {/* 음성 명령("재료 알려줘")과 별개로, 눈으로 직접 재료를 확인할 수 있는 명시적인 이동 버튼. */}
        <Pressable
          onPress={() => router.push(`/recipe/${id}/ingredients`)}
          style={{
            paddingHorizontal: 14,
            paddingVertical: 8,
            borderRadius: 16,
            backgroundColor: "#374151",
          }}
        >
          <Text style={{ color: "#fff", fontSize: 13 }}>📋 재료 보기</Text>
        </Pressable>
      </View>

      <View>
        <Text style={{ color: "#6b7280", fontSize: 16, marginBottom: 12 }}>
          {currentStepIndex + 1} / {totalSteps}
        </Text>
        <Text style={{ color: "#fff", fontSize: 28, lineHeight: 38 }}>{currentStep?.text}</Text>
      </View>

      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <Pressable
          onPress={prev}
          style={{ paddingHorizontal: 24, paddingVertical: 16, borderRadius: 24, backgroundColor: "#374151" }}
        >
          <Text style={{ color: "#fff" }}>← 이전</Text>
        </Pressable>
        <Pressable
          onPress={next}
          style={{ paddingHorizontal: 24, paddingVertical: 16, borderRadius: 24, backgroundColor: "#2563eb" }}
        >
          <Text style={{ color: "#fff" }}>다음 →</Text>
        </Pressable>
      </View>
    </View>
  );
}

async function tryOnlineFallback(text: string): Promise<CookModeIntent> {
  try {
    return await fetchIntentFallback(text);
  } catch {
    return { type: "UNKNOWN" as const, rawText: text };
  }
}

/** Math.round(seconds/60)는 20초 같은 짧은 타이머를 "0분"으로 말해버려 60초 미만은 초 단위로 안내한다. */
function formatDurationForSpeech(totalSeconds: number): string {
  if (totalSeconds < 60) return `${totalSeconds}초`;
  const minutes = Math.round(totalSeconds / 60);
  return `${minutes}분`;
}
