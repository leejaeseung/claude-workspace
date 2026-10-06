import { useEffect, useState } from "react";
import { Alert, Pressable, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useSettingsStore } from "../store/settingsStore";
import { useAppTheme } from "../theme";

export default function SettingsScreen() {
  const { wakeWord, updateWakeWord } = useSettingsStore();
  const [draft, setDraft] = useState(wakeWord);
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();

  // 스토어의 wakeWord가 로드 완료 후 바뀌면(최초 진입 시 아직 로딩 전일 수 있음) 입력창에 반영.
  useEffect(() => {
    setDraft(wakeWord);
  }, [wakeWord]);

  const onSave = async () => {
    if (draft.trim().length === 0) {
      Alert.alert("별명을 입력해주세요.");
      return;
    }
    await updateWakeWord(draft);
    Alert.alert("저장되었습니다.", `이제 요리 모드에서 "${draft.trim()}"라고 부르면 음성 명령이 시작됩니다.`);
  };

  return (
    <View
      style={{
        flex: 1,
        padding: 16,
        paddingBottom: insets.bottom + 24,
        gap: 12,
        backgroundColor: theme.background,
      }}
    >
      <Text style={{ fontWeight: "600", color: theme.text }}>요리 모드 음성 별명(웨이크워드)</Text>
      <Text style={{ color: theme.mutedText, marginBottom: 4 }}>
        요리 모드는 항상 듣고 있지 않고, 이 별명을 부른 뒤에만 음성 명령을 받습니다.
        예: "{wakeWord}, 다음 단계"
      </Text>
      <TextInput
        value={draft}
        onChangeText={setDraft}
        placeholder="예: 셰프야"
        placeholderTextColor={theme.placeholder}
        style={{
          borderWidth: 1,
          borderColor: theme.border,
          borderRadius: 8,
          padding: 10,
          color: theme.text,
        }}
      />
      <Pressable
        onPress={onSave}
        style={{
          backgroundColor: theme.primary,
          borderRadius: 24,
          paddingVertical: 14,
          alignItems: "center",
          marginTop: 8,
        }}
      >
        <Text style={{ color: theme.primaryText, fontSize: 16 }}>저장</Text>
      </Pressable>
    </View>
  );
}
