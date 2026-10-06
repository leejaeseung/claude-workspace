import { useCallback, useState } from "react";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useLocalSearchParams } from "expo-router";
import { getRecipeById, RecipeDetail } from "../../../db/recipeQueries";
import { useAppTheme } from "../../../theme";

/** 요리 모드에서 "재료 보기" 버튼으로 넘어오는 전용 재료 확인 화면. */
export default function IngredientsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [recipe, setRecipe] = useState<RecipeDetail | null>(null);
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();

  useFocusEffect(
    useCallback(() => {
      if (!id) return;
      getRecipeById(id).then(setRecipe);
    }, [id])
  );

  if (!recipe) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: theme.background,
        }}
      >
        <ActivityIndicator color={theme.primary} />
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24, gap: 10 }}
      style={{ flex: 1, backgroundColor: theme.background }}
    >
      <Text style={{ fontSize: 20, fontWeight: "700", color: theme.text, marginBottom: 6 }}>
        {recipe.title}
      </Text>
      {recipe.ingredients.length === 0 ? (
        <Text style={{ color: theme.mutedText }}>등록된 재료가 없습니다.</Text>
      ) : (
        recipe.ingredients.map((ing, index) => (
          <Text key={index} style={{ fontSize: 18, color: theme.text }}>
            • {ing.name}
            {ing.quantity ? ` ${ing.quantity}${ing.unit ?? ""}` : ing.unit ? ` ${ing.unit}` : ""}
          </Text>
        ))
      )}
    </ScrollView>
  );
}
