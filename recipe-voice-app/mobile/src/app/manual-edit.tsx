import { useState } from "react";
import { Alert, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { createRecipe, Ingredient, Step } from "../db/recipeQueries";
import { useAppTheme } from "../theme";

export default function ManualEditScreen() {
  const [title, setTitle] = useState("");
  const [ingredients, setIngredients] = useState<Ingredient[]>([
    { name: "", quantity: null, unit: null },
  ]);
  const [steps, setSteps] = useState<Step[]>([{ text: "", timerSeconds: null }]);
  const [tags, setTags] = useState("");
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();

  const onSave = async () => {
    if (title.trim().length === 0) {
      Alert.alert("제목을 입력해주세요.");
      return;
    }
    await createRecipe({
      title: title.trim(),
      source: "manual",
      ingredients: ingredients.filter((ing) => ing.name.trim().length > 0),
      steps: steps.filter((step) => step.text.trim().length > 0),
      tags: tags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
    });
    router.dismissTo("/");
  };

  const inputStyle = {
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 8,
    padding: 10,
    color: theme.text,
  };

  return (
    <ScrollView
      contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24, gap: 16 }}
      style={{ flex: 1, backgroundColor: theme.background }}
    >
      <View>
        <Text style={{ fontWeight: "600", marginBottom: 4, color: theme.text }}>제목</Text>
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder="예: 김치찌개"
          placeholderTextColor={theme.placeholder}
          style={inputStyle}
        />
      </View>

      <View>
        <Text style={{ fontWeight: "600", marginBottom: 4, color: theme.text }}>재료</Text>
        {ingredients.map((ing, index) => (
          <View key={index} style={{ flexDirection: "row", gap: 6, marginBottom: 6 }}>
            <TextInput
              value={ing.name}
              onChangeText={(value) =>
                setIngredients((prev) =>
                  prev.map((row, i) => (i === index ? { ...row, name: value } : row))
                )
              }
              placeholder="재료명"
              placeholderTextColor={theme.placeholder}
              style={[inputStyle, { flex: 2, padding: 8 }]}
            />
            <TextInput
              value={ing.quantity?.toString() ?? ""}
              onChangeText={(value) =>
                setIngredients((prev) =>
                  prev.map((row, i) =>
                    i === index ? { ...row, quantity: value ? Number(value) : null } : row
                  )
                )
              }
              placeholder="수량"
              placeholderTextColor={theme.placeholder}
              keyboardType="numeric"
              style={[inputStyle, { flex: 1, padding: 8 }]}
            />
            <TextInput
              value={ing.unit ?? ""}
              onChangeText={(value) =>
                setIngredients((prev) =>
                  prev.map((row, i) => (i === index ? { ...row, unit: value } : row))
                )
              }
              placeholder="단위"
              placeholderTextColor={theme.placeholder}
              style={[inputStyle, { flex: 1, padding: 8 }]}
            />
          </View>
        ))}
        <Pressable
          onPress={() =>
            setIngredients((prev) => [...prev, { name: "", quantity: null, unit: null }])
          }
        >
          <Text style={{ color: theme.primary }}>+ 재료 추가</Text>
        </Pressable>
      </View>

      <View>
        <Text style={{ fontWeight: "600", marginBottom: 4, color: theme.text }}>조리 순서</Text>
        {steps.map((step, index) => (
          <TextInput
            key={index}
            value={step.text}
            onChangeText={(value) =>
              setSteps((prev) => prev.map((row, i) => (i === index ? { ...row, text: value } : row)))
            }
            placeholder={`${index + 1}단계`}
            placeholderTextColor={theme.placeholder}
            multiline
            style={[inputStyle, { marginBottom: 6 }]}
          />
        ))}
        <Pressable onPress={() => setSteps((prev) => [...prev, { text: "", timerSeconds: null }])}>
          <Text style={{ color: theme.primary }}>+ 순서 추가</Text>
        </Pressable>
      </View>

      <View>
        <Text style={{ fontWeight: "600", marginBottom: 4, color: theme.text }}>
          태그 (쉼표로 구분)
        </Text>
        <TextInput
          value={tags}
          onChangeText={setTags}
          placeholderTextColor={theme.placeholder}
          style={inputStyle}
        />
      </View>

      <Pressable
        onPress={onSave}
        style={{
          backgroundColor: theme.primary,
          borderRadius: 24,
          paddingVertical: 14,
          alignItems: "center",
        }}
      >
        <Text style={{ color: theme.primaryText, fontSize: 16 }}>저장</Text>
      </Pressable>
    </ScrollView>
  );
}
