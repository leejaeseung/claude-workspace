import { useCallback, useEffect, useRef, useState } from "react";
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from "expo-speech-recognition";

const LANG_KO = "ko-KR";

export type OnDeviceSupport = "unknown" | "supported" | "unsupported";

/**
 * 앱 시작 시 1회 확인: 이 기기가 한국어 온디바이스 인식을 지원하는지.
 * 미지원이면 호출부에서 온라인 인식으로 폴백하거나 텍스트 입력 UI로 안내해야 한다.
 */
export function checkOnDeviceSupport(): OnDeviceSupport {
  try {
    const supported = ExpoSpeechRecognitionModule.supportsOnDeviceRecognition();
    return supported ? "supported" : "unsupported";
  } catch {
    return "unsupported";
  }
}

export async function requestSpeechPermissions(): Promise<boolean> {
  const result = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
  return result.granted;
}

/**
 * 음성 검색용 단발성 인식. 최종 발화 텍스트 하나를 resolve한다.
 * 온디바이스 인식이 가능하면 우선 시도하고, 실패 시 온라인 인식으로 한 번 더 시도한다.
 */
export function recognizeOnce(options?: { timeoutMs?: number }): Promise<string> {
  const timeoutMs = options?.timeoutMs ?? 8000;
  const preferOnDevice = checkOnDeviceSupport() === "supported";

  return new Promise((resolve, reject) => {
    let settled = false;
    let usedOnlineFallback = false;

    const resultSub = ExpoSpeechRecognitionModule.addListener("result", (event) => {
      if (!event.isFinal) return;
      const transcript = event.results[0]?.transcript ?? "";
      if (transcript.trim().length === 0) return;
      settle(() => resolve(transcript));
    });

    const errorSub = ExpoSpeechRecognitionModule.addListener("error", (event) => {
      if (preferOnDevice && !usedOnlineFallback) {
        usedOnlineFallback = true;
        ExpoSpeechRecognitionModule.stop();
        ExpoSpeechRecognitionModule.start({
          lang: LANG_KO,
          interimResults: false,
          requiresOnDeviceRecognition: false,
        });
        return;
      }
      settle(() => reject(new Error(`speech_recognition_error:${event.error}`)));
    });

    const timer = setTimeout(() => {
      settle(() => reject(new Error("speech_recognition_timeout")));
    }, timeoutMs);

    function settle(action: () => void) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resultSub.remove();
      errorSub.remove();
      ExpoSpeechRecognitionModule.stop();
      action();
    }

    ExpoSpeechRecognitionModule.start({
      lang: LANG_KO,
      interimResults: false,
      requiresOnDeviceRecognition: preferOnDevice,
    });
  });
}

export interface UseCookModeRecognitionOptions {
  enabled: boolean;
  onFinalTranscript: (text: string) => void;
}

export interface UseCookModeRecognitionResult {
  isListening: boolean;
  lastError: string | null;
  onDeviceSupport: OnDeviceSupport;
}

/**
 * 요리 모드 핸즈프리 탐색을 위한 연속 인식 훅.
 * expo-speech-recognition의 continuous 모드는 기기/OS에 따라 무기한 유지되지 않을 수 있어,
 * "end" 이벤트를 받으면 enabled인 동안 즉시 재시작하는 루프로 상시 리스닝을 흉내낸다.
 */
export function useCookModeRecognition({
  enabled,
  onFinalTranscript,
}: UseCookModeRecognitionOptions): UseCookModeRecognitionResult {
  const [isListening, setIsListening] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const onDeviceSupportRef = useRef<OnDeviceSupport>("unknown");
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  const startSession = useCallback(() => {
    if (onDeviceSupportRef.current === "unknown") {
      onDeviceSupportRef.current = checkOnDeviceSupport();
    }
    ExpoSpeechRecognitionModule.start({
      lang: LANG_KO,
      continuous: true,
      interimResults: true,
      requiresOnDeviceRecognition: onDeviceSupportRef.current === "supported",
    });
    setIsListening(true);
  }, []);

  useSpeechRecognitionEvent("result", (event) => {
    if (!event.isFinal) return;
    const transcript = event.results[0]?.transcript ?? "";
    if (transcript.trim().length > 0) onFinalTranscript(transcript);
  });

  useSpeechRecognitionEvent("error", (event) => {
    setLastError(event.error);
  });

  useSpeechRecognitionEvent("end", () => {
    setIsListening(false);
    // enabled 상태가 계속 유지되는 동안에만 즉시 재시작한다 (배터리 보호를 위해
    // 사용자가 요리 모드를 벗어나면(enabled=false) 재시작하지 않음).
    if (enabledRef.current) startSession();
  });

  useEffect(() => {
    if (enabled) {
      startSession();
    } else {
      ExpoSpeechRecognitionModule.stop();
    }
    return () => {
      // enabledRef는 렌더 중에만 갱신되므로, 컴포넌트가 언마운트될 때는 리렌더가 일어나지
      // 않아 true로 남아있을 수 있다. stop()이 비동기로 발생시키는 "end" 이벤트가 그 값을
      // 보고 재시작을 걸지 않도록 여기서 먼저 false로 내려준다 (요리 모드 이탈 후 마이크가
      // 계속 켜져 있는 문제 방지).
      enabledRef.current = false;
      ExpoSpeechRecognitionModule.stop();
    };
  }, [enabled, startSession]);

  return { isListening, lastError, onDeviceSupport: onDeviceSupportRef.current };
}
