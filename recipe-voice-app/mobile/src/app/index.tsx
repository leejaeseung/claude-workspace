import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";
import { useRecipeStore } from "../store/recipeStore";
import { recognizeOnce, requestSpeechPermissions } from "../voice/onDeviceRecognizer";
import { useAppTheme } from "../theme";

export default function RecipeListScreen() {
  const { recipes, isLoading, search } = useRecipeStore();
  const [isVoiceSearching, setIsVoiceSearching] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const inputValueRef = useRef(inputValue);
  const insets = useSafeAreaInsets();
  const isFirstRender = useRef(true);
  const theme = useAppTheme();

  useEffect(() => {
    inputValueRef.current = inputValue;
  }, [inputValue]);

  // 음성/직접 입력 화면에서 dismissTo("/")로 돌아왔을 때도 최신 목록이 보이도록
  // 마운트 시 1회가 아니라 화면에 포커스될 때마다 새로 불러오되, 현재 검색어(ref로 읽음)를
  // 유지한 채로 다시 조회한다. deps를 [search]로 고정해 타이핑할 때마다(inputValue가 바뀔 때마다)
  // 콜백 아이덴티티가 바뀌어 이 포커스 이펙트까지 함께 재실행되는 것을 막는다 — 그러면 아래
  // 디바운스와 이중으로 쿼리가 나가 버린다.
  useFocusEffect(
    useCallback(() => {
      search(inputValueRef.current);
    }, [search])
  );

  // 타이핑 중인 값은 즉시 입력창에 반영하되, 실제 DB 검색(SQLite 쿼리)은 타이핑이
  // 멈춘 뒤에만 실행해 키 입력마다 쿼리가 나가는 것을 막는다. 최초 마운트 시에는 위
  // 포커스 이펙트가 이미 같은 검색을 실행하므로 한 번 더 중복 실행하지 않는다.
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    const timer = setTimeout(() => {
      search(inputValue);
    }, 300);
    return () => clearTimeout(timer);
  }, [inputValue, search]);

  const onVoiceSearch = async () => {
    const granted = await requestSpeechPermissions();
    if (!granted) {
      Alert.alert("마이크 권한 필요", "음성 검색을 사용하려면 마이크 권한을 허용해주세요.");
      return;
    }
    setIsVoiceSearching(true);
    try {
      const transcript = await recognizeOnce();
      setInputValue(transcript);
      await search(transcript);
    } catch (error) {
      Alert.alert("음성 인식 실패", "다시 시도하거나 텍스트로 검색해주세요.");
    } finally {
      setIsVoiceSearching(false);
    }
  };

  return (
    <View style={{ flex: 1, padding: 16, gap: 12, backgroundColor: theme.background }}>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <TextInput
          placeholder="레시피 검색 (예: 김치찌개)"
          placeholderTextColor={theme.placeholder}
          value={inputValue}
          onChangeText={setInputValue}
          style={{
            flex: 1,
            borderWidth: 1,
            borderColor: theme.border,
            borderRadius: 8,
            paddingHorizontal: 12,
            paddingVertical: 8,
            color: theme.text,
          }}
        />
        <Pressable
          onPress={onVoiceSearch}
          disabled={isVoiceSearching}
          style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            backgroundColor: isVoiceSearching ? theme.mutedText : theme.primary,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {isVoiceSearching ? (
            <ActivityIndicator color={theme.primaryText} />
          ) : (
            <Text style={{ color: theme.primaryText, fontSize: 18 }}>🎤</Text>
          )}
        </Pressable>
      </View>

      {/*
        직접 입력 버튼은 안드로이드 시스템 내비게이션(제스처 바/뒤로가기 버튼)과 겹치지 않도록
        화면 하단이 아니라 검색바 바로 아래(상단)에 둔다.
      */}
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Pressable
          onPress={() => router.push("/manual-edit")}
          style={{
            paddingHorizontal: 16,
            paddingVertical: 10,
            borderRadius: 20,
            backgroundColor: theme.primary,
          }}
        >
          <Text style={{ color: theme.primaryText, fontWeight: "600" }}>+ 레시피 추가</Text>
        </Pressable>
        <Pressable
          onPress={() => router.push("/settings")}
          style={{
            paddingHorizontal: 14,
            paddingVertical: 10,
            borderRadius: 20,
            backgroundColor: theme.secondarySurface,
          }}
        >
          <Text style={{ color: theme.secondaryText }}>⚙ 설정</Text>
        </Pressable>
      </View>

      {isLoading ? (
        <ActivityIndicator color={theme.primary} />
      ) : (
        <FlatList
          data={recipes}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
          ListEmptyComponent={
            <Text style={{ textAlign: "center", marginTop: 40, color: theme.mutedText }}>
              등록된 레시피가 없습니다. 위 + 버튼으로 추가해보세요.
            </Text>
          }
          renderItem={({ item }) => (
            <Pressable
              onPress={() => router.push(`/recipe/${item.id}`)}
              style={{
                paddingVertical: 14,
                borderBottomWidth: 1,
                borderBottomColor: theme.border,
                flexDirection: "row",
                justifyContent: "space-between",
              }}
            >
              <Text style={{ fontSize: 16, color: theme.text }}>
                {item.isFavorite ? "★ " : ""}
                {item.title}
              </Text>
              {item.totalTimeMinutes ? (
                <Text style={{ color: theme.mutedText }}>{item.totalTimeMinutes}분</Text>
              ) : null}
            </Pressable>
          )}
        />
      )}
    </View>
  );
}
