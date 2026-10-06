import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { getRecipeById, RecipeDetail, toggleFavorite } from "../../../db/recipeQueries";
import { useAppTheme } from "../../../theme";

export default function RecipeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [recipe, setRecipe] = useState<RecipeDetail | null>(null);
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();

  const load = useCallback(async () => {
    if (!id) return;
    const detail = await getRecipeById(id);
    setRecipe(detail);
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
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
      contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24, gap: 16 }}
      style={{ flex: 1, backgroundColor: theme.background }}
    >
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Text style={{ fontSize: 22, fontWeight: "700", color: theme.text }}>{recipe.title}</Text>
        <Pressable
          onPress={async () => {
            await toggleFavorite(recipe.id);
            load();
          }}
        >
          <Text style={{ fontSize: 22, color: theme.text }}>
            {recipe.isFavorite ? "★" : "☆"}
          </Text>
        </Pressable>
      </View>

      {recipe.tags.length > 0 && (
        <Text style={{ color: theme.mutedText }}>
          {recipe.tags.map((tag) => `#${tag}`).join("  ")}
        </Text>
      )}

      <View>
        <Text style={{ fontWeight: "600", marginBottom: 8, color: theme.text }}>재료</Text>
        {recipe.ingredients.map((ing, index) => (
          <Text key={index} style={{ marginBottom: 4, color: theme.text }}>
            • {ing.name}
            {ing.quantity ? ` ${ing.quantity}${ing.unit ?? ""}` : ing.unit ? ` ${ing.unit}` : ""}
          </Text>
        ))}
      </View>

      <View>
        <Text style={{ fontWeight: "600", marginBottom: 8, color: theme.text }}>조리 순서</Text>
        {recipe.steps.map((step, index) => (
          <Text key={index} style={{ marginBottom: 6, color: theme.text }}>
            {index + 1}. {step.text}
          </Text>
        ))}
      </View>

      <Pressable
        onPress={() => router.push(`/recipe/${recipe.id}/cook`)}
        style={{
          backgroundColor: theme.primary,
          borderRadius: 24,
          paddingVertical: 14,
          alignItems: "center",
        }}
      >
        <Text style={{ color: theme.primaryText, fontSize: 16 }}>요리 시작</Text>
      </Pressable>
    </ScrollView>
  );
}
